"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/app/actions/sessions";
import { REACTIONS, rankClusterEmojis, reactionPile } from "@/lib/domain";
import { Avatar } from "@/components/Avatar";
import { ShareButton } from "@/components/ShareButton";

type Reactor = { userId: string; name: string; avatar: string | null; emoji: string };
type Viewer = { id: string; displayName: string; avatar: string | null };

const DEFAULT_EMOJI = "🍻"; // el brindis por defecto del tap simple
const HOLD_MS = 400;
const MOVE_CANCEL = 10;

// Gesto CSS por emoji (I-1). Brindis fino de 🍻 y mano de 🫡: assets propios en BACKLOG.
const ANIM_KEY: Record<string, string> = {
  "🍻": "beer", "🔥": "fire", "😂": "laugh", "🤤": "drool", "❤️": "heart", "🫡": "salute",
};

// Avatar con anillo: el del usuario en ámbar; los demás en el color de la tarjeta
// (separa los apilados). z-index sube el del usuario para que su anillo no se tape.
function RingAvatar({ reactor, viewerId, overlap }: { reactor: Reactor; viewerId: string; overlap: boolean }) {
  const me = reactor.userId === viewerId;
  return (
    <span
      title={me ? "Tú" : reactor.name}
      style={{
        display: "inline-block",
        marginLeft: overlap ? -8 : 0,
        borderRadius: 9,
        boxShadow: `0 0 0 2px ${me ? "var(--color-ambar)" : "var(--color-barra)"}`,
        position: "relative",
        zIndex: me ? 1 : 0,
      }}
    >
      <Avatar avatar={reactor.avatar} size={24} radius={7} />
    </span>
  );
}

/**
 * Pie de brindis + barra de acciones (I-1.3, opción 1a del tablero de diseño).
 *
 * Display (1a): racimo de hasta 4 emojis distintos + avatares de quienes brindaron
 * (el tuyo con anillo ámbar) + texto. SIN tally (el tally vive en los totales de
 * bebidas, donde ya estaba). Los emojis son SOLO display (no son blancos de toque).
 *  - 0 → "Nadie ha brindado"
 *  - 1 → "Caro brindó" (o "Brindaste" si eres tú)
 *  - 2+ → "Tú y N más" (o "Nombre y N más" si no brindaste)
 *
 * Acción: botón "Brindar" (tu emoji + "Brindaste" si ya brindaste). Tap aplica 🍻 o
 * quita; hold (~400ms) abre las seis. Optimista + serializado como en N.2 (pinta al
 * instante; la cola ordena las escrituras; el refresh trae la verdad al drenar). El
 * arrastre desde el botón hace scroll (no hold); la tarjeta es <Link> y no navega.
 * Comentar (I-3) y Compartir (share-card) van OCULTOS: la fila queda lista para ellos.
 */
