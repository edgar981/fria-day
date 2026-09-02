import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Glasses, RatingCell } from "@/components/Glasses";
import { FoamStrip } from "@/components/FoamStrip";
import { FORMAT_LABEL, formatAbv, relativeDay, joinMeta, formatNoun } from "@/lib/format";
import { ReactionBar } from "@/components/ReactionBar";
import { formatBreakdown } from "@/lib/domain";
import type { FeedSession } from "@/lib/queries";

type CheckIn = FeedSession["checkIns"][number];
type Tag = FeedSession["tags"][number];

function QtyChip({ n, onDark = false }: { n: number; onDark?: boolean }) {
  return (
    <span
      style={{
        minWidth: 34,
        height: 30,
        padding: "0 8px",
        borderRadius: 9,
        background: onDark ? "rgba(251,240,213,.14)" : "#2E2217",
        color: onDark ? "var(--color-espuma)" : "var(--color-ambar)",
        font: "700 14px var(--font-sans)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
      }}
    >
      {n}×
    </span>
  );
}

function BeerHero({ c }: { c: CheckIn }) {
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", background: "linear-gradient(180deg,#4A3413,#2A1E0E)" }}>
      <FoamStrip size="md" />
      <div style={{ height: 10, background: "#FBF0D5" }} />
      <div style={{ padding: "12px 15px 13px" }}>
        <div style={{ font: "700 22px/1.1 var(--font-display)", letterSpacing: "-.02em", color: "var(--color-espuma)" }}>
          {c.beer.name}
        </div>
        <div style={{ font: "400 13px var(--font-sans)", color: "#C9A874", marginTop: 4 }}>
          {joinMeta(c.beer.brewery, c.beer.style, formatAbv(c.beer.abv))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ height: 32, padding: "0 11px", borderRadius: 10, background: "rgba(251,240,213,.14)", color: "var(--color-espuma)", font: "700 15px var(--font-sans)", display: "flex", alignItems: "center" }}>
              {c.quantity}
            </span>
            <span style={{ font: "500 13px var(--font-sans)", color: "#C9A874", border: "1px solid rgba(251,240,213,.22)", borderRadius: 999, padding: "4px 11px" }}>
              {FORMAT_LABEL[c.format]}
            </span>
          </div>
          {c.rating == null ? (
            <span style={{ font: "500 12px var(--font-sans)", color: "#C9A874", border: "1px dashed rgba(251,240,213,.25)", borderRadius: 999, padding: "4px 11px" }}>
              Sin calificar
            </span>
          ) : (
            <Glasses value={c.rating} size="md" empty="rgba(251,240,213,.15)" />
          )}
        </div>
      </div>
    </div>
  );
}

function CompactRow({ c }: { c: CheckIn }) {
  return (
    <div>
      <FoamStrip size="sm" />
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 0 8px" }}>
      <QtyChip n={c.quantity} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "600 15px/1.2 var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.beer.name}
        </div>
        <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue)" }}>
          {joinMeta(c.beer.brewery, FORMAT_LABEL[c.format])}
        </div>
      </div>
      <RatingCell value={c.rating} size="xs" />
      </div>
    </div>
  );
}

function CompanionChips({ tags, viewerId }: { tags: Tag[]; viewerId: string }) {
  if (tags.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>Con</span>
      {tags.map((t) =>
        t.taggedUser ? (
          <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 999, padding: "3px 9px 3px 4px", font: "500 12.5px var(--font-sans)" }}>
            <Avatar avatar={t.taggedUser.avatar} size={20} radius={6} />
            {t.taggedUser.id === viewerId ? "tú" : t.taggedUser.displayName}
          </span>
        ) : (
          <span key={t.id} style={{ display: "inline-flex", alignItems: "center", background: "transparent", border: "1px dashed #4A3A28", borderRadius: 999, padding: "5px 10px", font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>
            {t.freeText}
          </span>
        ),
      )}
    </div>
  );
}

// Métrica compacta de la tarjeta (Pasada N, estilo Pivka): número grande arriba,
// etiqueta pequeña debajo. El total va en ámbar; el desglose por formato, en crema.
function Stat({ value, label, primary = false }: { value: number; label: string; primary?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ font: `800 ${primary ? 22 : 19}px/1 var(--font-display)`, letterSpacing: "-.01em", color: primary ? "var(--color-ambar)" : "var(--color-crema)" }}>
        {value}
      </span>
      <span style={{ font: "500 11px var(--font-sans)", color: "var(--color-tenue)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
    </div>
  );
}

