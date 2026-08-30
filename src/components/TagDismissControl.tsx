"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTagDismissed } from "@/app/actions/sessions";

// Solo lo ve el propio etiquetado. Marca/desmarca "no tomé ese día": neutro para
// su racha y fuera del denominador de "quién falta".
export function TagDismissControl({ tagId, dismissed }: { tagId: string; dismissed: boolean }) {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(dismissed);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(next: boolean) {
    setError(null);
    start(async () => {
      const res = await setTagDismissed(tagId, next);
      if (res.ok) {
        setIsDismissed(next);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      {isDismissed ? (
        <>
          <div style={{ font: "600 14.5px var(--font-sans)" }}>Marcaste que no tomaste ese día.</div>
          <p style={{ font: "400 12.5px/1.45 var(--font-sans)", color: "var(--color-tenue)", margin: 0 }}>
            No afecta tu racha.
          </p>
          <button type="button" className="btn btn-ghost" style={{ height: 44 }} onClick={() => toggle(false)} disabled={pending}>
            {pending ? "…" : "Deshacer"}
          </button>
        </>
      ) : (
        <>
          <div style={{ font: "600 14.5px var(--font-sans)" }}>¿No tomaste ese día?</div>
          <p style={{ font: "400 12.5px/1.45 var(--font-sans)", color: "var(--color-tenue)", margin: 0 }}>
            Márcalo y no afecta tu racha.
          </p>
          <button type="button" className="btn btn-ghost" style={{ height: 44 }} onClick={() => toggle(true)} disabled={pending}>
            {pending ? "…" : "No tomé ese día"}
          </button>
        </>
      )}
      {error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: 0 }}>{error}</p>}
    </div>
  );
}
