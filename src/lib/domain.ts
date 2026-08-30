// Lógica de dominio PURA (sin Prisma, sin I/O) — testeable en aislamiento.
//
// Regla no negociable #1: "Etiquetar no acredita cervezas".
//   Los totales de un usuario suben SOLO con sus propios check-ins, es decir,
//   check-ins de sesiones cuyo dueño (ownerId) es ese usuario. Ser etiquetado
//   (SessionTag) en la sesión de otro NUNCA suma al leaderboard ni a las métricas.

// Formatos: cerveza primero, cóctel después (Pasada D). El orden manda en el
// selector y en el desglose por formato. Enum aditivo: no se tocan los existentes.
export const BEER_FORMATS = ["BOTELLA", "LATA", "JARRA", "PINTA", "COPA", "VASO", "JARRA_COMPARTIDA"] as const;
export type BeerFormat = (typeof BEER_FORMATS)[number];

/** Tipo de bebida (Pasada D). El catálogo y el selector de formato se parten por esto. */
export const DRINK_KINDS = ["CERVEZA", "COCTEL"] as const;
export type DrinkKind = (typeof DRINK_KINDS)[number];

/** Formatos válidos por tipo. El selector solo ofrece los del tipo elegido. */
export const FORMATS_BY_KIND: Record<DrinkKind, BeerFormat[]> = {
  CERVEZA: ["BOTELLA", "LATA", "JARRA", "PINTA"],
  COCTEL: ["COPA", "VASO", "JARRA_COMPARTIDA"],
};

export interface CheckInData {
  beerId: string;
  /** Estilo de la cerveza del check-in (para agregación por estilo). */
  beerStyle?: string | null;
  quantity: number;
  format: BeerFormat;
  /** 1..5 o null = sin calificar (no cuenta al promedio del grupo). */
  rating: number | null;
}

export interface SessionData {
  id: string;
  /** Dueño de la sesión (Session.userId). Único que acredita cervezas. */
  ownerId: string;
  date: Date | string;
  checkIns: CheckInData[];
}

export interface UserRef {
  id: string;
  displayName: string;
}

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  units: number;
}

export interface UserStats {
  totalUnits: number;
  /** Unidades por estilo. Los check-ins sin estilo caen en "Sin estilo". */
  byStyle: Record<string, number>;
  /** Cantidad de cervezas distintas (por beerId) que el usuario ha registrado. */
  distinctBeers: number;
  /** Cantidad de sesiones propias. */
  sessionsCount: number;
}

export interface BeerRankingRow {
  beerId: string;
  avgRating: number;
  ratingsCount: number;
}

const STYLE_UNKNOWN = "Sin estilo";

/** Suma de unidades (quantity) de todos los check-ins de UNA sesión. */
export function sessionTotalUnits(session: Pick<SessionData, "checkIns">): number {
  return session.checkIns.reduce((sum, c) => sum + c.quantity, 0);
}

export interface FormatCount {
  format: BeerFormat;
  count: number;
}

/**
 * Desglose por formato (Pasada D): suma de unidades por formato. Da textura al total
 * ("11 bebidas · 7 botellas · 4 jarras") sin inventar conversiones de volumen — el
 * número sigue siendo registros de consumo, no litros. Ordena por conteo desc y, a
 * igualdad, por el orden del enum. Un formato con 0 no aparece. Si hay un solo
 * formato, el desglose es redundante y quien lo muestra decide no pintarlo.
 */
export function formatBreakdown(
  checkIns: { format: BeerFormat; quantity: number }[],
): FormatCount[] {
  const counts = new Map<BeerFormat, number>();
  for (const c of checkIns) counts.set(c.format, (counts.get(c.format) ?? 0) + c.quantity);
  return BEER_FORMATS.filter((f) => counts.has(f))
    .map((f) => ({ format: f, count: counts.get(f) as number }))
    .sort(
      (a, b) => b.count - a.count || BEER_FORMATS.indexOf(a.format) - BEER_FORMATS.indexOf(b.format),
    );
}

/**
 * Total histórico de unidades de un usuario: SOLO sus sesiones propias.
 * No importa en cuántas sesiones ajenas esté etiquetado.
 */
export function totalUnitsForUser(userId: string, sessions: SessionData[]): number {
  return sessions
    .filter((s) => s.ownerId === userId)
    .reduce((sum, s) => sum + sessionTotalUnits(s), 0);
}

/**
 * Leaderboard del grupo. Incluye a TODOS los usuarios dados (un usuario sin
 * check-ins propios aparece con 0). Ordenado por unidades desc y, a igualdad,
 * por displayName asc para un orden estable.
 */
