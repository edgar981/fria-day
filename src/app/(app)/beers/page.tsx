import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getBeersWithRanking } from "@/lib/queries";
import { Stars } from "@/components/Stars";
import { BeerSearch } from "@/components/BeerSearch";
import { formatAbv } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BeersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const beers = await getBeersWithRanking(q);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Catálogo</h1>
      <BeerSearch initialQ={q ?? ""} />

      {beers.length === 0 ? (
        <div className="card" style={{ padding: "1.5rem", textAlign: "center", color: "var(--muted)" }}>
          {q ? "Ninguna cerveza coincide." : "El catálogo está vacío. Se irá llenando al registrar cervezas en tus sesiones."}
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
          {beers.map((b, i) => (
            <li key={b.id}>
              <Link
                href={`/beers/${b.id}`}
                className="card"
                style={{ display: "flex", alignItems: "center", gap: "0.8rem", padding: "0.75rem 0.9rem", textDecoration: "none", color: "var(--text)" }}
              >
                <span style={{ fontWeight: 800, color: "var(--muted)", minWidth: 22, textAlign: "right" }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {b.name}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    {b.brewery}
                    {b.style ? ` · ${b.style}` : ""}
                    {formatAbv(b.abv) ? ` · ${formatAbv(b.abv)}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {b.avgRating != null ? (
                    <>
                      <Stars value={b.avgRating} size="0.82rem" />
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        {b.avgRating.toFixed(1)} · {b.ratingsCount} rating{b.ratingsCount !== 1 ? "s" : ""}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>sin ratings</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
