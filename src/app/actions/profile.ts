"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAvatarKey } from "@/lib/avatars";

// Excepción de avatares: el usuario puede cambiar su avatar desde el perfil.
export async function updateAvatar(
  key: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };
  const avatar = isAvatarKey(key) ? key : null; // null = anónimo
  await prisma.user.update({ where: { id: user.id }, data: { avatar } });
  revalidatePath("/profile");
  revalidatePath("/");
  return { ok: true };
}
