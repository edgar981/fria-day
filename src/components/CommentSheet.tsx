"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadSessionComments } from "@/app/actions/sessions";
import { SessionComments } from "@/components/SessionComments";

/**
 * Hoja inferior para comentar desde el feed sin salir del feed (I-3.1 §3). Sube con la
 * física de arrastre de la hoja de bebida (A.4): arrastrar hacia abajo o tocar afuera la
 * cierra. Trae la lista de comentarios al abrir (bajo demanda: el feed solo lleva el
 * conteo) y reutiliza SessionComments (optimista). El BORRADOR se conserva al cerrar: el
 * padre (ReactionBar, que sobrevive al cierre) guarda el texto y la hoja lo re-inyecta.
 */
type UserRef = { id: string; displayName: string; avatar: string | null };
type Comment = { id: string; body: string; createdAt: string; user: UserRef };

export function CommentSheet({
  open,
  onClose,
  sessionId,
  viewer,
  draft,
  onDraftChange,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  viewer: UserRef;
  draft: string;
  onDraftChange: (text: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null); // null = cargando
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ startY: 0, prevY: 0, prevT: 0, vy: 0, active: false });

  useEffect(() => setMounted(true), []);

  // Cada apertura re-consulta (trae lo último). Al cerrar, se descarta la lista pero el
  // borrador queda en el padre.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setComments(null);
    setLoadError(null);
    loadSessionComments(sessionId)
      .then((res) => {
        if (!active) return;
        if (res.ok) setComments(res.comments);
        else setLoadError(res.error);
      })
      .catch(() => active && setLoadError("No se pudieron cargar los comentarios."));
    return () => {
      active = false;
    };
  }, [open, sessionId]);

  function onDragStart(e: React.PointerEvent) {
    drag.current = { startY: e.clientY, prevY: e.clientY, prevT: e.timeStamp, vy: 0, active: true };
    setDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  }
  function onDragMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    const dt = e.timeStamp - d.prevT;
    if (dt > 0) d.vy = (e.clientY - d.prevY) / dt;
    d.prevY = e.clientY;
    d.prevT = e.timeStamp;
    setDragY(Math.max(0, e.clientY - d.startY));
  }
  function onDragEnd(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    setDragging(false);
    const dy = Math.max(0, e.clientY - d.startY);
    setDragY(0);
    if (dy > 110 || d.vy > 0.6) onClose();
  }

  if (!mounted || !open) return null;

  return createPortal(
    // stopPropagation en la raíz: la hoja se portaliza DESDE dentro de la tarjeta-Link
    // del feed, y los eventos de un portal burbujean por el árbol de React hasta ese
    // Link (navegaría al detalle). Cortarlos aquí mantiene todo dentro de la hoja.
    <div
      style={{ position: "fixed", inset: 0, zIndex: 85 }}
      role="dialog"
      aria-modal="true"
      aria-label="Comentarios"
      onClick={(e) => e.stopPropagation()}
    >
      <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", inset: 0, background: "rgba(10,7,4,.62)" }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          margin: "0 auto",
          maxWidth: 440,
          maxHeight: "85dvh",
          background: "var(--color-barra)",
          borderTop: "1px solid var(--color-borde)",
          borderRadius: "30px 30px 0 0",
          display: "flex",
          flexDirection: "column",
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform 0.25s ease",
        }}
      >
        {/* Zona de arrastre: grabber + título */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          style={{ touchAction: "none", cursor: "grab", display: "flex", flexDirection: "column", gap: 12, padding: "12px 18px 4px", flex: "none" }}
        >
          <span style={{ width: 44, height: 4, borderRadius: 99, background: "#4A3A28", alignSelf: "center" }} />
          <span style={{ font: "800 20px/1 var(--font-display)", letterSpacing: "-.02em" }}>Comentarios</span>
        </div>

        {/* Cuerpo: lista + campo (SessionComments). Scrollea; el campo va al final. */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px calc(env(safe-area-inset-bottom,0px) + 16px)" }}>
          {loadError ? (
            <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)" }}>{loadError}</p>
          ) : comments === null ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <span className="spinner" style={{ width: 22, height: 22, borderRadius: "50%", border: "2.5px solid rgba(251,240,213,.25)", borderTopColor: "var(--color-ambar)", display: "block", animation: "fd-spin .7s linear infinite" }} />
            </div>
          ) : (
            <SessionComments
              sessionId={sessionId}
              comments={comments}
              viewer={viewer}
              autoFocus
              initialText={draft}
              onDraftChange={onDraftChange}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
