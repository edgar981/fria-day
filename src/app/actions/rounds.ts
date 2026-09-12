"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toStoredDay, todayInputValue } from "@/lib/format";
import { isRouletteDynamicKey, secureRandomInt, pickChallengeKey } from "@/lib/roulette";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// RU · decisión de Edgar: la ruleta exige ≥2 personas de la app (dueño + etiquetados).
// No exportado: un módulo "use server" solo puede exportar funciones async.
const MIN_ROULETTE_PLAYERS = 2;

interface SpunRound {
  id: string;
  sessionId: string;
  roundNumber: number;
  loserId: string;
  dynamicKey: string;
  challengeKey: string;
}

/**
 * Gira la ruleta: crea la ronda EN EL SERVIDOR (§3). El perdedor y el reto se eligen
 * AQUÍ (crypto), no en el cliente: la animación solo REVELA un resultado ya persistido,
 * así un refresh a mitad de giro conserva el veredicto y nada es manipulable desde el
 * navegador.
 *
 * Participantes = dueño + etiquetados de la app (distintos). Incluye a quien marcó
 * "no tomé": la ruleta es de PRESENCIA, no de consumo (decisión 5). La compañía de texto
 * libre no juega (no tiene cuenta). Exige ≥2 (decisión 3).
 *
 * `sessionId` opcional: sin él se juega en la salida de HOY (§1: si no hay, se crea; y si
 * la creamos y no se puede jugar, se revierte para no dejar salida fantasma). Solo el
 * DUEÑO gira (la salida es personal — regla de dominio 2; en arquitectura A el teléfono
 * es el suyo). El `@@unique(sessionId, roundNumber)` es el cinturón contra dos giros
 * concurrentes (el 2º pierde).
 */
