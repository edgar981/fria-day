/**
 * Backfill retroactivo de puntos (Pasada PT · §10). Reconstruye el ledger `PointEntry` a
 * partir de los datos existentes, pasando cada evento por el MISMO motor idempotente que las
 * acciones en vivo (src/lib/award-points.ts). Al ser idempotente:
 *  - re-correrlo no duplica (RECONCILIA: crea solo lo que falte),
 *  - vale como migración inicial Y como reparador si un premio en vivo se pierde.
 *
 * Los eventos se procesan en ORDEN CRONOLÓGICO global para que "primera vez", el techo de 40
 * y los topes por día queden idénticos a como se habrían acreditado en vivo.
 *
 * Uso (dry-run por defecto; NO escribe):
 *   node --env-file=.env --import tsx scripts/backfill-points.ts
 * Aplicar de verdad:
 *   node --env-file=.env --import tsx scripts/backfill-points.ts --apply
 *
 * ⚠️ Apunta al .env que cargues. Code corre esto contra DEV; a producción lo corre Edgar.
 */
import { prisma } from "@/lib/prisma";
import { awardSession, awardRound, awardChallenge, awardPhoto, awardCheckIn, awardComment, awardToast } from "@/lib/award-points";

const APPLY = process.argv.includes("--apply");
// --reset: BORRA todo el ledger antes de reconstruir. Solo para DEV: el seed de gate borra y
// recrea sus salidas con ids nuevos en cada corrida, y como PointEntry.sessionId no es FK, las
// entradas de generaciones viejas quedan huérfanas e inflan los totales. En PROD NUNCA se usa
// (los datos no se reseedean; la migración inicial es un --apply limpio sobre una tabla vacía).
const RESET = process.argv.includes("--reset");
type Db = Parameters<typeof awardSession>[0];
type Op = { at: Date; run: (db: Db) => Promise<void> };

async function buildOps(): Promise<Op[]> {
  const [sessions, checkIns, rounds, photos, comments, reactions] = await Promise.all([
    prisma.session.findMany({ select: { id: true, userId: true, createdAt: true, tags: { where: { taggedUserId: { not: null } }, select: { taggedUserId: true } } } }),
    prisma.checkIn.findMany({ select: { id: true, sessionId: true, beerId: true, rating: true, createdAt: true, session: { select: { userId: true } } } }),
    prisma.sessionRound.findMany({ select: { id: true, sessionId: true, loserId: true, completedAt: true, createdAt: true, session: { select: { userId: true, tags: { where: { taggedUserId: { not: null } }, select: { taggedUserId: true } } } } } }),
    prisma.sessionPhoto.findMany({ select: { id: true, sessionId: true, createdAt: true, session: { select: { userId: true } } } }),
    prisma.sessionComment.findMany({ select: { id: true, sessionId: true, userId: true, createdAt: true } }),
    prisma.sessionReaction.findMany({ select: { sessionId: true, userId: true, createdAt: true } }),
  ]);

  const ops: Op[] = [];
  for (const s of sessions) ops.push({ at: s.createdAt, run: (db) => awardSession(db, { userId: s.userId, sessionId: s.id, at: s.createdAt }) });
  for (const c of checkIns) ops.push({ at: c.createdAt, run: (db) => awardCheckIn(db, { userId: c.session.userId, sessionId: c.sessionId, checkInId: c.id, beerId: c.beerId, rating: c.rating, at: c.createdAt }) });
  for (const r of rounds) {
    const players = new Set<string>([r.session.userId]);
    for (const t of r.session.tags) if (t.taggedUserId) players.add(t.taggedUserId);
    for (const pid of players) ops.push({ at: r.createdAt, run: (db) => awardRound(db, { userId: pid, sessionId: r.sessionId, roundId: r.id, at: r.createdAt }) });
    if (r.completedAt) ops.push({ at: r.completedAt, run: async (db) => { await awardChallenge(db, { userId: r.loserId, sessionId: r.sessionId, roundId: r.id, at: r.completedAt! }); } });
  }
  for (const p of photos) ops.push({ at: p.createdAt, run: (db) => awardPhoto(db, { userId: p.session.userId, sessionId: p.sessionId, photoId: p.id, at: p.createdAt }) });
  for (const c of comments) ops.push({ at: c.createdAt, run: (db) => awardComment(db, { userId: c.userId, sessionId: c.sessionId, commentId: c.id, at: c.createdAt }) });
  for (const r of reactions) ops.push({ at: r.createdAt, run: (db) => awardToast(db, { userId: r.userId, sessionId: r.sessionId, at: r.createdAt }) });

  ops.sort((a, b) => a.at.getTime() - b.at.getTime());
  return ops;
}

class DryRunRollback extends Error {}

async function main() {
  const host = process.env.DATABASE_URL?.match(/ep-[a-z-]+/)?.[0] ?? "?";
  console.log(`DB: ${host} ${host.startsWith("ep-nameless-glade") ? "(dev)" : host.startsWith("ep-holy-rain") ? "(⚠ PRODUCCIÓN)" : ""} · modo: ${APPLY ? "APPLY (escribe)" : "DRY-RUN"}`);

  if (RESET) {
    if (host.startsWith("ep-holy-rain")) throw new Error("--reset está prohibido en producción");
    if (APPLY) { const d = await prisma.pointEntry.deleteMany({}); console.log(`--reset: borradas ${d.count} entradas antes de reconstruir.`); }
    else console.log("--reset: (dry-run, no borra)");
  }

  const ops = await buildOps();
  const before = await prisma.pointEntry.count();
  console.log(`Eventos a procesar: ${ops.length} · PointEntry ya existentes: ${before}`);

  if (!APPLY) {
    let count = before, sum = 0;
    try {
      await prisma.$transaction(async (tx) => {
        for (const op of ops) await op.run(tx);
        count = await tx.pointEntry.count();
        sum = (await tx.pointEntry.aggregate({ _sum: { points: true } }))._sum.points ?? 0;
        throw new DryRunRollback();
      }, { timeout: 300_000, maxWait: 15_000 });
    } catch (e) {
      if (!(e instanceof DryRunRollback)) throw e;
    }
    console.log(`\nDRY-RUN: resultaría en ${count} entradas · ${sum} puntos.`);
    console.log(`Crearía ${count - before} entradas nuevas (${before} ya estaban). Corré con --apply para escribir.`);
    return;
  }

  let done = 0;
  for (const op of ops) {
    await op.run(prisma);
    if (++done % 100 === 0) console.log(`  ${done}/${ops.length}…`);
  }
  // Todo lo reconstruido es HISTORIA → marcado como ya visto (shownAt), para que al abrir una
  // salida vieja NO salte "la cuenta". Solo los premios GANADOS EN VIVO de ahora en adelante
  // quedan shownAt=null y disparan el recibo. (En un reconcile posterior, un premio en vivo aún
  // no visto también se marcaría visto: se pierde ese recibo pero no el punto — es aceptable.)
  const marked = await prisma.pointEntry.updateMany({ where: { shownAt: null }, data: { shownAt: new Date() } });
  const after = await prisma.pointEntry.count();
  const sum = (await prisma.pointEntry.aggregate({ _sum: { points: true } }))._sum.points ?? 0;
  console.log(`\nAPLICADO: ${before} → ${after} entradas (+${after - before}) · total ${sum} puntos. Marcadas como vistas: ${marked.count}.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
