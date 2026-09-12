import { describe, it, expect } from "vitest";
import { POINT_VALUES, buildCuentaLines, bogotaDayRange, DRINK_TECHO, buildDesglose, desgloseEthos, nextHitoObj, hitoEnSalidas, hitosReached, hitosCrossed, lastHitoPoints, HITOS } from "./points";

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

describe("desglose (§8) — de dónde salieron", () => {
  it("agrupa bebidas y social, ordena de mayor a menor", () => {
    const lines = buildDesglose({ session: 250, drink: 18, rate: 48, first_time: 90, photo: 60, round: 45, comment: 12, toast: 12 });
    expect(lines.map((l) => l.key)).toEqual(["session", "bebidas", "photo", "round", "social"]);
    expect(lines.find((l) => l.key === "bebidas")!.points).toBe(156); // 18+48+90
    expect(lines.find((l) => l.key === "social")!.points).toBe(24); // 12+12
  });
  it("la frase cierra el desglose con solo los números (PT.1: sin moraleja)", () => {
    expect(desgloseEthos(214, 428, 49, 2450)).toBe("214 bebidas: 428 puntos. 49 salidas: 2.450.");
    expect(desgloseEthos(1, 2, 1, 50)).toBe("1 bebida: 2 puntos. 1 salida: 50.");
  });
});

describe("hitos (§9) — los siete nombrados + cada 5.000", () => {
  it("los primeros siete son los del tablero", () => {
    expect(HITOS.slice(0, 7).map((h) => h.points)).toEqual([100, 250, 500, 1000, 2500, 5000, 10000]);
    expect(HITOS[0].name).toBe("La primera marca");
    expect(HITOS[3]).toMatchObject({ points: 1000, name: "Los mil", big: true });
    expect(HITOS[4]).toMatchObject({ points: 2500, name: "Veterano", big: false });
  });
  it("después de 10.000, uno cada 5.000 (todos con tarjeta)", () => {
    expect(HITOS[7]).toMatchObject({ points: 15000, big: true });
    expect(HITOS[8].points).toBe(20000);
  });
  it("nextHitoObj es el primero por encima del total", () => {
    expect(nextHitoObj(0)?.points).toBe(100);
    expect(nextHitoObj(300)?.points).toBe(500);
    expect(nextHitoObj(HITOS[HITOS.length - 1].points + 1)).toBeNull();
  });
  it("hitosReached / lastHitoPoints / hitosCrossed", () => {
    expect(hitosReached(600).map((h) => h.points)).toEqual([100, 250, 500]);
    expect(lastHitoPoints(600)).toBe(500);
    expect(hitosCrossed(400, 600).map((h) => h.name)).toEqual(["De la casa"]); // solo el 500
    expect(hitosCrossed(600, 600)).toEqual([]); // sin ganar puntos, nada cruzado
  });
  it("el próximo hito se expresa en salidas ('Dos salidas más')", () => {
    expect(hitoEnSalidas(420, 40)).toBe("Dos salidas más"); // (500-420)/40 = 2
    expect(hitoEnSalidas(460, 40)).toBe("Una salida más");
  });
  it("sin ritmo (0 salidas) no se puede expresar en salidas", () => {
    expect(hitoEnSalidas(0, 0)).toBeNull();
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
