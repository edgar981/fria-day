"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckInForm, type CheckInDraft } from "@/components/CheckInForm";
import { TagPicker, type DisplayTag } from "@/components/TagPicker";
import { Stars } from "@/components/Stars";
import { createSession } from "@/app/actions/sessions";
import { todayInputValue, FORMAT_LABEL } from "@/lib/format";
import type { BeerFormat } from "@/lib/domain";

interface LocalCheckIn {
  key: string;
  beerId: string;
  beerName: string;
  brewery: string;
  quantity: number;
  format: BeerFormat;
  rating: number;
}

interface LocalTag {
  key: string;
  kind: "user" | "text";
  label: string;
  userId?: string;
  text?: string;
}

export function NewSessionForm() {
  const router = useRouter();
  const [date, setDate] = useState(todayInputValue());
  const [placeName, setPlaceName] = useState("");
  const [notes, setNotes] = useState("");
  const [checkIns, setCheckIns] = useState<LocalCheckIn[]>([]);
  const [tags, setTags] = useState<LocalTag[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let seq = 0;
  const newKey = () => `${Date.now()}-${seq++}-${Math.round(performance.now())}`;

  function addCheckIn(d: CheckInDraft): boolean {
    setCheckIns((cur) => [
      ...cur,
      {
        key: newKey(),
        beerId: d.beer.id,
        beerName: d.beer.name,
        brewery: d.beer.brewery,
        quantity: d.quantity,
        format: d.format,
        rating: d.rating,
      },
    ]);
    return true;
  }

  const total = checkIns.reduce((s, c) => s + c.quantity, 0);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await createSession({
        date,
        placeName,
        notes,
        tags: tags.map((t) =>
          t.kind === "user" ? { taggedUserId: t.userId } : { freeText: t.text },
        ),
        checkIns: checkIns.map((c) => ({
          beerId: c.beerId,
          quantity: c.quantity,
          format: c.format,
          rating: c.rating,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      router.push(`/sessions/${res.id}`);
      router.refresh();
    } catch {
      setError("Algo salió mal, intenta de nuevo");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }}>
        <h2 style={{ fontWeight: 700 }}>Detalles</h2>
        <div>
          <label className="label" htmlFor="date">Fecha</label>
          <input id="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.3rem" }}>
            Puedes registrar días pasados (ej. “ayer fueron 6”).
          </p>
        </div>
        <div>
          <label className="label" htmlFor="place">Lugar</label>
          <input id="place" className="input" placeholder="Bar, casa, parque…" value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="notes">Notas</label>
          <textarea id="notes" className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.7rem" }}>
        <h2 style={{ fontWeight: 700 }}>Compañía</h2>
        <TagPicker
          tags={tags as DisplayTag[]}
          excludeUserIds={tags.filter((t) => t.userId).map((t) => t.userId!)}
          onAddUser={(u) =>
            setTags((cur) => [...cur, { key: newKey(), kind: "user", label: u.displayName, userId: u.id }])
          }
          onAddText={(text) =>
            setTags((cur) => [...cur, { key: newKey(), kind: "text", label: text, text }])
          }
          onRemove={(key) => setTags((cur) => cur.filter((t) => t.key !== key))}
        />
      </section>

      <section style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontWeight: 700 }}>Cervezas</h2>
          {total > 0 && (
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              {total} unidad{total !== 1 ? "es" : ""}
            </span>
          )}
        </div>

        {checkIns.length > 0 && (
          <ul style={{ display: "grid", gap: "0.5rem", listStyle: "none", padding: 0, margin: 0 }}>
            {checkIns.map((c) => (
              <li key={c.key} className="card" style={{ padding: "0.6rem 0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.quantity}× {c.beerName}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    {c.brewery} · {FORMAT_LABEL[c.format]} · <Stars value={c.rating} size="0.8rem" />
                  </div>
                </div>
                <button type="button" className="btn btn-ghost" style={{ padding: "0.3rem 0.55rem" }} onClick={() => setCheckIns((cur) => cur.filter((x) => x.key !== c.key))} aria-label="Quitar">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <CheckInForm onSubmit={addCheckIn} submitLabel="Agregar a la lista" />
      </section>

      {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

      <button type="button" className="btn btn-primary" style={{ padding: "0.85rem", fontSize: "1rem" }} onClick={submit} disabled={busy}>
        {busy ? "Creando…" : "Crear sesión"}
      </button>
    </div>
  );
}
