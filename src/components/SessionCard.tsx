import Link from "next/link";
import { RatingDisplay } from "@/components/Stars";
import { FORMAT_LABEL, relativeDay } from "@/lib/format";
import type { FeedSession } from "@/lib/queries";

export function SessionCard({
  session,
  viewerId,
}: {
  session: FeedSession;
  viewerId: string;
}) {
  const { user, tags, checkIns, totalUnits, isOwner } = session;

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="card"
      style={{
        display: "block",
        padding: "1rem",
        textDecoration: "none",
        color: "var(--text)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div>
          <div style={{ fontWeight: 700 }}>
            {isOwner ? "Tú" : user.displayName}
            {session.placeName ? (
              <span style={{ color: "var(--muted)", fontWeight: 500 }}> · {session.placeName}</span>
            ) : null}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{relativeDay(session.date)}</div>
        </div>
        {!isOwner && (
          <span
            className="chip"
            style={{ background: "var(--foam)", borderColor: "transparent", color: "#7c4a03", fontWeight: 600 }}
          >
            {user.displayName} te etiquetó
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.6rem" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)", alignSelf: "center" }}>Con</span>
          {tags.map((t) => (
            <span key={t.id} className="chip">
              {t.taggedUser
                ? `👤 ${t.taggedUser.id === viewerId ? "tú" : t.taggedUser.displayName}`
                : `✎ ${t.freeText}`}
            </span>
          ))}
        </div>
      )}

      {checkIns.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0", display: "grid", gap: "0.4rem" }}>
          {checkIns.map((c) => (
            <li key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <strong>{c.quantity}×</strong> {c.beer.name}
                <span style={{ color: "var(--muted)" }}> · {FORMAT_LABEL[c.format]}</span>
              </span>
              <RatingDisplay value={c.rating} size="0.82rem" />
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.75rem 0 0" }}>Sin cervezas aún.</p>
      )}

      <div style={{ marginTop: "0.8rem", borderTop: "1px solid var(--border)", paddingTop: "0.6rem", display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
        <span style={{ color: "var(--muted)" }}>{checkIns.length} check-in{checkIns.length !== 1 ? "s" : ""}</span>
        <span style={{ fontWeight: 700, color: "var(--accent)" }}>
          🍺 {totalUnits} unidad{totalUnits !== 1 ? "es" : ""}
        </span>
      </div>
    </Link>
  );
}
