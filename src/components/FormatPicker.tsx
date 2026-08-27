"use client";

import { BEER_FORMATS, type BeerFormat } from "@/lib/domain";
import { FORMAT_LABEL } from "@/lib/format";

export function FormatPicker({
  value,
  onChange,
}: {
  value: BeerFormat;
  onChange: (f: BeerFormat) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
      {BEER_FORMATS.map((f) => {
        const active = f === value;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            aria-pressed={active}
            className="btn"
            style={{
              flex: "1 1 0",
              minWidth: 68,
              padding: "0.45rem 0.5rem",
              fontSize: "0.85rem",
              background: active ? "var(--accent)" : "var(--surface-2)",
              color: active ? "var(--accent-contrast)" : "var(--text)",
              border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {FORMAT_LABEL[f]}
          </button>
        );
      })}
    </div>
  );
}