export function ReactionBar({
  sessionId,
  reactors,
  mine,
  viewer,
}: {
  sessionId: string;
  reactors: Reactor[];
  mine: string | null;
  viewer: Viewer;
}) {
  const router = useRouter();
  const [myEmoji, setMyEmoji] = useState<string | null>(mine);
  const [anim, setAnim] = useState<{ emoji: string; nonce: number } | null>(null);
  const [selector, setSelector] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const pending = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const nonce = useRef(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const gesture = useRef({ x: 0, y: 0, moved: false, held: false, endedAt: 0 });
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);
  // Resync con el servidor tras el refresh, solo sin toques en vuelo (patrón N.2).
  useEffect(() => {
    if (pending.current === 0) setMyEmoji(mine);
  }, [mine]);
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);

  // Reactores en orden CRONOLÓGICO (servidor asc) + mi reacción OPTIMISTA al final (la
  // más reciente). El racimo rankea por MÁS USADOS (empate: más reciente); la pila pone
  // MI avatar primero. Así, aunque mi emoji no quepa en el racimo, mi presencia se ve (I-1.5).
  const others = reactors.filter((r) => r.userId !== viewer.id);
  const entries: Reactor[] = myEmoji
    ? [...others, { userId: viewer.id, name: viewer.displayName, avatar: viewer.avatar, emoji: myEmoji }]
    : others;
  const total = entries.length;
  const clusterEmojis = rankClusterEmojis(entries, 4);
  const pile = reactionPile(entries, viewer.id, 3);

  function apply(emoji: string) {
    const prev = myEmoji;
    const removing = prev === emoji;
    setMyEmoji(removing ? null : emoji);
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
  const closeSelector = () => setSelector(null);

  // ---- Gestos táctiles (tap/hold/scroll) sobre "Brindar" ----
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
  const endGesture = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };
  function onTouchEnd(e: React.TouchEvent) {
    endGesture();
    const g = gesture.current;
    g.endedAt = Date.now();
    if (g.held) { e.preventDefault(); return; }
    if (g.moved) return;
    e.preventDefault(); // suprime el click sintético → el <Link> no navega
    apply(myEmoji ?? DEFAULT_EMOJI);
  }
  function onTouchCancel() { endGesture(); gesture.current.moved = true; }
  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (Date.now() - gesture.current.endedAt < 600) return; // ya lo manejó el toque
    apply(myEmoji ?? DEFAULT_EMOJI);
  }

  const reacted = myEmoji != null;
  const showEmoji = myEmoji ?? DEFAULT_EMOJI;
  const iReacted = entries.some((r) => r.userId === viewer.id);
  const lead = pile.visible[0]; // avatar líder: el propio si brindaste, si no el más reciente
  // Texto (en "tú"): 1 → "Caro brindó"/"Brindaste"; varios → "Tú y N más"/"Nombre y N más".
  // Guardado para total 0 (entries vacío) — solo se usa en el JSX cuando total > 0.
  const displayText =
    total === 0
      ? ""
      : total === 1
        ? lead.userId === viewer.id
          ? "Brindaste"
          : `${lead.name} brindó`
        : iReacted
          ? `Tú y ${total - 1} más`
          : `${lead.name} y ${total - 1} más`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {/* --- Display 1a: racimo de emojis (en círculos) + avatares + texto (sin tally) --- */}
      {total === 0 ? (
        <span style={{ font: "500 13px var(--font-sans)", color: "var(--color-tenue)" }}>Nadie ha brindado</span>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          {/* Racimo: hasta 4 emojis MÁS USADOS, cada uno en un círculo superpuesto (1a).
              SOLO display (no son blancos de toque; el único interactivo es Brindar). */}
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            {clusterEmojis.map((e, i) => (
              <span
                key={e}
                style={{
                  marginLeft: i ? -6 : 0,
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: "var(--color-barra-alta)",
                  boxShadow: "0 0 0 2px var(--color-barra)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  lineHeight: 1,
                  position: "relative",
                  zIndex: 10 - i, // el más usado, encima
                }}
              >
                {e}
              </span>
            ))}
          </span>
          {/* Avatares: el propio SIEMPRE primero (anillo ámbar) + los más recientes (I-1.5). */}
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            {pile.visible.map((r, i) => (
              <RingAvatar key={r.userId} reactor={r} viewerId={viewer.id} overlap={i > 0} />
            ))}
          </span>
          <span style={{ font: "500 13px var(--font-sans)", color: "var(--color-crema)" }}>{displayText}</span>
        </div>
      )}

      {/* --- Barra de acciones. Compartir activo (Pasada S). Comentar → I-3 (oculto). --- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          ref={btnRef}
          type="button"
          aria-label={reacted ? `Brindaste ${showEmoji}. Tocar para quitar; mantener para elegir otra` : "Brindar; mantener para elegir"}
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
            touchAction: "pan-y",
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
          {reacted ? "Brindaste" : "Brindar"}
        </button>
        <ShareButton sessionId={sessionId} />
      </div>

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
              aria-label="Elegir brindis"
              style={{
                position: "fixed",
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
                    aria-label={`Brindar ${emoji}`}
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
