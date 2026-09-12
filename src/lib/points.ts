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

// ---- Hitos (§9) ----
// Del tablero "Los Puntos". ⚠️ VALORES PROVISIONALES: el tablero tiene los reales (y quizá
// nombres); Edgar los cura. Progresión pensada para el ethos (una salida ≈ 50-90 pts, así que
// los saltos crecen). Se persiguen en SALIDAS, no en puntos (§6, §9).
export const HITOS: readonly number[] = [250, 500, 1000, 2000, 3500, 5000, 7500, 10000, 15000, 20000, 30000, 50000];

/** El próximo hito por encima del total, o null si ya pasó el último. */
export function nextHito(total: number): number | null {
  return HITOS.find((h) => h > total) ?? null;
}

const UNIDADES = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];
/** "Dos salidas más" / "1 salida más" (§6): el próximo hito expresado en salidas. `ritmo` = pts/salida. */
export function hitoEnSalidas(total: number, ritmo: number): string | null {
  const hito = nextHito(total);
  if (hito == null || ritmo <= 0) return null;
  const faltan = Math.max(1, Math.ceil((hito - total) / ritmo));
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
 * La frase que cierra el desglose y resume la ética (§8): "N bebidas dieron X puntos. M salidas
 * dieron Y. La app te paga por salir, no por tomar." bebidas = grupo de bebidas (registrar +
 * calificar + primera vez), salidas = registrar salida, coherente con las líneas de arriba.
 */
export function desgloseEthos(bebidasCount: number, bebidasPoints: number, salidasCount: number, salidasPoints: number): string {
  const b = bebidasCount === 1 ? "bebida dio" : "bebidas dieron";
  const s = salidasCount === 1 ? "salida dio" : "salidas dieron";
  return `${nf(bebidasCount)} ${b} ${nf(bebidasPoints)} puntos. ${nf(salidasCount)} ${s} ${nf(salidasPoints)}. La app te paga por salir, no por tomar.`;
}
