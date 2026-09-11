import { describe, it, expect } from "vitest";
import {
  ROULETTE_DYNAMICS,
  ROULETTE_DYNAMIC_KEYS,
  isRouletteDynamicKey,
  getRouletteDynamic,
  getRouletteChallenge,
  challengeKeysFor,
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
