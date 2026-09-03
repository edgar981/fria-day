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

import { formatDayLong, formatTimeWindow, companionsLabel } from "./format";

describe("S.2 · fecha larga de la share-card", () => {
  it("'Viernes 28 de agosto' (día de calendario UTC, sin año)", () => {
    // 2026-08-28 es viernes.
    expect(formatDayLong(new Date("2026-08-28T00:00:00.000Z"))).toBe("Viernes 28 de agosto");
  });
});

describe("S.2 · ventana horaria (hora de Colombia)", () => {
  it("'8:30 pm – 1:15 am' desde los createdAt reales", () => {
    const start = new Date("2026-08-29T01:30:00Z"); // 8:30 pm Bogotá
    const end = new Date("2026-08-29T06:15:00Z"); // 1:15 am Bogotá
    expect(formatTimeWindow(start, end)).toBe("8:30 pm – 1:15 am");
  });
});

describe("S.2 · el parche (línea 'con …')", () => {
  it("hasta 3 nombres: lista natural completa", () => {
    expect(companionsLabel(["Caro", "Edgar", "Vale"])).toBe("Caro, Edgar y Vale");
    expect(companionsLabel(["Caro"])).toBe("Caro");
  });
  it("más de 3: dos nombres y el resto resumido", () => {
    expect(companionsLabel(["Vale", "Edgar", "Ana", "Beto"])).toBe("Vale, Edgar y 2 más");
  });
  it("solo: vacío", () => {
    expect(companionsLabel([])).toBe("");
  });
});

import { shareFileName } from "./format";

describe("S.3 · nombre de archivo legible del share-card", () => {
  const d = new Date("2026-08-26T00:00:00.000Z");
  it("lugar + fecha en slug", () => {
    expect(shareFileName("Bar de la 85", d)).toBe("friaday-bar-de-la-85-26-ago.png");
  });
  it("sin lugar → solo fecha", () => {
    expect(shareFileName(null, d)).toBe("friaday-26-ago.png");
  });
  it("acentos y símbolos se normalizan", () => {
    expect(shareFileName("Andrés Carne de Res", d)).toBe("friaday-andres-carne-de-res-26-ago.png");
  });
});

import { relativeTime } from "./format";

describe("I-3 · relativeTime (tiempo del comentario)", () => {
  const base = new Date("2026-09-03T18:00:00Z").getTime();
  it("ahora / minutos / horas, y a partir de un día cae en relativeDay", () => {
    expect(relativeTime(new Date(base - 30_000), base)).toBe("ahora"); // 30s
    expect(relativeTime(new Date(base - 5 * 60_000), base)).toBe("hace 5 min");
    expect(relativeTime(new Date(base - 3 * 3_600_000), base)).toBe("hace 3 h");
    const older = relativeTime(new Date(base - 50 * 3_600_000), base); // >24h
    expect(older).not.toMatch(/min|h$|^ahora$/);
  });
});
