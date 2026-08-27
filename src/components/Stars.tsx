/** Muestra estrellas si hay rating, o "Sin calificar" si es null. */
export function RatingDisplay({
  value,
  size = "1rem",
}: {
  value: number | null;
  size?: string;
}) {
  if (value == null) {
    return (
      <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>Sin calificar</span>
    );
  }
  return <Stars value={value} size={size} />;
}

export function Stars({
  value,
  size = "1rem",
}: {
  value: number;
  size?: string;
}) {
  const full = Math.round(value);
  return (
    <span
      aria-label={`${value} de 5`}
      style={{ color: "var(--star)", fontSize: size, letterSpacing: "1px" }}
    >
      {"★".repeat(full)}
      <span style={{ color: "var(--border)" }}>{"★".repeat(5 - full)}</span>
    </span>
  );
}
