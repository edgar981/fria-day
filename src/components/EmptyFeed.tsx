import Link from "next/link";

// Estado vacío del feed (mockup 1i): un vaso vacío que se llena al registrar.
export function EmptyFeed() {
  return (
    <div style={{ flex: 1, minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, textAlign: "center", padding: "0 8px" }}>
      <div style={{ width: 104, height: 130, border: "3px solid #3A2A1A", borderRadius: "10px 10px 20px 20px", position: "relative", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        <div style={{ width: "100%", height: 16, background: "var(--color-borde)" }} />
        <div style={{ position: "absolute", right: -30, top: 34, width: 44, height: 52, border: "3px solid #3A2A1A", borderRadius: "0 22px 22px 0" }} />
      </div>
      <div>
        <div style={{ font: "800 30px/1.1 var(--font-display)", letterSpacing: "-.025em" }}>Está seco por aquí</div>
        <p style={{ font: "400 15.5px/1.55 var(--font-sans)", color: "var(--color-tenue)", margin: "11px 0 0", maxWidth: 320 }}>
          Nadie ha registrado nada todavía. La primera salida es la que arranca la costumbre.
        </p>
      </div>
      <Link href="/sessions/new" className="btn btn-primary" style={{ width: "100%", maxWidth: 340 }}>
        Registrar mi primera salida
      </Link>
      <Link href="/invite" style={{ font: "600 14.5px var(--font-sans)", color: "var(--color-ambar)" }}>
        Invitar al parche
      </Link>
    </div>
  );
}
