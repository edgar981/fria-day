import type { Prisma, PrismaClient } from "@prisma/client";
import {
  POINT_VALUES,
  DRINK_TECHO,
  DRINK_TECHO_ACTIONS,
  PER_SALIDA_COUNT_CAP,
  PER_DAY_COUNT_CAP,
  bogotaDayRange,
  type PointAction,
} from "@/lib/points";

/**
 * Motor de escritura de puntos (Pasada PT). Aplica los topes y es IDEMPOTENTE por
 * @@unique([userId, action, refId]): la misma acción paga una vez. Guarda los puntos YA
 * con el tope aplicado (efectivos). Nunca borra ("nada resta"): descalificar o borrar no
 * llama aquí. Lo usan tanto las acciones en vivo como el backfill retroactivo, así que el
 * backfill también RECONCILIA cualquier premio que se haya perdido en vivo.
 *
 * `at` = cuándo ocurrió la acción (se guarda en createdAt): topes por día y orden del techo
 * deterministas e iguales en vivo y en backfill. Acepta el cliente o una transacción.
 */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Corre un premio SIN romper la acción del usuario si algo falla: los puntos son un efecto
 * secundario, no deben tumbar el registro. Como el motor es idempotente, el backfill
 * retroactivo RECONCILIA cualquier premio perdido aquí. Úsalo en las acciones en vivo.
 */
export async function safeAward(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (e) {
    console.error("[points] no se pudo acreditar (se reconcilia en el backfill):", e);
  }
}

async function insertMany(
  db: Db,
  rows: { userId: string; action: PointAction; refId: string; sessionId: string | null; points: number; createdAt: Date; shownAt?: Date | null }[],
): Promise<number> {
  const data = rows.filter((r) => r.points > 0).map((r) => ({ ...r, shownAt: r.shownAt ?? null }));
  if (data.length === 0) return 0;
  // skipDuplicates + el unique → reintentar es no-op (idempotencia / carreras).
  const res = await db.pointEntry.createMany({ data, skipDuplicates: true });
  return res.count; // filas realmente creadas (0 si ya existían)
}

/** Registrar una salida: 50, uno por salida (el unique en refId=sessionId lo garantiza). */
export async function awardSession(db: Db, p: { userId: string; sessionId: string; at: Date }): Promise<void> {
  await insertMany(db, [{ userId: p.userId, action: "session", refId: p.sessionId, sessionId: p.sessionId, points: POINT_VALUES.session, createdAt: p.at }]);
}

/** Acción con tope de CANTIDAD por salida (round/photo/challenge). */
async function awardPerSalida(
  db: Db,
  action: PointAction,
  p: { userId: string; sessionId: string; refId: string; at: Date },
): Promise<void> {
  const cap = PER_SALIDA_COUNT_CAP[action]!;
  const count = await db.pointEntry.count({ where: { userId: p.userId, action, sessionId: p.sessionId } });
  if (count >= cap) return; // si ya estaba pagada, va incluida en el conteo → no re-paga
  await insertMany(db, [{ userId: p.userId, action, refId: p.refId, sessionId: p.sessionId, points: POINT_VALUES[action], createdAt: p.at }]);
}

export const awardRound = (db: Db, p: { userId: string; sessionId: string; roundId: string; at: Date }) =>
  awardPerSalida(db, "round", { userId: p.userId, sessionId: p.sessionId, refId: p.roundId, at: p.at });
export const awardPhoto = (db: Db, p: { userId: string; sessionId: string; photoId: string; at: Date }) =>
  awardPerSalida(db, "photo", { userId: p.userId, sessionId: p.sessionId, refId: p.photoId, at: p.at });

/**
 * Cumplir un reto: 10 al perdedor, tope 3/salida. Se marca `shownAt` al acreditar porque el
 * +10 se muestra EN VIVO junto al botón (§5, la única excepción) — así no se repite en la cuenta.
 */
