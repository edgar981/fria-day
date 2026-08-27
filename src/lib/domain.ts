// Lógica de dominio PURA (sin Prisma, sin I/O) — testeable en aislamiento.
//
// Regla no negociable #1: "Etiquetar no acredita cervezas".
//   Los totales de un usuario suben SOLO con sus propios check-ins, es decir,
//   check-ins de sesiones cuyo dueño (ownerId) es ese usuario. Ser etiquetado
//   (SessionTag) en la sesión de otro NUNCA suma al leaderboard ni a las métricas.

export const BEER_FORMATS = ["BOTELLA", "LATA", "JARRA", "PINTA"] as const;
export type BeerFormat = (typeof BEER_FORMATS)[number];

export interface CheckInData {
  beerId: string;
  /** Estilo de la cerveza del check-in (para agregación por estilo). */
  beerStyle?: string | null;
  quantity: number;
  format: BeerFormat;
  rating: number;
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
 * Agrega TODOS los check-ins recibidos (el ranking de una cerveza sí considera
 * las valoraciones de todos, porque valorar es sobre la cerveza, no sobre el
 * total del usuario). Ordena por promedio desc, luego por nº de ratings desc.
 */
export function beerRanking(
  checkIns: { beerId: string; rating: number }[],
): BeerRankingRow[] {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const c of checkIns) {
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

/**
 * Clave normalizada para el único compuesto case-insensitive de Beer.
 * Colapsa espacios internos, recorta y baja a minúsculas.
 */
export function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
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

/** Regla SessionTag: exactamente uno de taggedUserId | freeText. */
export function isValidTag(tag: {
  taggedUserId?: string | null;
  freeText?: string | null;
}): boolean {
  const hasUser = !!tag.taggedUserId;
  const hasText = !!(tag.freeText && tag.freeText.trim());
  return hasUser !== hasText; // XOR: exactamente uno
}
