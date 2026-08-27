"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "3rem" }} aria-hidden>
          🍺
        </div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          FriaDay
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Tus cervezas, salida por salida.
        </p>
      </div>

      <form action={action} className="card" style={{ padding: "1.25rem", display: "grid", gap: "0.9rem" }}>
        <h2 style={{ fontWeight: 700 }}>Entrar</h2>
        {state?.error && (
          <p
            role="alert"
            style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}
          >
            {state.error}
          </p>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.9rem", color: "var(--muted)" }}>
        ¿No tienes cuenta?{" "}
        <Link href="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Regístrate con tu código
        </Link>
      </p>
    </>
  );
}