export async function awardChallenge(db: Db, p: { userId: string; sessionId: string; roundId: string; at: Date }): Promise<boolean> {
  const cap = PER_SALIDA_COUNT_CAP.challenge!;
  const count = await db.pointEntry.count({ where: { userId: p.userId, action: "challenge", sessionId: p.sessionId } });
  if (count >= cap) return false;
  const created = await insertMany(db, [{ userId: p.userId, action: "challenge", refId: p.roundId, sessionId: p.sessionId, points: POINT_VALUES.challenge, createdAt: p.at, shownAt: p.at }]);
  return created > 0; // false si ya estaba acreditado (idempotente) → no re-mostrar el +10
}

/**
 * Bebidas bajo el TECHO de 40 por salida: first_time(10) + rate(8) + drink(2), en ese orden.
 * `userId` es el DUEÑO de la salida (los totales salen de sus check-ins). first_time es global
 * por bebida (se acredita en la salida donde se probó por primera vez).
 */
export async function awardCheckIn(
  db: Db,
  p: { userId: string; sessionId: string; checkInId: string; beerId: string; rating: number | null; at: Date },
): Promise<void> {
  const existing = await db.pointEntry.findMany({
    where: { userId: p.userId, sessionId: p.sessionId, action: { in: DRINK_TECHO_ACTIONS as unknown as string[] } },
    select: { action: true, refId: true, points: true },
  });
  let sum = existing.reduce((n, e) => n + e.points, 0);
  const has = (action: string, refId: string) => existing.some((e) => e.action === action && e.refId === refId);
  // first_time es global (por bebida, cualquier salida): si ya se acreditó, no cuenta aquí.
  const firstAwarded = await db.pointEntry.findUnique({
    where: { userId_action_refId: { userId: p.userId, action: "first_time", refId: p.beerId } },
    select: { id: true },
  });

  const candidates: { action: PointAction; refId: string; when: boolean }[] = [
    { action: "first_time", refId: p.beerId, when: !firstAwarded },
    { action: "rate", refId: p.checkInId, when: p.rating != null && !has("rate", p.checkInId) },
    { action: "drink", refId: p.checkInId, when: !has("drink", p.checkInId) },
  ];

  const rows: Parameters<typeof insertMany>[1] = [];
  for (const c of candidates) {
    if (!c.when) continue;
    const remaining = DRINK_TECHO - sum;
    if (remaining <= 0) break;
    const points = Math.min(POINT_VALUES[c.action], remaining);
    rows.push({ userId: p.userId, action: c.action, refId: c.refId, sessionId: p.sessionId, points, createdAt: p.at });
    sum += points;
  }
  await insertMany(db, rows);
}

/** Acción con tope de CANTIDAD por día (comment/toast), en día de Bogotá. */
async function awardPerDay(
  db: Db,
  action: PointAction,
  p: { userId: string; sessionId: string; refId: string; at: Date },
): Promise<void> {
  const cap = PER_DAY_COUNT_CAP[action]!;
  const { start, end } = bogotaDayRange(p.at);
  const count = await db.pointEntry.count({ where: { userId: p.userId, action, createdAt: { gte: start, lt: end } } });
  if (count >= cap) return;
  await insertMany(db, [{ userId: p.userId, action, refId: p.refId, sessionId: p.sessionId, points: POINT_VALUES[action], createdAt: p.at }]);
}

export const awardComment = (db: Db, p: { userId: string; sessionId: string; commentId: string; at: Date }) =>
  awardPerDay(db, "comment", { userId: p.userId, sessionId: p.sessionId, refId: p.commentId, at: p.at });
// Brindar: uno por salida (refId=sessionId) aunque cambie el emoji; tope 10/día. Quitar la
// reacción no resta; volver a reaccionar en la misma salida no re-paga.
export const awardToast = (db: Db, p: { userId: string; sessionId: string; at: Date }) =>
  awardPerDay(db, "toast", { userId: p.userId, sessionId: p.sessionId, refId: p.sessionId, at: p.at });
