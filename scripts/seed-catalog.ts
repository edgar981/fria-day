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
  { name: "Águila", brewery: "Bavaria", style: "Lager", abv: 4.0 },
  { name: "Águila Light", brewery: "Bavaria", style: "Lager", abv: 3.4 },
  { name: "Águila Cero", brewery: "Bavaria", style: "Lager sin alcohol", abv: 0.4 },
  { name: "Póker", brewery: "Bavaria", style: "Lager", abv: 4.0 },
  { name: "Pilsen", brewery: "Bavaria", style: "Lager", abv: null },
  { name: "Club Colombia Dorada", brewery: "Bavaria", style: "Lager", abv: 4.7 },
  { name: "Club Colombia Roja", brewery: "Bavaria", style: "Lager roja", abv: 4.7 },
  { name: "Club Colombia Negra", brewery: "Bavaria", style: "Lager negra", abv: 4.7 },
  { name: "Club Colombia Trigo", brewery: "Bavaria", style: "Trigo", abv: 4.7 },
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
  { name: "Corona Extra", brewery: "Grupo Modelo", style: "Lager", abv: 4.5 },
  { name: "Stella Artois", brewery: "AB InBev", style: "Pilsner", abv: null },
  { name: "Budweiser", brewery: "AB InBev", style: "Lager", abv: 5.0 },
  { name: "Heineken", brewery: "Heineken", style: "Lager", abv: 5.0 },
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

  let created = 0, filled = 0, unchanged = 0;
  const log: string[] = [];
  for (const r of CATALOG) {
    const nameKey = normalizeKey(r.name);
    const breweryKey = normalizeKey(r.brewery);
    const found = await prisma.beer.findUnique({
      where: { nameKey_breweryKey: { nameKey, breweryKey } },
      select: { id: true, name: true, abv: true, style: true },
    });
    if (!found) {
      created++;
      log.push(`+ crear     ${r.name} · ${r.brewery}${r.abv != null ? ` · ${r.abv}%` : ""}`);
      if (APPLY) await prisma.beer.create({ data: { name: r.name, brewery: r.brewery, style: r.style, abv: r.abv, nameKey, breweryKey, createdById: edgar.id } });
      continue;
    }
    // Existente: COMPLETAR campos vacíos (no pisar correcciones de abv/style hechas a
    // mano) y CORREGIR el nombre visible (el catálogo es la autoridad; el name no es
    // editable por el usuario). Ej.: "Poker" → "Póker" (G.2). La clave no cambia.
    const patch: { abv?: number; style?: string; name?: string } = {};
    if (found.abv == null && r.abv != null) patch.abv = r.abv;
    if ((found.style == null || found.style.trim() === "") && r.style) patch.style = r.style;
    if (found.name !== r.name) patch.name = r.name;
    if (Object.keys(patch).length > 0) {
      filled++;
      log.push(`~ ${r.name}${patch.name ? ` (name← "${found.name}")` : ""}${patch.abv != null ? ` abv=${patch.abv}` : ""}${patch.style ? ` style=${patch.style}` : ""}`);
      if (APPLY) await prisma.beer.update({ where: { id: found.id }, data: patch });
    } else {
      unchanged++;
    }
  }

  console.log(`Catálogo (${CATALOG.length}): ${APPLY ? "creadas" : "a crear"} ${created} · ${APPLY ? "completadas" : "a completar"} ${filled} · sin cambios ${unchanged}`);
  for (const l of log) console.log("   " + l);

  // Reporte de cobertura de ABV en TODO el catálogo
  const [conAbv, total] = await Promise.all([
    prisma.beer.count({ where: { abv: { not: null } } }),
    prisma.beer.count(),
  ]);
  console.log(`\nABV en el catálogo: ${conAbv} con ABV · ${total - conAbv} en null (de ${total} cervezas).`);
  if (!APPLY) console.log("(dry-run) No se escribió nada. Repite con --apply.");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