export async function spinRound(input: {
  sessionId?: string;
  dynamicKey: string;
}): Promise<Result<{ round: SpunRound }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo" };
  if (!isRouletteDynamicKey(input.dynamicKey)) return { ok: false, error: "Dinámica inválida" };

  const userId = user.id;
  const todayStored = toStoredDay(todayInputValue());
  const lockKey = input.sessionId ? `round|${input.sessionId}` : `round-today|${userId}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      // Salida objetivo (siempre del dueño). Sin sessionId → la de hoy (crear si no hay).
      let sessionId: string;
      let createdHere = false;
      if (input.sessionId) {
        const s = await tx.session.findUnique({ where: { id: input.sessionId }, select: { id: true, userId: true } });
        if (!s) return { ok: false as const, error: "No existe la salida" };
        if (s.userId !== userId) return { ok: false as const, error: "No es tu salida" };
        sessionId = s.id;
      } else {
        const existing = await tx.session.findFirst({
          where: { userId, date: todayStored },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (existing) {
          sessionId = existing.id;
        } else {
          const created = await tx.session.create({ data: { userId, date: todayStored }, select: { id: true } });
          sessionId = created.id;
          createdHere = true;
        }
      }

      // Participantes = dueño + etiquetados de la app (incluye "no tomé").
      const tags = await tx.sessionTag.findMany({
        where: { sessionId, taggedUserId: { not: null } },
        select: { taggedUserId: true },
      });
      const ids = new Set<string>([userId]);
      for (const t of tags) if (t.taggedUserId) ids.add(t.taggedUserId);
      const players = [...ids];
      if (players.length < MIN_ROULETTE_PLAYERS) {
        if (createdHere) await tx.session.delete({ where: { id: sessionId } }); // sin salida fantasma
        return { ok: false as const, error: `La ruleta necesita al menos ${MIN_ROULETTE_PLAYERS} personas de la app. Etiquetá a alguien en la salida.` };
      }

      // Perdedor uniforme (Web Crypto, sin sesgo de bundling · RU.2).
      const loserId = players[secureRandomInt(players.length)]!;
      // Reto SIN repetir los ya usados de esta dinámica en esta salida (RU.1 · §2).
      const usedRounds = await tx.sessionRound.findMany({
        where: { sessionId, dynamicKey: input.dynamicKey },
        select: { challengeKey: true },
      });
      const challengeKey = pickChallengeKey(input.dynamicKey, usedRounds.map((r) => r.challengeKey));
      if (!challengeKey) return { ok: false as const, error: "Dinámica inválida" };
      const agg = await tx.sessionRound.aggregate({ where: { sessionId }, _max: { roundNumber: true } });
      const roundNumber = (agg._max.roundNumber ?? 0) + 1;
      const round = await tx.sessionRound.create({
        data: { sessionId, dynamicKey: input.dynamicKey, loserId, challengeKey, roundNumber },
        select: { id: true, roundNumber: true, loserId: true, dynamicKey: true, challengeKey: true, sessionId: true },
      });
      return { ok: true as const, round };
    });

    if (!result.ok) return { ok: false, error: result.error };
    const r = result.round;
    revalidatePath("/");
    revalidatePath(`/sessions/${r.sessionId}`);
    return { ok: true, round: { id: r.id, sessionId: r.sessionId, roundNumber: r.roundNumber, loserId: r.loserId, dynamicKey: r.dynamicKey, challengeKey: r.challengeKey } };
  } catch {
    return { ok: false, error: "No se pudo girar la ruleta" };
  }
}

/**
 * Etiqueta a alguien PARA la ruleta desde el gate de "≥2 personas" (RU.1 · §8), sin salir a
 * editar la salida. Crea la salida de HOY si aún no existe (mismo criterio que spinRound).
 * Idempotente: si ya está etiquetado, no falla. Devuelve el jugador para agregarlo a la rueda.
 */
export async function tagForRoulette(input: {
  sessionId?: string;
  userId: string;
}): Promise<Result<{ sessionId: string; player: { id: string; name: string; avatar: string | null } }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Inicia sesión de nuevo" };
  if (input.userId === me.id) return { ok: false, error: "Ya estás en la ruleta" };

  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, displayName: true, avatar: true } });
  if (!user) return { ok: false, error: "No existe ese usuario" };

  let sessionId: string;
  if (input.sessionId) {
    const s = await prisma.session.findUnique({ where: { id: input.sessionId }, select: { id: true, userId: true } });
    if (!s || s.userId !== me.id) return { ok: false, error: "No es tu salida" };
    sessionId = s.id;
  } else {
    const todayStored = toStoredDay(todayInputValue());
    const existing = await prisma.session.findFirst({ where: { userId: me.id, date: todayStored }, orderBy: { createdAt: "asc" }, select: { id: true } });
    sessionId = existing?.id ?? (await prisma.session.create({ data: { userId: me.id, date: todayStored }, select: { id: true } })).id;
  }

  try {
    await prisma.sessionTag.create({ data: { sessionId, taggedUserId: input.userId } });
  } catch {
    // P2002 (ya etiquetado) → idempotente, seguimos.
  }
  revalidatePath("/");
  revalidatePath(`/sessions/${sessionId}`);
  return { ok: true, sessionId, player: { id: user.id, name: user.displayName, avatar: user.avatar } };
}

/**
 * Marca el desenlace de una ronda. "Paso" NUNCA penaliza (§6). Los dos estados son
 * excluyentes; "pending" limpia ambos. Solo el dueño de la salida (arquitectura A: su
 * teléfono; en la mesa marca lo que el perdedor decide).
 */
export async function setRoundOutcome(
  roundId: string,
  outcome: "completed" | "passed" | "pending",
): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo" };

  const round = await prisma.sessionRound.findUnique({
    where: { id: roundId },
    select: { sessionId: true, session: { select: { userId: true } } },
  });
  if (!round || round.session.userId !== user.id) return { ok: false, error: "No es tu salida" };

  const now = new Date();
  await prisma.sessionRound.update({
    where: { id: roundId },
    data: {
      completedAt: outcome === "completed" ? now : null,
      passedAt: outcome === "passed" ? now : null,
    },
  });
  revalidatePath("/");
  revalidatePath(`/sessions/${round.sessionId}`);
  return { ok: true };
}
