"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loadCircle } from "@/lib/queries";
import { rejectionOnCooldown } from "@/lib/requests";

export type RequestResult = { ok: true } | { ok: false; error: string };

/**
 * "Agregar al parche" (Pasada PA · §1, §5): el solicitante pide entrar al parche del destinatario.
 * Unilateral y con aceptación; nunca "seguir". Guarda todas las reglas del servidor:
 *  - no a uno mismo; no si ya están juntos (cualquiera de las tres vías);
 *  - si ya hay una pendiente, es idempotente; si hubo un rechazo, no antes de 15 días (§2);
 *  - una fila por par (requester→recipient): re-pedir reusa la fila.
 * No hay "retirar": una solicitud enviada no se puede quitar (§2).
 */
export async function sendRequest(recipientId: string): Promise<RequestResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado" };
  if (recipientId === user.id) return { ok: false, error: "No puedes agregarte a ti mismo" };

  const target = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true } });
  if (!target) return { ok: false, error: "Esa persona no existe" };

  const circle = await loadCircle(user.id);
  if (circle.has(recipientId)) return { ok: false, error: "Ya están en el mismo parche" };

  const existing = await prisma.joinRequest.findUnique({
    where: { requesterId_recipientId: { requesterId: user.id, recipientId } },
    select: { id: true, status: true, respondedAt: true },
  });

  if (existing) {
    if (existing.status === "pending") return { ok: true }; // ya enviada
    if (existing.status === "accepted") return { ok: false, error: "Ya están en el mismo parche" };
    // rejected: solo se puede volver a pedir pasados 15 días.
    if (rejectionOnCooldown(existing.respondedAt, new Date())) {
      return { ok: false, error: "Todavía no puedes volver a pedir" };
    }
    await prisma.joinRequest.update({
      where: { id: existing.id },
      data: { status: "pending", createdAt: new Date(), respondedAt: null },
    });
  } else {
    await prisma.joinRequest.create({ data: { requesterId: user.id, recipientId } });
  }

  revalidatePath(`/u/${recipientId}`);
  return { ok: true };
}

/** El destinatario acepta (Pasada PA · §2): status=accepted → arista simétrica del círculo. */
export async function acceptRequest(requestId: string): Promise<RequestResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado" };
  const req = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    select: { id: true, recipientId: true, requesterId: true, status: true },
  });
  if (!req || req.recipientId !== user.id) return { ok: false, error: "No existe" };
  if (req.status !== "pending") return { ok: false, error: "Esa solicitud ya no está pendiente" };

  await prisma.joinRequest.update({ where: { id: req.id }, data: { status: "accepted", respondedAt: new Date() } });
  // El círculo cambió para ambos: feed, Tabla y perfil se recalculan.
  revalidatePath("/");
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  revalidatePath(`/u/${req.requesterId}`);
  return { ok: true };
}

/** El destinatario rechaza (Pasada PA · §2): silencioso. El solicitante no se entera. */
export async function rejectRequest(requestId: string): Promise<RequestResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autorizado" };
  const req = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    select: { id: true, recipientId: true, status: true },
  });
  if (!req || req.recipientId !== user.id) return { ok: false, error: "No existe" };
  if (req.status !== "pending") return { ok: false, error: "Esa solicitud ya no está pendiente" };

  await prisma.joinRequest.update({ where: { id: req.id }, data: { status: "rejected", respondedAt: new Date() } });
  revalidatePath("/profile");
  return { ok: true };
}
