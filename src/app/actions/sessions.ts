"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toStoredDay } from "@/lib/format";
import { sessionSchema, checkInSchema } from "@/lib/validation";
import { planCheckInAdd, consolidateNewCheckIns, yoTambienCheckIn, isReaction, canAddSessionPhoto, MAX_SESSION_PHOTOS, isValidCommentBody, canDeleteComment, MAX_COMMENT_LENGTH } from "@/lib/domain";
import { deleteBlobQuietly, deleteBlobsQuietly, isOurBlobUrl } from "@/lib/blob";
import { loadCircle } from "@/lib/queries";

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
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };

  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }
  const data = parsed.data;

  // Consolidación (A.2-5): misma cerveza+formato = una fila. Desde I-2 la foto ya no
  // va en el check-in: es de la salida (se sube desde el detalle, tabla SessionPhoto).
  const consolidated = consolidateNewCheckIns(
    data.checkIns.map((c) => ({
      beerId: c.beerId,
      format: c.format,
      quantity: c.quantity,
      rating: c.rating ?? null,
    })),
  );

  try {
    const session = await prisma.session.create({
      data: {
        userId,
        date: toStoredDay(data.date),
        placeName: data.placeName ? data.placeName : null,
        notes: data.notes ? data.notes : null,
        tags: { create: buildTags(data.tags, userId) },
        checkIns: { create: consolidated },
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
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };
  if (!(await assertOwner(input.id, userId)))
    return { ok: false, error: "No es tu salida" };

  const parsed = sessionSchema
    .pick({ date: true, placeName: true, notes: true })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
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
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };
  if (!(await assertOwner(id, userId)))
    return { ok: false, error: "No es tu salida" };

  // Recoge las fotos ANTES de borrar (la cascada elimina filas, NO toca Vercel Blob).
  // Fuente de verdad: SessionPhoto (I-2). Se incluyen también los CheckIn.photoUrl
  // legados (misma URL tras la migración; el Set evita del() duplicados).
  const [sessionPhotos, legacy] = await Promise.all([
    prisma.sessionPhoto.findMany({ where: { sessionId: id }, select: { url: true } }),
    prisma.checkIn.findMany({ where: { sessionId: id, photoUrl: { not: null } }, select: { photoUrl: true } }),
  ]);
  const urls = new Set<string>([
    ...sessionPhotos.map((p) => p.url),
    ...legacy.map((p) => p.photoUrl as string),
  ]);

  await prisma.session.delete({ where: { id } }); // cascada a check-ins, tags y fotos
  // Best-effort: un fallo aquí no revierte el borrado de la salida.
  await deleteBlobsQuietly([...urls]);
  revalidatePath("/");
  return { ok: true };
}

export async function addCheckIn(
  input: unknown,
): Promise<Result<{ checkInId: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };

  const sessionId =
    input && typeof input === "object"
      ? (input as { sessionId?: string }).sessionId
      : undefined;
  const parsed = checkInSchema.safeParse(input);
  if (!sessionId) return { ok: false, error: "Falta la salida" };
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
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
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };

  const ci = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    select: { sessionId: true, session: { select: { userId: true } } },
  });
  if (!ci || ci.session.userId !== userId)
    return { ok: false, error: "No es tu salida" };

  // I-2: la foto ya NO es del check-in (es de la salida), así que borrar una bebida no
  // borra ningún blob. Las fotos se gestionan con add/removeSessionPhoto.
  await prisma.checkIn.delete({ where: { id: checkInId } });
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
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };

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
 * Agrega una foto A LA SALIDA (Pasada I-2). Solo el dueño. La subida ya ocurrió
 * (cliente → blob); aquí se guarda la URL DESPUÉS de subir (nunca una referencia rota).
 * Tope de MAX_SESSION_PHOTOS: la que sobra se rechaza con mensaje y su blob recién
 * subido se borra (best-effort) para no dejar huérfano. `order` = orden de subida.
 */
export async function addSessionPhoto(
  sessionId: string,
  url: string,
): Promise<Result<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };
  if (!isOurBlobUrl(url)) return { ok: false, error: "URL de foto inválida" };
  if (!(await assertOwner(sessionId, userId))) return { ok: false, error: "No es tu salida" };

  const agg = await prisma.sessionPhoto.aggregate({
    where: { sessionId },
    _count: true,
    _max: { order: true },
  });
  if (!canAddSessionPhoto(agg._count)) {
    await deleteBlobQuietly(url); // el blob ya subido no se usará
    return { ok: false, error: `Máximo ${MAX_SESSION_PHOTOS} fotos por salida` };
  }

  const created = await prisma.sessionPhoto.create({
    data: { sessionId, url, order: (agg._max.order ?? -1) + 1 },
    select: { id: true },
  });
  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, id: created.id };
}

