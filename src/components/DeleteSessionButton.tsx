"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSession } from "@/app/actions/sessions";

// Disparador "Borrar" + confirmación con conteo de check-ins. `block` (DS · modo Editar):
// fila completa centrada "Borrar la salida"; por defecto, enlace tenue para el header.
export function DeleteSessionButton({
  sessionId,
  checkInCount,
  label = "Borrar",
  block = false,
}: {
  sessionId: string;
  checkInCount: number;
  label?: string;
  block?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={
          block
            ? { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: 44, background: "transparent", border: "none", color: "var(--color-alerta)", font: "600 14px var(--font-sans)", cursor: "pointer" }
            : { background: "none", border: "none", color: "var(--color-alerta)", font: "600 14.5px var(--font-sans)", cursor: "pointer" }
        }
      >
        {label}
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div onClick={() => !pending && setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(10,7,4,.62)" }} />
          <div style={{ position: "absolute", left: 18, right: 18, top: "50%", transform: "translateY(-50%)", maxWidth: 400, margin: "0 auto", background: "var(--color-barra)", border: "1px solid var(--color-alerta)", borderRadius: 24, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ font: "800 22px/1.1 var(--font-display)", letterSpacing: "-.02em" }}>¿Borrar esta salida?</div>
            <p style={{ margin: 0, font: "400 14.5px/1.5 var(--font-sans)", color: "var(--color-tenue)" }}>
              {checkInCount > 0 ? (
                <>Se perderán <strong style={{ color: "var(--color-crema)" }}>{checkInCount} check-in{checkInCount !== 1 ? "s" : ""}</strong>. </>
              ) : null}
              Esto no se puede deshacer.
            </p>
            {error && <p style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 9 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} disabled={pending} onClick={() => setOpen(false)}>Cancelar</button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, background: "var(--color-alerta)", color: "#2A0E0A" }}
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteSession(sessionId);
                    if (!res.ok) { setError(res.error); return; }
                    router.push("/");
                    router.refresh();
                  })
                }
              >
                {pending ? "Borrando…" : "Sí, borrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
