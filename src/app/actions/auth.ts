"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema, loginSchema } from "@/lib/validation";

export type AuthState = { error?: string } | undefined;

export async function registerWithInvite(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { displayName, email, password, code } = parsed.data;

  // 1. La invitación debe existir, no estar usada y no estar expirada (regla 5).
  const invite = await prisma.invitation.findUnique({ where: { code } });
  if (!invite) return { error: "Código de invitación inválido" };
  if (invite.usedById) return { error: "Ese código ya fue usado" };
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { error: "Ese código ya expiró" };
  }

  // 2. Crear la cuenta (Better Auth). autoSignIn → deja la cookie de sesión.
  let userId: string;
  try {
    const res = await auth.api.signUpEmail({
      body: { email, password, name: displayName, displayName },
      headers: await headers(),
    });
    userId = res.user.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/exist|unique|already|taken/i.test(msg)) {
      return { error: "Ese email ya está registrado" };
    }
    return { error: "No se pudo crear la cuenta" };
  }

  // 3. Reclamar la invitación de forma atómica; si alguien la usó en el
  //    intermedio, deshacemos el usuario recién creado.
  const claimed = await prisma.invitation.updateMany({
    where: { id: invite.id, usedById: null },
    data: { usedById: userId },
  });
  if (claimed.count === 0) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    return { error: "Ese código acaba de ser usado por alguien más" };
  }

  redirect("/");
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch {
    return { error: "Email o contraseña incorrectos" };
  }
  redirect("/");
}

export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
