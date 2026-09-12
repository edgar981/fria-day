"use server";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildCuentaLines, isSocialAction, type CuentaLine } from "@/lib/points";

/**
 * "La cuenta" (Pasada PT · §5): al SALIR del detalle de una salida donde se registró/editó
 * algo, devuelve el recibo de lo NO visto y lo marca visto en el MISMO paso (atómico), así
 * no se puede disparar dos veces ni "repetir lo ya contado". Incluye:
 *  - las líneas de ESTA salida no vistas (registrar/ruleta/fotos/bebidas), y
 *  - todo lo SOCIAL no visto (brindis/comentarios, de cualquier salida), en una sola línea.
 * Si no se ganó nada de ESTA salida (solo se miró, o solo social), no hay recibo → lines vacío.
 * El +10 de "cumplir un reto" nunca llega aquí: se marca visto al acreditarse (se muestra en vivo).
 */
export async function takeCuenta(sessionId: string): Promise<{ lines: CuentaLine[]; total: number }> {
  const user = await getCurrentUser();
  if (!user) return { lines: [], total: 0 };

  const unseen = await prisma.pointEntry.findMany({
    where: {
      userId: user.id,
      shownAt: null,
      OR: [{ sessionId }, { action: { in: ["comment", "toast"] } }],
    },
    select: { id: true, action: true, points: true, sessionId: true },
  });

  // ¿Ganó algo de ESTA salida que no sea social? (registrar/editar algo, no solo mirar/brindar)
  const earnedHere = unseen.some((e) => e.sessionId === sessionId && !isSocialAction(e.action));
  if (!earnedHere) return { lines: [], total: 0 };

  const lines = buildCuentaLines(unseen.map((e) => ({ action: e.action, points: e.points })));
  const total = unseen.reduce((n, e) => n + e.points, 0);
  await prisma.pointEntry.updateMany({ where: { id: { in: unseen.map((e) => e.id) } }, data: { shownAt: new Date() } });
  return { lines, total };
}
