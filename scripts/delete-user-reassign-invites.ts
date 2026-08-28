/**
 * Borra un usuario preservando integridad referencial. ANTES de borrar reasigna a
 * otro usuario dos cosas que NO deben desaparecer con él (ambas tienen
 * onDelete:Cascade hacia User en el schema):
 *   - sus INVITACIONES (para que no se borren y las YA USADAS conserven su usedById),
 *   - las CERVEZAS que creó (el catálogo es COMPARTIDO: otras personas tienen
 *     check-ins sobre ellas; borrarlas violaría check_in_beerId_fkey (Restrict) y
 *     además rompería el catálogo del grupo).
 * LUEGO borra al usuario (cascada: sus salidas → check-ins + etiquetas; y las
 * etiquetas donde estaba etiquetado). Todo en UNA transacción.
 *
 * Caso P.4: borrar a Ana; sus 5 invitaciones y sus 4 cervezas pasan a Edgar;
 * NZFX55A (que Edgar usó) conserva usedById=Edgar. Ids POR ARGUMENTO, no hardcodeados.
 *
 * Uso (dry-run por defecto, NO escribe):
 *   node --env-file=.env --import tsx scripts/delete-user-reassign-invites.ts \
 *     --delete <userIdABorrar> --invites-to <userIdDestino>
 * Para aplicar:  ... --apply
 *
 * NUNCA contra producción sin revisar el dry-run. Apunta al .env que cargues.
 */
import { prisma } from "@/lib/prisma";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const deleteId = arg("--delete");
  const invitesTo = arg("--invites-to");
  const APPLY = process.argv.includes("--apply");

  if (!deleteId || !invitesTo) {
    console.error("Faltan args: --delete <id> --invites-to <id> [--apply]");
    process.exit(2);
  }
  if (deleteId === invitesTo) {
    console.error("--delete y --invites-to no pueden ser el mismo usuario");
    process.exit(2);
  }

  const [victim, heir] = await Promise.all([
    prisma.user.findUnique({ where: { id: deleteId } }),
    prisma.user.findUnique({ where: { id: invitesTo } }),
  ]);
  if (!victim) { console.error(`No existe el usuario a borrar: ${deleteId}`); process.exit(2); }
  if (!heir) { console.error(`No existe el usuario destino de invitaciones: ${invitesTo}`); process.exit(2); }

  const sessions = await prisma.session.findMany({ where: { userId: deleteId }, select: { id: true, placeName: true } });
  const sessionIds = sessions.map((s) => s.id);
  const [checkIns, tagsOnSessions, tagsWhereTagged, invites, beers] = await Promise.all([
    prisma.checkIn.count({ where: { sessionId: { in: sessionIds } } }),
    prisma.sessionTag.count({ where: { sessionId: { in: sessionIds } } }),
    prisma.sessionTag.count({ where: { taggedUserId: deleteId } }),
    prisma.invitation.findMany({ where: { createdById: deleteId }, select: { code: true, usedById: true } }),
    prisma.beer.findMany({ where: { createdById: deleteId }, select: { name: true, _count: { select: { checkIns: true } } } }),
  ]);

  console.log(`BORRAR: ${victim.name} <${victim.email}>  (${deleteId})`);
  console.log(`REASIGNAR A: ${heir.name} <${heir.email}>  (${invitesTo})\n`);
  console.log(`Paso 1 — reasignar ${invites.length} invitaciones a ${heir.name}:`);
  for (const i of invites) console.log(`    ${i.code}${i.usedById ? `  (usada por ${i.usedById})` : ""}`);
  console.log(`Paso 2 — reasignar ${beers.length} cervezas (catálogo compartido) a ${heir.name}:`);
  for (const b of beers) console.log(`    ${b.name}  (check-ins que la referencian: ${b._count.checkIns})`);
  console.log(`Paso 3 — borrar a ${victim.name} en cascada:`);
  console.log(`    salidas: ${sessions.length} [${sessions.map((s) => s.placeName).join(", ")}]`);
  console.log(`    check-ins en esas salidas: ${checkIns}`);
  console.log(`    etiquetas en esas salidas: ${tagsOnSessions}`);
  console.log(`    etiquetas donde estaba etiquetado: ${tagsWhereTagged}`);

  if (!APPLY) {
    console.log(`\n(dry-run) No se escribió nada. Repite con --apply para ejecutar.`);
    return prisma.$disconnect();
  }

  await prisma.$transaction([
    prisma.invitation.updateMany({ where: { createdById: deleteId }, data: { createdById: invitesTo } }),
    prisma.beer.updateMany({ where: { createdById: deleteId }, data: { createdById: invitesTo } }),
    prisma.user.delete({ where: { id: deleteId } }),
  ]);
  console.log(`\n✓ APLICADO: invitaciones reasignadas y usuario borrado, en una transacción.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
