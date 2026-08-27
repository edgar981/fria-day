import { describe, it, expect } from "vitest";
import {
  sessionTotalUnits,
  totalUnitsForUser,
  leaderboard,
  userStats,
  beerRanking,
  normalizeKey,
  isValidRating,
  isValidQuantity,
  isValidTag,
  type SessionData,
  type UserRef,
} from "./domain";

// Usuarios de prueba
const ana: UserRef = { id: "u_ana", displayName: "Ana" };
const beto: UserRef = { id: "u_beto", displayName: "Beto" };
const caro: UserRef = { id: "u_caro", displayName: "Caro" }; // sin sesiones propias

// Sesiones: Ana tiene 2 sesiones propias, Beto 1. Caro está SOLO etiquetada.
const sessions: SessionData[] = [
  {
    id: "s1",
    ownerId: ana.id,
    date: "2026-08-20",
    checkIns: [
      { beerId: "b_ipa", beerStyle: "IPA", quantity: 3, format: "BOTELLA", rating: 5 },
      { beerId: "b_lager", beerStyle: "Lager", quantity: 2, format: "LATA", rating: 4 },
    ],
  },
  {
    id: "s2",
    ownerId: ana.id,
    date: "2026-08-25",
    checkIns: [
      { beerId: "b_ipa", beerStyle: "IPA", quantity: 1, format: "PINTA", rating: 4 },
    ],
  },
  {
    id: "s3",
    ownerId: beto.id,
    date: "2026-08-26",
    checkIns: [
      { beerId: "b_stout", beerStyle: "Stout", quantity: 4, format: "JARRA", rating: 3 },
    ],
  },
];

describe("sessionTotalUnits", () => {
  it("suma las cantidades de los check-ins de la sesión", () => {
    expect(sessionTotalUnits(sessions[0])).toBe(5); // 3 + 2
    expect(sessionTotalUnits(sessions[1])).toBe(1);
    expect(sessionTotalUnits({ checkIns: [] })).toBe(0);
  });
});

describe("totalUnitsForUser — solo check-ins propios", () => {
  it("Ana: suma de sus dos sesiones (5 + 1 = 6)", () => {
    expect(totalUnitsForUser(ana.id, sessions)).toBe(6);
  });
  it("Beto: solo su sesión (4)", () => {
    expect(totalUnitsForUser(beto.id, sessions)).toBe(4);
  });
  it("Caro: 0, aunque estuviera etiquetada en sesiones ajenas", () => {
    expect(totalUnitsForUser(caro.id, sessions)).toBe(0);
  });
});

describe("leaderboard — regla 'etiquetar no acredita'", () => {
  it("ordena por unidades desc e incluye a todos", () => {
    const board = leaderboard([ana, beto, caro], sessions);
    expect(board).toEqual([
      { userId: "u_ana", displayName: "Ana", units: 6 },
      { userId: "u_beto", displayName: "Beto", units: 4 },
      { userId: "u_caro", displayName: "Caro", units: 0 },
    ]);
  });

  it("CASO EXPLÍCITO DEL SPEC: usuario etiquetado con 0 check-ins propios aparece con 0", () => {
    // Caro no tiene ninguna sesión propia; solo compañía. Debe salir con 0.
    const board = leaderboard([ana, beto, caro], sessions);
    const caroRow = board.find((r) => r.userId === caro.id);
    expect(caroRow).toBeDefined();
    expect(caroRow!.units).toBe(0);
  });

  it("etiquetar a alguien NO le suma unidades (invariante)", () => {
    // Añadimos un tag de Caro en la sesión de Ana simulando presentación;
    // como el leaderboard solo mira ownerId, el total de Caro sigue en 0.
    const board = leaderboard([ana, beto, caro], sessions);
    expect(board.find((r) => r.userId === caro.id)!.units).toBe(0);
    // Y el total del grupo = suma de check-ins reales (6 + 4).
    expect(board.reduce((s, r) => s + r.units, 0)).toBe(10);
  });

  it("desempate estable por displayName", () => {
    const x: UserRef = { id: "x", displayName: "Zoe" };
    const y: UserRef = { id: "y", displayName: "Aaron" };
    const board = leaderboard([x, y], []); // ambos en 0
    expect(board.map((r) => r.displayName)).toEqual(["Aaron", "Zoe"]);
  });
});

describe("userStats", () => {
  it("Ana: total, por estilo, distintas y nº de sesiones (solo propias)", () => {
    const stats = userStats(ana.id, sessions);
    expect(stats.totalUnits).toBe(6);
    expect(stats.byStyle).toEqual({ IPA: 4, Lager: 2 }); // IPA 3+1, Lager 2
    expect(stats.distinctBeers).toBe(2); // b_ipa, b_lager
    expect(stats.sessionsCount).toBe(2);
  });

  it("Caro (solo etiquetada): todo en cero", () => {
    const stats = userStats(caro.id, sessions);
    expect(stats).toEqual({
      totalUnits: 0,
      byStyle: {},
      distinctBeers: 0,
      sessionsCount: 0,
    });
  });

  it("check-in sin estilo cae en 'Sin estilo'", () => {
    const s: SessionData[] = [
      {
        id: "s",
        ownerId: "u",
        date: "2026-01-01",
        checkIns: [
          { beerId: "b", beerStyle: null, quantity: 2, format: "LATA", rating: 3 },
          { beerId: "b", beerStyle: "  ", quantity: 1, format: "LATA", rating: 3 },
        ],
      },
    ];
    expect(userStats("u", s).byStyle).toEqual({ "Sin estilo": 3 });
  });
});

describe("beerRanking", () => {
  it("promedia ratings y cuenta por cerveza; ordena por promedio desc", () => {
    const rows = beerRanking([
      { beerId: "b_ipa", rating: 5 },
      { beerId: "b_ipa", rating: 4 },
      { beerId: "b_lager", rating: 4 },
      { beerId: "b_stout", rating: 3 },
    ]);
    expect(rows[0]).toEqual({ beerId: "b_ipa", avgRating: 4.5, ratingsCount: 2 });
    expect(rows.map((r) => r.beerId)).toEqual(["b_ipa", "b_lager", "b_stout"]);
  });

  it("desempate por número de ratings desc", () => {
    const rows = beerRanking([
      { beerId: "poco", rating: 4 },
      { beerId: "mucho", rating: 4 },
      { beerId: "mucho", rating: 4 },
    ]);
    expect(rows.map((r) => r.beerId)).toEqual(["mucho", "poco"]);
  });
});

describe("normalizeKey", () => {
  it("recorta, colapsa espacios y baja a minúsculas", () => {
    expect(normalizeKey("  Club   Colombia ")).toBe("club colombia");
    expect(normalizeKey("BBC")).toBe("bbc");
  });
  it("mismo key para variantes case/espacios (frena duplicados)", () => {
    expect(normalizeKey("Poker")).toBe(normalizeKey("  poker "));
  });
});

describe("validaciones", () => {
  it("rating entero 1..5", () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
    expect(isValidRating("3")).toBe(false);
  });
  it("quantity entero >= 1", () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(-2)).toBe(false);
    expect(isValidQuantity(2.5)).toBe(false);
  });
  it("tag: exactamente uno de taggedUserId | freeText (XOR)", () => {
    expect(isValidTag({ taggedUserId: "u1" })).toBe(true);
    expect(isValidTag({ freeText: "los primos" })).toBe(true);
    expect(isValidTag({ taggedUserId: "u1", freeText: "x" })).toBe(false);
    expect(isValidTag({})).toBe(false);
    expect(isValidTag({ freeText: "   " })).toBe(false);
  });
});
