// Seed mínimo de FriaDay: 2 usuarios de prueba, 3 cervezas, 1 sesión con
// etiqueta (usuario de la app + texto libre), y 2 códigos de invitación libres
// para onboarding. Idempotente en lo razonable (reintenta sin duplicar).
//
// Ejecutar:  npm run db:seed
//
// NOTA (Pasada SEC): la contraseña de los usuarios de prueba NO vive en el repo —
// se toma de la env `SEED_PASSWORD` (fuera del repo). Sin ella, el seed no corre.
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes } from "node:crypto";

process.loadEnvFile(".env");

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL as string),
});

// Auth instance SIN nextCookies (fuera de contexto de request), para hashear
// contraseñas correctamente al crear usuarios.
const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  session: { modelName: "authSession" },
  user: { additionalFields: { displayName: { type: "string", required: true, input: true } } },
  secret: process.env.BETTER_AUTH_SECRET,
});

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(len = 7): string {
  const b = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[b[i] % ALPHABET.length];
  return out;
}

async function ensureUser(email: string, password: string, displayName: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  await auth.api.signUpEmail({ body: { email, password, name: displayName, displayName } });
  const created = await prisma.user.findUnique({ where: { email } });
  if (!created) throw new Error(`No se pudo crear el usuario ${email}`);
  return created.id;
}

async function ensureBeer(
  createdById: string,
  name: string,
  brewery: string,
  style: string | null,
  abv: number | null,
): Promise<string> {
  const nameKey = name.trim().replace(/\s+/g, " ").toLowerCase();
  const breweryKey = brewery.trim().replace(/\s+/g, " ").toLowerCase();
  const beer = await prisma.beer.upsert({
    where: { nameKey_breweryKey: { nameKey, breweryKey } },
    update: {},
    create: { name, brewery, style, abv, nameKey, breweryKey, createdById },
  });
  return beer.id;
}

async function main() {
  console.log("→ Sembrando FriaDay…");

  const SEED_PASSWORD = process.env.SEED_PASSWORD;
  if (!SEED_PASSWORD) {
    console.error("Falta la env SEED_PASSWORD: la contraseña de los usuarios de prueba NO vive en el repo (Pasada SEC). Ponla en tu .env.");
    process.exit(2);
  }
  const anaId = await ensureUser("ana@friaday.test", SEED_PASSWORD, "Ana");
  const betoId = await ensureUser("beto@friaday.test", SEED_PASSWORD, "Beto");
  console.log("  usuarios: Ana, Beto");

  const clubId = await ensureBeer(anaId, "Club Colombia Dorada", "Bavaria", "Lager", 4.7);
  const bbcId = await ensureBeer(anaId, "BBC Cajicá Honey Ale", "Bogotá Beer Company", "Honey Ale", 5.0);
  const pokerId = await ensureBeer(betoId, "Poker", "Bavaria", "Lager", 4.0);
  console.log("  cervezas: 3");

  // 1 sesión de Ana con etiqueta a Beto + texto libre, solo si Ana no tiene ya sesiones.
  const anaSessions = await prisma.session.count({ where: { userId: anaId } });
  if (anaSessions === 0) {
    const twoDaysAgo = new Date();
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
    const day = new Date(`${twoDaysAgo.toISOString().slice(0, 10)}T00:00:00.000Z`);

    await prisma.session.create({
      data: {
        userId: anaId,
        date: day,
        placeName: "Andrés Carne de Res",
        notes: "Arrancó la semana con todo.",
        tags: {
          create: [
            { taggedUserId: betoId },
            { freeText: "los primos de Medellín" },
          ],
        },
        checkIns: {
          create: [
            { beerId: clubId, quantity: 2, format: "BOTELLA", rating: 4 },
            { beerId: bbcId, quantity: 1, format: "PINTA", rating: 5 },
          ],
        },
      },
    });
    console.log("  sesión demo de Ana (con etiqueta a Beto + texto libre)");
  } else {
    console.log("  sesión demo: ya existía, no se duplica");
  }

  // Códigos de invitación libres para onboarding real.
  const codes: string[] = [];
  for (let i = 0; i < 2; i++) {
    const code = genCode();
    await prisma.invitation.create({ data: { code, createdById: anaId } });
    codes.push(code);
  }

  console.log("\n✓ Seed listo.");
  console.log("──────────────────────────────────────────────");
  console.log("Usuarios de prueba (contraseña: env SEED_PASSWORD, fuera del repo):");
  console.log("  Ana  · ana@friaday.test");
  console.log("  Beto · beto@friaday.test");
  console.log("Códigos de invitación LIBRES para registrarte:");
  for (const c of codes) console.log("  " + c);
  console.log("──────────────────────────────────────────────");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
