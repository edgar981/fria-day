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
    <div role="radiogroup" aria-label="Rating" style={{ display: "flex", gap: "0.15rem" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
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
  );
}
