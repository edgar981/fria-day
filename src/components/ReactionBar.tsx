"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/app/actions/sessions";
import { REACTIONS } from "@/lib/domain";

type Group = { emoji: string; count: number; mine: boolean };

const DEFAULT_EMOJI = "🍻"; // la reacción por defecto del tap simple
const HOLD_MS = 400; // umbral de hold para abrir el selector
const MOVE_CANCEL = 10; // px de movimiento que convierten el gesto en scroll, no hold

// Gesto CSS por emoji (I-1). El brindis fino de 🍻 y la mano de 🫡 son versiones
// simples; los assets propios están en BACKLOG por si saben a poco.
const ANIM_KEY: Record<string, string> = {
  "🍻": "beer",
  "🔥": "fire",
  "😂": "laugh",
  "🤤": "drool",
  "❤️": "heart",
  "🫡": "salute",
};

function toCounts(groups: Group[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const g of groups) m[g.emoji] = g.count;
  return m;
}

/**
 * Barra de acciones de la salida (I-1). La fila de seis emojis (Pasada R/N.2) se
 * comprime a UNA acción visible, "Reaccionar"; Comentar (I-3) y Compartir (share-card)
 * van ocultos hasta que existan — no se estrenan botones muertos, pero la fila queda
 * lista para sumarlos.
 *
 * Interacción (táctil, primaria):
 *  - Tap simple: sin reacción → aplica 🍻; con reacción → la quita.
 *  - Hold (~400ms): abre el selector con las seis. Elegir aplica; tocar la activa quita.
 *  - Si el dedo se mueve > umbral es scroll (no hold); la tarjeta es un <Link> y ni tap
 *    ni hold navegan (preventDefault en touchend/click). El callout de iOS se evita por
 *    CSS (-webkit-touch-callout/user-select) + onContextMenu.
 *
 * Estado: optimista y serializado como en N.2 (pinta al instante, la cola ordena las
 * escrituras, el refresh trae la verdad solo al drenar). Una reacción por usuario/salida.
 */
