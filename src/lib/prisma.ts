import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requiere un driver adapter (ya no se pasa una connection string al
// schema). Runtime usa la conexión POOLED (DATABASE_URL, endpoint con "-pooler").
// Ver DECISIONES.md.
function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL en el entorno.");
  }
  const adapter = new PrismaPg(connectionString);
  return new PrismaClient({ adapter });
}

// En dev (HMR) reutilizamos una sola instancia para no agotar conexiones.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makeClient>;
};

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
