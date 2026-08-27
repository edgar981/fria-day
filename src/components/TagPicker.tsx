"use client";

import { useEffect, useRef, useState } from "react";
import { searchUsersAction } from "@/app/actions/beers";

export interface DisplayTag {
  key: string; // id local o de servidor
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

  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {tags.map((t) => (
            <span key={t.key} className="chip">
              <span aria-hidden>{t.kind === "user" ? "👤" : "✎"}</span>
              {t.label}
              <button
                type="button"
                onClick={() => onRemove(t.key)}
                aria-label={`Quitar ${t.label}`}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem", lineHeight: 1 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={boxRef} style={{ position: "relative" }}>
        <input
          className="input"
          placeholder="Etiquetar a alguien de la app…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        {open && results.length > 0 && (
          <div
            className="card"
            style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, padding: "0.35rem", maxHeight: 220, overflowY: "auto" }}
          >
            {results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onAddUser(u);
                  setQuery("");
                  setOpen(false);
                }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem", borderRadius: "0.5rem", background: "transparent", border: "none", cursor: "pointer", color: "var(--text)" }}
              >
                👤 {u.displayName}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          className="input"
          placeholder="…o compañía sin app (texto libre)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (text.trim()) {
                onAddText(text.trim());
                setText("");
              }
            }
          }}
        />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (text.trim()) {
              onAddText(text.trim());
              setText("");
            }
          }}
        >
          Agregar
        </button>
      </div>
    </div>
  );
}
