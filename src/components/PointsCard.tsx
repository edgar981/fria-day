"use client";

import { useState } from "react";
import type { PointsSummary } from "@/lib/points-queries";

/**
 * Los puntos en el perfil (Pasada PT · §6, §8). Tarjeta OSCURA con franja de espuma (no el
 * degradado ámbar, para no competir con el total histórico que va debajo). Tres piezas: el
 * número, el ritmo (puntos por salida) y el próximo hito EN SALIDAS ("Dos salidas más"). Debajo,
 * "De dónde salieron" despliega el desglose (mayor a menor) y cierra con la frase de la ética.
 * El número solo sube: aquí nunca hay nada que presione (§2).
 */
export function PointsCard({ summary }: { summary: PointsSummary }) {
  const [open, setOpen] = useState(false);
  const nf = (n: number) => n.toLocaleString("es-CO");
  const ritmoLabel = summary.salidasCount > 0 ? `${nf(summary.ritmo)} por salida` : "aún sin ritmo";

  return (
    <div style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 24, overflow: "hidden" }}>
      {/* Franja de espuma: la firma de la marca, discreta. */}
      <div style={{ display: "flex", height: 12, overflow: "hidden" }} aria-hidden>
        {Array.from({ length: 22 }).map((_, i) => (
          <span key={i} style={{ width: 24, height: 24, borderRadius: 12, background: "var(--color-espuma)", marginTop: -12, marginLeft: i === 0 ? 0 : -1, flexShrink: 0, opacity: 0.92 }} />
        ))}
      </div>

      <div style={{ padding: "16px 20px 18px" }}>
        <div style={{ font: "700 11px/1 var(--font-sans)", letterSpacing: ".16em", color: "var(--color-tenue)" }}>TUS PUNTOS</div>
        <div style={{ font: "800 44px/1 var(--font-display)", letterSpacing: "-.02em", color: "var(--color-espuma)", marginTop: 8 }}>{nf(summary.total)}</div>
        <div style={{ font: "500 13.5px var(--font-sans)", color: "var(--color-tenue)", marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span>{ritmoLabel}</span>
          {summary.nextSalidas && (
            <>
              <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              <span style={{ color: "var(--color-ambar)", fontWeight: 600 }}>{summary.nextSalidas}</span>
            </>
          )}
        </div>

        {/* La barra del próximo hito (§6: "una barra y una frase en salidas"). */}
        {summary.nextHitoPoints != null && (
          <div aria-hidden style={{ height: 6, borderRadius: 99, background: "var(--color-barra-alta)", overflow: "hidden", marginTop: 12 }}>
            <div style={{ height: "100%", borderRadius: 99, background: "var(--color-ambar)", width: `${Math.max(2, Math.min(100, Math.round(((summary.total - summary.lastHitoPoints) / (summary.nextHitoPoints - summary.lastHitoPoints)) * 100)))}%` }} />
          </div>
        )}

        {/* Chips de hitos alcanzados, en orden (§9: el único historial). */}
        {summary.hitos.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 13 }}>
            {summary.hitos.map((h) => (
              <span key={h.points} style={{ font: "600 11.5px var(--font-sans)", color: "var(--color-crema)", background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 999, padding: "4px 10px" }}>
                {h.name}
              </span>
            ))}
          </div>
        )}

        {summary.desglose.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              style={{ marginTop: 16, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", borderTop: "1px solid var(--color-borde)", padding: "12px 0 0", cursor: "pointer", font: "600 13.5px var(--font-sans)", color: "var(--color-crema)" }}
            >
              De dónde salieron
              <span aria-hidden style={{ color: "var(--color-tenue)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>⌄</span>
            </button>

            {open && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                {summary.desglose.map((l) => (
                  <div key={l.key} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ font: "500 14px var(--font-sans)", color: "var(--color-crema)" }}>{l.label}</span>
                    <span aria-hidden style={{ flex: 1, borderBottom: "1px dotted var(--color-borde)", transform: "translateY(-3px)" }} />
                    <span style={{ font: "700 14px var(--font-sans)", color: "var(--color-tenue-2)" }}>{nf(l.points)}</span>
                  </div>
                ))}
                <p style={{ font: "400 12.5px/1.5 var(--font-sans)", color: "var(--color-tenue)", margin: "8px 0 0" }}>{summary.ethos}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
