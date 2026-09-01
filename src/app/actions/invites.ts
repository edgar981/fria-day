"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { inviteSchema } from "@/lib/validation";

// Sin caracteres ambiguos (0/O/1/I/L) para dictar el código por WhatsApp sin líos.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function genCode(len = 7): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export type CreateInviteResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

export async function createInvite(input: unknown): Promise<CreateInviteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo" };

  const parsed = inviteSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "Revisa los datos" };

  const days = parsed.data.expiresInDays;
  const expiresAt =
    typeof days === "number" ? new Date(Date.now() + days * 86_400_000) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    try {
      const inv = await prisma.invitation.create({
        data: { code, createdById: user.id, expiresAt },
      });
      revalidatePath("/leaderboard"); // Pasada N: la lista de códigos vive en el Leaderboard
      return { ok: true, code: inv.code };
    } catch {
      // colisión del code único: reintenta con otro
    }
  }
  return { ok: false, error: "No se pudo generar el código, intenta de nuevo" };
}
