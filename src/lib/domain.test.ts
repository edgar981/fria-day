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
  checkInMatchKey,
  dayKeyUTC,
  registrationStreak,
  sessionRegistration,
  leaderboardVariety,
  distinctBeersForUser,
  ownBeerRating,
  circleOf,
  formatBreakdown,
  leaderboardSessions,
  yoTambienCheckIn,
  REACTIONS,
  isReaction,
  groupReactions,
  rankClusterEmojis,
  reactionPile,
  FORMATS_BY_KIND,
  REGISTRATION_PLAZO_MS,
  type SessionData,
  type UserRef,
  type ExistingCheckIn,
  type CircleTagEdge,
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

describe("checkInMatchKey — 'la misma bebida' (DS.1: constancia de Yo también)", () => {
  it("misma beerId + mismo format → misma clave", () => {
    expect(checkInMatchKey({ beerId: "b1", format: "BOTELLA" })).toBe(checkInMatchKey({ beerId: "b1", format: "BOTELLA" }));
  });
  it("mismo beerId, formato distinto → clave distinta", () => {
    expect(checkInMatchKey({ beerId: "b1", format: "BOTELLA" })).not.toBe(checkInMatchKey({ beerId: "b1", format: "JARRA" }));
  });
  it("beerId distinto, mismo formato → clave distinta", () => {
    expect(checkInMatchKey({ beerId: "b1", format: "BOTELLA" })).not.toBe(checkInMatchKey({ beerId: "b2", format: "BOTELLA" }));
  });
  it("coincide con el emparejamiento de planCheckInAdd (misma fuente de verdad)", () => {
    const existing: ExistingCheckIn = { id: "x", beerId: "b1", format: "BOTELLA", quantity: 1, rating: null };
    const incoming = { beerId: "b1", format: "BOTELLA" as const, quantity: 1, rating: null };
    const mergesInPlan = planCheckInAdd([existing], incoming).action === "merge";
    const sameKey = checkInMatchKey(existing) === checkInMatchKey(incoming);
    expect(sameKey).toBe(mergesInPlan); // ambos dicen "es la misma bebida"
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

describe("Pasada C — el círculo (derivado de etiquetas)", () => {
  const A = "u_ana", B = "u_beto", C = "u_caro";
  const edge = (ownerId: string, taggedUserId: string): CircleTagEdge => ({ ownerId, taggedUserId });

  it("caso 1: A etiqueta a B → B en el círculo de A y A en el de B (simétrico)", () => {
    const edges = [edge(A, B)]; // salida de A donde A etiquetó a B
    expect(circleOf(A, edges).has(B)).toBe(true);
    expect(circleOf(B, edges).has(A)).toBe(true);
  });

  it("caso 2: A y B nunca se han etiquetado → no están en el círculo del otro", () => {
    const edges = [edge(A, C), edge(B, C)]; // ambos etiquetaron a C, nunca entre sí
    expect(circleOf(A, edges).has(B)).toBe(false);
    expect(circleOf(B, edges).has(A)).toBe(false);
  });

  it("caso 3: C etiquetó a B, nunca a A → C NO está en el círculo de A (no transitivo)", () => {
    const edges = [edge(A, B), edge(C, B)]; // A↔B y C↔B, pero A y C no
    const circA = circleOf(A, edges);
    expect(circA.has(B)).toBe(true); // amigo directo
    expect(circA.has(C)).toBe(false); // amigo de un amigo NO entra
  });

  it("caso 4: A en el círculo de B (por otra salida) → puede ver una salida de B que NO lo etiqueta", () => {
    // A y B salieron juntos alguna vez (arista A↔B). En OTRA salida B no etiqueta a A.
    const edges = [edge(B, A)];
    const circA = circleOf(A, edges);
    // El permiso de ver = el dueño está en mi círculo. B lo está → A puede ver.
    expect(circA.has(B)).toBe(true);
  });

  it("caso 5: salida de C fuera del círculo de A → A NO puede verla (404)", () => {
    const edges = [edge(A, B)]; // A solo ha salido con B
    const circA = circleOf(A, edges);
    expect(circA.has(C)).toBe(false); // dueño C no está en el círculo → 404
  });

  it("caso 6: usuario sin círculo → solo él mismo", () => {
    const circA = circleOf(A, []); // nunca etiquetó ni lo etiquetaron
    expect([...circA]).toEqual([A]);
    expect(circA.size).toBe(1);
  });

  it("caso 7: la etiqueta descartada (dismissedAt) SÍ cuenta para el círculo", () => {
    // El llamador incluye las descartadas en las aristas; el círculo las considera.
    const edges = [edge(B, A)]; // B etiquetó a A y A descartó ("no tomé", pero estuvo)
    expect(circleOf(A, edges).has(B)).toBe(true);
  });

  it("caso 8: invariante — etiquetado con 0 check-ins propios → 0 en el leaderboard del círculo", () => {
    const edges = [edge(A, C)]; // C está en el círculo de A pero no tiene salidas propias
    const circle = circleOf(A, edges);
    const circleUsers = [ana, beto, caro].filter((u) => circle.has(u.id)); // {A, C}
    // Solo A tiene una salida propia; C fue etiquetado pero no tiene check-ins propios.
    const sessions: SessionData[] = [
      { id: "s1", ownerId: A, date: "2026-08-01", checkIns: [{ beerId: "b1", quantity: 3, format: "LATA", rating: null }] },
    ];
    const board = leaderboard(circleUsers, sessions);
    expect(board.find((r) => r.userId === C)?.units).toBe(0); // etiquetar no acredita
    expect(board.find((r) => r.userId === A)?.units).toBe(3);
    expect(board.some((r) => r.userId === B)).toBe(false); // B fuera del círculo, no aparece
  });
});

describe("Pasada D — desglose por formato y formatos por tipo", () => {
  it("caso 1: 7 botellas + 4 jarras → desglose [botella 7, jarra 4] y total 11", () => {
    const cis = [
      { format: "BOTELLA" as const, quantity: 5 },
      { format: "JARRA" as const, quantity: 4 },
      { format: "BOTELLA" as const, quantity: 2 },
    ];
    const bd = formatBreakdown(cis);
    expect(bd).toEqual([
      { format: "BOTELLA", count: 7 },
      { format: "JARRA", count: 4 },
    ]);
    expect(bd.reduce((s, b) => s + b.count, 0)).toBe(11);
  });

  it("caso 2: un solo formato → desglose de largo 1 (quien lo muestra decide ocultarlo)", () => {
    expect(formatBreakdown([{ format: "LATA", quantity: 3 }])).toEqual([{ format: "LATA", count: 3 }]);
  });

  it("caso 3: cerveza + cóctel en la misma salida → suma ambos formatos", () => {
    const bd = formatBreakdown([
      { format: "BOTELLA", quantity: 2 },
      { format: "COPA", quantity: 1 },
      { format: "VASO", quantity: 1 },
    ]);
    expect(bd.reduce((s, b) => s + b.count, 0)).toBe(4); // total mezcla tipos
    expect(bd[0]).toEqual({ format: "BOTELLA", count: 2 }); // mayor primero
  });

  it("ordena por conteo desc, luego por orden del enum", () => {
    const bd = formatBreakdown([
      { format: "JARRA", quantity: 2 },
      { format: "LATA", quantity: 2 },
      { format: "BOTELLA", quantity: 5 },
    ]);
    // 5 primero; empate 2-2 desempata por orden de enum (LATA antes que JARRA)
    expect(bd.map((b) => b.format)).toEqual(["BOTELLA", "LATA", "JARRA"]);
  });

  it("caso 5: FORMATS_BY_KIND[COCTEL] no ofrece botella ni lata", () => {
    expect(FORMATS_BY_KIND.COCTEL).toEqual(["COPA", "VASO", "JARRA_COMPARTIDA"]);
    expect(FORMATS_BY_KIND.COCTEL).not.toContain("BOTELLA");
    expect(FORMATS_BY_KIND.COCTEL).not.toContain("LATA");
    expect(FORMATS_BY_KIND.CERVEZA).toEqual(["BOTELLA", "LATA", "JARRA", "PINTA"]);
  });
});

describe("Pasada E — eje Salidas (presencia)", () => {
  const mk = (id: string, ownerId: string, qty: number): SessionData => ({
    id,
    ownerId,
    date: "2026-08-01",
    checkIns: qty > 0 ? [{ beerId: "b", quantity: qty, format: "LATA", rating: null }] : [],
  });

  it("caso 1: A con 5 salidas de 1 vs B con 2 de 10 → A arriba en Salidas, B en Unidades", () => {
    const sessions: SessionData[] = [
      mk("a1", ana.id, 1), mk("a2", ana.id, 1), mk("a3", ana.id, 1), mk("a4", ana.id, 1), mk("a5", ana.id, 1),
      mk("b1", beto.id, 10), mk("b2", beto.id, 10),
    ];
    const bySessions = leaderboardSessions([ana, beto], sessions);
    expect(bySessions[0].userId).toBe(ana.id); // 5 > 2
    expect(bySessions.find((r) => r.userId === ana.id)?.sessions).toBe(5);
    expect(bySessions.find((r) => r.userId === beto.id)?.sessions).toBe(2);
    // El eje Unidades invierte el orden: B (20) arriba de A (5).
    expect(leaderboard([ana, beto], sessions)[0].userId).toBe(beto.id);
  });

  it("caso 2: etiquetado en salidas ajenas, 0 propias → 0 en Salidas (invariante)", () => {
    // caro no es dueño de ninguna salida (solo lo etiquetan en las de otros → irrelevante aquí).
    const sessions: SessionData[] = [mk("x1", ana.id, 3), mk("x2", beto.id, 2)];
    const row = leaderboardSessions([ana, beto, caro], sessions).find((r) => r.userId === caro.id);
    expect(row?.sessions).toBe(0);
  });

  it("caso 3: una salida SIN check-ins cuenta (presencia, no consumo)", () => {
    const sessions: SessionData[] = [mk("empty", ana.id, 0)];
    expect(leaderboardSessions([ana], sessions)[0].sessions).toBe(1);
  });
});

describe("Pasada Y — 'Yo también'", () => {
  it("caso 5: arma el check-in con cantidad 1 y SIN rating (no se copia)", () => {
    const ci = yoTambienCheckIn({ beerId: "b_mojito", format: "VASO" });
    expect(ci).toEqual({ beerId: "b_mojito", format: "VASO", quantity: 1, rating: null });
  });

  it("caso 3: consolida en tu salida si ya tienes esa bebida y formato (2× en vez de fila nueva)", () => {
    const mine: ExistingCheckIn[] = [
      { id: "c1", beerId: "b_mojito", format: "VASO", quantity: 1, rating: 5 },
    ];
    const plan = planCheckInAdd(mine, yoTambienCheckIn({ beerId: "b_mojito", format: "VASO" }));
    expect(plan.action).toBe("merge");
    expect(plan).toMatchObject({ quantity: 2, rating: 5 }); // suma cantidad, conserva TU rating
  });

  it("formato distinto → fila nueva (no consolida)", () => {
    const mine: ExistingCheckIn[] = [
      { id: "c1", beerId: "b_mojito", format: "COPA", quantity: 1, rating: null },
    ];
    const plan = planCheckInAdd(mine, yoTambienCheckIn({ beerId: "b_mojito", format: "VASO" }));
    expect(plan.action).toBe("create");
  });
});

describe("Pasada R — reacciones", () => {
  it("agrupa por emoji, marca la del viewer y ordena por el orden del set", () => {
    const rs = [
      { emoji: "🔥", userId: "u1" },
      { emoji: "🍻", userId: "u2" },
      { emoji: "🔥", userId: "u3" },
    ];
    const { groups, mine } = groupReactions(rs, "u3");
    expect(mine).toBe("🔥");
    expect(groups).toEqual([
      { emoji: "🍻", count: 1, mine: false }, // 🍻 antes de 🔥 (orden del set)
      { emoji: "🔥", count: 2, mine: true },
    ]);
  });

  it("viewer sin reacción → mine null; emojis sin reacción no aparecen", () => {
    const { groups, mine } = groupReactions([{ emoji: "🍻", userId: "u1" }], "u2");
    expect(mine).toBe(null);
    expect(groups).toEqual([{ emoji: "🍻", count: 1, mine: false }]);
  });

  it("isReaction valida contra el set fijo", () => {
    expect(isReaction("🍻")).toBe(true);
    expect(REACTIONS.every((e) => isReaction(e))).toBe(true);
    expect(isReaction("🍕")).toBe(false);
  });
});

describe("I-1.5 — racimo (más usados) y pila (propio primero)", () => {
  const r = (userId: string, emoji: string) => ({ userId, emoji });

  it("caso 3: 3 iguales + 1 distinta → el repetido primero", () => {
    const cluster = rankClusterEmojis([r("a", "🔥"), r("b", "🔥"), r("c", "🔥"), r("d", "😂")]);
    expect(cluster).toEqual(["🔥", "😂"]);
  });

  it("caso 4: empate en conteo → gana el más reciente (última aparición)", () => {
    // 🍻 y 🔥 con 1 cada uno; 🔥 llegó después → va primero.
    expect(rankClusterEmojis([r("a", "🍻"), r("b", "🔥")])).toEqual(["🔥", "🍻"]);
    // y al revés: si 🍻 es el más reciente, 🍻 primero.
    expect(rankClusterEmojis([r("a", "🔥"), r("b", "🍻")])).toEqual(["🍻", "🔥"]);
  });

  it("caso 1: 5 emojis distintos → el racimo muestra los 4 más usados (dropea el menos usado)", () => {
    const entries = [
      r("a", "🍻"), r("b", "🍻"), // 🍻 x2
      r("c", "🔥"), r("d", "🔥"), // 🔥 x2
      r("e", "😂"), r("f", "❤️"), r("g", "🫡"), // singles, en ese orden
    ];
    const cluster = rankClusterEmojis(entries, 4);
    expect(cluster).toHaveLength(4);
    // los dos con conteo 2 van primero (empate → más reciente: 🔥 antes que 🍻)
    expect(cluster.slice(0, 2)).toEqual(["🔥", "🍻"]);
    // 😂 es el single más viejo → es el que queda fuera
    expect(cluster).not.toContain("😂");
  });

  it("caso 2: viewer reacciona con el MENOS usado → su emoji no entra al racimo, pero su avatar va PRIMERO", () => {
    // 4 emojis con 2 reacciones c/u + la del viewer (🫡, una sola, aunque sea la más nueva).
    const entries = [
      r("o1", "🍻"), r("o2", "🍻"),
      r("o3", "🔥"), r("o4", "🔥"),
      r("o5", "😂"), r("o6", "😂"),
      r("o7", "❤️"), r("o8", "❤️"),
      r("me", "🫡"),
    ];
    // El 🫡 del viewer (1 reacción) queda fuera del racimo: hay 4 emojis MÁS usados.
    const cluster = rankClusterEmojis(entries, 4);
    expect(cluster).toHaveLength(4);
    expect(cluster).not.toContain("🫡");
    // ...pero su avatar SÍ está, y primero (anillo ámbar en la UI), con "+N" para el resto.
    const pile = reactionPile(entries, "me", 3);
    expect(pile.visible[0].userId).toBe("me");
    expect(pile.visible).toHaveLength(3);
    expect(pile.extra).toBe(6); // 9 personas, 3 visibles → +6
  });

  it("pila sin el viewer: muestra los más recientes primero", () => {
    const pile = reactionPile([r("a", "🍻"), r("b", "🔥"), r("c", "😂")], "me", 3);
    expect(pile.visible.map((p) => p.userId)).toEqual(["c", "b", "a"]); // c es el más reciente
    expect(pile.extra).toBe(0);
  });
});

// ----------------------------------------------------------------------------
// Pasada S.2 — los cuatro cálculos de la share-card v2.
// ----------------------------------------------------------------------------
import {
  drinkingSpanMinutes,
  formatDurationLabel,
  DURATION_MIN_MINUTES,
  recorrido,
  firstTimeDrink,
  outingNumber,
} from "./domain";

describe("S.2 · duración (ventana de createdAt)", () => {
  const at = (iso: string) => new Date(iso);

  it("span = min→max en minutos; <2 timestamps → 0", () => {
    expect(drinkingSpanMinutes([])).toBe(0);
    expect(drinkingSpanMinutes([at("2026-08-28T20:00:00Z")])).toBe(0);
    // 8:30pm → 1:15am (día siguiente) = 4h 45m = 285 min, sin importar el orden.
    const span = drinkingSpanMinutes([
      at("2026-08-29T06:15:00Z"), // 1:15am Bogotá
      at("2026-08-29T01:30:00Z"), // 8:30pm Bogotá
    ]);
    expect(span).toBe(285);
  });

  it("formato preciso, NUNCA 'casi 5 horas' (§2)", () => {
    expect(formatDurationLabel(285)).toBe("4h 45m");
    expect(formatDurationLabel(100)).toBe("1h 40m");
    expect(formatDurationLabel(58)).toBe("58m");
    expect(formatDurationLabel(120)).toBe("2h");
  });

  it("registro retroactivo (span ~0) cae bajo el umbral → se omite", () => {
    const retro = drinkingSpanMinutes([at("2026-08-28T20:00:00Z"), at("2026-08-28T20:02:00Z")]);
    expect(retro).toBeLessThan(DURATION_MIN_MINUTES);
    expect(285).toBeGreaterThanOrEqual(DURATION_MIN_MINUTES);
  });
});

describe("S.2 · recorrido (orden de registro)", () => {
  it("conserva el orden y las repeticiones", () => {
    const { names, extra } = recorrido(["Poker", "Águila", "Club Colombia", "Poker"]);
    expect(names).toEqual(["Poker", "Águila", "Club Colombia", "Poker"]);
    expect(extra).toBe(0);
  });

  it("corta a 5 nombres; el resto va a 'extra'", () => {
    const { names, extra } = recorrido(["a", "b", "c", "d", "e", "f", "g"]);
    expect(names).toEqual(["a", "b", "c", "d", "e"]);
    expect(extra).toBe(2);
  });
});

describe("S.2 · primera vez (acotada al dueño)", () => {
  const ordered = [
    { beerId: "club", name: "Club Colombia" },
    { beerId: "bbc", name: "BBC Cajicá" },
    { beerId: "mojito", name: "Mojito" },
  ];

  it("primer nombre del recorrido que el dueño no había registrado antes", () => {
    // El dueño ya conocía Club; BBC es nueva → 'BBC Cajicá'.
    expect(firstTimeDrink(ordered, new Set(["club"]))).toBe("BBC Cajicá");
  });

  it("respeta el orden de registro cuando hay varias nuevas", () => {
    expect(firstTimeDrink(ordered, new Set())).toBe("Club Colombia");
  });

  it("null si ninguna es primera vez", () => {
    expect(firstTimeDrink(ordered, new Set(["club", "bbc", "mojito"]))).toBeNull();
  });
});

describe("S.2 · salida #N del dueño", () => {
  const d = (s: string) => new Date(s);
  const sessions = [
    { id: "s1", date: d("2026-08-10T00:00:00Z"), createdAt: d("2026-08-10T02:00:00Z") },
    { id: "s2", date: d("2026-08-20T00:00:00Z"), createdAt: d("2026-08-20T02:00:00Z") },
    { id: "s3", date: d("2026-08-28T00:00:00Z"), createdAt: d("2026-08-28T02:00:00Z") },
  ];

  it("puesto por (date, createdAt) asc; la 1a es #1", () => {
    expect(outingNumber(sessions, "s1")).toBe(1);
    expect(outingNumber(sessions, "s3")).toBe(3);
  });

  it("desempata por createdAt cuando la fecha coincide", () => {
    const same = [
      { id: "a", date: d("2026-08-28T00:00:00Z"), createdAt: d("2026-08-28T01:00:00Z") },
      { id: "b", date: d("2026-08-28T00:00:00Z"), createdAt: d("2026-08-28T05:00:00Z") },
    ];
    expect(outingNumber(same, "a")).toBe(1);
    expect(outingNumber(same, "b")).toBe(2);
  });

  it("0 si la salida no está en la lista", () => {
    expect(outingNumber(sessions, "nope")).toBe(0);
  });
});

import { canAddSessionPhoto, MAX_SESSION_PHOTOS } from "./domain";

describe("I-2 · límite de fotos por salida", () => {
  it(`cabe hasta ${MAX_SESSION_PHOTOS}; la ${MAX_SESSION_PHOTOS + 1}ª se rechaza`, () => {
    expect(MAX_SESSION_PHOTOS).toBe(6);
    expect(canAddSessionPhoto(0)).toBe(true);
    expect(canAddSessionPhoto(5)).toBe(true);
    expect(canAddSessionPhoto(6)).toBe(false);
    expect(canAddSessionPhoto(7)).toBe(false);
  });
});

import { MAX_COMMENT_LENGTH, isValidCommentBody, canDeleteComment } from "./domain";

describe("I-3 · comentarios", () => {
  it("cuerpo válido: no vacío tras recortar, hasta el límite", () => {
    expect(MAX_COMMENT_LENGTH).toBe(280);
    expect(isValidCommentBody("hola")).toBe(true);
    expect(isValidCommentBody("")).toBe(false);
    expect(isValidCommentBody("   ")).toBe(false);
    expect(isValidCommentBody("a".repeat(280))).toBe(true);
    expect(isValidCommentBody("a".repeat(281))).toBe(false);
    expect(isValidCommentBody("  " + "a".repeat(280) + "  ")).toBe(true); // recorta antes de medir
  });
  it("borrar: SOLO el autor (I-3.2: el dueño de la salida ya NO borra ajenos)", () => {
    expect(canDeleteComment({ authorId: "u1", viewerId: "u1" })).toBe(true); // autor → sí
    expect(canDeleteComment({ authorId: "u1", viewerId: "own" })).toBe(false); // dueño de la salida → NO
    expect(canDeleteComment({ authorId: "u1", viewerId: "u2" })).toBe(false); // cualquier otro → no
  });
});
