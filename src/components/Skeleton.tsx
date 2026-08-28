export function Skeleton({
  w = "100%",
  h = 16,
  r = 12,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  style?: React.CSSProperties;
}) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

// Cabecera de pestaña (logo + avatar) mientras carga.
export function HeaderSkeleton() {
  return (
    <div style={{ padding: "calc(12px + env(safe-area-inset-top)) 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #241A12" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton w={30} h={30} r={9} />
        <div style={{ font: "800 22px var(--font-display)", letterSpacing: "-.02em", color: "var(--color-borde)" }}>FriaDay</div>
      </div>
      <Skeleton w={36} h={36} r={11} />
    </div>
  );
}

// Tarjeta de salida del feed (forma real).
export function SessionCardSkeleton() {
  return (
    <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
        <Skeleton w={40} h={40} r={13} />
        <div style={{ flex: 1 }}>
          <Skeleton w="55%" h={16} />
          <Skeleton w="30%" h={12} style={{ marginTop: 7 }} />
        </div>
      </div>
      <Skeleton w="100%" h={92} r={18} />
      <div style={{ borderTop: "1px solid #241A12", paddingTop: 11 }}>
        <Skeleton w={90} h={14} />
      </div>
    </div>
  );
}
