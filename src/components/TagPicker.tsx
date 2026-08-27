"use client";

import { useEffect, useRef, useState } from "react";
import { searchUsersAction } from "@/app/actions/beers";

export interface DisplayTag {
  key: string;
  label: string;
  kind: "user" | "text";
}

export function TagPicker({
  tags,
  excludeUserIds,
  onAddUser,
  onAddText,
  onRemove,
}: {
  tags: DisplayTag[];
  excludeUserIds: string[];
  onAddUser: (u: { id: string; displayName: string }) => void;
  onAddText: (text: string) => void;
  onRemove: (key: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; displayName: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const t = setTimeout(async () => {
      const r = await searchUsersAction(query);
      if (active) setResults(r.filter((u) => !excludeUserIds.includes(u.id)));
    }, 180);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open, excludeUserIds]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const chip = (t: DisplayTag) => (
    <span key={t.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: t.kind === "user" ? "var(--color-barra-alta)" : "transparent", border: `1px ${t.kind === "user" ? "solid var(--color-borde)" : "dashed #4A3A28"}`, borderRadius: 999, padding: "5px 10px", font: "500 12.5px var(--font-sans)", color: "var(--color-crema)" }}>
      {t.kind === "user" ? "👤" : ""} {t.label}
      <button type="button" onClick={() => onRemove(t.key)} aria-label={`Quitar ${t.label}`} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-tenue)", fontSize: 15, lineHeight: 1 }}>×</button>
    </span>
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {tags.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{tags.map(chip)}</div>}

      <div ref={boxRef} style={{ position: "relative" }}>
        <input className="field" placeholder="Etiquetar a alguien de la app…" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setOpen(true)} />
        {open && results.length > 0 && (
          <div className="card" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, padding: 6, maxHeight: 220, overflowY: "auto" }}>
            {results.map((u) => (
              <button key={u.id} type="button" onClick={() => { onAddUser(u); setQuery(""); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px", borderRadius: 12, background: "transparent", border: "none", cursor: "pointer", color: "var(--color-crema)", font: "500 15px var(--font-sans)" }}>
                👤 {u.displayName}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 7 }}>
        <input className="field" style={{ height: 48 }} placeholder="…o compañía sin app" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (text.trim()) { onAddText(text.trim()); setText(""); } } }} />
        <button type="button" className="btn btn-ghost" style={{ height: 48 }} onClick={() => { if (text.trim()) { onAddText(text.trim()); setText(""); } }}>Agregar</button>
      </div>
    </div>
  );
}
