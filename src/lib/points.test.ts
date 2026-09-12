import { describe, it, expect } from "vitest";
import { POINT_VALUES, buildCuentaLines, bogotaDayRange, DRINK_TECHO } from "./points";

describe("escala de puntos (PT §1)", () => {
  it("los valores del tablero", () => {
    expect(POINT_VALUES).toEqual({ session: 50, round: 20, challenge: 10, photo: 15, first_time: 10, rate: 8, drink: 2, comment: 3, toast: 1 });
  });
  it("el techo de bebidas es 40", () => {
    expect(DRINK_TECHO).toBe(40);
  });
});

describe("buildCuentaLines — el recibo (PT §3, §5)", () => {
  it("las bebidas van en UNA línea 'Bebidas' (el techo no se nombra)", () => {
    const lines = buildCuentaLines([
      { action: "first_time", points: 10 },
      { action: "rate", points: 8 },
      { action: "drink", points: 2 },
    ]);
    expect(lines).toEqual([{ key: "bebidas", label: "Bebidas", points: 20 }]);
    // nunca una etiqueta que revele el techo
    expect(lines.some((l) => /techo|40|tope|no suman/i.test(l.label))).toBe(false);
  });

  it("el mismo +40 se ve igual sin importar de qué bebidas salió (§3)", () => {
    const a = buildCuentaLines([{ action: "first_time", points: 10 }, { action: "rate", points: 30 }]);
    const b = buildCuentaLines([{ action: "drink", points: 20 }, { action: "rate", points: 20 }]);
    expect(a).toEqual([{ key: "bebidas", label: "Bebidas", points: 40 }]);
    expect(b).toEqual([{ key: "bebidas", label: "Bebidas", points: 40 }]);
  });

  it("lo social va en UNA línea 'Brindis y comentarios'", () => {
    const lines = buildCuentaLines([{ action: "comment", points: 6 }, { action: "toast", points: 3 }]);
    expect(lines).toEqual([{ key: "social", label: "Brindis y comentarios", points: 9 }]);
  });

  it("salida/ruleta/reto/fotos en su propia línea, en orden narrativo, social al final", () => {
    const lines = buildCuentaLines([
      { action: "toast", points: 2 },
      { action: "drink", points: 4 },
      { action: "photo", points: 30 },
      { action: "round", points: 40 },
      { action: "session", points: 50 },
    ]);
    expect(lines.map((l) => l.key)).toEqual(["session", "round", "photo", "bebidas", "social"]);
  });

  it("'Subiste una foto' vs 'Subiste fotos' según el total", () => {
    expect(buildCuentaLines([{ action: "photo", points: 15 }])[0].label).toBe("Subiste una foto");
    expect(buildCuentaLines([{ action: "photo", points: 45 }])[0].label).toBe("Subiste fotos");
  });

  it("líneas en cero no aparecen", () => {
    expect(buildCuentaLines([{ action: "session", points: 0 }])).toEqual([]);
  });
});

describe("bogotaDayRange — topes por día en hora de Colombia", () => {
  it("el rango es el día de Bogotá en UTC (medianoche 05:00Z), 24h", () => {
    const { start, end } = bogotaDayRange(new Date("2026-09-12T02:00:00.000Z")); // 11 sep 21:00 en Bogotá
    expect(start.toISOString()).toBe("2026-09-11T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-12T05:00:00.000Z");
  });
  it("una acción cae dentro de su propio día de Bogotá", () => {
    for (const iso of ["2026-09-12T05:00:00.000Z", "2026-09-12T18:30:00.000Z", "2026-09-13T04:59:59.000Z"]) {
      const at = new Date(iso);
      const { start, end } = bogotaDayRange(at);
      expect(at.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(at.getTime()).toBeLessThan(end.getTime());
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    }
  });
  it("las 04:59Z y las 05:00Z caen en días de Bogotá distintos", () => {
    const early = bogotaDayRange(new Date("2026-09-12T04:59:00.000Z")); // aún 11 sep en Bogotá
    const late = bogotaDayRange(new Date("2026-09-12T05:00:00.000Z")); // ya 12 sep en Bogotá
    expect(early.start.toISOString()).toBe("2026-09-11T05:00:00.000Z");
    expect(late.start.toISOString()).toBe("2026-09-12T05:00:00.000Z");
  });
});
