import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getSessionDetail } from "@/lib/queries";
import { Stars } from "@/components/Stars";
import { FORMAT_LABEL, formatDay } from "@/lib/format";
import { sessionTotalUnits } from "@/lib/domain";
import { QuickAddCheckIn } from "@/components/QuickAddCheckIn";
import { CheckInDeleteButton } from "@/components/CheckInDeleteButton";
import { DeleteSessionButton } from "@/components/DeleteSessionButton";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireUser();
  const s = await getSessionDetail(id);
  if (!s) notFound();

  const isOwner = s.userId === viewer.id;
  const isTagged = s.tags.some((t) => t.taggedUserId === viewer.id);
  if (!isOwner && !isTagged) notFound(); // privacidad: solo dueño o etiquetados

  const total = sessionTotalUnits({ checkIns: s.checkIns });

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Link href="/" className="btn btn-ghost" style={{ padding: "0.35rem 0.6rem" }}>
          ←
        </Link>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Sesión</h1>
      </div>

      <section className="card" style={{ padding: "1rem", display: "grid", gap: "0.6rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
              {isOwner ? "Tú" : s.user.displayName}
            </div>
            <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{formatDay(s.date)}</div>
          </div>
          {!isOwner && (
            <span className="chip" style={{ background: "var(--foam)", borderColor: "transparent", color: "#7c4a03", fontWeight: 600 }}>
              {s.user.displayName} te etiquetó
            </span>
          )}
        </div>

        {s.placeName && <div>📍 {s.placeName}</div>}

        {s.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)", alignSelf: "center" }}>Con</span>
            {s.tags.map((t) => (
              <span key={t.id} className="chip">
                {t.taggedUser
                  ? `👤 ${t.taggedUser.id === viewer.id ? "tú" : t.taggedUser.displayName}`
                  : `✎ ${t.freeText}`}
              </span>
            ))}
          </div>
        )}

        {s.notes && (
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{s.notes}</p>
        )}
      </section>

      <section style={{ display: "grid", gap: "0.6rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontWeight: 700 }}>Cervezas</h2>
          <span style={{ fontWeight: 700, color: "var(--accent)" }}>
            🍺 {total} unidad{total !== 1 ? "es" : ""}
          </span>
        </div>

        {s.checkIns.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Sin cervezas registradas.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
            {s.checkIns.map((c) => (
              <li key={c.id} className="card" style={{ padding: "0.7rem 0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {c.quantity}× {c.beer.name}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {c.beer.brewery} · {FORMAT_LABEL[c.format]}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Stars value={c.rating} size="0.9rem" />
                  {isOwner && <CheckInDeleteButton checkInId={c.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner ? (
        <>
          <section style={{ display: "grid", gap: "0.6rem" }}>
            <h2 style={{ fontWeight: 700 }}>Agregar otra cerveza</h2>
            <QuickAddCheckIn sessionId={s.id} />
          </section>

          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", marginTop: "0.5rem" }}>
            <Link href={`/sessions/${s.id}/edit`} className="btn btn-ghost">
              Editar detalles / compañía
            </Link>
            <DeleteSessionButton sessionId={s.id} checkInCount={s.checkIns.length} />
          </div>
        </>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", textAlign: "center" }}>
          Estás viendo la sesión de {s.user.displayName} en solo lectura.
        </p>
      )}
    </div>
  );
}
