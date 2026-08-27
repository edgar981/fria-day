"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSessionHeader } from "@/app/actions/sessions";

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
    <section className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
      <h2 style={{ fontWeight: 700 }}>Detalles</h2>
      <div>
        <label className="label" htmlFor="e-date">Fecha</label>
        <input id="e-date" type="date" className="input" value={date} onChange={(e) => { setDate(e.target.value); setSaved(false); }} />
      </div>
      <div>
        <label className="label" htmlFor="e-place">Lugar</label>
        <input id="e-place" className="input" value={placeName} onChange={(e) => { setPlaceName(e.target.value); setSaved(false); }} placeholder="Bar, casa, parque…" />
      </div>
      <div>
        <label className="label" htmlFor="e-notes">Notas</label>
        <textarea id="e-notes" className="input" rows={2} value={notes} onChange={(e) => { setNotes(e.target.value); setSaved(false); }} />
      </div>
      {error && <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar detalles"}
        </button>
        {saved && <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>✓ Guardado</span>}
      </div>
    </section>
  );
}
