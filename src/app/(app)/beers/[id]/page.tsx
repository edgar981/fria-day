import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getBeerDetail } from "@/lib/queries";
import { BackHeader } from "@/components/BackHeader";
import { Avatar } from "@/components/Avatar";
import { Glasses, RatingCell } from "@/components/Glasses";
import { FORMAT_LABEL, formatAbv, formatDay } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BeerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const data = await getBeerDetail(id);
  if (!data) notFound();
  const { beer, avgRating, ratingsCount, recent } = data;

  return (
    <div>
      <BackHeader title="Cerveza" href="/beers" />
      <main style={{ padding: "18px 18px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div style={{ font: "800 30px/1.05 var(--font-display)", letterSpacing: "-.025em" }}>{beer.name}</div>
          <div style={{ font: "500 14.5px var(--font-sans)", color: "var(--color-tenue)", marginTop: 6 }}>
            {beer.brewery}
            {beer.style ? ` · ${beer.style}` : ""}
            {formatAbv(beer.abv) ? ` · ${formatAbv(beer.abv)}` : ""}
          </div>
        </div>

        <div className="card" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          {avgRating != null ? (
            <>
              <Glasses value={Math.round(avgRating)} size="lg" />
              <div>
                <div style={{ font: "800 26px/1 var(--font-display)", color: "var(--color-espuma)" }}>{avgRating.toFixed(1)}</div>
                <div style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>{ratingsCount} rating{ratingsCount !== 1 ? "s" : ""} del grupo</div>
              </div>
            </>
          ) : (
            <span style={{ font: "500 14px var(--font-sans)", color: "var(--color-tenue-2)", border: "1px dashed #3A2A1A", borderRadius: 999, padding: "8px 14px" }}>Sin calificar</span>
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
