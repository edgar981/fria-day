/**
 * Siembra el catálogo con las cervezas que el parche pide en Bogotá (B.1 · item 4).
 * Idempotente: mismo criterio que createBeer (normalizeKey + único nameKey/breweryKey);
 * correrlo dos veces NO duplica. createdById = cuenta de Edgar.
 *
 * NO incluye artesanales de carta rotativa (Statua Rota, Madriguera, Chelarte, Hanna
 * Hops, Manigua): sus estilos cambian y crearían entradas muertas. Se crean sobre la marcha.
 *
 * ABV: null salvo donde se conoce con certeza (etiqueta / sitio oficial de 3 Cordilleras).
 * NO inventar porcentajes; vacío es mejor que incorrecto.
 *
 * Uso (dry-run por defecto):  node --env-file=.env --import tsx scripts/seed-catalog.ts
 * Para aplicar:               ... --apply
 * Ejecutar en DEV. En producción lo corre Edgar.
 */
import { prisma } from "@/lib/prisma";
import { normalizeKey } from "@/lib/domain";

type Row = { name: string; brewery: string; style: string; abv: number | null };

const CATALOG: Row[] = [
  // Bavaria
  { name: "Águila", brewery: "Bavaria", style: "Lager", abv: null },
  { name: "Águila Light", brewery: "Bavaria", style: "Lager", abv: null },
  { name: "Águila Cero", brewery: "Bavaria", style: "Lager sin alcohol", abv: 0.4 },
  { name: "Poker", brewery: "Bavaria", style: "Lager", abv: null },
  { name: "Pilsen", brewery: "Bavaria", style: "Lager", abv: null },
  { name: "Club Colombia Dorada", brewery: "Bavaria", style: "Lager", abv: 4.7 },
  { name: "Club Colombia Roja", brewery: "Bavaria", style: "Lager roja", abv: null },
  { name: "Club Colombia Negra", brewery: "Bavaria", style: "Lager negra", abv: null },
  { name: "Club Colombia Trigo", brewery: "Bavaria", style: "Trigo", abv: null },
  { name: "Costeña", brewery: "Bavaria", style: "Lager", abv: null },
  { name: "Costeñita", brewery: "Bavaria", style: "Lager", abv: null },
  { name: "Redd's", brewery: "Bavaria", style: "Cerveza saborizada", abv: null },
  // Bogotá Beer Company
  { name: "BBC Cajicá Honey Ale", brewery: "Bogotá Beer Company", style: "Honey Ale", abv: null },
  { name: "BBC Chapinero Porter", brewery: "Bogotá Beer Company", style: "Porter", abv: null },
  { name: "BBC Monserrate Roja", brewery: "Bogotá Beer Company", style: "Red Ale", abv: null },
  { name: "BBC Candelaria Clásica", brewery: "Bogotá Beer Company", style: "Golden Ale", abv: null },
  { name: "BBC Bacatá Blanca", brewery: "Bogotá Beer Company", style: "Witbier", abv: null },
  { name: "BBC Septimazo IPA", brewery: "Bogotá Beer Company", style: "IPA", abv: null },
  { name: "BBC Macondo Coffee Stout", brewery: "Bogotá Beer Company", style: "Coffee Stout", abv: 5.7 },
  { name: "BBC Lager Premium", brewery: "Bogotá Beer Company", style: "Lager", abv: null },
  { name: "BBC Rosada", brewery: "Bogotá Beer Company", style: "Fruit Beer", abv: null },
  { name: "BBC Mixiripa", brewery: "Bogotá Beer Company", style: "IPA", abv: null },
  { name: "BBC Oktobier", brewery: "Bogotá Beer Company", style: "Weissbier", abv: null },
  // Importadas de consumo común
  { name: "Corona Extra", brewery: "Grupo Modelo", style: "Lager", abv: null },
  { name: "Stella Artois", brewery: "AB InBev", style: "Pilsner", abv: null },
  { name: "Budweiser", brewery: "AB InBev", style: "Lager", abv: null },
  { name: "Heineken", brewery: "Heineken", style: "Lager", abv: null },
  { name: "Miller Lite", brewery: "Molson Coors", style: "Lager", abv: null },
  { name: "Peroni Nastro Azzurro", brewery: "Peroni", style: "Lager", abv: null },
  // 3 Cordilleras (ABV verificado del sitio oficial)
  { name: "3 Cordilleras Mona", brewery: "3 Cordilleras", style: "Blonde Ale", abv: 3.9 },
  { name: "3 Cordilleras Blanca", brewery: "3 Cordilleras", style: "Wheat Ale", abv: 4.6 },
  { name: "3 Cordilleras Mestiza", brewery: "3 Cordilleras", style: "American Pale Ale", abv: 4.8 },
  { name: "3 Cordilleras Mulata", brewery: "3 Cordilleras", style: "Amber Ale", abv: 5.2 },
  { name: "3 Cordilleras Negra", brewery: "3 Cordilleras", style: "Sweet Stout", abv: 6.4 },
  { name: "3 Cordilleras Rosada", brewery: "3 Cordilleras", style: "Rosé", abv: 3.8 },
  { name: "3 Cordilleras 6.47", brewery: "3 Cordilleras", style: "Strong Ale", abv: null },
];

async function main() {
  const APPLY = process.argv.includes("--apply");
  const edgar = await prisma.user.findFirst({ where: { email: "davidnb81230@gmail.com" }, select: { id: true } });
  if (!edgar) { console.error("No se encontró la cuenta de Edgar (davidnb81230@gmail.com)."); process.exit(2); }

  let toCreate = 0, existed = 0;
  const creating: string[] = [];
  for (const r of CATALOG) {
    const nameKey = normalizeKey(r.name);
    const breweryKey = normalizeKey(r.brewery);
    const found = await prisma.beer.findUnique({ where: { nameKey_breweryKey: { nameKey, breweryKey } } });
    if (found) { existed++; continue; }
    toCreate++;
    creating.push(`${r.name} · ${r.brewery} · ${r.style}${r.abv != null ? ` · ${r.abv}%` : ""}`);
    if (APPLY) {
      await prisma.beer.create({ data: { name: r.name, brewery: r.brewery, style: r.style, abv: r.abv, nameKey, breweryKey, createdById: edgar.id } });
    }
  }

  console.log(`Catálogo: ${CATALOG.length} entradas · ya existían: ${existed} · ${APPLY ? "CREADAS" : "a crear"}: ${toCreate}`);
  for (const c of creating) console.log(`   + ${c}`);
  if (!APPLY) console.log("\n(dry-run) No se escribió nada. Repite con --apply para crear.");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
