"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/app/actions/sessions";
import { REACTIONS, rankClusterEmojis, reactionPile } from "@/lib/domain";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { ReactionGlyph } from "@/components/ReactionGlyph";
import { ShareButton } from "@/components/ShareButton";
import { CommentSheet } from "@/components/CommentSheet";

// Estilo base de las 3 acciones (diseño 1a): una fila, cada una flex:1, transparente,
// borde superior como separador. Brindar en tenue; Comentar/Compartir más apagados.
const actionBtn: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 40,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  background: "transparent",
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
  font: "600 13.5px var(--font-sans)",
  color: "var(--color-tenue-2)",
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
};

type Reactor = { userId: string; name: string; avatar: string | null; emoji: string };
type Viewer = { id: string; displayName: string; avatar: string | null };

const DEFAULT_EMOJI = "🍻"; // el brindis por defecto del tap simple
const HOLD_MS = 400;
const MOVE_CANCEL = 10;

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
 * La fila de acciones lleva Brindar + Compartir (share-card) + Comentar (I-3).
 */
export function ReactionBar({
  sessionId,
  reactors,
  mine,
  viewer,
  commentCount,
  feed,
}: {
  sessionId: string;
  reactors: Reactor[];
  mine: string | null;
  viewer: Viewer;
  commentCount?: number; // feed: muestra el conteo; detalle: se omite (la lista ya lo tiene)
  feed?: boolean; // en el feed, Comentar abre una hoja; en el detalle, enfoca el campo
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(""); // borrador de la hoja del feed (se conserva al cerrar)

  // Comentar (I-3.1): en el feed abre una hoja inferior (comentar sin salir del feed);
  // en el detalle enfoca el campo en línea que ya existe abajo.
  function onComment(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (feed) {
      setSheetOpen(true);
      return;
    }
    const el = typeof document !== "undefined" ? document.getElementById("fd-comment-input") : null;
    if (el) {
      (el as HTMLTextAreaElement).focus();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  const [myEmoji, setMyEmoji] = useState<string | null>(mine);
  // A-1: `pulse` re-dispara la animación del glifo (un run por tap). 0 = nunca tocado
  // → el botón arranca ESTÁTICO en el feed; solo se anima el glifo recién elegido.
  const [pulse, setPulse] = useState(0);
  const [selector, setSelector] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  const pending = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
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
    if (!removing) setPulse((p) => p + 1);
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
                  position: "relative",
                  zIndex: 10 - i, // el más usado, encima
                }}
              >
                <ReactionGlyph emoji={e} size={18} />
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

      {/* --- Barra de acciones 1a: UNA línea, tres acciones iguales (Brindar · Comentar
          · Compartir), separadas del pie por un borde superior. --- */}
      <div style={{ display: "flex", gap: 4, borderTop: "1px solid #241A12", paddingTop: 8 }}>
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
            ...actionBtn,
            touchAction: "pan-y",
            color: reacted ? "var(--color-ambar)" : "var(--color-tenue)",
            fontWeight: reacted ? 700 : 600,
            background: reacted ? "rgba(242,160,22,.12)" : "transparent",
          }}
        >
          <ReactionGlyph emoji={showEmoji} size={20} animate={pulse > 0} animKey={pulse} />
          {reacted ? "Brindaste" : "Brindar"}
        </button>
        <button type="button" onClick={onComment} aria-label="Comentar" style={actionBtn}>
          <Icon name="comment" size={17} />
          {commentCount && commentCount > 0 ? commentCount : "Comentar"}
        </button>
        <ShareButton sessionId={sessionId} />
      </div>

      {/* Hoja de comentarios del feed (I-3.1): comentar sin salir del feed. */}
      {feed && (
        <CommentSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          sessionId={sessionId}
          viewer={viewer}
          draft={draft}
          onDraftChange={setDraft}
        />
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
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "none",
                      userSelect: "none",
                    }}
                  >
                    {/* Estático: el selector no anima (solo el botón tras elegir). */}
                    <ReactionGlyph emoji={emoji} size={28} />
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
