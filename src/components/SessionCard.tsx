import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Glasses, RatingCell } from "@/components/Glasses";
import { Tally } from "@/components/Tally";
import { FoamStrip } from "@/components/FoamStrip";
import { FORMAT_LABEL, formatAbv, relativeDay, pendingLabel } from "@/lib/format";
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
          {c.beer.brewery}
          {c.beer.style ? ` · ${c.beer.style}` : ""}
          {formatAbv(c.beer.abv) ? ` · ${formatAbv(c.beer.abv)}` : ""}
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
          {c.beer.brewery} · {FORMAT_LABEL[c.format]}
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

export function SessionCard({
  session,
  viewerId,
}: {
  session: FeedSession;
  viewerId: string;
}) {
  const { user, tags, checkIns, totalUnits, isOwner, viewerTagged } = session;
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

        {/* Pasada B: "quién falta" + aviso de racha en riesgo (social, acotado al
            grupo de la salida, que ya es visible solo para dueño y etiquetados). */}
        {session.social && session.social.total > 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 12, padding: "9px 11px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ font: "600 13px var(--font-sans)", color: "var(--color-crema)" }}>
                {session.social.registered} de {session.social.total} registraron
              </span>
              {session.social.registered < session.social.total && session.social.pending.length === 0 && (
                <span style={{ font: "500 12px var(--font-sans)", color: "var(--color-tenue-2)" }}>plazo vencido</span>
              )}
            </div>
            {session.social.pending.length > 0 && (
              <span style={{ font: "500 12.5px/1.4 var(--font-sans)", color: "var(--color-ambar)" }}>
                {pendingLabel(session.social.pending, viewerId)} · {session.social.plazoLabel}
              </span>
            )}
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

        {/* Pie: total (marcas de conteo + unidades). Sin "N check-ins": es un
            detalle de implementación. El total conserva las marcas de conteo,
            distinto del número-en-chip de cada cerveza (item A.1-8). */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, borderTop: "1px solid #241A12", paddingTop: 11 }}>
          {totalUnits > 0 && <Tally count={totalUnits} barW={2.5} barH={14} gap={3} maxGroups={6} />}
          <span style={{ font: "700 15px var(--font-sans)", color: "var(--color-ambar)" }}>
            {totalUnits} unidad{totalUnits !== 1 ? "es" : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