/** Quita una foto de la salida y borra el archivo (best-effort). Solo el dueño. */
export async function removeSessionPhoto(photoId: string): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };

  const p = await prisma.sessionPhoto.findUnique({
    where: { id: photoId },
    select: { url: true, sessionId: true, session: { select: { userId: true } } },
  });
  if (!p || p.session.userId !== userId)
    return { ok: false, error: "No es tu salida" };

  await prisma.sessionPhoto.delete({ where: { id: photoId } });
  await deleteBlobQuietly(p.url);
  revalidatePath("/");
  revalidatePath(`/sessions/${p.sessionId}`);
  return { ok: true };
}

/**
 * Comenta una salida (Pasada I-3). Puede comentar quien puede VERLA (dueño o círculo),
 * igual que reaccionar. Lista plana, sin editar. Devuelve id + createdAt para que el
 * cliente reconcilie el comentario optimista con la fila real.
 */
export async function addComment(
  sessionId: string,
  body: string,
): Promise<Result<{ id: string; createdAt: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };
  const text = body.trim();
  if (!isValidCommentBody(text))
    return { ok: false, error: `El comentario va de 1 a ${MAX_COMMENT_LENGTH} caracteres` };

  const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { userId: true } });
  if (!session) return { ok: false, error: "No existe la salida" };
  const circle = await loadCircle(userId);
  if (!circle.has(session.userId)) return { ok: false, error: "No puedes ver esa salida" };

  const c = await prisma.sessionComment.create({
    data: { sessionId, userId, body: text },
    select: { id: true, createdAt: true },
  });
  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, id: c.id, createdAt: c.createdAt.toISOString() };
}

/** Borra un comentario (I-3). Solo su autor o el dueño de la salida. */
export async function deleteComment(commentId: string): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };

  const c = await prisma.sessionComment.findUnique({
    where: { id: commentId },
    select: { userId: true, sessionId: true, session: { select: { userId: true } } },
  });
  if (!c) return { ok: false, error: "No existe el comentario" };
  if (!canDeleteComment({ authorId: c.userId, sessionOwnerId: c.session.userId, viewerId: userId }))
    return { ok: false, error: "No puedes borrar este comentario" };

  await prisma.sessionComment.delete({ where: { id: commentId } });
  revalidatePath("/");
  revalidatePath(`/sessions/${c.sessionId}`);
  return { ok: true };
}

export async function addTag(input: {
  sessionId: string;
  taggedUserId?: string | null;
  freeText?: string | null;
}): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };
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
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };

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
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };

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

/**
 * "Yo también" (Pasada Y): desde una bebida de una salida AJENA donde estás
 * etiquetado, la registra en TU salida de esa misma fecha (la crea si no existe,
 * copiando el lugar). El registro lo haces tú → el invariante se mantiene (etiquetar
 * no acredita). Consolida con A.2 si ya tienes esa bebida+formato. Sin rating ni foto.
 * Devuelve datos para deshacer.
 */
export async function yoTambien(
  sourceCheckInId: string,
): Promise<Result<{ checkInId: string; sessionCreated: boolean }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };

  const src = await prisma.checkIn.findUnique({
    where: { id: sourceCheckInId },
    select: {
      beerId: true,
      format: true,
      session: {
        select: { userId: true, date: true, placeName: true, tags: { select: { taggedUserId: true } } },
      },
    },
  });
  if (!src) return { ok: false, error: "No encontramos esa bebida" };
  // Permiso: no es tu salida y estás etiquetado en ella (solo escribes en la TUYA).
  if (src.session.userId === userId) return { ok: false, error: "Esa salida ya es tuya" };
  if (!src.session.tags.some((t) => t.taggedUserId === userId))
    return { ok: false, error: "No estás en esa salida" };

  // Tu salida de esa fecha: reutilizar o crear (copiando el lugar). date es medianoche
  // UTC del día, así que la igualdad exacta empareja "mismo día".
  //
  // Y.2 — advisory lock: sin esto, dos "Yo también" concurrentes del MISMO usuario y
  // día hacen findFirst-miss ambos y crean DOS salidas (bug verificado en Y.1). El
  // lock serializa SOLO (userId, día): el segundo espera, ve la salida del primero y
  // consolida. Variante _xact_ (se libera al commit) → segura con el pooler de Neon.
  // ACOTADO a yoTambien: en otros flujos crear una 2ª salida el mismo día es válido,
  // por eso el lock NO va en una helper genérica de find-or-create.
  const dayStr = src.session.date.toISOString().slice(0, 10);
  const lockKey = `yt|${userId}|${dayStr}`;
  const placeName = src.session.placeName ?? null;
  const add = yoTambienCheckIn({ beerId: src.beerId, format: src.format });

  const { checkInId, sessionCreated, sessionId } = await prisma.$transaction(async (tx) => {
    // $executeRaw (no $queryRaw): pg_advisory_xact_lock devuelve void y el driver
    // adapter no serializa esa columna. $executeRaw ejecuta y adquiere el lock igual.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    let target = await tx.session.findFirst({
      where: { userId, date: src.session.date },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    let created = false;
    if (!target) {
      target = await tx.session.create({
        data: { userId, date: src.session.date, placeName },
        select: { id: true },
      });
      created = true;
    }

    const existing = await tx.checkIn.findMany({
      where: { sessionId: target.id },
      select: { id: true, beerId: true, format: true, quantity: true, rating: true },
    });
    const plan = planCheckInAdd(existing, add);

    let cid: string;
    if (plan.action === "merge") {
      await tx.checkIn.update({
        where: { id: plan.targetId },
        data: { quantity: plan.quantity, rating: plan.rating }, // conserva TU rating (no copia el ajeno)
      });
      cid = plan.targetId;
    } else {
      const row = await tx.checkIn.create({
        data: { sessionId: target.id, beerId: src.beerId, quantity: 1, format: src.format, rating: null },
        select: { id: true },
      });
      cid = row.id;
    }
    return { checkInId: cid, sessionCreated: created, sessionId: target.id };
  });

  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, checkInId, sessionCreated };
}

