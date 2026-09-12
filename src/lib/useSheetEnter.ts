"use client";

import { useEffect, useState } from "react";

/**
 * Entrada con easing de las hojas (RU.6 · punto 4): la hoja entra deslizándose desde abajo
 * en vez de aparecer de golpe. Devuelve `entered`; la hoja arranca en `translateY(100%)`
 * (fuera de vista) y, un frame después de montarse/abrirse, pasa a `translateY(0)` usando la
 * MISMA transición que ya tiene para el arrastre (`transform .25s`), así que no hay keyframe
 * ni conflicto con el `translateY(dragY)` del gesto (la trampa de RU.5: una animación CSS con
 * fill pisaba el transform inline).
 *
 * El `requestAnimationFrame` es clave: deja que el navegador pinte primero el estado inicial
 * (100%) y recién entonces cambia a 0, para que la transición tenga de dónde animar. Se
 * reinicia al cerrar, de modo que vuelve a deslizar en la próxima apertura (sirve igual para
 * hojas que se montan/desmontan que para las que viven montadas con un flag `open`).
 */
export function useSheetEnter(open: boolean): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);
  return entered;
}

/** Transform de la hoja combinando la entrada (100%→0) con el arrastre (`dragY`). */
export function sheetEnterTransform(entered: boolean, dragY: number): string {
  return entered ? `translateY(${dragY}px)` : "translateY(100%)";
}
