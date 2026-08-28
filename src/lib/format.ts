import type { BeerFormat } from "@/lib/domain";

export const FORMAT_LABEL: Record<BeerFormat, string> = {
  BOTELLA: "Botella",
  LATA: "Lata",
  JARRA: "Jarra",
  PINTA: "Pinta",
};

export const FORMAT_EMOJI: Record<BeerFormat, string> = {
  BOTELLA: "🍾",
  LATA: "🥫",
  JARRA: "🍺",
  PINTA: "🍺",
};

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
