import { randomBytes } from "crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { prisma } from "@/lib/prisma";
import { isAvatarKey } from "@/lib/avatars";

// --- rpID / origin de WebAuthn ---
// Las passkeys quedan ATADAS al dominio (rpID). En producción DEBE ser el dominio
// canónico (fria-day.vercel.app); una passkey registrada en una URL de deployment
// (fria-xxxx-*.vercel.app) queda inservible. Se deriva de BETTER_AUTH_URL (que en
// Vercel apunta al dominio estable) y se puede fijar explícitamente con
// PASSKEY_RP_ID / PASSKEY_ORIGIN. Ver DECISIONES.md.
const AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const RP_ID = process.env.PASSKEY_RP_ID || new URL(AUTH_URL).hostname;
const RP_ORIGIN = process.env.PASSKEY_ORIGIN || new URL(AUTH_URL).origin;

/** Contexto que el cliente manda en addPasskey({ context }) para el alta passkey-first. */
type RegistrationContext = { code?: string; name?: string; avatar?: string | null };

function parseContext(context?: string | null): RegistrationContext {
  if (!context) return {};
  try {
    const v = JSON.parse(context);
    return typeof v === "object" && v ? v : {};
  } catch {
    return {};
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Grupo cerrado de amigos: sin verificación de email (no hay proveedor de
  // correo). El gating real es el código de invitación (ver actions/auth.ts).
  // El correo pasa a ser OPCIONAL (recuperación), agregado luego desde el perfil.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
  },

  // El modelo de sesión de auth se llama AuthSession (delegate prisma.authSession)
  // para no chocar con el modelo de dominio Session (la salida a tomar cerveza).
  session: {
    modelName: "authSession",
  },

  user: {
    additionalFields: {
      displayName: { type: "string", required: true, input: true },
      // Avatar elegido en el registro. null = anónimo.
      avatar: { type: "string", required: false, input: true },
    },
  },

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  plugins: [
    passkey({
      rpID: RP_ID,
      rpName: "FriaDay",
      origin: RP_ORIGIN,
      registration: {
        // Alta passkey-first: sin sesión previa. El plugin NO crea usuarios
        // (verificado: sin resolveUser lanza RESOLVE_USER_REQUIRED), así que lo
        // creamos aquí. Sin correo ni contraseña; la credencial es la passkey.
        requireSession: false,

        // Se ejecuta en generate-register-options (ANTES del prompt de FaceID).
        // Valida la invitación y genera el id del usuario (= userHandle de WebAuthn),
        // pero NO crea la fila todavía: si la ceremonia de passkey falla (rpID que no
        // coincide con el origen, cancelar FaceID, dispositivo sin soporte), el
        // navegador rechaza credentials.create() y verify-registration NUNCA corre,
        // así que un create aquí dejaría un usuario HUÉRFANO (pasó en producción,
        // ver DECISIONES.md · P.2). El usuario se crea en afterVerification, que solo
        // corre si la passkey se verificó → registro atómico.
        async resolveUser({ ctx, context }) {
          const { code, name } = parseContext(context);
          const displayName = (name ?? "").trim();
          if (!displayName) throw ctx.error("BAD_REQUEST", { message: "Falta tu nombre" });

          const invite = code ? await prisma.invitation.findUnique({ where: { code: code.trim() } }) : null;
          if (!invite) throw ctx.error("BAD_REQUEST", { message: "Código de invitación inválido" });
          if (invite.usedById) throw ctx.error("BAD_REQUEST", { message: "Ese código ya fue usado" });
          if (invite.expiresAt && invite.expiresAt.getTime() < Date.now())
            throw ctx.error("BAD_REQUEST", { message: "Ese código ya expiró" });

          // generateId puede devolver false (si la config delega el id a la DB);
          // aquí fijamos el id nosotros, así que caemos a un id aleatorio.
          const id = ctx.context.generateId({ model: "user" }) || randomBytes(24).toString("base64url");
          return { id, name: displayName, displayName };
        },

        // Se ejecuta tras verificar la passkey, ANTES de persistirla/crear sesión.
        // AQUÍ se crea el usuario (con el id ya generado = userHandle) y se reclama la
        // invitación, de forma atómica. Si la invitación se perdió en el intermedio,
        // se revierte el usuario y se aborta (nada de sesión a medias). Si esto lanza,
        // el plugin no persiste la passkey ni crea sesión.
        async afterVerification({ ctx, user, context }) {
          // Un usuario YA existente agregando una passkey ("Agregar passkey a este
          // dispositivo" en el perfil): el plugin llama a este hook igual que en el alta
          // passkey-first, pero aquí NO hay invitación que reclamar ni usuario que crear
          // — la passkey se registra al usuario de la sesión (targetUserId = user.id ya
          // resuelto por el plugin). Sin este corte se exigía un código y se lanzaba
          // "Ese código acaba de ser usado…", dejando addPasskey roto con 500 (verificado).
          // El alta passkey-first crea el usuario MÁS ABAJO, así que aquí aún no existe:
          // "ya existe" ⇒ es un add-passkey, no un alta.
          const already = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
          if (already) return;

          const { code, avatar } = parseContext(context);
          const displayName = (user.displayName ?? user.name ?? "Anónimo").trim() || "Anónimo";

          const invite = code ? await prisma.invitation.findUnique({ where: { code: code.trim() } }) : null;
          if (!invite || invite.usedById || (invite.expiresAt && invite.expiresAt.getTime() < Date.now())) {
            throw ctx.error("BAD_REQUEST", { message: "Ese código acaba de ser usado por alguien más" });
          }

          await prisma.user.create({
            data: {
              id: user.id, // == userHandle generado en resolveUser
              name: displayName,
              email: null, // alta sin correo (recuperación opcional después)
              emailVerified: false,
              displayName,
              avatar: isAvatarKey(avatar) ? avatar : null,
            },
          });

          const claimed = await prisma.invitation.updateMany({
            where: { id: invite.id, usedById: null },
            data: { usedById: user.id },
          });
          if (claimed.count === 0) {
            await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
            throw ctx.error("BAD_REQUEST", { message: "Ese código acaba de ser usado por alguien más" });
          }
        },
      },
    }),

    // nextCookies debe ir de último: aplica las cookies en Server Actions / route handlers.
    nextCookies(),
  ],
});
