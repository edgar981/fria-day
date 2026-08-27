"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toStoredDay } from "@/lib/format";
import { sessionSchema, checkInSchema } from "@/lib/validation";
import { planCheckInAdd, consolidateNewCheckIns } from "@/lib/domain";

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

  try {
    const session = await prisma.session.create({
      data: {
        userId,
        date: toStoredDay(data.date),
        placeName: data.placeName ? data.placeName : null,
        notes: data.notes ? data.notes : null,
        tags: { create: buildTags(data.tags, userId) },
        // Consolida misma cerveza+formato en una sola fila (punto A.2-5).
        checkIns: {
          create: consolidateNewCheckIns(
            data.checkIns.map((c) => ({
              beerId: c.beerId,
              format: c.format,
              quantity: c.quantity,
              rating: c.rating ?? null,
            })),
          ),
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

  await prisma.session.delete({ where: { id } }); // cascada a check-ins y tags
  revalidatePath("/");
  return { ok: true };
}

export async function addCheckIn(input: unknown): Promise<Result> {
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

  if (plan.action === "merge") {
    await prisma.checkIn.update({
      where: { id: plan.targetId },
      data: { quantity: plan.quantity, rating: plan.rating },
    });
  } else {
    await prisma.checkIn.create({
      data: {
        sessionId,
        beerId: c.beerId,
        quantity: c.quantity,
        format: c.format,
        rating: c.rating ?? null,
        photoUrl: c.photoUrl ? c.photoUrl : null,
      },
    });
  }
  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/edit`);
  return { ok: true };
}

export async function deleteCheckIn(checkInId: string): Promise<Result> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  const ci = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    select: { sessionId: true, session: { select: { userId: true } } },
  });
  if (!ci || ci.session.userId !== userId)
    return { ok: false, error: "No es tu salida" };

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
