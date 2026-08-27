"use client";

export function RatingInput({
  value,
  onChange,
  size = "1.9rem",
}: {
  value: number;
  onChange: (n: number) => void;
  size?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <div role="radiogroup" aria-label="Rating" style={{ display: "flex", gap: "0.15rem" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
            // Toca la misma estrella para limpiar el rating (opcional).
            onClick={() => onChange(value === n ? 0 : n)}
            style={{
              fontSize: size,
              lineHeight: 1,
              padding: "0.1rem",
              color: n <= value ? "var(--star)" : "var(--border)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            ★
          </button>
        ))}
      </div>
      {value > 0 ? (
        <button
          type="button"
          onClick={() => onChange(0)}
          style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}
        >
          Limpiar
        </button>
      ) : (
        <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Opcional</span>
      )}
    </div>
  );
}
