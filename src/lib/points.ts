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

// ---- Hitos (§9) — "sin temporadas, los hitos son el calendario" ----
// Del tablero "Los Puntos": SIETE hitos nombrados y luego uno cada 5.000. Los primeros caben en
// el primer mes de cualquiera; los últimos tardan años a propósito. `big` = merece la tarjeta a
// pantalla completa (se comparte); los chicos solo dejan una línea al pie de la cuenta.
export interface Hito { points: number; name: string; big: boolean }

const NAMED_HITOS: Hito[] = [
  { points: 100, name: "La primera marca", big: false },
  { points: 250, name: "Habitual", big: false },
  { points: 500, name: "De la casa", big: false },
  { points: 1000, name: "Los mil", big: true },
  { points: 2500, name: "Veterano", big: false },
  { points: 5000, name: "Los cinco mil", big: true },
  { points: 10000, name: "Los diez mil", big: true },
];
const HITO_STEP = 5000; // después de 10.000, uno cada 5.000 (todos con tarjeta)
const HITO_CEIL = 500000;

function buildHitos(): Hito[] {
  const list = [...NAMED_HITOS];
  for (let p = 15000; p <= HITO_CEIL; p += HITO_STEP) list.push({ points: p, name: p.toLocaleString("es-CO"), big: true });
  return list;
}
export const HITOS: readonly Hito[] = buildHitos();

/** El próximo hito por encima del total (null si se pasó el techo enumerado). */
export function nextHitoObj(total: number): Hito | null {
  return HITOS.find((h) => h.points > total) ?? null;
}
/** Puntos del hito alcanzado más alto (0 si ninguno) — para la barra de progreso del próximo. */
export function lastHitoPoints(total: number): number {
  let last = 0;
  for (const h of HITOS) {
    if (h.points <= total) last = h.points;
    else break;
  }
  return last;
}
/** Hitos ya alcanzados (≤ total), en orden — los chips del perfil (§9, el único historial). */
export function hitosReached(total: number): Hito[] {
  return HITOS.filter((h) => h.points <= total);
}
/** Hitos cruzados al ganar puntos, en (before, after] — la línea al pie de la cuenta. */
export function hitosCrossed(before: number, after: number): Hito[] {
  return HITOS.filter((h) => h.points > before && h.points <= after);
}

const UNIDADES = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];
/** "Dos salidas más" / "1 salida más" (§6): el próximo hito expresado en salidas. `ritmo` = pts/salida. */
export function hitoEnSalidas(total: number, ritmo: number): string | null {
  const hito = nextHitoObj(total);
  if (hito == null || ritmo <= 0) return null;
  const faltan = Math.max(1, Math.ceil((hito.points - total) / ritmo));
  const palabra = faltan <= 12 ? UNIDADES[faltan] : String(faltan);
  return `${palabra.charAt(0).toUpperCase()}${palabra.slice(1)} salida${faltan === 1 ? "" : "s"} más`;
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

// ---- El desglose "De dónde salieron" (§8) ----

export interface DesgloseLine { key: string; label: string; points: number }

/** Suma por acción → líneas del desglose, de MAYOR a MENOR (§8). Bebidas y social colapsadas. */
export function buildDesglose(byAction: Partial<Record<PointAction, number>>): DesgloseLine[] {
  const bebidas = (byAction.first_time ?? 0) + (byAction.rate ?? 0) + (byAction.drink ?? 0);
  const social = (byAction.comment ?? 0) + (byAction.toast ?? 0);
  const lines: DesgloseLine[] = [];
  const add = (key: string, label: string, points: number) => { if (points > 0) lines.push({ key, label, points }); };
  add("session", "Salidas", byAction.session ?? 0);
  add("round", "Ruleta", byAction.round ?? 0);
  add("challenge", "Retos", byAction.challenge ?? 0);
  add("photo", "Fotos", byAction.photo ?? 0);
  add("bebidas", "Bebidas", bebidas);
  add("social", "Brindis y comentarios", social);
  return lines.sort((a, b) => b.points - a.points);
}

const nf = (n: number) => n.toLocaleString("es-CO");

/**
 * La frase que cierra el desglose (§8): SOLO los números, el contraste se ve sin moraleja (regla de
 * la Pasada T). "N bebidas: X puntos. M salidas: Y." bebidas = grupo de bebidas (registrar +
 * calificar + primera vez), salidas = registrar salida, coherente con las líneas de arriba. (PT.1:
 * se quitó "La app te paga por salir, no por tomar" — "pagar" en la app es dinero, ver los retos.)
 */
export function desgloseEthos(bebidasCount: number, bebidasPoints: number, salidasCount: number, salidasPoints: number): string {
  const b = bebidasCount === 1 ? "bebida" : "bebidas";
  const s = salidasCount === 1 ? "salida" : "salidas";
  return `${nf(bebidasCount)} ${b}: ${nf(bebidasPoints)} puntos. ${nf(salidasCount)} ${s}: ${nf(salidasPoints)}.`;
}