/**
 * Deshacer un "Yo también" (Pasada Y). Quita 1 del check-in: si tenía más (consolidado),
 * baja la cantidad; si era 1, borra el check-in. Si la salida fue CREADA por la acción
 * y queda vacía, se borra (caso 4: no dejar salida fantasma que infle el eje Salidas).
 */
export async function undoYoTambien(
  checkInId: string,
  sessionCreated: boolean,
): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };

  const ci = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    select: { quantity: true, sessionId: true, session: { select: { userId: true } } },
  });
  if (!ci || ci.session.userId !== userId) return { ok: false, error: "No es tu salida" };

  if (ci.quantity > 1) {
    await prisma.checkIn.update({ where: { id: checkInId }, data: { quantity: { decrement: 1 } } });
  } else {
    await prisma.checkIn.delete({ where: { id: checkInId } });
    // Salida creada por "Yo también" que quedó vacía → se borra (caso 4).
    if (sessionCreated) {
      const left = await prisma.checkIn.count({ where: { sessionId: ci.sessionId } });
      if (left === 0) await prisma.session.delete({ where: { id: ci.sessionId } });
    }
  }
  revalidatePath("/");
  revalidatePath(`/sessions/${ci.sessionId}`);
  return { ok: true };
}

/**
 * Reacciona a una salida (Pasada R). Una por (salida, usuario): tocar la misma la
 * quita, tocar otra la cambia, ninguna la crea. Puede reaccionar cualquiera que pueda
 * VER la salida (dueño o círculo). El único compuesto (sessionId, userId) garantiza
 * una sola fila por usuario.
 */
export async function toggleReaction(sessionId: string, emoji: string): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };
  if (!isReaction(emoji)) return { ok: false, error: "Reacción inválida" };

  const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { userId: true } });
  if (!session) return { ok: false, error: "No existe la salida" };
  // Permiso = puede ver la salida (dueño está en su círculo; el círculo incluye a sí mismo).
  const circle = await loadCircle(userId);
  if (!circle.has(session.userId)) return { ok: false, error: "No puedes ver esa salida" };

  const existing = await prisma.sessionReaction.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
    select: { emoji: true },
  });
  if (!existing) {
    await prisma.sessionReaction.create({ data: { sessionId, userId, emoji } });
  } else if (existing.emoji === emoji) {
    await prisma.sessionReaction.delete({ where: { sessionId_userId: { sessionId, userId } } });
  } else {
    await prisma.sessionReaction.update({ where: { sessionId_userId: { sessionId, userId } }, data: { emoji } });
  }
  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true };
}

/**
 * Ajusta la cantidad de un check-in en ±1 (Pasada R · stepper). Solo el dueño. Es una
 * ACTUALIZACIÓN RELATIVA y atómica (increment con clamp a mínimo 1) en una sola
 * sentencia con el dueño en el WHERE: así cinco "+" rápidos suman 5 aunque lleguen
 * desordenados (no se pisan como haría un "set" absoluto). Bajar a 0 no borra — para
 * eso está la X con "Deshacer".
 */
export async function bumpCheckInQuantity(checkInId: string, delta: number): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Inicia sesión de nuevo" };
  const d = delta > 0 ? 1 : -1;

  const affected = await prisma.$executeRaw`
    UPDATE check_in ci SET quantity = GREATEST(1, ci.quantity + ${d})
    FROM session s
    WHERE ci.id = ${checkInId} AND ci."sessionId" = s.id AND s."userId" = ${userId}`;
  if (affected === 0) return { ok: false, error: "No es tu salida" };
  revalidatePath("/");
  return { ok: true };
}
