"use client";

// Medidor de rating interactivo: vasos que se llenan. 0 = sin calificar.
export function RatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div role="radiogroup" aria-label="Rating" style={{ display: "flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} de 5`}
            onClick={() => onChange(value === n ? 0 : n)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "9px 3px",
              minWidth: 22,
              minHeight: 44,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 14,
                height: 26,
                borderRadius: 4,
                background: n <= value ? "var(--color-ambar)" : "#3A2A1A",
                display: "block",
              }}
            />
          </button>
        ))}
      </div>
      {value > 0 ? (
        <button
          type="button"
          onClick={() => onChange(0)}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-tenue)",
            font: "500 12.5px var(--font-sans)",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Limpiar
        </button>
      ) : (
        <span style={{ color: "var(--color-tenue-2)", font: "400 12px var(--font-sans)" }}>
          Opcional
        </span>
      )}
    </div>
  );
}
