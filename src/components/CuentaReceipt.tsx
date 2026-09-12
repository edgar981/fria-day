"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FoamStrip } from "@/components/FoamStrip";
import type { CuentaLine } from "@/lib/points";

/** Cuenta ascendente de 0 a `target` con easeOutCubic en `ms`. */
function useCountUp(target: number, ms: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

/**
 * "La cuenta" (Pasada PT · §5): el papelito del bar al salir del detalle. Las líneas entran
 * escalonadas (90ms) y el total cuenta en 600ms — menos de segundo y medio, es un recibo, no
 * una ceremonia. Se cierra tocando. Respeta prefers-reduced-motion (aparece sin animar).
 */
export function CuentaReceipt({
  lines,
  total,
  crossed = [],
  onClose,
}: {
  lines: CuentaLine[];
  total: number;
  crossed?: { points: number; name: string; big: boolean }[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const reduced = useRef(false);
  useEffect(() => {
    setMounted(true);
    reduced.current = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const shown = useCountUp(total, reduced.current ? 1 : 600);
  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="La cuenta"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(10,7,4,.66)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 320,
          background: "var(--color-noche)",
          border: "1px solid var(--color-borde)",
          borderRadius: 20,
          padding: "22px 22px 16px",
          boxShadow: "0 24px 60px rgba(0,0,0,.55)",
          animation: reduced.current ? undefined : "fd-cuenta-pop .28s cubic-bezier(.22,.9,.3,1) both",
        }}
      >
        {/* Festón de espuma como firma de la marca, discreto (PT.2): el componente COMPARTIDO,
            rebosa hacia arriba como las tarjetas de bebida. Antes era una copia inline invertida
            (festón mordiendo hacia abajo), la misma que tenía la tarjeta de puntos. */}
        <div style={{ marginBottom: 12 }}>
          <FoamStrip size="md" />
        </div>
        <div style={{ font: "700 11px var(--font-sans)", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-tenue)", marginBottom: 14 }}>
          La cuenta
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {lines.map((l, i) => (
            <div
              key={l.key}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                animation: reduced.current ? undefined : "fd-cuenta-line .3s ease both",
                animationDelay: reduced.current ? undefined : `${i * 90}ms`,
              }}
            >
              <span style={{ font: "500 14.5px var(--font-sans)", color: "var(--color-crema)" }}>{l.label}</span>
              <span aria-hidden style={{ flex: 1, borderBottom: "1px dotted var(--color-borde)", transform: "translateY(-3px)" }} />
              <span style={{ font: "700 14.5px var(--font-sans)", color: "var(--color-tenue-2)" }}>+{l.points}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px dashed var(--color-borde)", margin: "14px 0 12px" }} />
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ font: "800 16px var(--font-display)", letterSpacing: "-.01em", color: "var(--color-espuma)" }}>Total</span>
          <span style={{ font: "800 30px/1 var(--font-display)", letterSpacing: "-.02em", color: "var(--color-ambar)" }}>+{shown}</span>
        </div>

        {/* Hito cruzado (§9): una línea al pie, no interrumpe. Los grandes llevarán "Ver" → tarjeta. */}
        {crossed.map((h) => (
          <div key={h.points} style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(242,160,22,.12)", border: "1px solid var(--color-ambar)" }}>
            <span aria-hidden style={{ fontSize: 14 }}>🏅</span>
            <span style={{ flex: 1, font: "700 13.5px var(--font-sans)", color: "var(--color-espuma)" }}>
              Llegaste a <span style={{ color: "var(--color-ambar)" }}>{h.name}</span>
            </span>
          </div>
        ))}

        <div style={{ marginTop: 14, textAlign: "center", font: "500 12px var(--font-sans)", color: "var(--color-tenue-2)" }}>
          Toca para cerrar
        </div>
      </div>
    </div>,
    document.body,
  );
}
