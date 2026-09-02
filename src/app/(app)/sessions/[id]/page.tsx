import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getSessionDetail, loadCircle } from "@/lib/queries";
import { BackHeader } from "@/components/BackHeader";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Tally } from "@/components/Tally";
import { AddCheckInButton } from "@/components/AddCheckInButton";
import { OwnerCheckInList } from "@/components/OwnerCheckInList";
import { TaggedCheckInList } from "@/components/TaggedCheckInList";
import { DeleteSessionButton } from "@/components/DeleteSessionButton";
import { ReactionBar } from "@/components/ReactionBar";
import { formatDay, formatBreakdownText } from "@/lib/format";
import { sessionTotalUnits, formatBreakdown } from "@/lib/domain";

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
  const s = await getSessionDetail(id, viewer.id);
  if (!s) notFound();

  const isOwner = s.userId === viewer.id;
  const myTag = s.tags.find((t) => t.taggedUserId === viewer.id);
  const isTagged = !!myTag;
  // Pasada C: puedo ver una salida si su dueño está en mi círculo (cubre propia,
  // etiquetado y "del parche" sin etiqueta). Fuera del círculo → 404, como antes.
  const circle = await loadCircle(viewer.id);
  if (!circle.has(s.userId)) notFound();

  const total = sessionTotalUnits({ checkIns: s.checkIns });
  const bd = formatBreakdown(s.checkIns.map((c) => ({ format: c.format, quantity: c.quantity })));
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
          {/* Distintivo SOLO con etiqueta real (C.1: se quitó "Del parche"). Las
              salidas del círculo sin etiqueta se identifican por el título
              ("Salida de X"), sin distintivo. */}
          {isTagged && (
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
            {/* Si la salida es de otro y tiene lugar (el título muestra el lugar),
                el dueño se atribuye aquí. Sin lugar, ya lo dice el título. */}
            {!isOwner && s.placeName ? `Salida de ${s.user.displayName} · ` : ""}
            {formatDay(s.date)}
            {compSummary ? ` · con ${compSummary}` : ""}
          </div>
        </div>

        {/* Total de la salida */}
        <div style={{ background: "linear-gradient(180deg,#C4620A,#8A4208)", borderRadius: 22, padding: "17px 19px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ font: "700 11px/1 var(--font-sans)", letterSpacing: ".16em", color: "rgba(251,240,213,.75)" }}>TOTAL DE LA SALIDA</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginTop: 7 }}>
              <span style={{ font: "800 40px/1 var(--font-display)", color: "var(--color-espuma)" }}>{total}</span>
              <span style={{ font: "600 14px var(--font-sans)", color: "rgba(251,240,213,.8)", paddingBottom: 4 }}>bebidas</span>
            </div>
            {/* Desglose por formato (Pasada D): solo con más de un formato. */}
            {bd.length > 1 && (
              <div style={{ font: "500 12.5px var(--font-sans)", color: "rgba(251,240,213,.72)", marginTop: 6 }}>{formatBreakdownText(bd)}</div>
            )}
          </div>
          {total > 0 && <Tally count={total} color="var(--color-espuma)" barW={3} barH={30} gap={4} maxGroups={5} labelColor="rgba(251,240,213,.7)" />}
        </div>

        {/* Reacciones (Pasada R). Reemplazan al contador "X de N registraron" y al
            control "No tomé ese día", ambos quitados: la racha queda privada (perfil). */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ReactionBar sessionId={s.id} groups={s.reactions.groups} mine={s.reactions.mine} showSummary={false} />
          {s.reactionWho.length > 0 && (
            <div style={{ font: "400 12.5px/1.5 var(--font-sans)", color: "var(--color-tenue)" }}>
              {s.reactionWho.map((w) => `${w.emoji} ${w.names.join(", ")}`).join("   ·   ")}
            </div>
          )}
        </div>

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
          <div className="eyebrow" style={{ marginBottom: 11 }}>Las bebidas</div>
          {s.checkIns.length === 0 ? (
            <p style={{ font: "400 14px var(--font-sans)", color: "var(--color-tenue)" }}>Todavía nada por aquí.</p>
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
                photoUrl: c.photoUrl,
              }))}
            />
          ) : (
            // Salida ajena en solo lectura + "Yo también" por bebida (Pasada Y),
            // ofrecido SOLO si estás etiquetado (no a un simple visitante del círculo).
            <TaggedCheckInList
              canYoTambien={isTagged}
              checkIns={s.checkIns.map((c) => ({
                id: c.id,
                quantity: c.quantity,
                format: c.format,
                rating: c.rating,
                beerName: c.beer.name,
                brewery: c.beer.brewery,
                photoUrl: c.photoUrl,
              }))}
            />
          )}
        </section>

        {s.notes && (
          <section>
            <div className="eyebrow" style={{ marginBottom: 7 }}>Notas</div>
            <div className="card" style={{ padding: 14, font: "400 15px/1.55 var(--font-sans)", color: "#D6C7AE" }}>{s.notes}</div>
          </section>
        )}

      </main>
    </div>
  );
}
