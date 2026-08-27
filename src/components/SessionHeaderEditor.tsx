"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSessionHeader } from "@/app/actions/sessions";

const labelStyle: React.CSSProperties = { display: "block", font: "500 13px var(--font-sans)", color: "var(--color-tenue)", marginBottom: 6 };

export function SessionHeaderEditor({
  session,
}: {
  session: { id: string; date: string; placeName: string; notes: string };
}) {
  const router = useRouter();
  const [date, setDate] = useState(session.date);
  const [placeName, setPlaceName] = useState(session.placeName);
  const [notes, setNotes] = useState(session.notes);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateSessionHeader({ id: session.id, date, placeName, notes });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="eyebrow">Detalles</div>
      <div>
        <label style={labelStyle} htmlFor="e-date">Fecha</label>
        <input id="e-date" type="date" className="field" value={date} onChange={(e) => { setDate(e.target.value); setSaved(false); }} />
      </div>
      <div>
        <label style={labelStyle} htmlFor="e-place">Lugar</label>
        <input id="e-place" className="field" value={placeName} onChange={(e) => { setPlaceName(e.target.value); setSaved(false); }} placeholder="Bar, casa, parque…" />
      </div>
      <div>
        <label style={labelStyle} htmlFor="e-notes">Notas</label>
        <textarea id="e-notes" className="field" rows={2} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} />
      </div>
      {error && <p style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" className="btn btn-primary" style={{ height: 48 }} onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar detalles"}
        </button>
        {saved && <span style={{ color: "var(--color-tenue)", font: "500 14px var(--font-sans)" }}>✓ Guardado</span>}
      </div>
    </section>
  );
}
