import { requireUser } from "@/lib/session";
import { getBeersWithRanking } from "@/lib/queries";
import { BeerSearch } from "@/components/BeerSearch";
import { BottomNav } from "@/components/BottomNav";
import { CatalogTabs, type CatalogBeer } from "@/components/CatalogTabs";

export const dynamic = "force-dynamic";

export default async function BeersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const beers = await getBeersWithRanking(q);
  // Partido por tipo (Pasada D). El ranking ya viene ordenado; solo separamos.
  const toCatalog = (b: (typeof beers)[number]): CatalogBeer => ({
    id: b.id,
    name: b.name,
    brewery: b.brewery,
    style: b.style,
    kind: b.kind,
    avgRating: b.avgRating,
    ratingsCount: b.ratingsCount,
  });
  const cervezas = beers.filter((b) => b.kind === "CERVEZA").map(toCatalog);
  const cocteles = beers.filter((b) => b.kind === "COCTEL").map(toCatalog);

  return (
    <div className="pb-nav">
      <div className="pb-scroll">
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--color-noche)", borderBottom: "1px solid #241A12", padding: "calc(16px + env(safe-area-inset-top)) 18px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ font: "800 26px/1 var(--font-display)", letterSpacing: "-.02em" }}>Catálogo</div>
        <BeerSearch initialQ={q ?? ""} />
      </header>

      <main style={{ padding: "12px 18px 0" }}>
        <CatalogTabs cervezas={cervezas} cocteles={cocteles} q={q ?? ""} />
      </main>
      </div>
      <BottomNav />
    </div>
  );
}
