/**
 * Seed de datos de GATE para dev (no producción). Deja dev en un estado útil para que
 * Edgar revise la app en el preview: 3 usuarios con contraseña conocida, salidas en
 * varias fechas con etiquetas cruzadas (el círculo existe), bebidas variadas (cervezas
 * y cócteles, con y sin rating, varios formatos, alguna cantidad > 1 para el stepper),
 * una salida donde Ana está etiquetada y NO tiene la suya ese día ("Yo también"),
 * algunas reacciones y el catálogo sembrado.
 *
 * Uso (dry-run por defecto, NO escribe):
 *   node --env-file=.env --import tsx scripts/seed-gate-data.ts
 * Para aplicar:
 *   node --env-file=.env --import tsx scripts/seed-gate-data.ts --apply
 *
 * IDEMPOTENTE: correrlo dos veces converge al mismo estado (borra y recrea las salidas
 * de los 3 usuarios de gate; upsertea usuarios y catálogo). Solo toca el entorno del
 * .env que cargues — en local, dev. NUNCA producción.
 *
 * Estos usuarios y salidas son SEPARADOS de las cuentas que usa la verificación de Code
 * (beto@friaday.test, etc.): limpiar los datos de una pasada no borra este seed.
 */
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { normalizeKey, type BeerFormat, type DrinkKind } from "@/lib/domain";

const APPLY = process.argv.includes("--apply");

// Credenciales de gate — DOCUMENTADAS (no ***REDACTED***). Se reportan en cada pasada.
const USERS = [
  { key: "ana", email: "gate-ana@friaday.test", password: "***REDACTED***", displayName: "Ana" },
  { key: "beto", email: "gate-beto@friaday.test", password: "***REDACTED***", displayName: "Beto" },
  { key: "caro", email: "gate-caro@friaday.test", password: "***REDACTED***", displayName: "Caro" },
] as const;
type UserKey = (typeof USERS)[number]["key"];

// Usuarios SOLO-DISPLAY (I-1.2): existen únicamente para poblar avatares de brindis y
// llegar al estado "+N" del pie (con 3 usuarios no se alcanza). NO tienen cuenta (no
// hacen login), ni salidas, ni etiquetas → no aparecen en círculo, leaderboard ni feed;
// solo como avatares de reacción. No son credenciales que reportar.
const EXTRA_USERS = [
  { key: "dani", email: "gate-x-dani@friaday.test", displayName: "Dani", avatar: "tucan" },
  { key: "eli", email: "gate-x-eli@friaday.test", displayName: "Eli", avatar: "jaguar" },
  { key: "fabio", email: "gate-x-fabio@friaday.test", displayName: "Fabio", avatar: "mono" },
  { key: "gabo", email: "gate-x-gabo@friaday.test", displayName: "Gabo", avatar: "rana" },
] as const;

type CatalogItem = { name: string; brewery: string | null; style: string | null; abv: number | null; kind: DrinkKind };
const CATALOG: CatalogItem[] = [
  { name: "Club Colombia Dorada", brewery: "Bavaria", style: "Lager", abv: 4.7, kind: "CERVEZA" },
  { name: "Águila", brewery: "Bavaria", style: "Lager", abv: 4.0, kind: "CERVEZA" },
  { name: "Póker", brewery: "Bavaria", style: "Lager", abv: 4.0, kind: "CERVEZA" },
  { name: "Corona Extra", brewery: "Grupo Modelo", style: "Lager", abv: 4.5, kind: "CERVEZA" },
  { name: "BBC Cajicá Honey Ale", brewery: "Bogotá Beer Company", style: "Honey Ale", abv: 5.0, kind: "CERVEZA" },
  { name: "Heineken", brewery: "Heineken", style: "Lager", abv: 5.0, kind: "CERVEZA" },
  { name: "Mojito", brewery: null, style: null, abv: null, kind: "COCTEL" },
  { name: "Cuba Libre", brewery: null, style: null, abv: null, kind: "COCTEL" },
  { name: "Margarita", brewery: null, style: null, abv: null, kind: "COCTEL" },
];

