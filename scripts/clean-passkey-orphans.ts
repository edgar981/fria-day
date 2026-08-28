/**
 * Limpia usuarios HUÉRFANOS de un registro passkey-first fallido: filas en `user`
 * sin passkey, sin account (ninguna credencial → no pueden entrar), sin invitación
 * reclamada, sin salidas propias y sin etiquetas. Antes de la Pasada P.2 el registro
 * no era atómico y una ceremonia de passkey fallida (p.ej. rpID que no coincide con
 * el origen en producción) dejaba estas filas. La P.2 lo hace atómico; esto barre
 * las que ya quedaron.
 *
 * Uso (dry-run por defecto, NO borra):
 *   node --env-file=.env --import tsx scripts/clean-passkey-orphans.ts
 * Para borrar de verdad:
 *   node --env-file=.env --import tsx scripts/clean-passkey-orphans.ts --apply
 *
 * Apunta al entorno del .env que cargues. NUNCA correr contra producción sin querer:
 * revisa primero el dry-run.
 */
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      passkeys: { none: {} },
      accounts: { none: {} },
      usedInvitation: null, // no reclamó ninguna invitación
      sessions: { none: {} }, // no es dueño de ninguna salida
      taggedIn: { none: {} }, // no está etiquetado en ninguna
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  console.log(`Huérfanos encontrados: ${candidates.length}`);
  for (const u of candidates) {
    console.log(`  - ${u.id}  name="${u.name}"  email=${u.email}  created=${u.createdAt.toISOString()}`);
  }
  if (candidates.length === 0) {
    console.log("Nada que limpiar.");
    return prisma.$disconnect();
  }

  if (!APPLY) {
    console.log("\n(dry-run) No se borró nada. Vuelve a correr con --apply para borrar.");
    return prisma.$disconnect();
  }

  const ids = candidates.map((u) => u.id);
  const res = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`\n✓ Borrados: ${res.count}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
