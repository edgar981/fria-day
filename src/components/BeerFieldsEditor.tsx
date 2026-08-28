"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBeerFields } from "@/app/actions/beers";

// Editar estilo/ABV desde el detalle (B.1 · item 4). Para completar vacíos o corregir.
export function BeerFieldsEditor({
  beerId,
  style,
  abv,
}: {
  beerId: string;
  style: string | null;
  abv: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [styleVal, setStyleVal] = useState(style ?? "");
  const [abvVal, setAbvVal] = useState(abv ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incompleto = !style || !abv;

  async function save() {
    setError(null);
    setBusy(true);
    const res = await updateBeerFields(beerId, { style: styleVal, abv: abvVal });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else setError(res.error);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ alignSelf: "flex-start", background: "none", border: "none", color: incompleto ? "var(--color-ambar)" : "var(--color-tenue)", font: "600 13px var(--font-sans)", cursor: "pointer", padding: 0, textDecoration: "underline" }}
      >
        {incompleto ? "Completar estilo o ABV" : "Editar estilo y ABV"}
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
      <div>
        <label style={{ display: "block", font: "500 12.5px var(--font-sans)", color: "var(--color-tenue)", marginBottom: 6 }}>Estilo</label>
        <input className="field" value={styleVal} onChange={(e) => setStyleVal(e.target.value)} placeholder="IPA, Lager, Stout…" />
      </div>
      <div>
        <label style={{ display: "block", font: "500 12.5px var(--font-sans)", color: "var(--color-tenue)", marginBottom: 6 }}>ABV (%)</label>
        <input className="field" inputMode="decimal" value={abvVal} onChange={(e) => setAbvVal(e.target.value)} placeholder="Déjalo vacío si no lo sabes con certeza" />
        <p style={{ font: "400 11.5px/1.4 var(--font-sans)", color: "var(--color-tenue-2)", margin: "6px 0 0" }}>
          Está impreso en la etiqueta. Mejor vacío que incorrecto.
        </p>
      </div>
      {error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-primary" style={{ flex: 1, height: 46 }} onClick={save} disabled={busy}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className="btn btn-ghost" style={{ height: 46 }} onClick={() => { setOpen(false); setStyleVal(style ?? ""); setAbvVal(abv ?? ""); setError(null); }}>Cancelar</button>
      </div>
    </div>
  );
}
