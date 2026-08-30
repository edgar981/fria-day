/**
 * Reclasifica una bebida a un tipo distinto SIN borrarla (Pasada D). Caso real: en
 * producción hay un mojito registrado como cerveza (kind CERVEZA, formato botella).
 * No se borra: se pasa a COCTEL y, si se indica, se corrige el formato de SUS
 * check-ins que traían un formato de cerveza.
 *
 * Uso (dry-run por defecto, NO escribe):
 *   node --env-file=.env --import tsx scripts/reclassify-drink.ts --id <beerId> [--format VASO]
 * Para aplicar:
 *   node --env-file=.env --import tsx scripts/reclassify-drink.ts --id <beerId> --format VASO --apply
 *
 * Sin --id, solo imprime el diagnóstico de "otros sospechosos". Apunta al entorno del
 * .env que cargues; en local es dev (Code NUNCA corre esto contra prod — lo hace Edgar).
 */
import { prisma } from "@/lib/prisma";
import { FORMATS_BY_KIND, normalizeKey, type BeerFormat } from "@/lib/domain";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const APPLY = process.argv.includes("--apply");
const ID = argValue("--id");
const NEW_FORMAT = argValue("--format") as BeerFormat | undefined;

const BEER_ONLY = FORMATS_BY_KIND.CERVEZA; // formatos que no aplican a un cóctel
const COCTEL_FORMATS = FORMATS_BY_KIND.COCTEL;

// Nombres que suelen ser cócteles; sirve para señalar registros mal clasificados.
const HINTS = [
  "mojito", "margarita", "daiquiri", "pina colada", "cuba libre", "gin tonic",
  "caipirinha", "martini", "negroni", "cosmopolitan", "mai tai", "aperol",
  "spritz", "sangria", "michelada", "tom collins", "bloody mary", "piña colada",
];

async function suspects() {
  const cervezas = await prisma.beer.findMany({
    where: { kind: "CERVEZA" },
    select: { id: true, name: true, brewery: true },
  });
  const hits = cervezas.filter((b) => {
    const nk = normalizeKey(b.name);
    return HINTS.some((h) => nk.includes(normalizeKey(h)));
  });
  console.log(`\nOtros posibles cócteles mal clasificados como cerveza: ${hits.length}`);
  for (const h of hits) console.log(`  - ${h.name}  (id ${h.id})`);
  if (hits.length === 0) console.log("  (ninguno con nombre sospechoso)");
}

async function main() {
  if (NEW_FORMAT && !COCTEL_FORMATS.includes(NEW_FORMAT)) {
    console.error(`--format debe ser de cóctel (${COCTEL_FORMATS.join(", ")}).`);
    return prisma.$disconnect();
  }

  if (!ID) {
    console.log("Falta --id <beerId>. Diagnóstico de sospechosos:");
    await suspects();
    return prisma.$disconnect();
  }

  const beer = await prisma.beer.findUnique({
    where: { id: ID },
    select: { id: true, name: true, kind: true },
  });
  if (!beer) {
    console.error(`No existe una bebida con id ${ID}.`);
    return prisma.$disconnect();
  }

  const byFormat = await prisma.checkIn.groupBy({
    by: ["format"],
    where: { beerId: ID },
    _count: true,
  });
  const toFix = byFormat.filter((f) => (BEER_ONLY as readonly string[]).includes(f.format));

  console.log(`Bebida: "${beer.name}" (${beer.id})`);
  console.log(`  kind actual: ${beer.kind} → COCTEL`);
  console.log(`  check-ins por formato: ${byFormat.map((f) => `${f.format}×${f._count}`).join(", ") || "(ninguno)"}`);
  if (NEW_FORMAT) {
    const n = toFix.reduce((s, f) => s + f._count, 0);
    console.log(`  ajustar formato de ${n} check-in(s) con formato de cerveza → ${NEW_FORMAT}`);
  } else {
    console.log("  (sin --format: no se tocan los formatos de los check-ins)");
  }

  await suspects();

  if (!APPLY) {
    console.log("\n(dry-run) No se escribió nada. Repite con --apply para aplicar.");
    return prisma.$disconnect();
  }

  await prisma.$transaction(async (tx) => {
    await tx.beer.update({ where: { id: ID }, data: { kind: "COCTEL" } });
    if (NEW_FORMAT) {
      await tx.checkIn.updateMany({
        where: { beerId: ID, format: { in: BEER_ONLY } },
        data: { format: NEW_FORMAT },
      });
    }
  });
  console.log("\n✓ Aplicado.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
