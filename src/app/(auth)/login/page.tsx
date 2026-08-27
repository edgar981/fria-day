"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "24px 26px", gap: 24 }}>
      <div style={{ textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/friaday-icon.png" alt="" width={72} height={72} style={{ borderRadius: 20, display: "block", margin: "0 auto 14px" }} />
        <div style={{ font: "800 40px/1 var(--font-display)", letterSpacing: "-.03em", color: "var(--color-espuma)" }}>FriaDay</div>
        <p style={{ font: "500 15px var(--font-sans)", color: "var(--color-tenue)", margin: "10px 0 0" }}>El parche lleva la cuenta.</p>
      </div>

      <form action={action} style={{ display: "grid", gap: 14 }}>
        {state?.error && (
          <p role="alert" style={{ color: "var(--color-alerta)", font: "500 14px var(--font-sans)", margin: 0 }}>{state.error}</p>
        )}
        <div>
          <label style={{ display: "block", font: "500 13px var(--font-sans)", color: "var(--color-tenue)", marginBottom: 6 }} htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label style={{ display: "block", font: "500 13px var(--font-sans)", color: "var(--color-tenue)", marginBottom: 6 }} htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p style={{ textAlign: "center", font: "400 14px var(--font-sans)", color: "var(--color-tenue)" }}>
        ¿No tienes cuenta?{" "}
        <Link href="/register" style={{ color: "var(--color-ambar)", fontWeight: 600 }}>Regístrate con tu código</Link>
      </p>
    </div>
  );
}