export function ReactionBar({
  sessionId,
  groups,
  mine,
  showSummary = true,
}: {
  sessionId: string;
  groups: Group[];
  mine: string | null;
  // El detalle ya lista quién reaccionó por nombre; ahí no hace falta el resumen.
  showSummary?: boolean;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>(() => toCounts(groups));
  const [myEmoji, setMyEmoji] = useState<string | null>(mine);
  const [anim, setAnim] = useState<{ emoji: string; nonce: number } | null>(null);
  const [selector, setSelector] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const pending = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const nonce = useRef(0);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Gesto táctil
  const gesture = useRef({ x: 0, y: 0, moved: false, held: false, endedAt: 0 });
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  // Resync con el servidor tras el refresh, solo sin toques en vuelo (patrón N.2/stepper).
  useEffect(() => {
    if (pending.current === 0) {
      setCounts(toCounts(groups));
      setMyEmoji(mine);
    }
  }, [groups, mine]);

  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);

  // Aplica/quita una reacción de forma optimista + persiste en segundo plano (serializado).
  function apply(emoji: string) {
    const prev = myEmoji;
    const removing = prev === emoji;
    setCounts((c) => {
      const n = { ...c };
      if (removing) {
        n[emoji] = Math.max(0, (n[emoji] ?? 0) - 1);
      } else {
        if (prev) n[prev] = Math.max(0, (n[prev] ?? 0) - 1);
        n[emoji] = (n[emoji] ?? 0) + 1;
      }
      return n;
    });
    setMyEmoji(removing ? null : emoji);
    // Animar SOLO al aplicar (no al quitar), una vez.
    if (!removing) setAnim({ emoji, nonce: ++nonce.current });

    pending.current++;
    chain.current = chain.current
      .catch(() => {})
      .then(() => toggleReaction(sessionId, emoji))
      .finally(() => {
        pending.current--;
        if (pending.current === 0) router.refresh();
      });
  }

  function openSelector() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setSelector({ x: r.left + r.width / 2, y: r.top });
  }
  function closeSelector() {
    setSelector(null);
  }

  // ---- Gestos táctiles sobre el botón "Reaccionar" ----
  function onTouchStart(e: React.TouchEvent) {
    if (selector) return;
    const t = e.touches[0];
    gesture.current = { x: t.clientX, y: t.clientY, moved: false, held: false, endedAt: 0 };
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      if (gesture.current.moved) return;
      gesture.current.held = true;
      openSelector();
    }, HOLD_MS);
  }
  function onTouchMove(e: React.TouchEvent) {
    const t = e.touches[0];
    const g = gesture.current;
    if (Math.hypot(t.clientX - g.x, t.clientY - g.y) > MOVE_CANCEL) {
      g.moved = true;
      if (holdTimer.current) clearTimeout(holdTimer.current);
    }
  }
  function endGesture() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }
  function onTouchEnd(e: React.TouchEvent) {
    endGesture();
    const g = gesture.current;
    g.endedAt = Date.now();
    if (g.held) { e.preventDefault(); return; } // el hold ya abrió el selector
    if (g.moved) return; // fue scroll
    // Tap: preventDefault suprime el click sintético → no navega el <Link>.
    e.preventDefault();
    apply(myEmoji ?? DEFAULT_EMOJI);
  }
  function onTouchCancel() {
    endGesture();
    gesture.current.moved = true;
  }
  // Fallback ratón (desktop, no es el objetivo): click = tap por defecto. Un click
  // originado por touch (reciente) se ignora aquí; siempre se corta la navegación.
  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (Date.now() - gesture.current.endedAt < 600) return;
    apply(myEmoji ?? DEFAULT_EMOJI);
  }

  const reacted = myEmoji != null;
  const showEmoji = myEmoji ?? DEFAULT_EMOJI;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const present = REACTIONS.filter((e) => (counts[e] ?? 0) > 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Acción: Reaccionar. (Comentar → I-3; Compartir → share-card: ocultos por ahora,
          la fila queda lista para sumarlos.) */}
      <button
        ref={btnRef}
        type="button"
        aria-label={reacted ? `Reaccionaste ${showEmoji}. Tocar para quitar; mantener para elegir otra` : "Reaccionar; mantener para elegir"}
        aria-pressed={reacted}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onClick={onClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          height: 34,
          padding: "0 14px 0 11px",
          borderRadius: 999,
          cursor: "pointer",
          border: `1px solid ${reacted ? "var(--color-ambar)" : "var(--color-borde)"}`,
          background: reacted ? "rgba(242,160,22,.14)" : "var(--color-barra-alta)",
          color: reacted ? "var(--color-ambar)" : "var(--color-tenue)",
          font: "700 13.5px var(--font-sans)",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
          touchAction: "pan-y", // deja scrollear el feed; el movimiento cancela el hold
        }}
      >
        <span
          key={anim ? `a${anim.nonce}` : "s"}
          className={anim ? `fd-react fd-react-${ANIM_KEY[anim.emoji]}` : "fd-react"}
          onAnimationEnd={() => setAnim(null)}
          style={{ fontSize: 17, lineHeight: 1 }}
        >
          {showEmoji}
        </span>
        {reacted ? "Reaccionaste" : "Reaccionar"}
      </button>

      {/* Resumen compacto de reacciones (no interactivo): que no se pierda el social. */}
      {showSummary && total > 0 && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-tenue)" }}>
          <span style={{ fontSize: 14, lineHeight: 1, letterSpacing: "-.02em" }}>{present.join("")}</span>
          <span style={{ font: "700 12.5px var(--font-sans)" }}>{total}</span>
        </div>
      )}

      {/* Selector (hold): en portal para escapar el overflow:hidden de la tarjeta. */}
      {mounted && selector &&
        createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 90 }}>
            <div
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeSelector(); }}
              onTouchStart={(e) => { e.stopPropagation(); closeSelector(); }}
              style={{ position: "absolute", inset: 0 }}
            />
            <div
              role="menu"
              aria-label="Elegir reacción"
              style={{
                position: "fixed",
                // Centrado en el botón, pero clamp con la MITAD del ancho del popover
                // (~140px) para que no se recorte contra los bordes del viewport.
                left: Math.min(Math.max(selector.x, 148), (typeof window !== "undefined" ? window.innerWidth : 400) - 148),
                top: selector.y - 12,
                transform: "translate(-50%, -100%)",
                display: "flex",
                gap: 4,
                padding: 7,
                borderRadius: 999,
                background: "var(--color-barra-alta)",
                border: "1px solid var(--color-borde)",
                boxShadow: "0 14px 34px rgba(0,0,0,.5)",
              }}
            >
              {REACTIONS.map((emoji) => {
                const on = myEmoji === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitem"
                    aria-label={`Reaccionar ${emoji}`}
                    aria-pressed={on}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); apply(emoji); closeSelector(); }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      border: `1px solid ${on ? "var(--color-ambar)" : "transparent"}`,
                      background: on ? "rgba(242,160,22,.16)" : "transparent",
                      fontSize: 21,
                      lineHeight: 1,
                      cursor: "pointer",
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
