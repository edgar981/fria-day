"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toStoredDay } from "@/lib/format";
import { sessionSchema, checkInSchema } from "@/lib/validation";
import { planCheckInAdd, consolidateNewCheckIns } from "@/lib/domain";
import { deleteBlobQuietly, deleteBlobsQuietly, isOurBlobUrl } from "@/lib/blob";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/** Regla 2: solo el dueño puede tocar su sesión. */
async function assertOwner(sessionId: string, userId: string): Promise<boolean> {
  const s = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  return !!s && s.userId === userId;
}

function buildTags(
  tags: { taggedUserId?: string | null; freeText?: string | null }[],
  ownerId: string,
) {
  const seenUsers = new Set<string>();
  const out: ({ taggedUserId: string } | { freeText: string })[] = [];
  for (const t of tags) {
    if (t.taggedUserId) {
      if (t.taggedUserId === ownerId) continue; // no auto-etiqueta
      if (seenUsers.has(t.taggedUserId)) continue; // sin duplicados
      seenUsers.add(t.taggedUserId);
      out.push({ taggedUserId: t.taggedUserId });
    } else if (t.freeText && t.freeText.trim()) {
      out.push({ freeText: t.freeText.trim() });
    }
  }
  return out;
}

export async function createSession(input: unknown): Promise<Result<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  // Consolidación (A.2-5): misma cerveza+formato = una fila. La foto NO va por el
  // dominio (lo dejamos puro): consolidamos aquí el photoUrl con "el primero gana",
  // igual criterio que el rating (Pasada F). Solo aceptamos URLs de nuestro blob.
  const consolidated = consolidateNewCheckIns(
    data.checkIns.map((c) => ({
      beerId: c.beerId,
      format: c.format,
      quantity: c.quantity,
      rating: c.rating ?? null,
    })),
  );
  const photoByKey = new Map<string, string>();
  for (const c of data.checkIns) {
    const url = c.photoUrl && c.photoUrl.trim() ? c.photoUrl.trim() : null;
    if (url && isOurBlobUrl(url)) {
      const k = `${c.beerId}|${c.format}`;
      if (!photoByKey.has(k)) photoByKey.set(k, url);
    }
  }

  try {
    const session = await prisma.session.create({
      data: {
        userId,
        date: toStoredDay(data.date),
        placeName: data.placeName ? data.placeName : null,
        notes: data.notes ? data.notes : null,
        tags: { create: buildTags(data.tags, userId) },
        checkIns: {
          create: consolidated.map((c) => ({
            ...c,
            photoUrl: photoByKey.get(`${c.beerId}|${c.format}`) ?? null,
          })),
        },
      },
      select: { id: true },
    });
    revalidatePath("/");
    return { ok: true, id: session.id };
  } catch {
    return { ok: false, error: "No se pudo crear la salida" };
  }
}

export async function updateSessionHeader(input: {
  id: string;
  date: string;
  placeName?: string;
  notes?: string;
}): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };
  if (!(await assertOwner(input.id, userId)))
    return { ok: false, error: "No es tu salida" };

  const parsed = sessionSchema
    .pick({ date: true, placeName: true, notes: true })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.session.update({
    where: { id: input.id },
    data: {
      date: toStoredDay(parsed.data.date),
      placeName: parsed.data.placeName ? parsed.data.placeName : null,
      notes: parsed.data.notes ? parsed.data.notes : null,
    },
  });
  revalidatePath("/");
  revalidatePath(`/sessions/${input.id}`);
  return { ok: true };
}

export async function deleteSession(id: string): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };
  if (!(await assertOwner(id, userId)))
    return { ok: false, error: "No es tu salida" };

  // Recoge las fotos ANTES de borrar (la cascada elimina los check-ins). Blob vive
  // fuera de Postgres: hay que borrar los archivos aparte (Pasada F, huérfanos).
  const photos = await prisma.checkIn.findMany({
    where: { sessionId: id, photoUrl: { not: null } },
    select: { photoUrl: true },
  });

  await prisma.session.delete({ where: { id } }); // cascada a check-ins y tags
  // Best-effort: un fallo aquí no revierte el borrado de la salida.
  await deleteBlobsQuietly(photos.map((p) => p.photoUrl));
  revalidatePath("/");
  return { ok: true };
}