type Drink = { beer: string; fmt: BeerFormat; qty: number; rating: number | null };
type React = { by: string; emoji: string }; // by = key de USERS o de EXTRA_USERS
type SessionSpec = { owner: UserKey; daysAgo: number; place: string; tags: UserKey[]; drinks: Drink[]; reactions: React[] };

// Reacciones repartidas para ejercitar los 4 estados del pie de brindis (I-1.2),
// VIENDO EL FEED COMO ANA:
//   · Bar de la 85 (de Ana)     → 6 reactores → estado "+N" (3 avatares + "+3")
//   · Andrés Carne de Res       → 2 reactores (Ana + Beto) → "pocos" (Ana con anillo)
//   · Casa de Beto              → 1 reactor (Caro) → "Caro brindó"
//   · Bogotá Beer Company (hoy) → 0 reactores → "Nadie ha brindado" (y sigue el caso
//                                  "Yo también": Ana etiquetada hoy, sin salida propia)
const SESSIONS: SessionSpec[] = [
  {
    owner: "ana", daysAgo: 7, place: "Bar de la 85", tags: ["beto", "caro"],
    drinks: [
      { beer: "Club Colombia Dorada", fmt: "BOTELLA", qty: 3, rating: 5 }, // qty > 1 (stepper)
      { beer: "Corona Extra", fmt: "LATA", qty: 1, rating: 4 },
      { beer: "Mojito", fmt: "COPA", qty: 1, rating: 5 }, // cóctel con rating
    ],
    reactions: [
      { by: "beto", emoji: "🍻" }, { by: "caro", emoji: "🔥" },
      { by: "dani", emoji: "🔥" }, { by: "eli", emoji: "😂" }, { by: "fabio", emoji: "❤️" }, { by: "gabo", emoji: "🍻" },
    ],
  },
  {
    owner: "beto", daysAgo: 3, place: "Casa de Beto", tags: ["ana"],
    drinks: [
      { beer: "Águila", fmt: "LATA", qty: 2, rating: null }, // qty > 1, sin rating
      { beer: "Cuba Libre", fmt: "VASO", qty: 1, rating: null }, // cóctel sin rating
    ],
    reactions: [{ by: "caro", emoji: "❤️" }], // 1 reactor (no Ana) → "Caro brindó"
  },
  {
    owner: "caro", daysAgo: 1, place: "Andrés Carne de Res", tags: ["ana", "beto"],
    drinks: [
      { beer: "Póker", fmt: "BOTELLA", qty: 1, rating: 3 },
      { beer: "Margarita", fmt: "COPA", qty: 2, rating: 5 }, // cóctel qty > 1
      { beer: "Corona Extra", fmt: "JARRA", qty: 1, rating: null },
    ],
    reactions: [{ by: "ana", emoji: "🤤" }, { by: "beto", emoji: "🫡" }], // 2 → "pocos"
  },
  {
    // HOY, Beto etiqueta a Ana (y Caro). Ana NO tiene salida propia hoy → "Yo también".
    // Sin reacciones → estado "0" del pie ("Nadie ha brindado").
    owner: "beto", daysAgo: 0, place: "Bogotá Beer Company", tags: ["ana", "caro"],
    drinks: [
      { beer: "Club Colombia Dorada", fmt: "BOTELLA", qty: 2, rating: 5 },
      { beer: "BBC Cajicá Honey Ale", fmt: "LATA", qty: 1, rating: 4 },
    ],
    reactions: [],
  },
];

function dayUTC(daysAgo: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

async function ensureUser(email: string, password: string, displayName: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return existing.id;
  await auth.api.signUpEmail({ body: { email, password, name: displayName, displayName } });
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!u) throw new Error(`No se pudo crear ${email}`);
  return u.id;
}

// Usuario SOLO-DISPLAY (I-1.2): fila User mínima, sin cuenta de auth (no login). Sirve
// para avatares de brindis. Idempotente por email.
async function ensureDisplayUser(email: string, displayName: string, avatar: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return existing.id;
  const u = await prisma.user.create({
    data: { id: crypto.randomUUID(), email, name: displayName, displayName, avatar, emailVerified: false },
    select: { id: true },
  });
  return u.id;
}

