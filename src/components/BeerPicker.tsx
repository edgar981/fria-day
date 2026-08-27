"use client";

import { useEffect, useRef, useState } from "react";
import { searchBeersAction, createBeer } from "@/app/actions/beers";

export interface BeerOption {
  id: string;
  name: string;
  brewery: string;
  style: string | null;
  abv: string | null;
}

export function BeerPicker({
  value,
  onSelect,
}: {
  value: BeerOption | null;
  onSelect: (beer: BeerOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BeerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBrewery, setNewBrewery] = useState("");
  const [newStyle, setNewStyle] = useState("");
  const [newAbv, setNewAbv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchBeersAction(query);
      if (active) {
        setResults(r);
        setLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function handleCreate() {
    setError(null);
    if (!query.trim() || !newBrewery.trim()) {
      setError("Nombre y cervecería son obligatorios");
      return;
    }
    const res = await createBeer({
      name: query.trim(),
      brewery: newBrewery.trim(),
      style: newStyle.trim(),
      abv: newAbv.trim() === "" ? "" : newAbv.trim(),
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSelect(res.beer);
    reset();
  }

  function reset() {
    setOpen(false);
    setCreating(false);
    setQuery("");
    setNewBrewery("");
    setNewStyle("");
    setNewAbv("");
    setError(null);
  }

  if (value) {
    return (
      <div
        className="card"
        style={{
          padding: "0.6rem 0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {value.name}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            {value.brewery}
            {value.style ? ` · ${value.style}` : ""}
          </div>
        </div>
        <button type="button" className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }} onClick={() => onSelect(null)}>
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        className="input"
        placeholder="Buscar cerveza…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 280,
            overflowY: "auto",
            padding: "0.35rem",
          }}
        >
          {!creating && (
            <>
              {loading && (
                <div style={{ padding: "0.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>Buscando…</div>
              )}
              {!loading && results.length === 0 && (
                <div style={{ padding: "0.5rem", color: "var(--muted)", fontSize: "0.85rem" }}>
                  Sin resultados.
                </div>
              )}
              {results.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onSelect(b);
                    reset();
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{b.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    {b.brewery}
                    {b.style ? ` · ${b.style}` : ""}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  if (!query.trim()) setError("Escribe primero el nombre arriba");
                }}
                className="btn btn-ghost"
                style={{ width: "100%", marginTop: "0.25rem", justifyContent: "flex-start" }}
              >
                ＋ Crear {query.trim() ? `«${query.trim()}»` : "una cerveza nueva"}
              </button>
            </>
          )}

          {creating && (
            <div style={{ display: "grid", gap: "0.55rem", padding: "0.35rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                Nueva cerveza: {query.trim() || "(escribe el nombre arriba)"}
              </div>
              <input className="input" placeholder="Cervecería *" value={newBrewery} onChange={(e) => setNewBrewery(e.target.value)} />
              <input className="input" placeholder="Estilo (opcional)" value={newStyle} onChange={(e) => setNewStyle(e.target.value)} />
              <input
                className="input"
                placeholder="ABV % (opcional)"
                inputMode="decimal"
                value={newAbv}
                onChange={(e) => setNewAbv(e.target.value)}
              />
              {error && <p style={{ color: "var(--danger)", fontSize: "0.8rem", margin: 0 }}>{error}</p>}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreate}>
                  Crear y usar
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
                  Atrás
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
