/**
 * Pasada AV — conteo de avatares por clave (SOLO LECTURA). No escribe nada; lo corre Edgar
 * contra PRODUCCIÓN para saber cuántos usuarios tienen la `iguana` (que sale del set) antes de
 * decidir la migración. Corre contra el .env que se cargue:
 *
 *   # PRODUCCIÓN (rama principal de Neon) — lo corre Edgar:
 *   node --env-file=.env.prod --import tsx scripts/count-avatars.ts
 *
 * Marca las claves que YA NO son elegibles (RETIRED) para ver el impacto de un vistazo.
 */
import { prisma } from "@/lib/prisma";

const RETIRED = new Set(["iguana"]); // claves que salen del set en la Pasada AV

async function main() {
  const grouped = await prisma.user.groupBy({ by: ["avatar"], _count: { _all: true } });
  const rows = grouped
    .map((g) => ({ key: g.avatar ?? "(null / anónimo)", count: g._count._all }))
    .sort((a, b) => b.count - a.count);
  const total = rows.reduce((n, r) => n + r.count, 0);

  console.log(`Avatares por clave (${total} usuarios):`);
  for (const r of rows) {
    const flag = RETIRED.has(r.key) ? "  ← RETIRADO (necesita decisión)" : "";
    console.log(`  ${r.key}: ${r.count}${flag}`);
  }
  const affected = rows.filter((r) => RETIRED.has(r.key)).reduce((n, r) => n + r.count, 0);
  console.log(`\nUsuarios con una clave retirada: ${affected}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
