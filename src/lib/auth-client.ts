"use client";

import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // Mismo origen → no hace falta baseURL.
  plugins: [
    inferAdditionalFields({
      user: { displayName: { type: "string" } },
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
