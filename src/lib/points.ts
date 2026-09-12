/**
 * Sistema de puntos (Pasada PT) — lógica pura, sin servidor. La escala y los topes del
 * tablero "Los Puntos", codificados y testeados. El motor que escribe (con topes por salida
 * y por día, idempotente) vive en award-points.ts; aquí solo el catálogo y los helpers puros.
 *
 * Las tres reglas (no negociables): nada resta nunca; tomar más no rinde más (el techo de 40);
 * paga el registro, no la visita.
 */

export type PointAction =
  | "session" // registrar una salida
  | "round" // jugar una ronda de ruleta (por participante)
  | "challenge" // cumplir un reto
  | "photo" // subir una foto
  | "first_time" // probar algo nunca registrado
  | "rate" // calificar una bebida
  | "drink" // registrar una bebida
  | "comment" // comentar
  | "toast"; // brindar

export const POINT_VALUES: Record<PointAction, number> = {
  session: 50,
  round: 20,
  challenge: 10,
  photo: 15,
  first_time: 10,
  rate: 8,
  drink: 2,
  comment: 3,
  toast: 1,
};

/** Techo compartido por salida de todo lo que depende de bebidas. NUNCA se nombra (§3). */
export const DRINK_TECHO = 40;
/** Acciones bajo el techo de 40 por salida. */
export const DRINK_TECHO_ACTIONS: readonly PointAction[] = ["first_time", "rate", "drink"];
/** Acciones sociales: se acumulan en silencio y van en UNA línea de la cuenta. */
export const SOCIAL_ACTIONS: readonly PointAction[] = ["comment", "toast"];

/** Tope de CANTIDAD por salida (nº de veces que la acción paga en una salida). */
export const PER_SALIDA_COUNT_CAP: Partial<Record<PointAction, number>> = {
  round: 3, // 3 rondas · 60
  photo: 3, // 3 fotos · 45
  challenge: 3, // 3 retos · 30
};

/** Tope de CANTIDAD por día (por usuario). */
export const PER_DAY_COUNT_CAP: Partial<Record<PointAction, number>> = {
  comment: 5, // 5 al día · 15
  toast: 10, // 10 al día · 10
};

export const isDrinkTechoAction = (a: string): boolean => DRINK_TECHO_ACTIONS.includes(a as PointAction);
export const isSocialAction = (a: string): boolean => SOCIAL_ACTIONS.includes(a as PointAction);

// El parche corre en Colombia (America/Bogota, UTC-5 sin horario de verano). Los topes por
// día se cuentan en día de Bogotá, no UTC, para que "5 comentarios al día" sea el día real.
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Rango [start, end) en UTC que corresponde al día de Bogotá de `at`. Para topes por día. */
export function bogotaDayRange(at: Date): { start: Date; end: Date } {
  const b = new Date(at.getTime() - BOGOTA_OFFSET_MS);
  const startUTC = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()) + BOGOTA_OFFSET_MS;
  return { start: new Date(startUTC), end: new Date(startUTC + 24 * 60 * 60 * 1000) };
}

// ---- La cuenta: agrupar entradas en líneas del recibo ----

export interface CuentaLine {
  key: string;
  label: string;
  points: number;
}

/**
 * Convierte entradas (acción + puntos) en las líneas del recibo. Reglas del tablero:
 *  - Las bebidas (registrar/calificar/primera vez) van en UNA sola línea "Bebidas" con su
 *    total — el techo NO se nombra jamás (§3): quien lo tope verá el mismo +40 sin saber por qué.
 *  - Lo social (brindis/comentarios) va en UNA línea "Brindis y comentarios".
 *  - El resto (salida, ruleta, reto, fotos) va en su propia línea.
 * Orden fijo, narrativo (la salida primero, lo social al final).
 */
export function buildCuentaLines(entries: readonly { action: string; points: number }[]): CuentaLine[] {
  let bebidas = 0;
  let social = 0;
  const singles: Partial<Record<PointAction, number>> = {};
  for (const e of entries) {
    if (isDrinkTechoAction(e.action)) bebidas += e.points;
    else if (isSocialAction(e.action)) social += e.points;
    else singles[e.action as PointAction] = (singles[e.action as PointAction] ?? 0) + e.points;
  }
  const lines: CuentaLine[] = [];
  const push = (key: string, label: string, points: number) => { if (points > 0) lines.push({ key, label, points }); };
  push("session", "Registraste la salida", singles.session ?? 0);
  push("round", "Jugaste la ruleta", singles.round ?? 0);
  push("challenge", "Cumpliste un reto", singles.challenge ?? 0);
  const photo = singles.photo ?? 0;
  push("photo", photo === POINT_VALUES.photo ? "Subiste una foto" : "Subiste fotos", photo);
  push("bebidas", "Bebidas", bebidas);
  push("social", "Brindis y comentarios", social);
  return lines;
}
