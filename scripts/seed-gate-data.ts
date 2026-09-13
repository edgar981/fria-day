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
import zlib from "node:zlib";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { normalizeKey, type BeerFormat, type DrinkKind } from "@/lib/domain";

const APPLY = process.argv.includes("--apply");

// --- PNG sólido de dos bandas (sin dependencias): fotos placeholder para el gate de
// I-2. Suficiente para ejercitar carrusel/indicador/pantalla completa; se suben como
// PNG real (no SVG) para que el share-card de satori también las rasterice. ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function solidPng(w: number, h: number, body: [number, number, number], band: [number, number, number]): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  const bandH = Math.floor(h * 0.32);
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const off = y * (1 + w * 3);
    raw[off] = 0; // filtro None
    const [r, g, b] = y < bandH ? band : body;
    for (let x = 0; x < w; x++) {
      const p = off + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

// Credenciales de gate — DOCUMENTADAS (no ***REDACTED***). Se reportan en cada pasada.
const USERS = [
  { key: "ana", email: "gate-ana@friaday.test", password: "***REDACTED***", displayName: "Ana", avatar: "capibara" },
  { key: "beto", email: "gate-beto@friaday.test", password: "***REDACTED***", displayName: "Beto", avatar: "condor" },
  { key: "caro", email: "gate-caro@friaday.test", password: "***REDACTED***", displayName: "Caro", avatar: "iguana" },
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
  { key: "hugo", email: "gate-x-hugo@friaday.test", displayName: "Hugo", avatar: "chucha" },
  { key: "iris", email: "gate-x-iris@friaday.test", displayName: "Iris", avatar: "armadillo" },
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

// `at` (S.3 §1): hora Bogotá del check-in [hora, minuto], hora ≥ 24 = pasada la
// medianoche. Presente → se fija createdAt para que el span dé una duración real;
// ausente → createdAt default (now) → span ~0, la duración se OMITE.
type Drink = { beer: string; fmt: BeerFormat; qty: number; rating: number | null; at?: [number, number] };
type React = { by: string; emoji: string }; // by = key de user; emoji = clave de reacción (RK): brindis/fuego/risa/baba/corazon/fiesta
type Comment = { by: UserKey; body: string }; // I-3: comentarios de gate
type SessionSpec = { owner: UserKey; daysAgo: number; place: string; tags: UserKey[]; drinks: Drink[]; reactions: React[]; comments?: Comment[] };

// Reacciones repartidas para ejercitar los estados del pie de brindis y las reglas del
// racimo (I-1.5), VIENDO EL FEED COMO ANA:
//   · Bar de la 85 (de Ana)     → CASO DEL GATE: 4 reacciones con 2 c/u (8 personas)
//                                  + Ana con `fiesta` (la MENOS usada). El racimo muestra
//                                  las 4 más usadas (brindis/fuego/risa/corazon) y `fiesta`
//                                  NO entra, pero el avatar de Ana SÍ va primero (anillo).
//   · Andrés Carne de Res       → 2 reactores (Ana + Beto) → "Tú y 1 más" (Ana con anillo)
//   · Casa de Beto              → 1 reactor (Caro) → "Caro brindó"
//   · Bogotá Beer Company (hoy) → 0 reactores → "Nadie ha brindado" (y sigue el caso
//                                  "Yo también": Ana etiquetada hoy, sin salida propia)
const SESSIONS: SessionSpec[] = [
  {
    owner: "ana", daysAgo: 7, place: "Bar de la 85", tags: ["beto", "caro"],
    // Check-ins repartidos en la noche (S.3 §1): 8:30pm → 11:00pm → 1:15am → duración
    // "4h 45m" (ventana 8:30 pm – 1:15 am). La única salida con duración real; el resto
    // se cargan en lote (span ~0) → ejercitan el caso "duración omitida sin hueco".
    drinks: [
      { beer: "Club Colombia Dorada", fmt: "BOTELLA", qty: 3, rating: 5, at: [20, 30] }, // qty > 1 (stepper)
      { beer: "Corona Extra", fmt: "LATA", qty: 1, rating: 4, at: [23, 0] },
      { beer: "Mojito", fmt: "COPA", qty: 1, rating: 5, at: [25, 15] }, // cóctel con rating; 1:15am
    ],
    reactions: [
      { by: "beto", emoji: "brindis" }, { by: "gabo", emoji: "brindis" }, // 🍻 x2
      { by: "caro", emoji: "fuego" }, { by: "dani", emoji: "fuego" }, // 🔥 x2
      { by: "eli", emoji: "risa" }, { by: "hugo", emoji: "risa" }, // 😂 x2
      { by: "fabio", emoji: "corazon" }, { by: "iris", emoji: "corazon" }, // ❤️ x2
      { by: "ana", emoji: "fiesta" }, // Ana: el 5º emoji, MENOS usado → fuera del racimo, avatar visible
    ],
    // I-3: 4 comentarios (autores mezclados). Como la salida es de Ana, ella puede
    // borrar el suyo Y los ajenos (dueña); Beto/Caro solo el propio.
    comments: [
      { by: "beto", body: "Qué noche, la Club estaba bien helada." },
      { by: "caro", body: "El mojito de ese lugar es otro nivel." },
      { by: "ana", body: "¿Repetimos el finde?" },
      { by: "beto", body: "De una." },
    ],
  },
  {
    owner: "beto", daysAgo: 3, place: "Casa de Beto", tags: ["ana"],
    drinks: [
      { beer: "Águila", fmt: "LATA", qty: 2, rating: null }, // qty > 1, sin rating
      { beer: "Cuba Libre", fmt: "VASO", qty: 1, rating: null }, // cóctel sin rating
    ],
    reactions: [{ by: "caro", emoji: "corazon" }], // 1 reactor (no Ana) → "Caro brindó"
  },
  {
    owner: "caro", daysAgo: 1, place: "Andrés Carne de Res", tags: ["ana", "beto"],
    drinks: [
      { beer: "Póker", fmt: "BOTELLA", qty: 1, rating: 3 },
      { beer: "Margarita", fmt: "COPA", qty: 2, rating: 5 }, // cóctel qty > 1
      { beer: "Corona Extra", fmt: "JARRA", qty: 1, rating: null },
    ],
    reactions: [{ by: "ana", emoji: "baba" }, { by: "beto", emoji: "fiesta" }], // 2 → "pocos"
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
    console.log(`  Comentarios: ${SESSIONS.reduce((n, s) => n + (s.comments?.length ?? 0), 0)} (I-3, en "Bar de la 85")`);
    console.log(`  Usuarios solo-display (avatares de brindis, sin login): ${EXTRA_USERS.length}`);
    console.log(`  "Yo también": Ana está etiquetada HOY (salida de Beto) y no tiene salida propia hoy.`);
    console.log(`  Fotos: 3 en "Bar de la 85" (I-2) ${process.env.BLOB_PREV_READ_WRITE_TOKEN ? "" : "(se omitirían: falta BLOB_PREV_READ_WRITE_TOKEN)"}`);
    console.log("\nCorre con --apply para escribir. Idempotente: no duplica.");
    return prisma.$disconnect();
  }

  const uid: Record<string, string> = {};
  for (const u of USERS) uid[u.key] = await ensureUser(u.email, u.password, u.displayName);
  // Avatares de los usuarios de gate (I-1.3): sin esto quedan como anónimo punteado y
  // no se aprecia el anillo ámbar del pie. ensureUser (signUpEmail) no los pone, así
  // que se fijan aquí (idempotente).
  for (const u of USERS) await prisma.user.update({ where: { id: uid[u.key] }, data: { avatar: u.avatar } });
  // Usuarios solo-display para los avatares de brindis (estado "+N"). Sin login.
  for (const u of EXTRA_USERS) uid[u.key] = await ensureDisplayUser(u.email, u.displayName, u.avatar);

  const beerId: Record<string, string> = {};
  for (const b of CATALOG) beerId[b.name] = await ensureBeer(uid.ana, b);

  // Idempotencia: borra las salidas de los 3 usuarios de gate (cascada a check-ins,
  // tags y reacciones) y las recrea. Converge al mismo estado en cada corrida.
  await prisma.session.deleteMany({ where: { userId: { in: Object.values(uid) } } });

  let photoSessionId: string | null = null;
  for (const s of SESSIONS) {
    const session = await prisma.session.create({
      data: {
        userId: uid[s.owner],
        date: dayUTC(s.daysAgo),
        placeName: s.place,
        tags: { create: s.tags.map((t) => ({ taggedUserId: uid[t] })) },
        checkIns: {
          create: s.drinks.map((d) => ({
            beerId: beerId[d.beer],
            format: d.fmt,
            quantity: d.qty,
            rating: d.rating,
            // Bogotá = UTC−5: UTC = medianoche del día + (hora + 5) — 'at' vacío deja el default.
            createdAt: d.at ? new Date(dayUTC(s.daysAgo).getTime() + ((d.at[0] + 5) * 60 + d.at[1]) * 60_000) : undefined,
          })),
        },
      },
      select: { id: true },
    });
    if (s.reactions.length > 0) {
      await prisma.sessionReaction.createMany({
        data: s.reactions.map((r) => ({ sessionId: session.id, userId: uid[r.by], emoji: r.emoji })),
      });
    }
    if (s.comments?.length) {
      // createdAt escalonado (1 min entre cada uno) para un orden estable ascendente.
      const now = Date.now();
      await prisma.sessionComment.createMany({
        data: s.comments.map((c, i) => ({
          sessionId: session.id,
          userId: uid[c.by],
          body: c.body,
          createdAt: new Date(now - (s.comments!.length - i) * 60_000),
        })),
      });
    }
    if (s.owner === "ana" && s.place === "Bar de la 85") photoSessionId = session.id;
  }

  // Fotos de la salida (I-2): al menos una salida con 3 fotos para gatear el carrusel,
  // el indicador "1/N" y el visor. Se suben al store de dev/preview con pathname estable
  // (allowOverwrite) → idempotente, sin acumular huérfanos al re-correr el seed.
  const blobToken = process.env.BLOB_PREV_READ_WRITE_TOKEN;
  let photosUploaded = 0;
  if (photoSessionId && blobToken) {
    const shots: [string, Buffer][] = [
      ["gate/bar85-1.png", solidPng(1000, 750, [58, 40, 18], [194, 98, 10])], // ámbar
      ["gate/bar85-2.png", solidPng(1000, 750, [30, 22, 14], [122, 74, 30])], // tostado
      ["gate/bar85-3.png", solidPng(1000, 750, [34, 46, 32], [111, 199, 156])], // verde botella
    ];
    let order = 0;
    for (const [pathname, buf] of shots) {
      const { url } = await put(pathname, buf, { access: "public", token: blobToken, addRandomSuffix: false, allowOverwrite: true, contentType: "image/png" });
      await prisma.sessionPhoto.create({ data: { sessionId: photoSessionId, url, order: order++ } });
      photosUploaded++;
    }
  }

  // Pasada PA — solicitudes pendientes: ana ve "quieren entrar" en su perfil. Eli y Gabo están
  // FUERA del círculo de ana (no salieron juntos ni se invitaron), así que su solicitud es real.
  // Idempotente: restablece a pendiente (el seed es un reset a estado conocido; deshace pruebas).
  const PENDING: [string, string][] = [["eli", "ana"], ["gabo", "ana"]];
  for (const [from, to] of PENDING) {
    await prisma.joinRequest.upsert({
      where: { requesterId_recipientId: { requesterId: uid[from], recipientId: uid[to] } },
      update: { status: "pending", respondedAt: null },
      create: { requesterId: uid[from], recipientId: uid[to], status: "pending" },
    });
  }
  // Limpia cualquier solicitud que Code haya creado en su verificación (ana→otros): el gate
  // queda solo con las pendientes sembradas arriba.
  await prisma.joinRequest.deleteMany({ where: { requesterId: uid.ana } });

  // Reporte del estado final.
  const counts = await Promise.all(
    USERS.map(async (u) => {
      const salidas = await prisma.session.count({ where: { userId: uid[u.key] } });
      return `${u.displayName}: ${salidas} salidas`;
    }),
  );
  const totalR = await prisma.sessionReaction.count({ where: { userId: { in: Object.values(uid) } } });
  const totalC = await prisma.sessionComment.count({ where: { userId: { in: Object.values(uid) } } });
  const totalReq = await prisma.joinRequest.count({ where: { recipientId: uid.ana, status: "pending" } });
  console.log("✓ Seed de gate aplicado.");
  console.log(`  ${counts.join(" · ")} · reacciones: ${totalR} · comentarios: ${totalC} · solicitudes pendientes a Ana: ${totalReq}`);
  console.log(
    photosUploaded > 0
      ? `  Fotos: ${photosUploaded} subidas a "Bar de la 85" (carrusel + visor)`
      : "  Fotos: OMITIDAS (sin BLOB_PREV_READ_WRITE_TOKEN en el entorno)",
  );
  console.log("  Credenciales:");
  for (const u of USERS) console.log(`    ${u.displayName}: ${u.email} / ${u.password}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
