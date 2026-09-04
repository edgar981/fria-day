"use client";

/**
 * Sección colapsable de Editar (DS.2). La lista de bebidas es lo que se edita seguido;
 * fecha, lugar y compañía se tocan una vez o nunca. Van colapsadas por defecto, mostrando
 * el VALOR actual en la fila ("DETALLES · El Andén · 28 ago") para leerse sin expandir; el
 * toque extra solo lo paga quien va a cambiar algo. El estado (abierto/cerrado) lo maneja
 * el padre, que lo reinicia a cerrado cada vez que se entra a Editar.
 */
export function CollapsibleField({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section style={{ border: "1px solid var(--color-borde)", borderRadius: 16, background: "var(--color-barra)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "14px 15px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ font: "700 11px/1 var(--font-sans)", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-tenue)", flex: "none" }}>{title}</span>
        {!open && (
          <span style={{ flex: 1, minWidth: 0, font: "500 14px var(--font-sans)", color: "var(--color-crema)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            · {summary}
          </span>
        )}
        <span aria-hidden style={{ marginLeft: "auto", color: "var(--color-tenue)", display: "flex", transition: "transform .2s ease", transform: open ? "rotate(180deg)" : "none" }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>
      {open && <div style={{ padding: "0 15px 15px" }}>{children}</div>}
    </section>
  );
}
