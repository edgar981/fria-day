import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getBeerDetail } from "@/lib/queries";
import { Stars } from "@/components/Stars";
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
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Link href="/beers" className="btn btn-ghost" style={{ padding: "0.35rem 0.6rem" }}>
          ←
        </Link>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Cerveza</h1>
      </div>

      <section className="card" style={{ padding: "1.1rem", display: "grid", gap: "0.5rem" }}>
        <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>{beer.name}</div>
        <div style={{ color: "var(--muted)" }}>
          {beer.brewery}
          {beer.style ? ` · ${beer.style}` : ""}
          {formatAbv(beer.abv) ? ` · ${formatAbv(beer.abv)}` : ""}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.4rem" }}>
          {avgRating != null ? (
            <>
              <Stars value={avgRating} size="1.1rem" />
              <span style={{ fontWeight: 700 }}>{avgRating.toFixed(1)}</span>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                · {ratingsCount} rating{ratingsCount !== 1 ? "s" : ""} del grupo
              </span>
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>Aún sin ratings del grupo.</span>
          )}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          Agregada por {beer.createdBy.displayName}
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.6rem" }}>
        <h2 style={{ fontWeight: 700 }}>Ratings recientes</h2>
        {recent.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Todavía nadie la ha registrado.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
            {recent.map((c) => (
              <li key={c.id} className="card" style={{ padding: "0.6rem 0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <Link href={`/sessions/${c.session.id}`} style={{ textDecoration: "none", color: "var(--text)", minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{c.session.user.displayName}</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
                    {formatDay(c.session.date)} · {c.quantity}× {FORMAT_LABEL[c.format]}
                  </div>
                </Link>
                <Stars value={c.rating} size="0.85rem" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
