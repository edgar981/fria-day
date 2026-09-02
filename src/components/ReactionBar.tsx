"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/app/actions/sessions";
import { REACTIONS } from "@/lib/domain";
import { Avatar } from "@/components/Avatar";
import { Tally } from "@/components/Tally";

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
 * Pie de brindis + barra de acciones (I-1.2). Basado en el tablero de diseño
 * (opción 1c con avatares de 1a = recomendación 1d).
 *
 * Display (híbrido):
 *  - 0 → "Nadie ha brindado"
 *  - 1 → emoji + avatar + nombre ("Caro brindó" / "Brindaste" si eres tú)
 *  - 2+ → total en marcas de conteo (Tally) + emojis distintos (grandes, sin cajas,
 *         SOLO display) + avatares apilados (3 + "+N"; el tuyo con anillo ámbar).
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

  // Reactores EFECTIVOS = los demás (del servidor) + mi reacción OPTIMISTA superpuesta.
  const others = reactors.filter((r) => r.userId !== viewer.id);
  const effective: Reactor[] = myEmoji
    ? [{ userId: viewer.id, name: viewer.displayName, avatar: viewer.avatar, emoji: myEmoji }, ...others]
    : others;
  const total = effective.length;
  const distinctEmojis = REACTIONS.filter((e) => effective.some((r) => r.emoji === e)).slice(0, 4);

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
  const visibleAvatars = effective.slice(0, 3);
  const extra = effective.length - visibleAvatars.length;

  const emojiRow = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {distinctEmojis.map((e) => (
        <span key={e} style={{ fontSize: 18, lineHeight: 1 }}>{e}</span>
      ))}
    </span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {/* --- Display híbrido --- */}
      {total === 0 ? (
        <span style={{ font: "500 13px var(--font-sans)", color: "var(--color-tenue)" }}>Nadie ha brindado</span>
      ) : total === 1 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{effective[0].emoji}</span>
          <RingAvatar reactor={effective[0]} viewerId={viewer.id} overlap={false} />
          <span style={{ font: "500 13.5px var(--font-sans)", color: "var(--color-crema)" }}>
            {effective[0].userId === viewer.id ? "Brindaste" : `${effective[0].name} brindó`}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Tally count={total} barW={2.5} barH={13} gap={3} maxGroups={6} />
          {emojiRow}
          <span style={{ display: "inline-flex", alignItems: "center" }}>
            {visibleAvatars.map((r, i) => (
              <RingAvatar key={r.userId} reactor={r} viewerId={viewer.id} overlap={i > 0} />
            ))}
            {extra > 0 && (
              <span style={{ marginLeft: -8, height: 24, minWidth: 24, padding: "0 6px", borderRadius: 9, background: "var(--color-barra-alta)", boxShadow: "0 0 0 2px var(--color-barra)", display: "inline-flex", alignItems: "center", justifyContent: "center", font: "700 11px var(--font-sans)", color: "var(--color-tenue)" }}>
                +{extra}
              </span>
            )}
          </span>
        </div>
      )}

      {/* --- Barra de acciones (Comentar → I-3, Compartir → share-card: ocultos) --- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
