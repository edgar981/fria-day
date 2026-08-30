"use client";

import { FORMATS_BY_KIND, type BeerFormat, type DrinkKind } from "@/lib/domain";
import { FORMAT_LABEL } from "@/lib/format";

export function FormatPicker({
  value,
  onChange,
  kind = "CERVEZA",
}: {
  value: BeerFormat;
  onChange: (f: BeerFormat) => void;
  kind?: DrinkKind;
}) {
  // Solo los formatos del tipo elegido (Pasada D): cerveza no ofrece copa/vaso, y
  // cóctel no ofrece botella/lata.
  return (
    <div style={{ display: "flex", gap: 7 }}>
      {FORMATS_BY_KIND[kind].map((f) => {
        const active = f === value;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            aria-pressed={active}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              cursor: "pointer",
              font: `${active ? 600 : 500} 14px var(--font-sans)`,
              background: active ? "var(--color-ambar)" : "var(--color-barra-alta)",
              color: active ? "var(--color-tinta)" : "var(--color-tenue)",
              border: active ? "1px solid var(--color-ambar)" : "1px solid var(--color-borde)",
            }}
          >
            {FORMAT_LABEL[f]}
          </button>
        );
      })}
    </div>
  );
}
