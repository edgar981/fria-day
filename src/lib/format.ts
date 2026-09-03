import type { BeerFormat, FormatCount } from "@/lib/domain";

export const FORMAT_LABEL: Record<BeerFormat, string> = {
  BOTELLA: "Botella",
  LATA: "Lata",
  JARRA: "Jarra",
  PINTA: "Pinta",
  COPA: "Copa",
  VASO: "Vaso",
  JARRA_COMPARTIDA: "Jarra compartida",
};

export const FORMAT_EMOJI: Record<BeerFormat, string> = {
  BOTELLA: "🍾",
  LATA: "🥫",
  JARRA: "🍺",
  PINTA: "🍺",
  COPA: "🍸",
  VASO: "🥃",
  JARRA_COMPARTIDA: "🍹",
};

// Sustantivo en minúscula [singular, plural] para el desglose por formato (Pasada D).
const FORMAT_NOUN: Record<BeerFormat, [string, string]> = {
  BOTELLA: ["botella", "botellas"],
  LATA: ["lata", "latas"],
  JARRA: ["jarra", "jarras"],
  PINTA: ["pinta", "pintas"],
  COPA: ["copa", "copas"],
  VASO: ["vaso", "vasos"],
  JARRA_COMPARTIDA: ["jarra compartida", "jarras compartidas"],
};

/** "7 botellas · 4 jarras" — textura del total sin inventar conversiones (Pasada D). */
export function formatBreakdownText(breakdown: FormatCount[]): string {
  return breakdown
    .map((b) => `${b.count} ${FORMAT_NOUN[b.format][b.count === 1 ? 0 : 1]}`)
    .join(" · ");
}

/** Solo el sustantivo, concordado con la cantidad ("botella"/"botellas"). Para la
 *  fila de métricas de la tarjeta (Pasada N), donde el número va aparte, grande. */
export function formatNoun(format: BeerFormat, count: number): string {
  return FORMAT_NOUN[format][count === 1 ? 0 : 1];
}

/** "N bebida(s)" — el conteo cuenta registros de consumo, no volumen (Pasada D). */
export function bebidasLabel(n: number): string {
  return `${n} bebida${n !== 1 ? "s" : ""}`;
}

/**
 * Une metadatos con " · " saltando los vacíos. Clave para cócteles (Pasada D): sin
 * cervecería no debe quedar un " · " colgando ni un punto al inicio.
 */
export function joinMeta(...parts: (string | null | undefined)[]): string {
  return parts.filter((p) => p != null && p !== "").join(" · ");
}

/**
 * La fecha de la sesión representa un día de calendario. Se guarda como
 * medianoche UTC del día elegido y se formatea en UTC para mostrar SIEMPRE el
 * mismo día, sin importar la zona horaria del que mira.
 */
