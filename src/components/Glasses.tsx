// Medidor de rating: vasos que se llenan (no estrellas).
// "Sin calificar" NUNCA se dibuja como cero — es una píldora aparte.

const SIZES = {
  xs: { w: 6.5, h: 14, gap: 2.5, r: 2 },
  sm: { w: 8, h: 17, gap: 3, r: 2 },
  md: { w: 11, h: 22, gap: 3.5, r: 3 },
  lg: { w: 14, h: 26, gap: 4, r: 4 },
} as const;

export type GlassSize = keyof typeof SIZES;

export function Glasses({
  value,
  size = "xs",
  empty = "#3A2A1A",
}: {
  value: number; // 1..5
  size?: GlassSize;
  empty?: string;
}) {
  const d = SIZES[size];
  return (
    <span
      aria-label={`${value} de 5`}
      style={{ display: "inline-flex", gap: d.gap, alignItems: "center" }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          style={{
            width: d.w,
            height: d.h,
            borderRadius: d.r,
            background: n <= value ? "var(--color-ambar)" : empty,
            display: "block",
          }}
        />
      ))}
    </span>
  );
}

/** Vasos si hay rating; píldora "Sin calificar" (o "Calificar") si es null. */
export function RatingCell({
  value,
  size = "xs",
  emptyLabel = "Sin calificar",
  action = false,
}: {
  value: number | null;
  size?: GlassSize;
  emptyLabel?: string;
  /** true → invitación ámbar (Calificála); false → gris tenue (Sin calificar). */
  action?: boolean;
}) {
  if (value == null) {
    return (
      <span
        style={{
          font: "600 12px var(--font-sans)",
          color: action ? "var(--color-ambar)" : "var(--color-tenue-2)",
          border: `1px dashed ${action ? "#6B5334" : "#3A2A1A"}`,
          borderRadius: 999,
          padding: "5px 11px",
          whiteSpace: "nowrap",
          flex: "none",
        }}
      >
        {emptyLabel}
      </span>
    );
  }
  return <Glasses value={value} size={size} />;
}
