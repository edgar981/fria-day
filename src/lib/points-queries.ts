import { prisma } from "@/lib/prisma";
import { loadCircle } from "@/lib/queries";
import { buildDesglose, desgloseEthos, hitoEnSalidas, nextHitoObj, lastHitoPoints, hitosReached, type DesgloseLine, type PointAction } from "@/lib/points";

export interface PointsSummary {
  total: number;
  ritmo: number; // puntos por salida
  salidasCount: number;
  desglose: DesgloseLine[];
  ethos: string;
  /** Próximo hito en salidas ("Dos salidas más"), o null si no hay ritmo / se pasó el último. */
  nextSalidas: string | null;
  /** Barra de progreso al próximo hito: de `lastHito` (base) a `nextHito`. null = sin próximo. */
  nextHitoPoints: number | null;
  lastHitoPoints: number;
  /** Hitos alcanzados (chips del perfil, en orden — el único historial). */
  hitos: { points: number; name: string }[];
}

/** Resumen de puntos de un usuario (Pasada PT · §6, §8, §9). */
export async function getPointsSummary(userId: string): Promise<PointsSummary> {
  const grouped = await prisma.pointEntry.groupBy({
    by: ["action"],
    where: { userId },
    _sum: { points: true },
    _count: { _all: true },
  });
  const byAction: Partial<Record<PointAction, number>> = {};
  const countByAction: Partial<Record<string, number>> = {};
  for (const g of grouped) {
    byAction[g.action as PointAction] = g._sum.points ?? 0;
    countByAction[g.action] = g._count._all;
  }
  const total = Object.values(byAction).reduce((a, b) => a + b, 0);
  const salidasCount = countByAction.session ?? 0;
  const salidasPoints = byAction.session ?? 0;
  const bebidasCount = countByAction.drink ?? 0;
  const bebidasPoints = (byAction.first_time ?? 0) + (byAction.rate ?? 0) + (byAction.drink ?? 0);
  const ritmo = salidasCount > 0 ? Math.round(total / salidasCount) : 0;

  const nextH = nextHitoObj(total);
  return {
    total,
    ritmo,
    salidasCount,
    desglose: buildDesglose(byAction),
    ethos: desgloseEthos(bebidasCount, bebidasPoints, salidasCount, salidasPoints),
    nextSalidas: hitoEnSalidas(total, ritmo),
    nextHitoPoints: nextH?.points ?? null,
    lastHitoPoints: lastHitoPoints(total),
    hitos: hitosReached(total).map((h) => ({ points: h.points, name: h.name })),
  };
}

export interface CircleMemberPoints {
  id: string;
  displayName: string;
  avatar: string | null;
  total: number;
}

/**
 * Puntos de cada miembro del círculo (§6). **Ordenado por ANTIGÜEDAD (createdAt asc), NUNCA por
 * puntos** — ordenarlo por puntos lo volvería el ranking que dijimos que no es.
 */
export async function getCirclePoints(userId: string): Promise<CircleMemberPoints[]> {
  const circle = await loadCircle(userId); // incluye al propio usuario
  const ids = [...circle];
  if (ids.length === 0) return [];
  const [users, grouped] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, avatar: true, createdAt: true } }),
    prisma.pointEntry.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _sum: { points: true } }),
  ]);
  const pts = new Map(grouped.map((g) => [g.userId, g._sum.points ?? 0]));
  return users
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((u) => ({ id: u.id, displayName: u.displayName, avatar: u.avatar, total: pts.get(u.id) ?? 0 }));
}
