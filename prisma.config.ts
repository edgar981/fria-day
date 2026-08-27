import { defineConfig, env } from "prisma/config";

// Prisma 7 ya no auto-carga .env ni acepta url en el schema. Cargamos .env
// localmente (en Vercel las env vars ya vienen en process.env, y el archivo
// no existe → try/catch). Las migraciones usan la conexión DIRECTA.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env en el entorno (p.ej. Vercel): se usan las vars ya presentes.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // DIRECT_URL = endpoint SIN "-pooler". Migrate/introspect necesitan conexión directa.
    url: env("DIRECT_URL"),
  },
});
