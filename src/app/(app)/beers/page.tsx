import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getBeersWithRanking } from "@/lib/queries";
import { BeerSearch } from "@/components/BeerSearch";
import { BottomNav } from "@/components/BottomNav";

export const dynamic = "force-dynamic";

function RankRow({ beer, rank }: { beer: Awaited<ReturnType<typeof getBeersWithRanking>>[number]; rank: number }) {
  return (
    <Link
      href={`/beers/${beer.id}`}
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderBottom: "1px solid #241A12", textDecoration: "none", color: "var(--color-crema)" }}
    >
      <span style={{ font: "800 20px var(--font-display)", color: rank <= 2 ? "var(--color-ambar)" : "var(--color-tenue)", width: 24, flex: "none" }}>{rank + 1}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ font: "600 16px/1.2 var(--font-sans)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{beer.name}</span>
        <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>
          {beer.brewery}
          {beer.style ? ` · ${beer.style}` : ""}
        </span>
      </span>
      <span style={{ textAlign: "right", flex: "none" }}>
        <span style={{ font: "800 20px/1 var(--font-display)", color: "var(--color-espuma)", display: "block" }}>{beer.avgRating!.toFixed(1)}</span>
        <span style={{ font: "400 11px var(--font-sans)", color: "var(--color-tenue)" }}>{beer.ratingsCount} rating{beer.ratingsCount !== 1 ? "s" : ""}</span>
      </span>
    </Link>
  );
}

export default async function BeersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const beers = await getBeersWithRanking(q);
  const rated = beers.filter((b) => b.avgRating != null);
  const unrated = beers.filter((b) => b.avgRating == null);

  return (
    <div className="pb-nav">
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--color-noche)", borderBottom: "1px solid #241A12", padding: "16px 18px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ font: "800 26px/1 var(--font-display)", letterSpacing: "-.02em" }}>
          Catálogo <span style={{ font: "600 15px var(--font-sans)", color: "var(--color-tenue)" }}>· {beers.length} cerveza{beers.length !== 1 ? "s" : ""}</span>
        </div>
        <BeerSearch initialQ={q ?? ""} />
        <div style={{ display: "flex", gap: 7 }}>
          <span style={{ height: 34, padding: "0 14px", borderRadius: 999, background: "var(--color-ambar)", color: "var(--color-tinta)", font: "600 13px var(--font-sans)", display: "flex", alignItems: "center" }}>Mejor calificadas</span>
        </div>
      </header>

      <main style={{ padding: "8px 18px 0" }}>
        {beers.length === 0 ? (
          <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--color-tenue)", marginTop: 12 }}>
            {q ? "Ninguna cerveza coincide." : "El catálogo está vacío. Se irá llenando al registrar cervezas en tus salidas."}
          </div>
        ) : (
          <>
            {rated.map((b, i) => (
              <RankRow key={b.id} beer={b} rank={i} />
            ))}
            {unrated.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 4px" }}>
                  <span className="eyebrow">Sin calificar · {unrated.length}</span>
                  <span style={{ flex: 1, height: 1, background: "#241A12" }} />
                </div>
                {unrated.map((b) => (
                  <Link key={b.id} href={`/beers/${b.id}`} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderBottom: "1px solid #241A12", textDecoration: "none" }}>
                    <span style={{ width: 24, flex: "none" }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ font: "600 16px/1.2 var(--font-sans)", display: "block", color: "#D6C7AE" }}>{b.name}</span>
                      <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>
                        {b.brewery}
                        {b.style ? ` · ${b.style}` : ""}
                      </span>
                    </span>
                    <span style={{ font: "600 12.5px var(--font-sans)", color: "var(--color-ambar)", border: "1px dashed #6B5334", borderRadius: 999, padding: "7px 13px", flex: "none" }}>Calificála</span>
                  </Link>
                ))}
              </>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
