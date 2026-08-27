"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerWithInvite } from "@/app/actions/auth";

export function RegisterForm({ initialCode = "" }: { initialCode?: string }) {
  const [state, action, pending] = useActionState(registerWithInvite, undefined);

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "3rem" }} aria-hidden>
          🍺
        </div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Únete a FriaDay
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Solo por invitación de un amigo.
        </p>
      </div>

      <form action={action} className="card" style={{ padding: "1.25rem", display: "grid", gap: "0.9rem" }}>
        {state?.error && (
          <p role="alert" style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>
            {state.error}
          </p>
        )}
        <div>
          <label className="label" htmlFor="code">Código de invitación</label>
          <input
            id="code"
            name="code"
            defaultValue={initialCode}
            required
            autoCapitalize="characters"
            className="input"
            style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}
            placeholder="ABC2345"
          />
        </div>
        <div>
          <label className="label" htmlFor="displayName">Tu nombre</label>
          <input id="displayName" name="displayName" required className="input" placeholder="Como te dicen" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input" />
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
            Mínimo 8 caracteres.
          </p>
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.9rem", color: "var(--muted)" }}>
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Entrar
        </Link>
      </p>
    </>
  );
}
