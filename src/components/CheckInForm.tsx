"use client";

import { useState } from "react";
import { BeerPicker, type BeerOption } from "@/components/BeerPicker";
import { FormatPicker } from "@/components/FormatPicker";
import { RatingInput } from "@/components/RatingInput";
import type { BeerFormat } from "@/lib/domain";

export interface CheckInDraft {
  beer: BeerOption;
  quantity: number;
  format: BeerFormat;
  rating: number;
}

const LAST_FORMAT_KEY = "fd:lastFormat";

function readLastFormat(): BeerFormat {
  if (typeof window === "undefined") return "BOTELLA";
  try {
    const v = window.localStorage.getItem(LAST_FORMAT_KEY);
    if (v === "BOTELLA" || v === "LATA" || v === "JARRA" || v === "PINTA") return v;
  } catch {
    /* storage no disponible */
  }
  return "BOTELLA";
}

export function CheckInForm({
  onSubmit,
  submitLabel = "Agregar cerveza",
}: {
  onSubmit: (draft: CheckInDraft) => Promise<boolean> | boolean;
  submitLabel?: string;
}) {
  const [beer, setBeer] = useState<BeerOption | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [format, setFormat] = useState<BeerFormat>(readLastFormat);
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!beer) return setError("Elige una cerveza");
    if (rating < 1) return setError("Pon un rating de 1 a 5");
    if (quantity < 1) return setError("Cantidad mínima 1");

    setBusy(true);
    try {
      const ok = await onSubmit({ beer, quantity, format, rating });
      if (ok) {
        try {
          window.localStorage.setItem(LAST_FORMAT_KEY, format);
        } catch {
          /* ignore */
        }
        setBeer(null);
        setQuantity(1);
        setRating(0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: "0.9rem", display: "grid", gap: "0.8rem" }}>
      <div>
        <span className="label">Cerveza</span>
        <BeerPicker value={beer} onSelect={setBeer} />
      </div>

      <div style={{ display: "flex", gap: "0.9rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <span className="label">Cantidad</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <button type="button" className="btn btn-ghost" style={{ padding: "0.35rem 0.7rem" }} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700, fontSize: "1.1rem" }}>{quantity}</span>
            <button type="button" className="btn btn-ghost" style={{ padding: "0.35rem 0.7rem" }} onClick={() => setQuantity((q) => Math.min(99, q + 1))}>
              +
            </button>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <span className="label">Rating</span>
          <RatingInput value={rating} onChange={setRating} />
        </div>
      </div>

      <div>
        <span className="label">Formato</span>
        <FormatPicker value={format} onChange={setFormat} />
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: 0 }}>{error}</p>}

      <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
        {busy ? "Guardando…" : submitLabel}
      </button>
    </div>
  );
}
