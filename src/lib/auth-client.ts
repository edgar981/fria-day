"use client";

import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  // Mismo origen → no hace falta baseURL.
  plugins: [
    inferAdditionalFields({
      user: {
        displayName: { type: "string" },
        avatar: { type: "string", required: false },
      },
    }),
    passkeyClient(),
  ],
});

export const { signIn, signUp, signOut, useSession, passkey } = authClient;