export function toStoredDay(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayInputValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const dayFmt = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDay(date: Date): string {
  return dayFmt.format(date);
}

/**
 * Tiempo relativo compacto para comentarios (I-3): "ahora" / "hace N min" / "hace N h",
 * y a partir de un día cae en relativeDay ("ayer" / "hace N días" / la fecha). `nowMs`
 * inyectable para tests. El "cuándo" de un comentario suele ser del mismo día, así que
 * relativeDay solo ("hoy") no informaba.
 */
export function relativeTime(date: Date, nowMs: number = Date.now()): string {
  const min = Math.floor((nowMs - date.getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return relativeDay(date);
}

/** "hoy" / "ayer" / "hace N días" o la fecha, comparando por día UTC. */
export function relativeDay(date: Date): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfUTCDay = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const diff = Math.round((startOfUTCDay(new Date()) - startOfUTCDay(date)) / dayMs);
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  if (diff > 1 && diff < 7) return `hace ${diff} días`;
  return formatDay(date);
}

/**
 * Copy del plazo de la racha (Pasada B): nombre del día mientras falten más de
 * 24h ("hasta mañana"), horas restantes cuando falten menos ("quedan 9 h").
 */
const weekdayFmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", timeZone: "UTC" });
export function avisoPlazo(deadlineMs: number, nowMs: number): string {
  const hoursLeft = (deadlineMs - nowMs) / 3_600_000;
  if (hoursLeft <= 0) return "";
  if (hoursLeft < 24) return `quedan ${Math.ceil(hoursLeft)} h`;
  const dayMs = 24 * 60 * 60 * 1000;
  const startUTC = (ms: number) => {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  };
  const diff = Math.round((startUTC(deadlineMs) - startUTC(nowMs)) / dayMs);
  if (diff <= 0) return "hasta hoy";
  if (diff === 1) return "hasta mañana";
  return `hasta el ${weekdayFmt.format(new Date(deadlineMs))}`;
}

/** Lista natural en español: "A", "A y B", "A, B y C". */
function naturalList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/**
 * Aviso "quién falta" bien conjugado (B.1 · item 2):
 *   1 y soy yo → "Faltas tú" · 1 y es otro → "Falta Caro"
 *   varios → "Faltan tú y Caro" / "Faltan Edgar, Caro y Dani" (yo primero).
 */
export function pendingLabel(
  pending: { id: string; displayName: string }[],
  viewerId: string,
): string {
  if (pending.length === 0) return "";
  const names = pending
    .map((p) => (p.id === viewerId ? "tú" : p.displayName))
    .sort((a, b) => (a === "tú" ? -1 : b === "tú" ? 1 : 0));
  if (pending.length === 1) return names[0] === "tú" ? "Faltas tú" : `Falta ${names[0]}`;
  return `Faltan ${naturalList(names)}`;
}

export function formatAbv(abv: unknown): string | null {
  if (abv == null) return null;
  const n = typeof abv === "number" ? abv : Number(abv.toString());
  if (Number.isNaN(n)) return null;
  return `${n.toFixed(1)}%`;
}

// ---- Share-card v2 (Pasada S.2) ----

const wdLongFmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", timeZone: "UTC" });
const monthLongFmt = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "UTC" });

/**
 * Fecha larga para la share-card: "Viernes 28 de agosto" (sin año, día de calendario
 * en UTC como el resto de fechas de sesión). La v1 usaba formatDay ("vie., 28 ago.").
 */
export function formatDayLong(date: Date): string {
  const wd = wdLongFmt.format(date);
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${date.getUTCDate()} de ${monthLongFmt.format(date)}`;
}

// La ventana horaria de la noche se lee en hora de Colombia (UTC-5, sin horario de
// verano): así "8:30 pm – 1:15 am" refleja la noche real aunque el server corra en UTC.
const clockFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Bogota",
});
function clockLabel(d: Date): string {
  const parts = clockFmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;
}

/** "8:30 pm – 1:15 am": la ventana real de la salida (min→max de createdAt). */
export function formatTimeWindow(start: Date, end: Date): string {
  return `${clockLabel(start)} – ${clockLabel(end)}`;
}

/**
 * El parche en la share-card: hasta 3 nombres tal cual ("Caro, Edgar y Vale"); con
 * más, dos nombres y el resto resumido ("Vale, Edgar y 2 más"). Sin el dueño (va como
 * primer avatar). Vacío = salida en solitario (no se dibuja la línea "con …").
 */
export function companionsLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= 3) return naturalList(names);
  return `${names.slice(0, 2).join(", ")} y ${names.length - 2} más`;
}

// Slug ASCII: sin acentos, minúsculas, separadores → "-", sin guiones colgantes.
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const monthShortFmt = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" });

/**
 * Nombre de archivo legible del share-card (S.3 §2): lo primero que ve quien recibe la
 * imagen. "friaday-bar-de-la-85-26-ago.png" (lugar + fecha) o "friaday-26-ago.png" sin
 * lugar. Día UTC (como el resto de fechas de sesión).
 */
export function shareFileName(place: string | null | undefined, date: Date): string {
  const dateSlug = `${date.getUTCDate()}-${slugify(monthShortFmt.format(date))}`;
  const placeSlug = place ? slugify(place) : "";
  return `friaday-${[placeSlug, dateSlug].filter(Boolean).join("-")}.png`;
}
