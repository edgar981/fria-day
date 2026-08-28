"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [pkBusy, setPkBusy] = useState(false);
  const [pkError, setPkError] = useState<string | null>(null);

  // Autofill condicional (si el navegador/versión lo soportan). Arma una petición
  // WebAuthn con mediation:conditional; si el usuario elige una passkey desde el
  // autocompletado, entra directo. Silencioso si no hay passkeys o no se soporta.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pkc = typeof window !== "undefined" ? window.PublicKeyCredential : undefined;
        if (!pkc?.isConditionalMediationAvailable || !(await pkc.isConditionalMediationAvailable())) return;
        const res = await authClient.signIn.passkey({ autoFill: true });
        if (!cancelled && res && "data" in res && res.data) window.location.assign("/");
      } catch {
        /* sin passkeys / cancelado: no-op */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function signInWithPasskey() {
    setPkError(null);
    setPkBusy(true);
    try {
      const res = await authClient.signIn.passkey();
      if (res && "data" in res && res.data) window.location.assign("/");
      else setPkError("No se pudo entrar con passkey. Prueba otra forma.");
    } catch {
      setPkError("Tu dispositivo canceló o no tiene una passkey de FriaDay.");
    } finally {
      setPkBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "calc(24px + env(safe-area-inset-top)) 26px 24px", gap: 22 }}>
      <div style={{ textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/friaday-icon.png" alt="" width={72} height={72} style={{ borderRadius: 20, display: "block", margin: "0 auto 14px" }} />
        <div style={{ font: "800 40px/1 var(--font-display)", letterSpacing: "-.03em", color: "var(--color-espuma)" }}>FriaDay</div>
        <p style={{ font: "500 15px var(--font-sans)", color: "var(--color-tenue)", margin: "10px 0 0" }}>El parche lleva la cuenta.</p>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {pkError && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 14px var(--font-sans)", margin: 0, textAlign: "center" }}>{pkError}</p>}
        <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={signInWithPasskey} disabled={pkBusy}>
          {pkBusy ? "Abriendo FaceID…" : "Entrar con passkey"}
        </button>

        {!showPassword ? (
          <button type="button" onClick={() => setShowPassword(true)} style={{ background: "none", border: "none", color: "var(--color-tenue)", font: "500 13.5px var(--font-sans)", cursor: "pointer", padding: 6 }}>
            Otra forma de entrar
          </button>
        ) : (
          <form action={action} style={{ display: "grid", gap: 14, marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flex: 1, height: 1, background: "#241A12" }} />
              <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue-2)" }}>correo y contraseña</span>
              <span style={{ flex: 1, height: 1, background: "#241A12" }} />
            </div>
            {state?.error && (
              <p role="alert" style={{ color: "var(--color-alerta)", font: "500 14px var(--font-sans)", margin: 0 }}>{state.error}</p>
            )}
            <div>
              <label style={{ display: "block", font: "500 13px var(--font-sans)", color: "var(--color-tenue)", marginBottom: 6 }} htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="username webauthn" required className="field" />
            </div>
            <div>
              <label style={{ display: "block", font: "500 13px var(--font-sans)", color: "var(--color-tenue)", marginBottom: 6 }} htmlFor="password">Contraseña</label>
              <input id="password" name="password" type="password" autoComplete="current-password webauthn" required className="field" />
            </div>
            <button type="submit" className="btn btn-ghost" style={{ width: "100%", height: 52 }} disabled={pending}>
              {pending ? "Entrando…" : "Entrar con contraseña"}
            </button>
          </form>
        )}
      </div>

      <p style={{ textAlign: "center", font: "400 14px var(--font-sans)", color: "var(--color-tenue)" }}>
        ¿No tienes cuenta?{" "}
        <Link href="/register" style={{ color: "var(--color-ambar)", fontWeight: 600 }}>Regístrate con tu código</Link>
      </p>
    </div>
  );
}
