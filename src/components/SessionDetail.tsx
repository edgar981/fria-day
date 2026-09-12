"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Tally } from "@/components/Tally";
import { PhotoHero } from "@/components/PhotoHero";
import { CheckInReadList } from "@/components/CheckInReadList";
import { RouletteBlock, type RoundView } from "@/components/RouletteBlock";
import { TaggedCheckInList } from "@/components/TaggedCheckInList";
import { OwnerCheckInList, type OwnerCheckIn } from "@/components/OwnerCheckInList";
import { SessionPhotos } from "@/components/SessionPhotos";
import { SessionHeaderEditor } from "@/components/SessionHeaderEditor";
import { SessionTagsEditor, type EditorTag } from "@/components/SessionTagsEditor";
import { AddCheckInButton } from "@/components/AddCheckInButton";
import { DeleteSessionButton } from "@/components/DeleteSessionButton";
import { CollapsibleField } from "@/components/CollapsibleField";
import { ReactionBar } from "@/components/ReactionBar";
import { SessionComments } from "@/components/SessionComments";
import { ShareButton } from "@/components/ShareButton";

/**
 * Detalle de salida rediseñado (Pasada DS · tablero "Detalle de salida", estados 1a–1e).
 * La foto manda arriba y absorbe el header; el registro queda debajo, en LECTURA, con un
 * solo interruptor "Editar" que cambia de piel el MISMO scroll (sin navegar); lo social se
 * separa del registro con su propio fondo, tras la costura de espuma.
 *
 * Solo presentación: no toca el modelo ni las reglas. Reúsa los componentes interactivos
 * ya probados (stepper/rating/borrar con Deshacer, Yo también, fotos, reacciones,
 * comentarios). El modo Editar existe solo para el dueño.
 */
type Viewer = { id: string; displayName: string; avatar: string | null };

const PILL_FLOAT: React.CSSProperties = {
  width: 42, height: 42, borderRadius: 14, background: "rgba(10,7,4,.55)", backdropFilter: "blur(6px)",
  border: "1px solid rgba(251,240,213,.16)", display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--color-espuma)", flex: "none", cursor: "pointer",
};
const PILL_SOLID: React.CSSProperties = {
  width: 42, height: 42, borderRadius: 14, background: "var(--color-barra)", border: "1px solid var(--color-borde)",
  display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-crema)", flex: "none", cursor: "pointer",
};
const EYEBROW: React.CSSProperties = { font: "700 11px/1 var(--font-sans)", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-tenue)" };
const PAD = "0 18px";

