// Motivo visual de la app: la franja de espuma (festón). ÚNICA implementación
// (G.2) — antes había dos: la clase CSS `.foam-scallop` (sin uso) y radial-gradients
// inline. `md` corona el bloque protagonista (BeerHero); `sm` va en las filas de las
// listas de cerveza, uniforme (todas o ninguna).
export function FoamStrip({ size = "sm" }: { size?: "sm" | "md" }) {
  const style: React.CSSProperties =
    size === "md"
      ? { height: 8, background: "radial-gradient(circle at 50% 100%,var(--color-espuma) 6px,transparent 6.5px) 0 0/13px 8px repeat-x" }
      : { height: 6, background: "radial-gradient(circle at 50% 100%,var(--color-espuma) 4.5px,transparent 5px) 0 0/10px 6px repeat-x" };
  return <div aria-hidden style={style} />;
}