async function ensureBeer(createdById: string, b: CatalogItem): Promise<string> {
  const nameKey = normalizeKey(b.name);
  const breweryKey = normalizeKey(b.brewery ?? "");
  const beer = await prisma.beer.upsert({
    where: { nameKey_breweryKey: { nameKey, breweryKey } },
    update: {}, // no pisa datos existentes del catálogo real
    create: {
      name: b.name, brewery: b.brewery, style: b.style, kind: b.kind,
      abv: b.abv, nameKey, breweryKey, createdById,
    },
    select: { id: true },
  });
  return beer.id;
}

async function main() {
  if (!APPLY) {
    console.log("(dry-run) Dejaría dev con el estado de GATE:");
    console.log(`  Usuarios (${USERS.length}): ${USERS.map((u) => `${u.email} / ${u.password}`).join("  ·  ")}`);
    console.log(`  Catálogo asegurado: ${CATALOG.length} bebidas (${CATALOG.filter((c) => c.kind === "COCTEL").length} cócteles)`);
    console.log(`  Salidas: ${SESSIONS.length} en varias fechas, con etiquetas cruzadas (círculo completo)`);
    console.log(`  Reacciones: ${SESSIONS.reduce((n, s) => n + s.reactions.length, 0)} (pie de brindis: estados 0 / 1 / pocos / +N)`);
    console.log(`  Usuarios solo-display (avatares de brindis, sin login): ${EXTRA_USERS.length}`);
    console.log(`  "Yo también": Ana está etiquetada HOY (salida de Beto) y no tiene salida propia hoy.`);
    console.log("\nCorre con --apply para escribir. Idempotente: no duplica.");
    return prisma.$disconnect();
  }

  const uid: Record<string, string> = {};
  for (const u of USERS) uid[u.key] = await ensureUser(u.email, u.password, u.displayName);
  // Usuarios solo-display para los avatares de brindis (estado "+N"). Sin login.
  for (const u of EXTRA_USERS) uid[u.key] = await ensureDisplayUser(u.email, u.displayName, u.avatar);

  const beerId: Record<string, string> = {};
  for (const b of CATALOG) beerId[b.name] = await ensureBeer(uid.ana, b);

  // Idempotencia: borra las salidas de los 3 usuarios de gate (cascada a check-ins,
  // tags y reacciones) y las recrea. Converge al mismo estado en cada corrida.
  await prisma.session.deleteMany({ where: { userId: { in: Object.values(uid) } } });

  for (const s of SESSIONS) {
    const session = await prisma.session.create({
      data: {
        userId: uid[s.owner],
        date: dayUTC(s.daysAgo),
        placeName: s.place,
        tags: { create: s.tags.map((t) => ({ taggedUserId: uid[t] })) },
        checkIns: { create: s.drinks.map((d) => ({ beerId: beerId[d.beer], format: d.fmt, quantity: d.qty, rating: d.rating })) },
      },
      select: { id: true },
    });
    if (s.reactions.length > 0) {
      await prisma.sessionReaction.createMany({
        data: s.reactions.map((r) => ({ sessionId: session.id, userId: uid[r.by], emoji: r.emoji })),
      });
    }
  }

  // Reporte del estado final.
  const counts = await Promise.all(
    USERS.map(async (u) => {
      const salidas = await prisma.session.count({ where: { userId: uid[u.key] } });
      return `${u.displayName}: ${salidas} salidas`;
    }),
  );
  const totalR = await prisma.sessionReaction.count({ where: { userId: { in: Object.values(uid) } } });
  console.log("✓ Seed de gate aplicado.");
  console.log(`  ${counts.join(" · ")} · reacciones: ${totalR}`);
  console.log("  Credenciales:");
  for (const u of USERS) console.log(`    ${u.displayName}: ${u.email} / ${u.password}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