export function SessionDetail(props: {
  sessionId: string;
  isOwner: boolean;
  isTagged: boolean;
  ownerName: string;
  ownerAvatar: string | null;
  viewer: Viewer;
  placeName: string | null;
  notes: string | null;
  dateLabel: string;
  dateShort: string;
  dateInput: string;
  compSummary: string | null;
  taggedByName: string | null;
  checkIns: OwnerCheckIn[];
  photos: { id: string; url: string }[];
  tags: EditorTag[];
  reactions: { mine: string | null; reactors: { userId: string; name: string; avatar: string | null; emoji: string }[] };
  comments: { id: string; body: string; createdAt: string | Date; user: Viewer }[];
  total: number;
  distinct: number;
  breakdownText: string | null;
  initialMineIds: string[];
  autoFocusComment: boolean;
  rounds: RoundView[]; // RU · §8
}) {
  const {
    sessionId, isOwner, isTagged, ownerName, ownerAvatar, viewer, placeName, notes, dateLabel, dateShort, dateInput,
    compSummary, taggedByName, checkIns, photos, tags, reactions, comments, total, distinct, breakdownText, initialMineIds, autoFocusComment, rounds,
  } = props;

  const [mode, setMode] = useState<"read" | "edit">("read");
  const [menuOpen, setMenuOpen] = useState(false);
  // DS.2: Detalles y Compañía arrancan COLAPSADAS cada vez que se entra a Editar.
  const [detOpen, setDetOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  function enterEdit() {
    setDetOpen(false);
    setCompOpen(false);
    setMenuOpen(false);
    setMode("edit");
  }
  // Resúmenes de la fila colapsada (DS.2): valor actual, no solo el título.
  const detSummary = [placeName, dateShort].filter(Boolean).join(" · ");
  const compRowSummary = compSummary ?? "nadie etiquetado";
  // DS.1: la constancia sale de los datos (initialMineIds del servidor). El contador
  // arranca con lo persistido; TaggedCheckInList lo actualiza al tocar/deshacer.
  const [taggedMine, setTaggedMine] = useState(initialMineIds.length);

  const hasPhoto = photos.length > 0;
  const title = placeName || (isOwner ? "Tu salida" : `Salida de ${ownerName}`);
  const subtitle = `${dateLabel}${compSummary ? ` · con ${compSummary}` : ""}`;
  const nBrindis = reactions.reactors.length;
  const nComments = comments.length;

  // ============================ MODO EDITAR (solo dueño) ============================
  if (mode === "edit" && isOwner) {
    return (
      <div style={{ paddingBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(12px + env(safe-area-inset-top)) 16px 12px" }}>
          <button type="button" aria-label="Salir de editar" onClick={() => setMode("read")} style={PILL_SOLID}>
            <Icon name="back" size={22} />
          </button>
          <span style={{ font: "700 11px/1 var(--font-sans)", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-ambar)" }}>Editando</span>
          <button type="button" onClick={() => setMode("read")} style={{ height: 42, display: "flex", alignItems: "center", padding: "0 16px", borderRadius: 14, background: "var(--color-ambar)", border: "none", font: "700 14px var(--font-sans)", color: "#241609", cursor: "pointer" }}>
            Listo
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "6px 18px 0" }}>
          {/* Fotos: subir, ver y quitar (componente ya probado; su presentación difiere de
              la tira compacta del tablero, pero cubre la función completa). */}
          <SessionPhotos sessionId={sessionId} photos={photos} isOwner />

          {/* Fecha / lugar / notas + compañía: colapsadas por defecto, con el valor a la
              vista (DS.2). La lista de bebidas es lo que se edita seguido; esto una vez o
              nunca. */}
          <CollapsibleField title="Detalles" summary={detSummary} open={detOpen} onToggle={() => setDetOpen((o) => !o)}>
            <SessionHeaderEditor bare session={{ id: sessionId, date: dateInput, placeName: placeName ?? "", notes: notes ?? "" }} />
          </CollapsibleField>
          <CollapsibleField title="Compañía" summary={compRowSummary} open={compOpen} onToggle={() => setCompOpen((o) => !o)}>
            <SessionTagsEditor bare sessionId={sessionId} tags={tags} />
          </CollapsibleField>

          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={EYEBROW}>Las bebidas</span>
              <span style={{ font: "500 12px var(--font-sans)", color: "var(--color-tenue-2)" }}>toca una para calificar</span>
            </div>
            {checkIns.length === 0 ? (
              <p style={{ font: "400 14px var(--font-sans)", color: "var(--color-tenue)" }}>Todavía nada por aquí.</p>
            ) : (
              <OwnerCheckInList sessionId={sessionId} checkIns={checkIns} />
            )}
          </section>

          <DeleteSessionButton sessionId={sessionId} checkInCount={checkIns.length} label="Borrar la salida" block />
        </div>

        {/* ＋ Bebida anclado al pulgar. */}
        <div style={{ position: "sticky", bottom: 0, borderTop: "1px solid #2b2018", background: "var(--color-noche)", padding: "12px 18px calc(14px + env(safe-area-inset-bottom,0px))", marginTop: 12 }}>
          <AddCheckInButton sessionId={sessionId} variant="primary" />
        </div>
      </div>
    );
  }

  // ================================ MODO LECTURA ================================
  const titleOverlay = (
    <>
      {isTagged && taggedByName && (
        <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(62,143,107,.16)", border: "1px solid rgba(62,143,107,.42)", color: "#6FC79C", font: "600 12px var(--font-sans)", borderRadius: 999, padding: "6px 11px" }}>
          {taggedByName} te etiquetó
        </span>
      )}
      {!isOwner && !isTagged && (
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Avatar avatar={ownerAvatar} size={30} radius={10} />
          <span style={{ font: "600 14.5px var(--font-sans)", color: "var(--color-espuma)" }}>{ownerName}</span>
        </div>
      )}
      <div style={{ font: "800 31px/1.02 var(--font-display)", letterSpacing: "-.03em", color: "var(--color-espuma)" }}>{title}</div>
      <div style={{ font: "500 14px var(--font-sans)", color: "#c9b795" }}>{subtitle}</div>
    </>
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Filo verde del estado etiquetado (1e). */}
      {isTagged && <div aria-hidden style={{ height: 4, background: "#3e8f6b" }} />}
      {/* Header: flotante sobre la foto; sólido si no hay foto. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(12px + env(safe-area-inset-top)) 16px 12px", position: "relative", zIndex: 2 }}>
        <Link href="/" aria-label="Atrás" style={hasPhoto ? PILL_FLOAT : PILL_SOLID}>
          <Icon name="back" size={22} />
        </Link>
        {isOwner ? (
          <button type="button" aria-label="Más" onClick={() => setMenuOpen(true)} style={hasPhoto ? PILL_FLOAT : PILL_SOLID}>
            <Icon name="more" size={22} />
          </button>
        ) : (
          <ShareButton sessionId={sessionId} variant="icon" />
        )}
      </div>

      {/* Titular: foto o, sin foto, bloque de texto. */}
      {hasPhoto ? (
        <div style={{ marginTop: -70 }}>
          <PhotoHero photos={photos} height={isTagged ? 290 : !isOwner ? 300 : 330}>
            {titleOverlay}
          </PhotoHero>
        </div>
      ) : (
        <div style={{ padding: "6px 18px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          {isTagged && taggedByName && (
            <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(62,143,107,.16)", border: "1px solid rgba(62,143,107,.42)", color: "#6FC79C", font: "600 12px var(--font-sans)", borderRadius: 999, padding: "6px 11px", marginBottom: 4 }}>
              {taggedByName} te etiquetó
            </span>
          )}
          {/* Círculo sin foto: atribuir al dueño (con foto va sobre la imagen). */}
          {!isOwner && !isTagged && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 2 }}>
              <Avatar avatar={ownerAvatar} size={30} radius={10} />
              <span style={{ font: "600 14.5px var(--font-sans)", color: "var(--color-crema)" }}>{ownerName}</span>
            </div>
          )}
          <div style={{ font: "800 32px/1.02 var(--font-display)", letterSpacing: "-.03em" }}>{title}</div>
          <div style={{ font: "500 14.5px var(--font-sans)", color: "var(--color-tenue)" }}>{subtitle}</div>
        </div>
      )}

      {/* Invitación a subir foto (dueño, sin foto). */}
      {isOwner && !hasPhoto && (
        <div style={{ margin: "16px 18px 0", borderRadius: 20, border: "1px dashed #4a3a28", padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div aria-hidden style={{ width: 44, height: 44, borderRadius: 14, background: "var(--color-barra)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-tenue)", flex: "none" }}>
            <Icon name="camera" size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 14.5px var(--font-sans)", color: "var(--color-espuma)" }}>Ponle una foto</div>
            <div style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue-2)", marginTop: 2 }}>Una sola alcanza para acordarse</div>
          </div>
          <button type="button" onClick={enterEdit} style={{ height: 38, display: "flex", alignItems: "center", padding: "0 14px", borderRadius: 12, background: "#2e2217", border: "none", font: "600 13px var(--font-sans)", color: "var(--color-ambar)", flex: "none", cursor: "pointer" }}>
            Subir
          </button>
        </div>
      )}

      {/* Resumen de dos cifras (o una) + marcas de conteo (dueño). Etiquetada: cifras propias. */}
      {isTagged ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px 12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ font: "800 26px/1 var(--font-display)", letterSpacing: "-.02em", color: "var(--color-ambar)" }}>{total}</span>
            <span style={{ font: "500 11px var(--font-sans)", color: "var(--color-tenue)" }}>de {ownerName}</span>
          </div>
          {taggedMine > 0 && (
            <>
              <div style={{ width: 1, height: 34, background: "var(--color-borde)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ font: "800 26px/1 var(--font-display)", letterSpacing: "-.02em", color: "#6FC79C" }}>{taggedMine}</span>
                <span style={{ font: "500 11px var(--font-sans)", color: "var(--color-tenue)" }}>{taggedMine === 1 ? "tuya, ya sumada" : "tuyas, ya sumadas"}</span>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px 14px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ font: "800 26px/1 var(--font-display)", letterSpacing: "-.02em", color: "var(--color-ambar)" }}>{total}</span>
            <span style={{ font: "500 11px var(--font-sans)", color: "var(--color-tenue)" }}>{total === 1 ? "bebida" : "bebidas"}</span>
          </div>
          {checkIns.length > 1 && (
            <>
              <div style={{ width: 1, height: 34, background: "var(--color-borde)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ font: "800 26px/1 var(--font-display)", letterSpacing: "-.02em", color: "var(--color-crema)" }}>{distinct}</span>
                <span style={{ font: "500 11px var(--font-sans)", color: "var(--color-tenue)" }}>distintas</span>
              </div>
            </>
          )}
          {/* RU · §8: "rondas" junto a "bebidas". Sin unidades de alcohol, como la regla. */}
          {rounds.length > 0 && (
            <>
              <div style={{ width: 1, height: 34, background: "var(--color-borde)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ font: "800 26px/1 var(--font-display)", letterSpacing: "-.02em", color: "var(--color-crema)" }}>{rounds.length}</span>
                <span style={{ font: "500 11px var(--font-sans)", color: "var(--color-tenue)" }}>{rounds.length === 1 ? "ronda" : "rondas"}</span>
              </div>
            </>
          )}
          {isOwner && total > 0 && (
            <span style={{ marginLeft: "auto" }}>
              <Tally count={total} color="#6b5334" barW={3} barH={19} gap={4} maxGroups={5} />
            </span>
          )}
        </div>
      )}
      {breakdownText && !isTagged && (
        <div style={{ padding: "0 18px 6px", font: "500 12.5px var(--font-sans)", color: "var(--color-tenue-2)", marginTop: -6 }}>{breakdownText}</div>
      )}

      {/* Cabecera de la lista + (dueño) Editar. */}
      <div style={{ padding: "0 18px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <span style={EYEBROW}>{isTagged ? `Las bebidas de ${ownerName}` : "Las bebidas"}</span>
        {isOwner && (
          <button type="button" onClick={enterEdit} style={{ height: 34, display: "flex", alignItems: "center", padding: "0 13px", border: "1px solid var(--color-borde)", borderRadius: 11, font: "600 13px var(--font-sans)", color: "var(--color-ambar)", background: "var(--color-barra)", cursor: "pointer" }}>
            Editar
          </button>
        )}
      </div>

      {/* Lista de bebidas. */}
      <div style={{ padding: PAD }}>
        {checkIns.length === 0 ? (
          <p style={{ font: "400 14px var(--font-sans)", color: "var(--color-tenue)" }}>Todavía nada por aquí.</p>
        ) : isTagged ? (
          <TaggedCheckInList
            canYoTambien
            initialAddedIds={initialMineIds}
            onAddedCountChange={setTaggedMine}
            checkIns={checkIns.map((c) => ({ id: c.id, quantity: c.quantity, format: c.format, rating: c.rating, beerName: c.beerName, brewery: c.brewery }))}
          />
        ) : (
          <CheckInReadList checkIns={checkIns.map((c) => ({ id: c.id, quantity: c.quantity, format: c.format, rating: c.rating, beerName: c.beerName, brewery: c.brewery }))} />
        )}
      </div>

      {/* La ruleta (RU · §8): última ronda completa + anteriores colapsadas + girar. */}
      <RouletteBlock rounds={rounds} isOwner={isOwner} viewerId={viewer.id} sessionId={sessionId} />

      {/* Notas (lectura). */}
      {notes && (
        <div style={{ padding: "16px 18px 6px" }}>
          <div style={{ ...EYEBROW, marginBottom: 8 }}>Notas</div>
          <p style={{ font: "400 14.5px/1.55 var(--font-sans)", color: "#d6c7ae", margin: 0, borderLeft: "2px solid var(--color-borde)", paddingLeft: 12 }}>{notes}</p>
        </div>
      )}

      {/* Zona social: fondo propio, tras la costura de espuma (invertida). "El brindis". */}
      <div style={{ background: "#191310", borderTop: "1px solid #2b2018", borderRadius: "28px 28px 0 0", padding: "0 18px 22px", marginTop: 18 }}>
        <div aria-hidden style={{ height: 6, margin: "0 -18px", background: "radial-gradient(circle at 50% 0%,#191310 4.5px,transparent 5px) 0 0/10px 6px repeat-x", position: "relative", top: -1 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 12px" }}>
          <span style={{ ...EYEBROW, color: "var(--color-tenue-2)" }}>El brindis</span>
          {(nBrindis > 0 || nComments > 0) && (
            <span style={{ font: "500 12.5px var(--font-sans)", color: "var(--color-tenue-2)" }}>
              {nBrindis > 0 ? `${nBrindis} brindis` : ""}
              {nBrindis > 0 && nComments > 0 ? " · " : ""}
              {nComments > 0 ? `${nComments} comentario${nComments === 1 ? "" : "s"}` : ""}
            </span>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <ReactionBar sessionId={sessionId} reactors={reactions.reactors} mine={reactions.mine} viewer={viewer} social />
        </div>

        <SessionComments sessionId={sessionId} comments={comments} viewer={viewer} autoFocus={autoFocusComment} heading={false} />
      </div>

      {/* Menú del dueño (ic-more): Compartir + Editar. */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80 }} onClick={() => setMenuOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 60px)", right: 16, width: 200, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 16, boxShadow: "0 14px 34px rgba(0,0,0,.5)", overflow: "hidden", padding: "6px 0" }}
          >
            <ShareButton sessionId={sessionId} variant="menuItem" onClose={() => setMenuOpen(false)} />
            <button
              type="button"
              onClick={enterEdit}
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", height: 44, padding: "0 14px", background: "transparent", border: "none", cursor: "pointer", font: "600 14.5px var(--font-sans)", color: "var(--color-crema)" }}
            >
              <Icon name="plus" size={18} color="var(--color-tenue)" />
              Editar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
