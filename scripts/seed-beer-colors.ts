/**
 * Siembra `Beer.color` para el catálogo existente (Pasada SC · nivel 1). Cada bebida cuyo
 * nombre matchee el mapa de marca recibe su color de empaque; las que no, quedan sin color
 * (→ la cascada baja al nivel 2, la foto). Idempotente. Dry-run por defecto.
 *
 *   node --env-file=.env --import tsx scripts/seed-beer-colors.ts [--apply]
 *
 * ⚠️ Apunta al .env que cargues. Code corre esto contra DEV; a prod lo corre Edgar.
 */
import { prisma } from "@/lib/prisma";
import { brandColorFor } from "@/lib/colors";

const APPLY = process.argv.includes("--apply");

async function main() {
  const host = process.env.DATABASE_URL?.match(/ep-[a-z-]+/)?.[0] ?? "?";
  console.log(`DB: ${host} ${host.startsWith("ep-nameless-glade") ? "(dev)" : host.startsWith("ep-holy-rain") ? "(⚠ PRODUCCIÓN)" : ""} · ${APPLY ? "APPLY" : "DRY-RUN"}`);

  const beers = await prisma.beer.findMany({ select: { id: true, name: true, color: true } });
  const updates = beers
    .map((b) => ({ b, hex: brandColorFor(b.name) }))
    .filter((u) => u.hex && u.b.color !== u.hex);

  const withColor = beers.filter((b) => brandColorFor(b.name)).length;
  console.log(`Total: ${beers.length} · con color de marca: ${withColor} · sin color (→ nivel 2): ${beers.length - withColor}`);
  console.log(`A actualizar ahora: ${updates.length}`);

  if (!APPLY) { console.log("Corré con --apply para escribir."); return; }

  for (const u of updates) await prisma.beer.update({ where: { id: u.b.id }, data: { color: u.hex } });
  console.log(`Actualizadas ${updates.length} bebidas.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
