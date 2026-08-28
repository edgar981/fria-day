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
        return (
          <button
            key={o.key ?? "anon"}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(o.key)}
            style={{ textAlign: "center", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          >
            {/* El anillo de selección va como BORDER de este contenedor (dentro del
                border-box), no como `outline`: en iOS/WebKit el outline sobre un
                <svg> con offset+radius se pinta incompleto, y un outline lo puede
                recortar un ancestro con overflow. El borde siempre reserva 3px
                (transparente si no está elegido) para que el layout no salte, y el
                padding deja el espacio entre el anillo y el avatar. Un único
                indicador → exactamente una celda marcada. */}
            <div
              style={{
                borderRadius: 27,
                padding: 3,
                border: `3px solid ${selected ? "var(--color-ambar)" : "transparent"}`,
                transition: "border-color .12s ease",
              }}
            >
              <svg
                viewBox="0 0 48 48"
                style={{ width: "100%", aspectRatio: "1", borderRadius: 24, background: o.bg, display: "block" }}
              >
                <use href={`#${o.symbol}`} />
              </svg>
            </div>
            <span style={{ display: "block", marginTop: 5, font: `${selected ? 700 : 500} 12px var(--font-sans)`, color: selected ? "var(--color-ambar)" : "var(--color-tenue)" }}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
