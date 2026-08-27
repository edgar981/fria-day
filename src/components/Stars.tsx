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
