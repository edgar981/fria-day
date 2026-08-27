import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // Grupo cerrado de amigos: sin verificación de email (no hay proveedor de
  // correo). El gating real es el código de invitación (ver actions/auth.ts).
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
    },
  },

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  // nextCookies debe ir de último: aplica las cookies en Server Actions / route handlers.
  plugins: [nextCookies()],
});
