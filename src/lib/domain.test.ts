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
  planCheckInAdd,
  consolidateNewCheckIns,
  dayKeyUTC,
  registrationStreak,
  sessionRegistration,
  leaderboardVariety,
  distinctBeersForUser,
  ownBeerRating,
  REGISTRATION_PLAZO_MS,
  type SessionData,
  type UserRef,
  type ExistingCheckIn,
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

  it("CASO EXPLÍCITO: check-in sin rating (null) NO baja el promedio ni suma al conteo", () => {
    // Una cerveza con dos check-ins: uno con rating 4, otro sin rating.
    // Promedio = 4 (no 2), conteo = 1 (no 2).
    const rows = beerRanking([
      { beerId: "x", rating: 4 },
      { beerId: "x", rating: null },
    ]);
    expect(rows).toEqual([{ beerId: "x", avgRating: 4, ratingsCount: 1 }]);
  });

  it("cerveza sin ningún rating no aparece en el ranking (→ 'Sin calificar' en UI)", () => {
    const rows = beerRanking([
      { beerId: "sinrating", rating: null },
      { beerId: "sinrating", rating: null },
    ]);
    expect(rows).toEqual([]);
  });
});

describe("normalizeKey", () => {
  it("recorta, colapsa espacios y baja a minúsculas", () => {
    expect(normalizeKey("  Club   Colombia ")).toBe("club colombia");
    expect(normalizeKey("BBC")).toBe("bbc");
  });
  it("insensible a acentos (G.2): aguila = Águila = AGUILA", () => {
    expect(normalizeKey("Águila")).toBe("aguila");
    expect(normalizeKey("aguila")).toBe("aguila");
    expect(normalizeKey("AGUILA")).toBe("aguila");
    expect(normalizeKey("Póker")).toBe("poker");
    expect(normalizeKey("Bogotá Beer Company")).toBe("bogota beer company");
    expect(normalizeKey("Costeñita")).toBe("costenita"); // ñ → n
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

describe("consolidación de check-ins (misma cerveza + formato) — punto A.2-5", () => {
  const existing = (over: Partial<ExistingCheckIn>): ExistingCheckIn => ({
    id: "x",
    beerId: "b1",
    format: "BOTELLA",
    quantity: 1,
    rating: null,
    ...over,
  });

  it("misma cerveza, mismo formato, 1× + 1× → un check-in de 2×", () => {
    const plan = planCheckInAdd([existing({ quantity: 1 })], {
      beerId: "b1",
      format: "BOTELLA",
      quantity: 1,
      rating: null,
    });
    expect(plan).toEqual({ action: "merge", targetId: "x", quantity: 2, rating: null });
  });

  it("misma cerveza, formato distinto → dos check-ins (create)", () => {
    const plan = planCheckInAdd([existing({ format: "BOTELLA" })], {
      beerId: "b1",
      format: "JARRA",
      quantity: 1,
      rating: null,
    });
    expect(plan.action).toBe("create");
  });

  it("existente con rating 4 + nuevo sin rating → queda en 4", () => {
    const plan = planCheckInAdd([existing({ rating: 4 })], {
      beerId: "b1",
      format: "BOTELLA",
      quantity: 1,
      rating: null,
    });
    expect(plan).toMatchObject({ action: "merge", rating: 4 });
  });

  it("existente sin rating + nuevo con rating 3 → queda en 3", () => {
    const plan = planCheckInAdd([existing({ rating: null })], {
      beerId: "b1",
      format: "BOTELLA",
      quantity: 1,
      rating: 3,
    });
    expect(plan).toMatchObject({ action: "merge", rating: 3 });
  });

  it("existente con rating 4 + nuevo con rating 2 → queda en 4 (no sobrescribe)", () => {
    const plan = planCheckInAdd([existing({ rating: 4 })], {
      beerId: "b1",
      format: "BOTELLA",
      quantity: 1,
      rating: 2,
    });
    expect(plan).toMatchObject({ action: "merge", rating: 4 });
  });

  it("consolidateNewCheckIns fusiona en crear salida (mismo beer+formato) y separa por formato", () => {
    const out = consolidateNewCheckIns([
      { beerId: "b1", format: "BOTELLA", quantity: 1, rating: null },
      { beerId: "b1", format: "BOTELLA", quantity: 1, rating: 4 },
      { beerId: "b1", format: "JARRA", quantity: 1, rating: null },
    ]);
    expect(out).toEqual([
      { beerId: "b1", format: "BOTELLA", quantity: 2, rating: 4 },
      { beerId: "b1", format: "JARRA", quantity: 1, rating: null },
    ]);
  });
});

// ============================================================================
// Pasada B — mecánica social. Casos de aceptación del spec (criterio).
// ============================================================================
describe("Pasada B — racha de registro (PIEZA 1)", () => {
  const U = "u";
  const NOW = Date.UTC(2026, 7, 28, 12); // 28-ago-2026 12:00 UTC
  const day = (y: number, m: number, d: number) => dayKeyUTC(new Date(Date.UTC(y, m - 1, d)));
  const reg = (...pairs: [string, number][]) => new Set(pairs.map(([u, k]) => `${u}|${k}`));

  it("caso 1: sin salidas ni etiquetas → 0", () => {
    expect(registrationStreak({ registeredDays: new Set(), userId: U, eventDayKeys: [], nowMs: NOW })).toBe(0);
  });

  it("caso 2: tres salidas propias en fechas distintas → 3", () => {
    const ks = [day(2026, 8, 1), day(2026, 8, 10), day(2026, 8, 20)];
    expect(registrationStreak({ registeredDays: reg([U, ks[0]], [U, ks[1]], [U, ks[2]]), userId: U, eventDayKeys: ks, nowMs: NOW })).toBe(3);
  });

  it("caso 3: salida propia + etiqueta la misma fecha → 1, no 2", () => {
    const k = day(2026, 8, 20);
    // el día está en ambos conjuntos → una sola clave en la unión
    expect(registrationStreak({ registeredDays: reg([U, k]), userId: U, eventDayKeys: [k, k], nowMs: NOW })).toBe(1);
  });

  it("caso 4: etiquetado dentro del plazo, sin registrar → racha intacta (pendiente no rompe)", () => {
    const own1 = day(2026, 8, 10), own2 = day(2026, 8, 15);
    const tagHoy = day(2026, 8, 28); // deadline 30-ago 00:00 > NOW → pendiente
    const streak = registrationStreak({ registeredDays: reg([U, own1], [U, own2]), userId: U, eventDayKeys: [tagHoy, own2, own1], nowMs: NOW });
    expect(streak).toBe(2); // los 2 previos siguen; el tag pendiente ni suma ni rompe
    expect(NOW < tagHoy + REGISTRATION_PLAZO_MS).toBe(true); // aviso activo
  });

  it("caso 5: etiquetado vencido (>48h) sin registrar → rompe la racha (0)", () => {
    const ownViejo = day(2026, 8, 10);
    const tagVencido = day(2026, 8, 25); // deadline 27-ago 00:00 < NOW → vencido
    const streak = registrationStreak({ registeredDays: reg([U, ownViejo]), userId: U, eventDayKeys: [tagVencido, ownViejo], nowMs: NOW });
    expect(streak).toBe(0); // el tag vencido (más reciente) rompe antes de contar el viejo
  });

  it("caso 6: etiquetado vencido pero DESCARTADO → racha intacta (no entra en eventos)", () => {
    const own = day(2026, 8, 10);
    // el tag descartado NO se pasa en eventDayKeys → no rompe
    expect(registrationStreak({ registeredDays: reg([U, own]), userId: U, eventDayKeys: [own], nowMs: NOW })).toBe(1);
  });

  it("caso 7 (CRÍTICO): sin actividad dos meses, sin etiquetas → racha CONGELADA en su último valor", () => {
    const ks = [day(2026, 6, 1), day(2026, 6, 2), day(2026, 6, 3)]; // junio, ~2 meses antes
    const registeredDays = reg([U, ks[0]], [U, ks[1]], [U, ks[2]]);
    const base = { registeredDays, userId: U, eventDayKeys: ks };
    expect(registrationStreak({ ...base, nowMs: NOW })).toBe(3);
    // Demostrado corriendo: el paso del tiempo NUNCA la rompe (no tomar no castiga).
    expect(registrationStreak({ ...base, nowMs: NOW + 60 * 24 * 3600 * 1000 })).toBe(3);
    expect(registrationStreak({ ...base, nowMs: NOW + 3650 * 24 * 3600 * 1000 })).toBe(3); // 10 años
  });
});

describe("Pasada B — contador 'quién falta' (PIEZA 2)", () => {
  const NOW = Date.UTC(2026, 7, 28, 12);
  const day = (y: number, m: number, d: number) => dayKeyUTC(new Date(Date.UTC(y, m - 1, d)));
  const reg = (...pairs: [string, number][]) => new Set(pairs.map(([u, k]) => `${u}|${k}`));
  const sDay = day(2026, 8, 28); // dentro del plazo respecto a NOW

  it("caso 8: dueño + 3 etiquetados de la app + 1 texto libre, dos etiquetados registraron → 3 de 4", () => {
    // el texto libre NO está en taggedUserIds. t1 y t2 registraron ese día; t3 no.
    const r = sessionRegistration({
      registeredDays: reg(["owner", sDay], ["t1", sDay], ["t2", sDay]),
      ownerId: "owner",
      taggedUserIds: ["t1", "t2", "t3"],
      sessionDayKey: sDay,
      nowMs: NOW,
    });
    expect(r.registered).toBe(3); // dueño (siempre) + t1 + t2
    expect(r.total).toBe(4); // dueño + 3 de la app
    expect(r.pending).toEqual(["t3"]); // falta t3, dentro del plazo
  });

  it("caso 9: un etiquetado descarta → sale del denominador", () => {
    // t3 descartó → no se pasa en taggedUserIds
    const r = sessionRegistration({
      registeredDays: reg(["owner", sDay], ["t1", sDay], ["t2", sDay]),
      ownerId: "owner",
      taggedUserIds: ["t1", "t2"],
      sessionDayKey: sDay,
      nowMs: NOW,
    });
    expect(r.total).toBe(3); // dueño + t1 + t2 (t3 fuera)
    expect(r.registered).toBe(3);
    expect(r.pending).toEqual([]);
  });
});

describe("Pasada B — leaderboard dos ejes (PIEZA 3)", () => {
  const A: UserRef = { id: "A", displayName: "A" };
  const B: UserRef = { id: "B", displayName: "B" };
  // A: 10 unidades de 2 cervezas. B: 5 unidades de 5 cervezas.
  const sessions: SessionData[] = [
    { id: "sa", ownerId: "A", date: new Date(), checkIns: [
      { beerId: "a1", quantity: 6, format: "BOTELLA", rating: null },
      { beerId: "a2", quantity: 4, format: "BOTELLA", rating: null },
    ] },
    { id: "sb", ownerId: "B", date: new Date(), checkIns: [
      { beerId: "b1", quantity: 1, format: "BOTELLA", rating: null },
      { beerId: "b2", quantity: 1, format: "BOTELLA", rating: null },
      { beerId: "b3", quantity: 1, format: "BOTELLA", rating: null },
      { beerId: "b4", quantity: 1, format: "BOTELLA", rating: null },
      { beerId: "b5", quantity: 1, format: "BOTELLA", rating: null },
    ] },
  ];

  it("caso 10: A arriba en Unidades (10>5), B arriba en Variedad (5>2)", () => {
    expect(leaderboard([A, B], sessions)[0].userId).toBe("A"); // unidades
    expect(leaderboardVariety([A, B], sessions)[0].userId).toBe("B"); // variedad
    expect(distinctBeersForUser("A", sessions)).toBe(2);
    expect(distinctBeersForUser("B", sessions)).toBe(5);
  });

  it("invariante: etiquetar no acredita variedad (solo check-ins propios)", () => {
    // B no tiene check-ins propios de las cervezas de A aunque estuviera etiquetado.
    expect(distinctBeersForUser("B", sessions)).toBe(5);
    expect(distinctBeersForUser("A", sessions)).toBe(2);
  });
});

describe("ownBeerRating (G.3) — rating propio, el más reciente", () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  it("nunca la ha probado → never", () => {
    expect(ownBeerRating([])).toEqual({ status: "never" });
  });
  it("la tomó pero sin calificar → unrated", () => {
    expect(ownBeerRating([{ rating: null, date: d("2026-08-01"), createdAt: d("2026-08-01") }])).toEqual({ status: "unrated" });
  });
  it("un solo rating → ese", () => {
    expect(ownBeerRating([{ rating: 4, date: d("2026-08-01"), createdAt: d("2026-08-01") }])).toEqual({ status: "rated", rating: 4 });
  });
  it("CASO CLAVE: dos check-ins con ratings distintos → el MÁS RECIENTE (no el promedio)", () => {
    const cis = [
      { rating: 5, date: d("2026-08-01"), createdAt: d("2026-08-01") }, // viejo
      { rating: 2, date: d("2026-08-20"), createdAt: d("2026-08-20") }, // reciente
    ];
    expect(ownBeerRating(cis)).toEqual({ status: "rated", rating: 2 });
    // el orden de entrada no importa
    expect(ownBeerRating([cis[1], cis[0]])).toEqual({ status: "rated", rating: 2 });
  });
  it("misma fecha → desempata por createdAt más reciente", () => {
    const cis = [
      { rating: 3, date: d("2026-08-10"), createdAt: new Date("2026-08-10T10:00:00Z") },
      { rating: 5, date: d("2026-08-10"), createdAt: new Date("2026-08-10T18:00:00Z") },
    ];
    expect(ownBeerRating(cis)).toEqual({ status: "rated", rating: 5 });
  });
  it("mezcla calificados y sin calificar → el más reciente CON rating", () => {
    const cis = [
      { rating: 4, date: d("2026-08-05"), createdAt: d("2026-08-05") },
      { rating: null, date: d("2026-08-25"), createdAt: d("2026-08-25") }, // más nuevo pero sin rating
    ];
    expect(ownBeerRating(cis)).toEqual({ status: "rated", rating: 4 });
  });
});
