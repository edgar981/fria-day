"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInvite } from "@/app/actions/invites";

export function InviteGenerator() {
  const router = useRouter();
  const [expiresInDays, setExpiresInDays] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const link = code && typeof window !== "undefined"
    ? `${window.location.origin}/register?code=${code}`
    : "";

  async function generate() {
    setError(null);
    setCopied(null);
    setBusy(true);
    try {
      const res = await createInvite({ expiresInDays: expiresInDays === "" ? "" : expiresInDays });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCode(res.code);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, which: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("No se pudo copiar; hazlo manual.");
    }
  }

  return (
    <section className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
      <h2 style={{ fontWeight: 700 }}>Generar invitación</h2>
      <div>
        <label className="label" htmlFor="exp">Expira en (días, opcional)</label>
        <input
          id="exp"
          className="input"
          inputMode="numeric"
          placeholder="Sin expiración"
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value.replace(/[^\d]/g, ""))}
        />
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: 0 }}>{error}</p>}
      <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
        {busy ? "Generando…" : "Generar código"}
      </button>

      {code && (
        <div className="card" style={{ padding: "0.85rem", display: "grid", gap: "0.6rem", background: "var(--surface-2)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Código</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "0.15em" }}>{code}</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => copy(code, "code")}>
              {copied === "code" ? "✓ Copiado" : "Copiar código"}
            </button>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => copy(link, "link")}>
              {copied === "link" ? "✓ Copiado" : "Copiar link"}
            </button>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0, wordBreak: "break-all" }}>{link}</p>
        </div>
      )}
    </section>
  );
}
