import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getBeerDetail } from "@/lib/queries";
import { BackHeader } from "@/components/BackHeader";
import { Avatar } from "@/components/Avatar";
import { Glasses, RatingCell } from "@/components/Glasses";
import { BeerFieldsEditor } from "@/components/BeerFieldsEditor";
import { FORMAT_LABEL, formatAbv, formatDay } from "@/lib/format";
import type { OwnBeerRating } from "@/lib/domain";

export const dynamic = "force-dynamic";

const dashedPill: React.CSSProperties = {
  font: "500 13px var(--font-sans)",
  color: "var(--color-tenue-2)",
  border: "1px dashed #3A2A1A",
  borderRadius: 999,
  padding: "6px 12px",
};

function StatRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 34 }}>
      <span style={{ font: "600 13.5px var(--font-sans)", color: "var(--color-tenue)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>{children}</div>
    </div>
  );
}

// Tu rating: el más reciente propio, o el estado ("No la has probado" / "Sin calificar").
function OwnStat({ own }: { own: OwnBeerRating }) {
  return (
    <StatRow label="Tu rating">
      {own.status === "rated" ? (
        <>
          <Glasses value={own.rating} size="md" />
          <span style={{ font: "800 22px/1 var(--font-display)", color: "var(--color-espuma)" }}>{own.rating}</span>
        </>
      ) : (
        <span style={dashedPill}>{own.status === "never" ? "No la has probado" : "Sin calificar"}</span>
      )}
    </StatRow>
  );
}

// El parche: promedio del grupo + conteo (obligatorio), o "Sin calificar".
function GroupStat({ avg, count }: { avg: number | null; count: number }) {
  return (
    <StatRow label="El parche">
      {avg != null ? (
        <>
          <Glasses value={Math.round(avg)} size="md" />
          <span style={{ font: "800 22px/1 var(--font-display)", color: "var(--color-espuma)" }}>{avg.toFixed(1)}</span>
          <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>· {count} rating{count !== 1 ? "s" : ""}</span>
        </>
      ) : (
        <span style={dashedPill}>Sin calificar</span>
      )}
    </StatRow>
  );
}

export default async function BeerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getBeerDetail(id, user.id);
  if (!data) notFound();
  const { beer, avgRating, ratingsCount, own, otherRated, recent } = data;
  // Colapsar a una sola stat (label del grupo) cuando el único que la calificó eres tú.
  const collapse = ratingsCount > 0 && !otherRated;

  return (
    <div>
      <BackHeader title="Cerveza" href="/beers" />
      <main style={{ padding: "18px 18px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ font: "800 30px/1.05 var(--font-display)", letterSpacing: "-.025em" }}>{beer.name}</div>
          <div style={{ font: "500 14.5px var(--font-sans)", color: "var(--color-tenue)", marginTop: -2 }}>
            {beer.brewery}
            {beer.style ? ` · ${beer.style}` : ""}
            {formatAbv(beer.abv) ? ` · ${formatAbv(beer.abv)}` : ""}
          </div>
          <BeerFieldsEditor beerId={beer.id} style={beer.style} abv={beer.abv ? beer.abv.toString() : null} />
        </div>

        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {collapse ? (
            <GroupStat avg={avgRating} count={ratingsCount} />
          ) : (
            <>
              <OwnStat own={own} />
              <div style={{ height: 1, background: "var(--color-borde)" }} />
              <GroupStat avg={avgRating} count={ratingsCount} />
            </>
          )}
        </div>
        <div style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue-2)", marginTop: -8 }}>Agregada por {beer.createdBy.displayName}</div>

        <section>
          <div className="eyebrow" style={{ marginBottom: 11 }}>Registros recientes</div>
          {recent.length === 0 ? (
            <p style={{ font: "400 14px var(--font-sans)", color: "var(--color-tenue)" }}>Todavía nadie la ha registrado.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {recent.map((c) => (
                <Link key={c.id} href={`/sessions/${c.session.id}`} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "var(--color-crema)" }}>
                  <Avatar avatar={c.session.user.avatar} size={36} radius={11} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 15px var(--font-sans)" }}>{c.session.user.displayName}</div>
                    <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue)" }}>{formatDay(c.session.date)} · {c.quantity}× {FORMAT_LABEL[c.format]}</div>
                  </div>
                  <RatingCell value={c.rating} size="xs" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