export function leaderboard(users: UserRef[], sessions: SessionData[]): LeaderboardRow[] {
  const rows = users.map((u) => ({
    userId: u.id,
    displayName: u.displayName,
    units: totalUnitsForUser(u.id, sessions),
  }));
  return rows.sort(
    (a, b) => b.units - a.units || a.displayName.localeCompare(b.displayName),
  );
}

/** Métricas de perfil de un usuario, calculadas SOLO desde sus sesiones propias. */
export function userStats(userId: string, sessions: SessionData[]): UserStats {
  const own = sessions.filter((s) => s.ownerId === userId);
  const byStyle: Record<string, number> = {};
  const distinct = new Set<string>();
  let totalUnits = 0;

  for (const s of own) {
    for (const c of s.checkIns) {
      totalUnits += c.quantity;
      distinct.add(c.beerId);
      const style = c.beerStyle?.trim() ? c.beerStyle.trim() : STYLE_UNKNOWN;
      byStyle[style] = (byStyle[style] ?? 0) + c.quantity;
    }
  }

  return {
    totalUnits,
    byStyle,
    distinctBeers: distinct.size,
    sessionsCount: own.length,
  };
}

/**
 * Ranking del grupo por cerveza: promedio de rating y número de ratings.
 * SOLO cuenta check-ins CON rating: uno sin calificar (rating null) no baja el
 * promedio ni suma al conteo. Una cerveza sin ningún rating no aparece aquí.
 * Ordena por promedio desc, luego por nº de ratings desc.
 */
export function beerRanking(
  checkIns: { beerId: string; rating: number | null }[],
): BeerRankingRow[] {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const c of checkIns) {
    if (c.rating == null) continue; // sin calificar → no cuenta
    const cur = acc.get(c.beerId) ?? { sum: 0, count: 0 };
    cur.sum += c.rating;
    cur.count += 1;
    acc.set(c.beerId, cur);
  }
  const rows: BeerRankingRow[] = [];
  for (const [beerId, { sum, count }] of acc) {
    rows.push({ beerId, avgRating: sum / count, ratingsCount: count });
  }
  return rows.sort(
    (a, b) => b.avgRating - a.avgRating || b.ratingsCount - a.ratingsCount,
  );
}

// ----------------------------------------------------------------------------
// Rating propio de una cerveza (G.3, detalle del catálogo).
// Invariante intacto: solo cuentan los check-ins PROPIOS del usuario.
// ----------------------------------------------------------------------------

export interface OwnBeerCheckIn {
  rating: number | null;
  date: Date | string; // fecha de la salida (día en que la tomó)
  createdAt: Date | string; // cuándo se registró (desempate)
}

export type OwnBeerRating =
  | { status: "never" } // nunca la ha probado
  | { status: "unrated" } // la tomó pero no la calificó
  | { status: "rated"; rating: number }; // la calificó → el rating MÁS RECIENTE

function toMs(d: Date | string): number {
  return (typeof d === "string" ? new Date(d) : d).getTime();
}

/**
 * Rating propio de una cerveza a partir de los check-ins PROPIOS del usuario para
 * esa cerveza. Si hay varios calificados con ratings distintos, devuelve el MÁS
 * RECIENTE (la opinión actual pesa más que la vieja), no el promedio.
 * Orden de "reciente": fecha de la salida desc, desempate por createdAt desc.
 */
export function ownBeerRating(ownCheckIns: OwnBeerCheckIn[]): OwnBeerRating {
  if (ownCheckIns.length === 0) return { status: "never" };
  const rated = ownCheckIns.filter((c) => c.rating != null);
  if (rated.length === 0) return { status: "unrated" };
  const mostRecent = rated.reduce((best, c) => {
    const byDate = toMs(c.date) - toMs(best.date);
    if (byDate > 0) return c;
    if (byDate === 0 && toMs(c.createdAt) > toMs(best.createdAt)) return c;
    return best;
  });
  return { status: "rated", rating: mostRecent.rating as number };
}

/**
 * Clave normalizada para el único compuesto case-insensitive de Beer.
 * Colapsa espacios internos, recorta y baja a minúsculas.
 */
