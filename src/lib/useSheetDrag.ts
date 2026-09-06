"use client";

import { useRef, useState } from "react";

/**
 * Física de arrastre-para-cerrar de las hojas (A.4): arrastrar la hoja hacia abajo más de
 * un umbral de distancia, o soltarla con suficiente velocidad, la cierra. La misma que ya
 * usan la hoja de bebida, la de comentarios y el visor de fotos; B-1 bug 3 la lleva a las
 * dos que faltaban (Invitar y el selector de formato al compartir).
 *
 * Devuelve el desplazamiento para el `transform` de la hoja y los handlers para la ZONA DE
 * AGARRE (grabber + encabezado) — nunca el cuerpo scrolleable ni los botones, para no
 * pelear con el scroll ni tragarse sus toques (pointer capture).
 */
export function useSheetDrag(onClose: () => void) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ startY: 0, prevY: 0, prevT: 0, vy: 0, active: false });

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, prevY: e.clientY, prevT: e.timeStamp, vy: 0, active: true };
    setDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    const dt = e.timeStamp - d.prevT;
    if (dt > 0) d.vy = (e.clientY - d.prevY) / dt;
    d.prevY = e.clientY;
    d.prevT = e.timeStamp;
    setDragY(Math.max(0, e.clientY - d.startY)); // solo hacia abajo
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    setDragging(false);
    const dy = Math.max(0, e.clientY - d.startY);
    setDragY(0);
    if (dy > 110 || d.vy > 0.6) onClose();
  }

  return {
    dragY,
    dragging,
    /** Transform + transición para el contenedor de la hoja. */
    sheetTransform: { transform: `translateY(${dragY}px)`, transition: dragging ? "none" : "transform 0.25s ease" } as const,
    /** Spread en la zona de agarre (grabber + encabezado). */
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      style: { touchAction: "none" as const, cursor: "grab" as const },
    },
  };
}
