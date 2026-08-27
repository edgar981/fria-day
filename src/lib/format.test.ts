// Zona horaria: Bogotá es UTC−5. El default "hoy" DEBE usar componentes locales
// (getFullYear/getMonth/getDate), no toISOString(), o después de las 7pm la app
// propondría MAÑANA. Se fija la TZ antes de cualquier uso de Date.
process.env.TZ = "America/Bogota";

import { describe, it, expect, afterAll, vi } from "vitest";
import { todayInputValue } from "./format";

describe("todayInputValue — zona horaria (Bogotá UTC−5)", () => {
  afterAll(() => vi.useRealTimers());

  it("20:00 en Bogotá devuelve el día en curso, no el siguiente", () => {
    vi.useFakeTimers();
    // 2026-08-27 20:00 America/Bogota = 2026-08-28 01:00 UTC
    vi.setSystemTime(new Date("2026-08-28T01:00:00Z"));
    expect(todayInputValue()).toBe("2026-08-27");
    // El bug que evitamos: toISOString() daría el día siguiente.
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-08-28");
  });

  it("mediodía en Bogotá devuelve ese mismo día", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T17:00:00Z")); // 12:00 Bogotá
    expect(todayInputValue()).toBe("2026-08-27");
  });
});
