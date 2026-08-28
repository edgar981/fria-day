import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getSessionDetail } from "@/lib/queries";
import { BackHeader } from "@/components/BackHeader";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RatingCell } from "@/components/Glasses";
import { Tally } from "@/components/Tally";
import { AddCheckInButton } from "@/components/AddCheckInButton";
import { OwnerCheckInList } from "@/components/OwnerCheckInList";
import { DeleteSessionButton } from "@/components/DeleteSessionButton";
import { TagDismissControl } from "@/components/TagDismissControl";
import { FoamStrip } from "@/components/FoamStrip";
import { FORMAT_LABEL, formatDay, pendingLabel } from "@/lib/format";
import { sessionTotalUnits } from "@/lib/domain";

export const dynamic = "force-dynamic";

function companions(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names[0]}, ${names[1]} y ${names.length - 2} más`;
}

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
  const myTag = s.tags.find((t) => t.taggedUserId === viewer.id);
  const isTagged = !!myTag;
  if (!isOwner && !isTagged) notFound();

  const total = sessionTotalUnits({ checkIns: s.checkIns });
  const compSummary = companions(
    s.tags.map((t) =>
      t.taggedUser ? (t.taggedUser.id === viewer.id ? "tú" : t.taggedUser.displayName) : t.freeText ?? "",
    ),
  );

  return (
    <div>
      <BackHeader
        title=""
        href="/"
        right={isOwner ? <DeleteSessionButton sessionId={s.id} checkInCount={s.checkIns.length} /> : undefined}
      />
      <main style={{ padding: "18px 18px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Título */}
        <div>
          {!isOwner && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <Avatar avatar={s.user.avatar} size={32} radius={10} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(62,143,107,.16)", border: "1px solid rgba(62,143,107,.42)", color: "#6FC79C", font: "600 12px var(--font-sans)", borderRadius: 999, padding: "5px 10px" }}>
                <Icon name="lock" size={12} color="#6FC79C" />
                {s.user.displayName} te etiquetó
              </span>
            </div>
          )}
          <div style={{ font: "800 32px/1.05 var(--font-display)", letterSpacing: "-.025em" }}>
            {s.placeName || (isOwner ? "Tu salida" : `Salida de ${s.user.displayName}`)}
          </div>
          <div style={{ font: "500 15px var(--font-sans)", color: "var(--color-tenue)", marginTop: 6 }}>
            {formatDay(s.date)}
            {compSummary ? ` · con ${compSummary}` : ""}
          </div>
        </div>

        {/* Total de la salida */}
        <div style={{ background: "linear-gradient(180deg,#C4620A,#8A4208)", borderRadius: 22, padding: "17px 19px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ font: "700 11px/1 var(--font-sans)", letterSpacing: ".16em", color: "rgba(251,240,213,.75)" }}>TOTAL DE LA SALIDA</div>
            <div style={{ font: "800 40px/1 var(--font-display)", color: "var(--color-espuma)", marginTop: 7 }}>{total}</div>
          </div>
          {total > 0 && <Tally count={total} color="var(--color-espuma)" barW={3} barH={30} gap={4} maxGroups={5} labelColor="rgba(251,240,213,.7)" />}
        </div>

        {/* Pasada B: contador "quién falta" (social, acotado al grupo de la salida). */}
        {s.social && s.social.total > 1 && (
          <div style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 16, padding: "12px 15px", display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ font: "700 15px var(--font-sans)" }}>
              {s.social.registered} de {s.social.total} registraron
            </span>
            {s.social.pending.length > 0 && (
              <span style={{ font: "500 13px/1.4 var(--font-sans)", color: "var(--color-ambar)" }}>
                {pendingLabel(s.social.pending, viewer.id)} · {s.social.plazoLabel}
              </span>
            )}
            {s.social.pending.length === 0 && s.social.registered < s.social.total && (
              <span style={{ font: "500 12.5px var(--font-sans)", color: "var(--color-tenue-2)" }}>El plazo de 48 h ya venció para quienes faltaron.</span>
            )}
          </div>
        )}

        {/* Control "no tomé" — solo el propio etiquetado. */}
        {myTag && <TagDismissControl tagId={myTag.id} dismissed={!!myTag.dismissedAt} />}

        {isOwner && (
          <>
            <AddCheckInButton sessionId={s.id} />
            <Link href={`/sessions/${s.id}/edit`} style={{ font: "600 13.5px var(--font-sans)", color: "var(--color-tenue)", textAlign: "center", textDecoration: "underline" }}>
              Editar fecha, lugar y compañía
            </Link>
          </>
        )}

        {/* Las cervezas */}
        <section>
          <div className="eyebrow" style={{ marginBottom: 11 }}>Las cervezas</div>
          {s.checkIns.length === 0 ? (
            <p style={{ font: "400 14px var(--font-sans)", color: "var(--color-tenue)" }}>Sin cervezas registradas.</p>
          ) : isOwner ? (
            <OwnerCheckInList
              sessionId={s.id}
              checkIns={s.checkIns.map((c) => ({
                id: c.id,
                quantity: c.quantity,
                format: c.format,
                rating: c.rating,
                beerId: c.beerId,
                beerName: c.beer.name,
                brewery: c.beer.brewery,
              }))}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {s.checkIns.map((c) => (
                <div key={c.id} style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 18, overflow: "hidden" }}>
                  <FoamStrip size="sm" />
                  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ minWidth: 36, height: 34, padding: "0 9px", borderRadius: 11, background: "#2E2217", color: "var(--color-ambar)", font: "700 16px var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{c.quantity}×</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "600 16px/1.2 var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.beer.name}</div>
                      <div style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>{c.beer.brewery} · {FORMAT_LABEL[c.format]}</div>
                    </div>
                    <RatingCell value={c.rating} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {s.notes && (
          <section>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Notas</div>
            <div className="card" style={{ padding: 14, font: "400 15px/1.55 var(--font-sans)", color: "#D6C7AE" }}>{s.notes}</div>
          </section>
        )}

        {!isOwner && (
          <p style={{ font: "400 13px var(--font-sans)", color: "var(--color-tenue-2)", textAlign: "center" }}>
            Estás viendo la salida de {s.user.displayName} en solo lectura.
          </p>
        )}
      </main>
    </div>
  );
}
