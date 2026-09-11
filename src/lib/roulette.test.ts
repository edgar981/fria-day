import { describe, it, expect } from "vitest";
import {
  ROULETTE_DYNAMICS,
  ROULETTE_DYNAMIC_KEYS,
  isRouletteDynamicKey,
  getRouletteDynamic,
  getRouletteChallenge,
  challengeKeysFor,
  secureRandomInt,
  pickRandom,
  pickChallengeKey,
} from "./roulette";

describe("catálogo de la ruleta", () => {
  it("tiene 6 dinámicas y 18 retos", () => {
    expect(ROULETTE_DYNAMICS).toHaveLength(6);
    expect(ROULETTE_DYNAMICS.flatMap((d) => d.challenges)).toHaveLength(18);
    for (const d of ROULETTE_DYNAMICS) expect(d.challenges).toHaveLength(3);
  });

  it("todas las claves son únicas y estables", () => {
    const dynKeys = ROULETTE_DYNAMICS.map((d) => d.key);
    expect(new Set(dynKeys).size).toBe(6);
    const chKeys = ROULETTE_DYNAMICS.flatMap((d) => d.challenges.map((c) => c.key));
    expect(new Set(chKeys).size).toBe(18);
    // clave de reto = `${dinámica}-${n}`
    for (const d of ROULETTE_DYNAMICS) {
      d.challenges.forEach((c, i) => expect(c.key).toBe(`${d.key}-${i + 1}`));
    }
  });

  it("resuelve dinámicas y retos por clave", () => {
    expect(ROULETTE_DYNAMIC_KEYS).toEqual(["tapazo", "cronista", "bautizo", "estatua", "embajador", "cuenta"]);
    expect(isRouletteDynamicKey("tapazo")).toBe(true);
    expect(isRouletteDynamicKey("no-existe")).toBe(false);
    expect(getRouletteDynamic("estatua")?.name).toBe("La estatua");
    const r = getRouletteChallenge("estatua-1");
    expect(r?.dynamic.key).toBe("estatua");
    expect(r?.challenge.text).toContain("No puedes usar las manos");
    expect(getRouletteChallenge("no-existe")).toBeUndefined();
    expect(challengeKeysFor("cuenta")).toEqual(["cuenta-1", "cuenta-2", "cuenta-3"]);
    expect(challengeKeysFor("no-existe")).toEqual([]);
  });

  // Regla §6: el paso es un derecho absoluto y sin penalización.
  it("ningún reto quita el derecho a paso (§6)", () => {
    for (const d of ROULETTE_DYNAMICS) {
      for (const c of d.challenges) {
        expect(`${c.text} ${c.note}`.toLowerCase()).not.toContain("sin derecho a paso");
      }
    }
  });

  // Regla §7: ningún reto ordena beber, sirve ni castiga con alcohol.
  it("ningún reto usa las fórmulas prohibidas de consumo (§7)", () => {
    const prohibido = /f[oó]ndo blanco|t[oó]mate otra|te saltas la ronda|s[eé]cate|de una|hasta el fondo/i;
    for (const d of ROULETTE_DYNAMICS) {
      for (const c of d.challenges) {
        expect(prohibido.test(`${c.text} ${c.note}`)).toBe(false);
      }
    }
  });
});

// RU.2: el sorteo del perdedor DEBE ser aleatorio (no semilla fija, ni índice constante,
// ni orden de participantes determinando el resultado). Este test lo fija.
describe("sorteo (RU.2)", () => {
  it("secureRandomInt es uniforme sobre 3 (100 y 9000 rondas simuladas)", () => {
    const dist = (N: number) => {
      const c = [0, 0, 0];
      for (let i = 0; i < N; i++) c[secureRandomInt(3)]! += 1;
      return c;
    };
    // 100 rondas: cada casilla razonablemente lejos de 0 o del monopolio (±~20).
    const c100 = dist(100);
    expect(c100.reduce((a, b) => a + b, 0)).toBe(100);
    for (const n of c100) expect(n).toBeGreaterThan(12); // nadie cerca de "siempre" ni "nunca"
    // 9000 rondas: cada casilla dentro de ±15% de 1/3 (imposible de fallar por azar).
    const N = 9000, c = dist(N), lo = (N / 3) * 0.85, hi = (N / 3) * 1.15;
    for (const n of c) { expect(n).toBeGreaterThan(lo); expect(n).toBeLessThan(hi); }
  });

  it("secureRandomInt cubre todos los índices y respeta el rango", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) { const v = secureRandomInt(5); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(5); seen.add(v); }
    expect(seen.size).toBe(5); // no se queda pegado en un índice
    expect(secureRandomInt(1)).toBe(0);
  });

  it("pickRandom usa el rng inyectado", () => {
    expect(pickRandom(["a", "b", "c"], () => 1)).toBe("b");
    expect(pickRandom([], () => 0)).toBeUndefined();
  });

  it("pickChallengeKey no repite mientras queden y reinicia al agotar (§2)", () => {
    // con 2 usados, el único disponible es el 3.º (determinístico)
    expect(pickChallengeKey("tapazo", ["tapazo-1", "tapazo-2"], () => 0)).toBe("tapazo-3");
    // con los 3 usados → reinicia el pool (elige del set completo)
    expect(pickChallengeKey("tapazo", ["tapazo-1", "tapazo-2", "tapazo-3"], () => 0)).toBe("tapazo-1");
    // sin usados → set completo
    expect(pickChallengeKey("cuenta", [], () => 2)).toBe("cuenta-3");
    expect(pickChallengeKey("no-existe", [], () => 0)).toBeNull();
  });
});
