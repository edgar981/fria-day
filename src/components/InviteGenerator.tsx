"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createInvite } from "@/app/actions/invites";
import { ShareCodeButton } from "@/components/ShareCodeButton";

export function InviteGenerator() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const link = code && typeof window !== "undefined" ? `${window.location.origin}/register?code=${code}` : "";

  async function generate() {
    setError(null);
    setCopied(null);
    setBusy(true);
    try {
      // N.2: los códigos ya no expiran (un parche de amigos no lo necesita). Se manda
      // "" → expiresAt null. La columna Invitation.expiresAt se queda en el esquema.
      const res = await createInvite({ expiresInDays: "" });
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
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="eyebrow">Generar código</div>
      {error && <p style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: 0 }}>{error}</p>}
      <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={generate} disabled={busy}>
        {busy ? "Generando…" : "Generar código"}
      </button>

      {code && (
        <div style={{ background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 18, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ font: "400 11.5px var(--font-sans)", color: "var(--color-tenue)", letterSpacing: ".1em" }}>CÓDIGO</div>
            <div style={{ font: "700 30px var(--font-display)", letterSpacing: ".18em", color: "var(--color-espuma)", marginTop: 4 }}>{code}</div>
          </div>
          <ShareCodeButton code={code} variant="primary" />
          <div style={{ display: "flex", gap: 9 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1, height: 44 }} onClick={() => copy(code, "code")}>
              {copied === "code" ? "✓ Copiado" : "Copiar código"}
            </button>
            <button type="button" className="btn btn-ghost" style={{ flex: 1, height: 44 }} onClick={() => copy(link, "link")}>
              {copied === "link" ? "✓ Copiado" : "Copiar link"}
            </button>
          </div>
          <p style={{ font: "400 11.5px var(--font-sans)", color: "var(--color-tenue-2)", margin: 0, wordBreak: "break-all" }}>{link}</p>
        </div>
      )}
    </div>
  );
}
