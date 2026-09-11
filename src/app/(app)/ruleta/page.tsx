import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toStoredDay, todayInputValue } from "@/lib/format";
import { isRouletteDynamicKey } from "@/lib/roulette";
import { RouletteFlow, type RoulettePlayer, type RouletteLatestRound } from "@/components/RouletteFlow";

export const dynamic = "force-dynamic";

/**
 * Pantalla de la ruleta (Pasada RU). Inmersiva (sin barra): se entra por el hold del "+"
 * (con `?dyn=`) o por "Girar otra vez" del detalle (con `?session=`). Sin `?session` se
 * juega en la salida de HOY (spinRound la crea si no hay · §1). El perdedor y el reto los
 * decide el servidor; aquí solo cargamos participantes y la última ronda (refresh-safe).
 */
export default async function RuletaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const dynRaw = typeof sp.dyn === "string" ? sp.dyn : null;
  const preselectedDyn = dynRaw && isRouletteDynamicKey(dynRaw) ? dynRaw : null;
  const sessionParam = typeof sp.session === "string" ? sp.session : null;

  const todayStored = toStoredDay(todayInputValue());
  const session = sessionParam
    ? await prisma.session.findUnique({ where: { id: sessionParam }, select: { id: true, userId: true } })
    : await prisma.session.findFirst({ where: { userId: user.id, date: todayStored }, orderBy: { createdAt: "asc" }, select: { id: true, userId: true } });

  // Solo el dueño juega su salida (regla de dominio 2).
  if (sessionParam && (!session || session.userId !== user.id)) redirect("/");
  const sessionId = session && session.userId === user.id ? session.id : null;

  const players: RoulettePlayer[] = [
    { id: user.id, name: user.displayName, avatar: user.avatar ?? null },
  ];
  let latestRound: RouletteLatestRound | null = null;

  if (sessionId) {
    const [tags, last] = await Promise.all([
      prisma.sessionTag.findMany({
        where: { sessionId, taggedUserId: { not: null } },
        select: { taggedUser: { select: { id: true, displayName: true, avatar: true } } },
      }),
      prisma.sessionRound.findFirst({
        where: { sessionId },
        orderBy: { roundNumber: "desc" },
        select: { id: true, roundNumber: true, dynamicKey: true, challengeKey: true, loserId: true, completedAt: true, passedAt: true, loser: { select: { id: true, displayName: true, avatar: true } } },
      }),
    ]);
    const seen = new Set<string>([user.id]);
    for (const t of tags) {
      if (t.taggedUser && !seen.has(t.taggedUser.id)) {
        seen.add(t.taggedUser.id);
        players.push({ id: t.taggedUser.id, name: t.taggedUser.displayName, avatar: t.taggedUser.avatar });
      }
    }
    if (last) {
      // Si el perdedor de la última ronda ya no está etiquetado, igual lo incluimos para
      // poder MOSTRAR el veredicto persistido (caso raro: se destetiquetó tras perder).
      if (!seen.has(last.loser.id)) players.push({ id: last.loser.id, name: last.loser.displayName, avatar: last.loser.avatar });
      latestRound = {
        id: last.id,
        roundNumber: last.roundNumber,
        dynamicKey: last.dynamicKey,
        challengeKey: last.challengeKey,
        loserId: last.loserId,
        completed: last.completedAt != null,
        passed: last.passedAt != null,
      };
    }
  }

  return (
    <RouletteFlow
      players={players}
      viewerId={user.id}
      sessionId={sessionId}
      preselectedDyn={preselectedDyn}
      latestRound={latestRound}
    />
  );
}
