"use client";

import { AVATAR_KEYS, AVATAR_META, ANON_META } from "@/lib/avatars";

const OPTIONS: { key: string | null; symbol: string; bg: string; label: string }[] = [
  { key: null, symbol: ANON_META.symbol, bg: ANON_META.bg, label: "Anónimo" },
  ...AVATAR_KEYS.map((k) => ({ key: k, symbol: AVATAR_META[k].symbol, bg: AVATAR_META[k].bg, label: AVATAR_META[k].label })),
];

export function AvatarPicker({
  value,
  onSelect,
}: {
  value: string | null;
  onSelect: (key: string | null) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11 }}>
      {OPTIONS.map((o) => {
        const selected = (value ?? null) === o.key;
        const anon = o.key === null;
        return (
          <button
            key={o.key ?? "anon"}
            type="button"
            onClick={() => onSelect(o.key)}
            style={{ textAlign: "center", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          >
            <svg
              viewBox="0 0 48 48"
              style={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: 24,
                background: o.bg,
                display: "block",
                outline: selected ? "3px solid var(--color-ambar)" : "none",
                outlineOffset: 3,
                ...(anon ? { border: "1px dashed #4A3A28" } : null),
              }}
            >
              <use href={`#${o.symbol}`} />
            </svg>
            <span style={{ display: "block", marginTop: 5, font: `${selected ? 700 : 500} 12px var(--font-sans)`, color: selected ? "var(--color-ambar)" : "var(--color-tenue)" }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
