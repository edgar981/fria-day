/**
 * RC · Auditoría de métodos de acceso — SOLO LECTURA (no escribe nada).
 *
 * Responde: ¿quién puede quedar fuera de la app si pierde la passkey?
 * Reporta CONTEOS, nunca listas ni datos personales (nombres/correos/ids).
 *
 * Métodos de entrada hoy: (a) passkey, (b) correo + contraseña.
 * El "correo de recuperación" se guarda en User.email; por sí solo NO es un
 * método de entrada mientras no exista el flujo de reset (punto 2 de RC).
 *
 * Uso contra DEV (verificación de Code):
 *   node --env-file=.env --import tsx scripts/audit-recovery.ts
 *
 * Uso contra PROD (lo corre EDGAR, no Code):
 *   node --env-file=.env.prod --import tsx scripts/audit-recovery.ts
 *   # o con la cadena de prod inline:
 *   DATABASE_URL='postgres://…ep-holy-rain…' node --import tsx scripts/audit-recovery.ts
 *
 * Imprime también el host de la DB para que sea evidente contra qué rama corrió.
 */
import { prisma } from "../src/lib/prisma";

function hostOf(url: string | undefined): string {
  if (!url) return "(sin DATABASE_URL)";
  const m = url.match(/@([^/?]+)/);
  return m ? m[1] : "(no parseable)";
}

async function main() {
  console.log(`DB host: ${hostOf(process.env.DATABASE_URL)}`);

  const users = await prisma.user.findMany({ select: { id: true, email: true } });

  // Cuentas con contraseña (providerId "credential" y password no nulo).
  const credAccounts = await prisma.account.findMany({
    where: { providerId: "credential", password: { not: null } },
    select: { userId: true },
  });
  const withPassword = new Set(credAccounts.map((a) => a.userId));

  // Usuarios con al menos una passkey.
  const passkeys = await prisma.passkey.findMany({ select: { userId: true } });
  const withPasskey = new Set(passkeys.map((p) => p.userId));

  let total = 0;
  let hasEmail = 0;
  let hasPassword = 0;
  let hasPasskey = 0;
  let passkeyOnly = 0; // passkey, sin contraseña → hoy solo entra por passkey
  let stranded = 0; // passkey, sin contraseña Y sin correo → ni un futuro reset lo salva
  let passwordNoPasskey = 0; // entra por contraseña, sin passkey
  let noMethod = 0; // ni passkey ni contraseña (roto/huérfano)

  for (const u of users) {
    total++;
    const email = !!u.email;
    const pw = withPassword.has(u.id);
    const pk = withPasskey.has(u.id);
    if (email) hasEmail++;
    if (pw) hasPassword++;
    if (pk) hasPasskey++;
    if (pk && !pw) passkeyOnly++;
    if (pk && !pw && !email) stranded++;
    if (pw && !pk) passwordNoPasskey++;
    if (!pk && !pw) noMethod++;
  }

  console.log("\n— Métodos de acceso (conteos) —");
  console.log(`  usuarios totales:                         ${total}`);
  console.log(`  con correo de recuperación:               ${hasEmail}`);
  console.log(`  con contraseña:                           ${hasPassword}`);
  console.log(`  con passkey:                              ${hasPasskey}`);
  console.log(`  con contraseña pero sin passkey:          ${passwordNoPasskey}`);
  console.log("\n— Riesgo de quedar fuera —");
  console.log(`  SOLO passkey (sin contraseña):            ${passkeyOnly}`);
  console.log(`    de esos, SIN correo (no salva ni reset): ${stranded}`);
  console.log(`  sin ningún método (roto):                 ${noMethod}`);
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
