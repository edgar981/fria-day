/**
 * Pasada SEC.2 — Reset de las cuentas de prueba/gate de DEV en un solo comando.
 *
 * Borra TODAS las cuentas `@friaday.test` (y su data en cascada) y reseedea el estado de gate con
 * la contraseña de la env `SEED_PASSWORD`. Reemplaza la secuencia manual (borrar + db:seed +
 * seed-gate-data + backfill). Idempotente: converge al mismo estado.
 *
 *   node --env-file=.env --import tsx scripts/reset-gate.ts           # DRY-RUN (no escribe)
 *   node --env-file=.env --import tsx scripts/reset-gate.ts --apply   # ejecuta
 *
 * Guardarraíles: exige `SEED_PASSWORD`; ABORTA si `DATABASE_URL` no es la rama DEV de Neon
 * (nunca toca producción); solo borra correos `@friaday.test`. Nunca imprime la contraseña.
 */
import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");
const TEST_SUFFIX = "@friaday.test"; // lo único que este script puede borrar
const DEV_HOST = "ep-nameless-glade"; // rama DEV de Neon (la única permitida)
const PROD_HOST = "ep-holy-rain"; // rama de PRODUCCIÓN (documentada como referencia)

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(2);
}

/** Guardarraíl: nunca prod, siempre dev, y con SEED_PASSWORD. No imprime la contraseña. */
function guard(): void {
  if (!process.env.SEED_PASSWORD) {
    fail("Falta la env SEED_PASSWORD (la contraseña de las cuentas de prueba vive fuera del repo, Pasada SEC). Ponla en tu .env y reintenta.");
  }
  const host = process.env.DATABASE_URL?.match(/ep-[a-z0-9-]+/)?.[0] ?? "";
  if (!host) fail("No hay DATABASE_URL (o no reconozco su endpoint). Abortado.");
  if (host.startsWith(PROD_HOST)) fail(`DATABASE_URL apunta a PRODUCCIÓN (${host}). Este script NUNCA corre contra prod. Abortado.`);
  if (!host.startsWith(DEV_HOST)) fail(`DATABASE_URL no es la rama DEV esperada (${DEV_HOST}); vi "${host}". Abortado por seguridad.`);
}

function reseed(): void {
  // Los seeds cargan .env por su cuenta; se pasan --env-file para que hereden DATABASE_URL/SEED_PASSWORD.
  const run = (args: string[]) => execFileSync("node", ["--env-file=.env", "--import", "tsx", ...args], { stdio: "inherit" });
  run(["prisma/seed.ts"]); // ana@/beto@ + catálogo mínimo + invitaciones
  run(["scripts/seed-gate-data.ts", "--apply"]); // gate-* + estado de gate (salidas, reacciones, solicitudes)
  run(["scripts/backfill-points.ts", "--apply", "--reset"]); // ledger de puntos (dev; --reset seguro tras reseed)
}

async function main() {
  guard();
  const host = process.env.DATABASE_URL?.match(/ep-[a-z0-9-]+/)?.[0] ?? "?";
  const targets = await prisma.user.findMany({ where: { email: { endsWith: TEST_SUFFIX } }, select: { email: true } });
  console.log(`DB: ${host} (dev) · cuentas ${TEST_SUFFIX}: ${targets.length} · modo: ${APPLY ? "APPLY (escribe)" : "DRY-RUN"}`);

  if (!APPLY) {
    console.log(`Con --apply: borra esas ${targets.length} cuentas y reseedea con la contraseña de SEED_PASSWORD (no se imprime).`);
    for (const t of targets) console.log(`  - ${t.email}`);
    await prisma.$disconnect();
    return;
  }

  // Orden de borrado: primero las SALIDAS de las cuentas .test (cascada a check-ins, tags,
  // reacciones, comentarios, rondas, fotos) → así ningún check-in referencia ya sus cervezas del
  // catálogo (CheckIn.beerId es Restrict). Luego las cuentas: al borrarlas, sus cervezas se van en
  // cascada sin violar el Restrict, y PointEntry/JoinRequest también. Las cervezas de la cuenta real
  // de Edgar (no .test) no se tocan.
  const s = await prisma.session.deleteMany({ where: { user: { email: { endsWith: TEST_SUFFIX } } } });
  const r = await prisma.user.deleteMany({ where: { email: { endsWith: TEST_SUFFIX } } });
  console.log(`Borradas: ${r.count} cuentas ${TEST_SUFFIX} (y ${s.count} salidas suyas en cascada).`);
  await prisma.$disconnect(); // cerrar antes de reseedear (los seeds abren su propio cliente)

  reseed();

  // Estado final (cliente nuevo tras los seeds).
  const { prisma: prisma2 } = await import("@/lib/prisma");
  const after = await prisma2.user.count({ where: { email: { endsWith: TEST_SUFFIX } } });
  console.log(`✓ Reset completo. Cuentas ${TEST_SUFFIX} ahora: ${after}. Contraseña: env SEED_PASSWORD (fuera del repo).`);
  await prisma2.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
