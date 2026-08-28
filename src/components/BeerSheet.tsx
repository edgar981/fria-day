"use client";

import { useEffect, useState } from "react";
import { searchBeersAction, createBeer } from "@/app/actions/beers";
import { FormatPicker } from "@/components/FormatPicker";
import { RatingInput } from "@/components/RatingInput";
import { Icon } from "@/components/Icon";
import { BEER_FORMATS, type BeerFormat } from "@/lib/domain";
import type { BeerOption } from "@/lib/beer";

const LAST_FORMAT_KEY = "fd:lastFormat";
function readLastFormat(): BeerFormat {
  if (typeof window === "undefined") return "BOTELLA";
  try {
    const v = window.localStorage.getItem(LAST_FORMAT_KEY);
    if ((BEER_FORMATS as readonly string[]).includes(v ?? "")) return v as BeerFormat;
  } catch {}
  return "BOTELLA";
}

export interface SheetDraft {
  beer: BeerOption;
  format: BeerFormat;
  rating: number; // 0 = sin calificar
}

const FoamIcon = () => (
  <span style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(180deg,#4A3413,#2A1E0E)", display: "flex", alignItems: "flex-end", justifyContent: "center", flex: "none", overflow: "hidden" }}>
    <span style={{ width: "100%", height: 9, background: "var(--color-espuma)" }} />
  </span>
);

export function BeerSheet({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (draft: SheetDraft) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BeerOption[]>([]);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState(false);
  const [selected, setSelected] = useState<BeerOption | null>(null);
  const [creating, setCreating] = useState(false);
  const [brewery, setBrewery] = useState("");
  const [style, setStyle] = useState("");
  const [format, setFormat] = useState<BeerFormat>("BOTELLA");
  const [rating, setRating] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setFormat(readLastFormat());
  }, [open]);

  useEffect(() => {
    if (!open || selected || creating) return;
    let active = true;
    setSearching(true);
    setSearchError(false);
    const t = setTimeout(async () => {
      try {
        const r = await searchBeersAction(query);
        if (active) setResults(r);
      } catch {
        if (active) setSearchError(true);
      } finally {
        if (active) setSearching(false);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open, selected, creating]);

  if (!open) return null;

  function reset() {
    setQuery("");
    setResults([]);
    setSelected(null);
    setCreating(false);
    setBrewery("");
    setStyle("");
    setRating(0);
    setError(null);
  }
  // Cerrar sin agregar CONSERVA el borrador (item A.1-7b): al reabrir sigue lo
  // que se había elegido/escrito. Solo un commit exitoso limpia el estado.
  function dismiss() {
    onClose();
  }

  async function commit() {
    setError(null);
    let beer = selected;
    if (!beer && creating) {
      if (!query.trim() || !brewery.trim()) {
        setError("Nombre y cervecería son obligatorios");
        return;
      }
      setBusy(true);
      const res = await createBeer({ name: query.trim(), brewery: brewery.trim(), style: style.trim(), abv: "" });
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      beer = res.beer;
    }
    if (!beer) {
      setError("Elige o crea una cerveza");
      return;
    }
    try {
      window.localStorage.setItem(LAST_FORMAT_KEY, format);
    } catch {}
    setBusy(true);
    await onAdd({ beer, format, rating });
    setBusy(false);
    reset(); // add exitoso: sí limpiamos para el próximo
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      <div onClick={dismiss} style={{ position: "absolute", inset: 0, background: "rgba(10,7,4,.62)" }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          margin: "0 auto",
          maxWidth: 440,
          background: "var(--color-barra)",
          borderTop: "1px solid var(--color-borde)",
          borderRadius: "30px 30px 0 0",
          padding: "12px 18px calc(env(safe-area-inset-bottom,0px) + 20px)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        <span style={{ width: 44, height: 4, borderRadius: 99, background: "#4A3A28", alignSelf: "center" }} />
        <span style={{ font: "800 22px/1 var(--font-display)", letterSpacing: "-.02em" }}>¿Cuál te tomaste?</span>

        {selected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 11, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 16, padding: "10px 13px" }}>
            <FoamIcon />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 16px/1.2 var(--font-sans)" }}>{selected.name}</div>
              <div style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>
                {selected.brewery}
                {selected.style ? ` · ${selected.style}` : ""}
              </div>
            </div>
            <button type="button" className="btn btn-ghost" style={{ height: 38, fontSize: 13 }} onClick={() => setSelected(null)}>
              Cambiar
            </button>
          </div>
        ) : (
          <>
            <div style={{ height: 54, border: "1px solid #4A3A28", borderRadius: 16, background: "var(--color-barra-alta)", display: "flex", alignItems: "center", gap: 11, padding: "0 15px" }}>
              <Icon name="search" size={21} color="var(--color-ambar)" />
              <input
                autoFocus
                className="field"
                style={{ height: "auto", border: "none", background: "transparent", padding: 0 }}
                placeholder="Buscar cerveza…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {!creating && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* 3 estados: cargando (esqueletos) · sin resultados · error. */}
                {searching ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 4px", borderBottom: "1px solid #241A12" }}>
                      <span className="skeleton" style={{ width: 44, height: 44, borderRadius: 13, flex: "none" }} />
                      <span style={{ flex: 1 }}>
                        <span className="skeleton" style={{ width: "60%", height: 15, borderRadius: 6, display: "block" }} />
                        <span className="skeleton" style={{ width: "40%", height: 11, borderRadius: 6, display: "block", marginTop: 6 }} />
                      </span>
                    </span>
                  ))
                ) : searchError ? (
                  <span style={{ padding: "13px 4px", font: "400 13px var(--font-sans)", color: "var(--color-alerta)" }}>No se pudo buscar. Intenta de nuevo.</span>
                ) : results.length === 0 ? (
                  <span style={{ padding: "13px 4px", font: "400 13px var(--font-sans)", color: "var(--color-tenue)" }}>
                    {query.trim() ? "No hay cervezas que coincidan." : "Aún no hay cervezas. Créala abajo."}
                  </span>
                ) : (
                  results.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelected(b)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 4px", borderBottom: "1px solid #241A12", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: "var(--color-crema)" }}
                    >
                      <FoamIcon />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ font: "600 16px/1.2 var(--font-sans)", display: "block" }}>{b.name}</span>
                        <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>
                          {b.brewery}
                          {b.style ? ` · ${b.style}` : ""}
                        </span>
                      </span>
                    </button>
                  ))
                )}
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  style={{ border: "1px dashed #6B5334", borderRadius: 18, padding: 14, marginTop: 6, background: "transparent", color: "var(--color-ambar)", font: "600 14.5px var(--font-sans)", cursor: "pointer", textAlign: "left" }}
                >
                  ＋ Crear {query.trim() ? `«${query.trim()}»` : "una cerveza"}
                </button>
              </div>
            )}

            {creating && (
              <div style={{ border: "1px dashed #6B5334", borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
                <span style={{ font: "600 14.5px var(--font-sans)", color: "var(--color-ambar)" }}>
                  ＋ Crear {query.trim() ? `«${query.trim()}»` : "cerveza"}
                </span>
                <input className="field" style={{ height: 48 }} placeholder="Cervecería *" value={brewery} onChange={(e) => setBrewery(e.target.value)} />
                <input className="field" style={{ height: 48 }} placeholder="Estilo (opcional)" value={style} onChange={(e) => setStyle(e.target.value)} />
                <span style={{ font: "400 12px/1.4 var(--font-sans)", color: "var(--color-tenue-2)" }}>
                  Solo la cervecería es obligatoria. Lo demás se puede completar después, desde el catálogo.
                </span>
                <button type="button" className="btn btn-ghost" style={{ alignSelf: "flex-start", height: 40 }} onClick={() => setCreating(false)}>
                  Atrás
                </button>
              </div>
            )}
          </>
        )}

        <div>
          <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Formato</span>
          <FormatPicker value={format} onChange={setFormat} />
        </div>
        <div>
          <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>Rating</span>
          <RatingInput value={rating} onChange={setRating} />
        </div>

        {error && <p style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: 0 }}>{error}</p>}

        <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={busy || (!selected && !creating)} onClick={commit}>
          {busy ? "Guardando…" : "Agregar a la salida"}
        </button>
      </div>
    </div>
  );
}