export async function addCheckIn(
  input: unknown,
): Promise<Result<{ checkInId: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  const sessionId =
    input && typeof input === "object"
      ? (input as { sessionId?: string }).sessionId
      : undefined;
  const parsed = checkInSchema.safeParse(input);
  if (!sessionId) return { ok: false, error: "Falta la salida" };
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  if (!(await assertOwner(sessionId, userId)))
    return { ok: false, error: "No es tu salida" };

  const c = parsed.data;

  // Consolida con un check-in existente de la MISMA cerveza y formato (A.2-5).
  const existing = await prisma.checkIn.findMany({
    where: { sessionId },
    select: { id: true, beerId: true, format: true, quantity: true, rating: true },
  });
  const plan = planCheckInAdd(existing, {
    beerId: c.beerId,
    format: c.format,
    quantity: c.quantity,
    rating: c.rating ?? null,
  });

  // Devolvemos el id del check-in resultante (creado o fusionado) para que el
  // cliente pueda adjuntar la foto DESPUÉS con setCheckInPhoto (Pasada F): la
  // foto nunca bloquea ni precede al registro del check-in.
  let checkInId: string;
  if (plan.action === "merge") {
    await prisma.checkIn.update({
      where: { id: plan.targetId },
      data: { quantity: plan.quantity, rating: plan.rating },
    });
    checkInId = plan.targetId;
  } else {
    const created = await prisma.checkIn.create({
      data: {
        sessionId,
        beerId: c.beerId,
        quantity: c.quantity,
        format: c.format,
        rating: c.rating ?? null,
      },
      select: { id: true },
    });
    checkInId = created.id;
  }
  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/edit`);
  return { ok: true, checkInId };
}

export async function deleteCheckIn(checkInId: string): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  const ci = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    select: { sessionId: true, photoUrl: true, session: { select: { userId: true } } },
  });
  if (!ci || ci.session.userId !== userId)
    return { ok: false, error: "No es tu salida" };

  await prisma.checkIn.delete({ where: { id: checkInId } });
  // Borra la foto asociada (best-effort; no revierte el borrado del check-in).
  await deleteBlobQuietly(ci.photoUrl);
  revalidatePath("/");
  revalidatePath(`/sessions/${ci.sessionId}`);
  revalidatePath(`/sessions/${ci.sessionId}/edit`);
  return { ok: true };
}

/** Editar SOLO el rating de un check-in (poner/quitar). Solo el dueño. */
export async function updateCheckIn(input: {
  checkInId: string;
  rating: number | null;
}): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  const rating = input.rating;
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    return { ok: false, error: "Rating inválido" };
  }

  const ci = await prisma.checkIn.findUnique({
    where: { id: input.checkInId },
    select: { sessionId: true, session: { select: { userId: true } } },
  });
  if (!ci || ci.session.userId !== userId)
    return { ok: false, error: "No es tu salida" };

  await prisma.checkIn.update({ where: { id: input.checkInId }, data: { rating } });
  revalidatePath("/");
  revalidatePath(`/sessions/${ci.sessionId}`);
  return { ok: true };
}

/**
 * Adjunta o REEMPLAZA la foto de un check-in (Pasada F). Solo el dueño de la salida.
 * La subida ya ocurrió (cliente → blob); aquí solo se guarda la URL, DESPUÉS de que
 * la subida terminó (así nunca queda una referencia rota). Al reemplazar, se borra
 * el archivo anterior (best-effort). Solo se aceptan URLs de nuestro almacén.
 */
export async function setCheckInPhoto(
  checkInId: string,
  photoUrl: string,
): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };
  if (!isOurBlobUrl(photoUrl)) return { ok: false, error: "URL de foto inválida" };

  const ci = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    select: { sessionId: true, photoUrl: true, session: { select: { userId: true } } },
  });
  if (!ci || ci.session.userId !== userId)
    return { ok: false, error: "No es tu salida" };

  await prisma.checkIn.update({ where: { id: checkInId }, data: { photoUrl } });
  // Reemplazo: borra el archivo anterior si había otro distinto.
  if (ci.photoUrl && ci.photoUrl !== photoUrl) await deleteBlobQuietly(ci.photoUrl);
  revalidatePath("/");
  revalidatePath(`/sessions/${ci.sessionId}`);
  revalidatePath(`/sessions/${ci.sessionId}/edit`);
  return { ok: true };
}

/** Quita la foto de un check-in y borra el archivo (best-effort). Solo el dueño. */
export async function removeCheckInPhoto(checkInId: string): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  const ci = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    select: { sessionId: true, photoUrl: true, session: { select: { userId: true } } },
  });
  if (!ci || ci.session.userId !== userId)
    return { ok: false, error: "No es tu salida" };

  if (ci.photoUrl) {
    await prisma.checkIn.update({ where: { id: checkInId }, data: { photoUrl: null } });
    await deleteBlobQuietly(ci.photoUrl);
  }
  revalidatePath("/");
  revalidatePath(`/sessions/${ci.sessionId}`);
  revalidatePath(`/sessions/${ci.sessionId}/edit`);
  return { ok: true };
}

export async function addTag(input: {
  sessionId: string;
  taggedUserId?: string | null;
  freeText?: string | null;
}): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };
  if (!(await assertOwner(input.sessionId, userId)))
    return { ok: false, error: "No es tu salida" };

  const [tag] = buildTags([input], userId);
  if (!tag) return { ok: false, error: "Etiqueta inválida" };

  try {
    await prisma.sessionTag.create({ data: { sessionId: input.sessionId, ...tag } });
  } catch {
    return { ok: false, error: "Esa persona ya está etiquetada" };
  }
  revalidatePath("/");
  revalidatePath(`/sessions/${input.sessionId}`);
  revalidatePath(`/sessions/${input.sessionId}/edit`);
  return { ok: true };
}

export async function removeTag(tagId: string): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  const tag = await prisma.sessionTag.findUnique({
    where: { id: tagId },
    select: { sessionId: true, session: { select: { userId: true } } },
  });
  if (!tag || tag.session.userId !== userId)
    return { ok: false, error: "No es tu salida" };

  await prisma.sessionTag.delete({ where: { id: tagId } });
  revalidatePath("/");
  revalidatePath(`/sessions/${tag.sessionId}`);
  revalidatePath(`/sessions/${tag.sessionId}/edit`);
  return { ok: true };
}

/**
 * Pasada B: el propio etiquetado marca/desmarca "no tomé". SOLO el etiquetado
 * puede tocar SU etiqueta (no el dueño). Descartada = neutra para la racha y fuera
 * del denominador de "quién falta".
 */
export async function setTagDismissed(
  tagId: string,
  dismissed: boolean,
): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  const tag = await prisma.sessionTag.findUnique({
    where: { id: tagId },
    select: { sessionId: true, taggedUserId: true },
  });
  if (!tag || tag.taggedUserId !== userId)
    return { ok: false, error: "Solo puedes descartar tu propia etiqueta" };

  await prisma.sessionTag.update({
    where: { id: tagId },
    data: { dismissedAt: dismissed ? new Date() : null },
  });
  revalidatePath("/");
  revalidatePath(`/sessions/${tag.sessionId}`);
  return { ok: true };
}
