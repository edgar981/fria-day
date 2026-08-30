"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema, loginSchema } from "@/lib/validation";
import { isAvatarKey } from "@/lib/avatars";

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
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }
  const { displayName, email, password, code } = parsed.data;
  const rawAvatar = formData.get("avatar");
  const avatar = isAvatarKey(rawAvatar) ? rawAvatar : null; // null = anónimo

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
      body: { email, password, name: displayName, displayName, avatar },
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

/**
 * Verifica un código de invitación SIN crear cuenta ni reclamarlo. Se usa al
 * pasar del paso 1 al paso 2 del onboarding. La reclamación atómica sigue en
 * registerWithInvite (submit final).
 */
export async function validateInviteCode(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = code.trim();
  if (!c) return { ok: false, error: "Escribe tu código de invitación" };
  const invite = await prisma.invitation.findUnique({ where: { code: c } });
  if (!invite) return { ok: false, error: "Código de invitación inválido" };
  if (invite.usedById) return { ok: false, error: "Ese código ya fue usado" };
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now())
    return { ok: false, error: "Ese código ya expiró" };
  return { ok: true };
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
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
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
