"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const emailSchema = z.string().trim().toLowerCase().email("Revisa tu correo");

/**
 * Elimina (revoca) una passkey del usuario. Guardarraíl: no dejar la cuenta sin
 * ninguna forma de entrar. Si es la ÚNICA passkey y NO hay contraseña NI correo de
 * recuperación, se rechaza con el motivo (el usuario quedaría sin acceso).
 */
export async function deletePasskey(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo" };

  const [passkeys, credentialCount] = await Promise.all([
    prisma.passkey.findMany({ where: { userId: user.id }, select: { id: true } }),
    prisma.account.count({ where: { userId: user.id, providerId: "credential" } }),
  ]);
  if (!passkeys.some((p) => p.id === id)) {
    return { ok: false, error: "Esa passkey no es tuya" };
  }
  const isLast = passkeys.length === 1;
  const hasPassword = credentialCount > 0;
  const hasEmail = !!(user as { email?: string | null }).email;
  if (isLast && !hasPassword && !hasEmail) {
    return {
      ok: false,
      error: "Es tu única forma de entrar. Agrega una contraseña o un correo de recuperación antes de eliminarla.",
    };
  }

  try {
    await auth.api.deletePasskey({ body: { id }, headers: await headers() });
  } catch {
    return { ok: false, error: "No se pudo eliminar la passkey" };
  }
  revalidatePath("/profile");
  return { ok: true };
}

/**
 * Agrega (o cambia) el correo de RECUPERACIÓN, opcional, desde el perfil.
 * Better Auth bloquea fijar email vía updateUser (EMAIL_CAN_NOT_BE_UPDATED, verificado),
 * así que se hace con prisma directo: hay sesión (ownership) y el grupo va sin
 * verificación de correo. La unicidad la garantiza el índice @unique.
 */
export async function addRecoveryEmail(
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo" };
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa tu correo" };
  const email = parsed.data;
  try {
    await prisma.user.update({ where: { id: user.id }, data: { email } });
  } catch (e) {
    // P2002 = violación de unicidad (email ya registrado por otra cuenta)
    if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "Ese correo ya está registrado en otra cuenta" };
    }
    return { ok: false, error: "No se pudo guardar el correo" };
  }
  revalidatePath("/profile");
  return { ok: true };
}

/**
 * Agrega una CONTRASEÑA como método alterno (para entrar sin passkey). Requiere
 * un correo ya guardado, porque el login por contraseña usa el correo. Usa
 * auth.api.setPassword (verificado por ejecución: crea el account credential).
 */
export async function setAccountPassword(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo" };
  if (!(user as { email?: string | null }).email) {
    return { ok: false, error: "Agrega primero un correo de recuperación" };
  }
  if (typeof password !== "string" || password.length < 8) {
    return { ok: false, error: "La contraseña necesita mínimo 8 caracteres" };
  }
  try {
    await auth.api.setPassword({ body: { newPassword: password }, headers: await headers() });
  } catch {
    return { ok: false, error: "No se pudo guardar la contraseña" };
  }
  revalidatePath("/profile");
  return { ok: true };
}

/**
 * Cambia (ROTA) la contraseña de un usuario ya autenticado, SIN pedir la anterior
 * (RC · punto 1). Para quien tiene passkey y olvidó la contraseña pero sigue dentro:
 * no puede usar changePassword (exige la actual) y auth.api.setPassword LANZA
 * PASSWORD_ALREADY_SET si ya hay una (verificado en el fuente de Better Auth).
 *
 * Rotamos con el context de Better Auth: su MISMO hasher + updateAccount, tal como
 * changePassword por dentro, pero sin exigir la contraseña actual. Atómico (un solo
 * update), sin ventana en la que la credencial quede borrada.
 *
 * NOTA de seguridad: el FaceID que pide la UI antes de llamar aquí es un step-up de
 * CLIENTE (authClient.signIn.passkey refresca la sesión). Better Auth no permite atar
 * una ceremonia de passkey a esta operación sin endpoints propios, así que el servidor
 * autoriza por la SESIÓN válida. Evaluado y aceptado (RC · punto 1): el step-up de
 * cliente cubre el caso real (teléfono desbloqueado en mano), el servidor confía en la
 * sesión. Si algún día hace falta blindaje de servidor, es un endpoint propio aparte.
 */
export async function changeAccountPassword(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Inicia sesión de nuevo" };
  if (typeof password !== "string" || password.length < 8) {
    return { ok: false, error: "La contraseña necesita mínimo 8 caracteres" };
  }
  try {
    const ctx = await auth.$context;
    const account = await ctx.internalAdapter.findCredentialAccount(user.id);
    if (!account || !account.password) {
      // No hay contraseña que rotar (llegó por un camino inesperado): cae al alta
      // normal, que ENLAZA la credencial. setPassword sí funciona cuando no existe.
      await auth.api.setPassword({ body: { newPassword: password }, headers: await headers() });
    } else {
      const passwordHash = await ctx.password.hash(password);
      await ctx.internalAdapter.updateAccount(account.id, { password: passwordHash });
    }
  } catch {
    return { ok: false, error: "No se pudo cambiar la contraseña" };
  }
  revalidatePath("/profile");
  return { ok: true };
}
