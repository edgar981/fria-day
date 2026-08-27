// Motivo: marcas de conteo. Todo total se dibuja antes de escribirse.
// Grupos de 5 (4 barras verticales + 1 diagonal). Con `maxGroups`, los totales
// grandes se recortan con "…× N".

export function Tally({
  count,
  color = "var(--color-ambar)",
  barW = 3,
  barH = 17,
  gap = 4,
  maxGroups = Infinity,
  labelColor = "var(--color-tenue)",
}: {
  count: number;
  color?: string;
  barW?: number;
  barH?: number;
  gap?: number;
  maxGroups?: number;
  labelColor?: string;
}) {
  const total = Math.max(0, Math.floor(count));
  const fullGroups = Math.floor(total / 5);
  const rem = total % 5;
  const groupW = 4 * barW + 3 * gap;
  const strikeH = barH * 1.2;
  const strikeMl = -(groupW / 2 + barW);

  const shownGroups = Math.min(fullGroups, maxGroups);
  const truncated = fullGroups > maxGroups;

  const bar = (h: number, extra?: React.CSSProperties) => (
    <i
      style={{
        width: barW,
        height: h,
        background: color,
        borderRadius: 2,
        display: "block",
        ...extra,
      }}
    />
  );

  const group = (key: number) => (
    <span key={key} style={{ display: "flex", gap, alignItems: "center" }}>
      {bar(barH)}
      {bar(barH)}
      {bar(barH)}
      {bar(barH)}
      {bar(strikeH, { transform: "rotate(30deg)", marginLeft: strikeMl })}
    </span>
  );

  return (
    <span style={{ display: "flex", gap: gap * 2, alignItems: "center", flexWrap: "wrap" }}>
      {Array.from({ length: shownGroups }, (_, i) => group(i))}
      {!truncated && rem > 0 && (
        <span style={{ display: "flex", gap, alignItems: "center" }}>
          {Array.from({ length: rem }, (_, i) => (
            <span key={i} style={{ display: "block" }}>
              {bar(barH)}
            </span>
          ))}
        </span>
      )}
      {truncated && (
        <span
          style={{
            font: `500 12px var(--font-sans)`,
            color: labelColor,
            alignSelf: "center",
          }}
        >
          …× {total}
        </span>
      )}
    </span>
  );
}