export function normalizeKey(value: string): string {
  // Quita diacríticos (NFD + elimina marcas combinantes) para que la clave sea
  // insensible a acentos: "Águila", "aguila" y "AGUILA" comparten clave (G.2).
  // El nombre visible (Beer.name) NO cambia; solo la clave de búsqueda/único.
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isValidRating(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;
}

export function isValidQuantity(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1;
}

export function isBeerFormat(v: unknown): v is BeerFormat {
  return typeof v === "string" && (BEER_FORMATS as readonly string[]).includes(v);
}

// ----------------------------------------------------------------------------
// Consolidación de check-ins (misma cerveza + mismo formato en una salida).
// Un formato distinto (botella vs jarra) es un check-in aparte.
// ----------------------------------------------------------------------------

/**
 * Rating al fusionar: NUNCA se sobrescribe un rating ya puesto. Si el existente
 * es null, se toma el del nuevo. (Para cambiar un rating existente está
 * updateCheckIn.)
 */
export function mergeCheckInRating(
  existing: number | null,
  incoming: number | null,
): number | null {
  return existing != null ? existing : incoming;
}

export interface CheckInAddInput {
  beerId: string;
  format: BeerFormat;
  quantity: number;
  rating: number | null;
}

export interface ExistingCheckIn {
  id: string;
  beerId: string;
  format: BeerFormat;
  quantity: number;
  rating: number | null;
}

export type CheckInAddPlan =
  | { action: "merge"; targetId: string; quantity: number; rating: number | null }
  | { action: "create"; quantity: number; rating: number | null };

/**
 * Decide si un check-in nuevo se fusiona con uno existente (misma beerId Y
 * mismo format) o se crea aparte.
 */
export function planCheckInAdd(
  existing: ExistingCheckIn[],
  incoming: CheckInAddInput,
): CheckInAddPlan {
  const match = existing.find(
    (c) => c.beerId === incoming.beerId && c.format === incoming.format,
  );
  if (!match) {
    return { action: "create", quantity: incoming.quantity, rating: incoming.rating };
  }
  return {
    action: "merge",
    targetId: match.id,
    quantity: match.quantity + incoming.quantity,
    rating: mergeCheckInRating(match.rating, incoming.rating),
  };
}

/** Consolida una lista de check-ins nuevos (misma beerId+format se fusiona). */
export function consolidateNewCheckIns(
  items: CheckInAddInput[],
): CheckInAddInput[] {
  const out: CheckInAddInput[] = [];
  for (const it of items) {
    const match = out.find((c) => c.beerId === it.beerId && c.format === it.format);
    if (!match) {
      out.push({ ...it });
    } else {
      match.quantity += it.quantity;
      match.rating = mergeCheckInRating(match.rating, it.rating);
    }
  }
  return out;
}

/** Regla SessionTag: exactamente uno de taggedUserId | freeText. */
export function isValidTag(tag: {
  taggedUserId?: string | null;
  freeText?: string | null;
}): boolean {
  const hasUser = !!tag.taggedUserId;
  const hasText = !!(tag.freeText && tag.freeText.trim());
  return hasUser !== hasText; // XOR: exactamente uno
}

// ----------------------------------------------------------------------------
// Pasada B — mecánica social (racha, "quién falta", leaderboard por variedad).
//
// Regla de producto: hacer la app entretenida SIN incentivar tomar más. La racha
// mide DÍAS QUE REGISTRASTE, no frecuencia de salidas; no tomar NUNCA la rompe.
// Se calcula en cada lectura (NO cachear): cambia con el paso del tiempo.
// ----------------------------------------------------------------------------

/** Plazo para registrar tras que te etiqueten: 48 horas desde la medianoche UTC del día. */
export const REGISTRATION_PLAZO_MS = 48 * 60 * 60 * 1000;

/** Clave de día = medianoche UTC (ms). `Session.date` ya se guarda a medianoche UTC. */
export function dayKeyUTC(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * ÚNICA función de emparejamiento fecha↔usuario, compartida por la racha y el
 * contador "quién falta": ¿el usuario tiene salida PROPIA registrada ese día?
 * `registeredDays` = set de claves `${userId}|${dayKey}` de TODAS las salidas propias.
 */
export function hasOwnRegistration(
  registeredDays: Set<string>,
  userId: string,
  dayKey: number,
): boolean {
  return registeredDays.has(`${userId}|${dayKey}`);
}

/**
 * PIEZA 1 — Racha de registro. Recorre los días-evento del usuario (unión de días
 * con salida propia O etiqueta no descartada), del más reciente al más antiguo:
 *  - día con salida propia → +1 (una vez por día)
 *  - día solo etiquetado, dentro del plazo → pendiente: ni suma ni rompe
 *  - día solo etiquetado, vencido el plazo → rompe
 * Sin eventos que rompan (p.ej. sin salir y sin etiquetas) la racha se CONGELA.
 */
export function registrationStreak(args: {
  registeredDays: Set<string>;
  userId: string;
  eventDayKeys: number[];
  nowMs: number;
}): number {
  const keys = [...new Set(args.eventDayKeys)].sort((a, b) => b - a); // desc
  let streak = 0;
  for (const k of keys) {
    if (hasOwnRegistration(args.registeredDays, args.userId, k)) {
      streak += 1;
      continue;
    }
    // día SOLO etiquetado (sin salida propia ese día)
    if (args.nowMs < k + REGISTRATION_PLAZO_MS) continue; // pendiente
    break; // vencido → rompe
  }
  return streak;
}

export interface SessionRegistration {
  registered: number;
  total: number;
  /** Usuarios de la app que faltan por registrar y AÚN están dentro del plazo. */
  pending: string[];
  /** now >= deadlineMs ⇒ el plazo venció. */
  deadlineMs: number;
}

/**
 * PIEZA 2 — Contador "quién falta" (+ insumo del aviso). Reutiliza
 * hasOwnRegistration (misma implementación que la racha).
 * Denominador = dueño + usuarios de la app etiquetados y NO descartados (el texto
 * libre no cuenta). El dueño SIEMPRE cuenta como registrado.
 */
export function sessionRegistration(args: {
  registeredDays: Set<string>;
  ownerId: string;
  taggedUserIds: string[];
  sessionDayKey: number;
  nowMs: number;
}): SessionRegistration {
  const participants: string[] = [];
  const seen = new Set<string>();
  for (const id of [args.ownerId, ...args.taggedUserIds]) {
    if (!seen.has(id)) {
      seen.add(id);
      participants.push(id);
    }
  }
  const deadlineMs = args.sessionDayKey + REGISTRATION_PLAZO_MS;
  let registered = 0;
  const pending: string[] = [];
  for (const u of participants) {
    const reg = u === args.ownerId || hasOwnRegistration(args.registeredDays, u, args.sessionDayKey);
    if (reg) registered += 1;
    else if (args.nowMs < deadlineMs) pending.push(u); // falta, dentro del plazo
  }
  return { registered, total: participants.length, pending, deadlineMs };
}

/** Cervezas distintas (por beerId) de las salidas PROPIAS de un usuario. */
export function distinctBeersForUser(userId: string, sessions: SessionData[]): number {
  const set = new Set<string>();
  for (const s of sessions) {
    if (s.ownerId !== userId) continue;
    for (const c of s.checkIns) set.add(c.beerId);
  }
  return set.size;
}

export interface VarietyRow {
  userId: string;
  displayName: string;
  variety: number;
}

/**
 * PIEZA 3 — Leaderboard por VARIEDAD (cervezas distintas). Mismo invariante que
 * el de unidades: solo cuentan check-ins propios. Ordena por variedad desc y, a
 * igualdad, por displayName asc.
 */
export function leaderboardVariety(users: UserRef[], sessions: SessionData[]): VarietyRow[] {
  return users
    .map((u) => ({
      userId: u.id,
      displayName: u.displayName,
      variety: distinctBeersForUser(u.id, sessions),
    }))
    .sort((a, b) => b.variety - a.variety || a.displayName.localeCompare(b.displayName));
}

// ----------------------------------------------------------------------------
// Pasada C — el círculo.
//
// El círculo de un usuario son las personas con las que HA SALIDO. NO es una
// entidad: se deriva de las etiquetas que ya existen. Una arista por cada
// etiqueta a un usuario de la app (owner de la salida ↔ etiquetado).
// ----------------------------------------------------------------------------

/** Arista de círculo: el dueño de una salida etiquetó a un usuario de la app. */
export interface CircleTagEdge {
  ownerId: string; // Session.userId (dueño de la salida)
  taggedUserId: string; // usuario de la app etiquetado (el texto libre NO genera arista)
}

/**
 * Círculo de `userId`: el conjunto de usuarios con los que ha salido, derivado de
 * las etiquetas. **Simétrico**: si B etiqueta a A, cada uno entra al círculo del
 * otro (etiquetar afirma que salieron juntos). **NO transitivo**: amigos de amigos
 * no entran. El usuario SIEMPRE está en su propio círculo.
 *
 * Reglas de las aristas (responsabilidad del llamador al armarlas):
 *  - Solo etiquetas a usuarios de la app (el texto libre no cuenta: no tienen cuenta).
 *  - Las etiquetas descartadas (`dismissedAt`) SÍ cuentan: descartar es "no tomé",
 *    no "no estuve" — así que deben incluirse en `edges`.
 *
 * Una sola implementación, usada por feed, permisos y leaderboard.
 */
export function circleOf(userId: string, edges: CircleTagEdge[]): Set<string> {
  const circle = new Set<string>([userId]);
  for (const e of edges) {
    if (e.ownerId === userId) circle.add(e.taggedUserId); // A etiquetó a B
    else if (e.taggedUserId === userId) circle.add(e.ownerId); // B etiquetó a A (simétrico)
  }
  return circle;
}
