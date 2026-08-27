import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // Por defecto node; los tests de DOM declaran su entorno con un comentario
    // // @vitest-environment jsdom al inicio del archivo.
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
  },
});
