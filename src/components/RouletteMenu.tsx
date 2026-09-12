"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useSheetDrag } from "@/lib/useSheetDrag";
import { useSheetEnter, sheetEnterTransform } from "@/lib/useSheetEnter";
import { ROULETTE_DYNAMICS } from "@/lib/roulette";

// Mismos umbrales que el gesto de reacciones (I-1): tap corto, hold a 400ms, y un
// movimiento > 10px cancela el hold para dejar pasar el scroll. SYNTH_CLICK_MS ignora
// el click sintético que iOS emite tras el toque.
const HOLD_MS = 400;
const MOVE_CANCEL = 10;
const SYNTH_CLICK_MS = 600;

/**
 * Botón "+" de la barra (Pasada RU · §1). Tap = "Nueva salida" (como hoy, sin costo
 * extra en el registro). Hold = menú de dinámicas de la ruleta, que sale hacia arriba.
 * Arrastrar deja pasar el scroll. Mismo gesto que las reacciones (patrón I-1); el hold
 * no dispara el menú contextual de iOS (contextmenu + touch-callout).
 */
export function RouletteMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const gesture = useRef({ x: 0, y: 0, moved: false, held: false, endedAt: 0 });
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { dragY, dragging, dragHandlers } = useSheetDrag(() => setOpen(false));
  const entered = useSheetEnter(open); // RU.6 · punto 4: entrada con easing

  useEffect(() => setMounted(true), []);
  useEffect(() => { router.prefetch("/sessions/new"); }, [router]);
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);

  function goNew() { router.push("/sessions/new"); }
  function openMenu() { setOpen(true); }
  function pickDynamic(key: string) {
    // RU.6 · punto 3: igual que el selector de reacciones (I-1), soltar el hold NO elige.
    // El click sintético que el release dispara sobre la dinámica bajo el dedo cae dentro de
    // SYNTH_CLICK_MS de `endedAt` → se ignora. Un tap posterior (deliberado) sí elige. En
    // ratón/escritorio `endedAt` es 0, así que el click normal pasa.
    if (Date.now() - gesture.current.endedAt < SYNTH_CLICK_MS) return;
    setOpen(false);
    router.push(`/ruleta?dyn=${key}`);
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    gesture.current = { x: t.clientX, y: t.clientY, moved: false, held: false, endedAt: 0 };
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      if (gesture.current.moved) return;
      gesture.current.held = true;
      openMenu();
    }, HOLD_MS);
  }
  function onTouchMove(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    const g = gesture.current;
    if (Math.hypot(t.clientX - g.x, t.clientY - g.y) > MOVE_CANCEL) {
      g.moved = true;
      if (holdTimer.current) clearTimeout(holdTimer.current);
    }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    const g = gesture.current;
    g.endedAt = Date.now();
    if (g.held) { e.preventDefault(); return; }  // el hold ya abrió el menú
    if (g.moved) return;                          // fue scroll
    e.preventDefault();                           // suprime el click sintético
    goNew();
  }
  function onTouchCancel() { if (holdTimer.current) clearTimeout(holdTimer.current); gesture.current.moved = true; }
  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    if (Date.now() - gesture.current.endedAt < SYNTH_CLICK_MS) return; // ya lo manejó el toque
    goNew(); // ratón/escritorio: click = nueva salida
  }

  return (
    <span style={{ display: "flex", justifyContent: "center" }}>
      <button
        type="button"
        aria-label="Nueva salida; mantén para girar la ruleta"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: 56,
          height: 56,
          borderRadius: 20,
          background: "var(--color-ambar)",
          color: "var(--color-tinta)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          marginTop: -22,
          boxShadow: "0 8px 20px rgba(242,160,22,.32)",
          touchAction: "pan-y",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        <Icon name="plus" size={28} />
      </button>

      {mounted && open &&
        createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 90 }} role="dialog" aria-modal="true" aria-label="Girar la ruleta">
            <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(10,7,4,.62)" }} />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                maxWidth: 440,
                margin: "0 auto",
                background: "var(--color-noche)",
                borderTop: "1px solid var(--color-borde)",
                borderRadius: "22px 22px 0 0",
                // RU.6 · punto 3: zona muerta inferior — la hoja se abre por un hold sobre el
                // "+" (abajo-centro), así que el dedo queda sobre esa franja al soltar. Con ~64px
                // de respiro ninguna dinámica cae bajo el dedo (medido: ~19px de aire sobre la
                // última); el resto lo cubre la guarda de click sintético en pickDynamic.
                padding: "12px 16px calc(env(safe-area-inset-bottom,0px) + 64px)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transform: sheetEnterTransform(entered, dragY),
                transition: dragging ? "none" : "transform 0.25s ease",
              }}
            >
              <div {...dragHandlers} style={{ ...dragHandlers.style, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 2 }}>
                  <span style={{ width: 40, height: 4, borderRadius: 99, background: "var(--color-borde)" }} />
                </div>
                <h2 style={{ font: "800 22px/1 var(--font-display)", letterSpacing: "-.02em", margin: "4px 0 0" }}>Girar la ruleta</h2>
                <p style={{ font: "400 13px/1.4 var(--font-sans)", color: "var(--color-tenue)", margin: 0 }}>
                  El teléfono al centro. Elige qué se juega.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "58vh", overflowY: "auto" }}>
                {ROULETTE_DYNAMICS.map((d, i) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => pickDynamic(d.key)}
                    style={{
                      textAlign: "left",
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      width: "100%",
                      background: "var(--color-barra)",
                      border: "1px solid var(--color-borde)",
                      borderRadius: 18,
                      padding: "12px 13px",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ width: 40, height: 40, borderRadius: 13, background: "var(--color-barra-alta)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", font: "800 15px var(--font-display)", color: "var(--color-ambar)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", font: "700 16px/1.15 var(--font-sans)", color: "var(--color-crema)" }}>{d.name}</span>
                      <span style={{ display: "block", font: "400 12.5px/1.4 var(--font-sans)", color: "var(--color-tenue)", marginTop: 2 }}>{d.pitch}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
