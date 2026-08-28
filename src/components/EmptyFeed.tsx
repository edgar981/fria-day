import Link from "next/link";

// Estado vacío del feed (mockup 1i): un vaso vacío que se llena al registrar.
// El contenedor externo arranca igual que el <main> real y el del skeleton
// (padding "16px 18px 0" → su primer hijo cae en la MISMA Y que la primera tarjeta
// del skeleton). El offset visual va DENTRO (paddingTop), fijo: así el estado vacío
// no queda pegado al header y —al no centrarse por viewport— no se re-centra cuando
// cargan las fuentes. Antes usaba minHeight:60vh + justify-center, que provocaba el
// salto al entrar (ver DECISIONES.md · P.4/P.5).
export function EmptyFeed() {
  return (
    <div style={{ padding: "16px 18px 0" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, textAlign: "center", paddingTop: 56 }}>
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
    </div>
  );
}