export function SessionCard({
  session,
  viewerId,
}: {
  session: FeedSession;
  viewerId: string;
}) {
  const { user, tags, checkIns, totalUnits, isOwner, viewerTagged } = session;
  // Desglose por formato para la fila de métricas. Solo se pinta con más de un
  // formato: con uno, "5 bebidas · 5 botellas" es redundante (misma regla que el detalle).
  const bd = formatBreakdown(checkIns.map((c) => ({ format: c.format, quantity: c.quantity })));
  // Foto de la salida en la tarjeta (Pasada N, revierte F): la primera bebida CON foto.
  // La mayoría de salidas no tienen foto → la tarjeta se ve bien igual (sin este bloque).
  const heroPhoto = checkIns.find((c) => c.photoUrl)?.photoUrl ?? null;
  // Distintivo verde SOLO cuando hay etiqueta real (Pasada C). Las salidas del
  // círculo sin etiqueta aparecen sin distintivo alguno (C.1: se quitó "Del parche").
  const tagged = !isOwner && viewerTagged;
  const single = checkIns.length === 1;
  const visible = single ? checkIns : checkIns.slice(0, 3);
  const hidden = checkIns.length - visible.length;

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="card"
      style={{
        display: "block",
        textDecoration: "none",
        color: "var(--color-crema)",
        overflow: "hidden",
        // I-1.1: la tarjeta es un tap-target (Link), no texto para seleccionar. El
        // user-select:none del botón no bastaba: al sostener el hold, iOS seleccionaba
        // el texto SELECCIONABLE de alrededor (diagnóstico: cardRoot/nombre = "text").
        // Poniéndolo en el contenedor (hereda a todo el texto) no hay nada que iOS
        // pueda resaltar cerca del dedo. No afecta scroll ni tap.
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
        ...(tagged ? { border: "1px solid rgba(62,143,107,.32)" } : null),
      }}
    >
      {tagged && <div style={{ height: 4, background: "var(--color-botella)" }} />}
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
          <Avatar avatar={user.avatar} size={40} radius={13} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 17px/1.2 var(--font-sans)" }}>
              {isOwner ? "Tú" : user.displayName}
              {session.placeName ? (
                <span style={{ color: "var(--color-tenue)", fontWeight: 400 }}> · {session.placeName}</span>
              ) : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
              <span style={{ font: "400 13px var(--font-sans)", color: "var(--color-tenue)" }}>{relativeDay(session.date)}</span>
              {tagged && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(62,143,107,.16)", border: "1px solid rgba(62,143,107,.42)", color: "#6FC79C", font: "600 11.5px var(--font-sans)", borderRadius: 999, padding: "4px 9px" }}>
                  <Icon name="lock" size={12} color="#6FC79C" />
                  {user.displayName} te etiquetó
                </span>
              )}
            </div>
          </div>
        </div>

        <CompanionChips tags={tags} viewerId={viewerId} />

        {/* Foto de la salida (Pasada N). Caja con aspect-ratio FIJO: reserva el alto
            antes de que cargue, así la tarjeta no salta (mismo criterio que el skeleton
            del feed). loading="lazy" nativo: lo de fuera de pantalla no se descarga
            hasta acercarse; se sirve el original del Blob (ya comprimido en el cliente
            a ≤1200px), sin next/image ni cuota de optimización. */}
        {heroPhoto && (
          <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--color-borde)", background: "var(--color-barra-alta)", aspectRatio: "4 / 3" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroPhoto}
              alt=""
              loading="lazy"
              decoding="async"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}

        {/* Cervezas */}
        {checkIns.length === 0 ? (
          <p style={{ font: "400 13px var(--font-sans)", color: "var(--color-tenue)", margin: 0 }}>Sin cervezas aún.</p>
        ) : single ? (
          <BeerHero c={checkIns[0]} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visible.map((c) => (
              <CompactRow key={c.id} c={c} />
            ))}
            {hidden > 0 && (
              <span style={{ marginTop: 8, height: 40, borderTop: "1px solid #241A12", display: "flex", alignItems: "center", justifyContent: "center", font: "600 14px var(--font-sans)", color: "var(--color-ambar)" }}>
                +{hidden} más
              </span>
            )}
          </div>
        )}

        {/* Pie: fila compacta de métricas (Pasada N, estilo Pivka). Bebidas totales +
            desglose por formato. Sin unidades de alcohol ni duración: la app no mide
            consumo con precisión clínica. */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, borderTop: "1px solid #241A12", paddingTop: 12, flexWrap: "wrap", rowGap: 12 }}>
          <Stat value={totalUnits} label={`bebida${totalUnits !== 1 ? "s" : ""}`} primary />
          {bd.length > 1 &&
            bd.map((b) => <Stat key={b.format} value={b.count} label={formatNoun(b.format, b.count)} />)}
        </div>

        {/* Reacciones (Pasada R). Los botones cortan la navegación de la tarjeta-Link. */}
        <ReactionBar sessionId={session.id} groups={session.reactions.groups} mine={session.reactions.mine} />
      </div>
    </Link>
  );
}
