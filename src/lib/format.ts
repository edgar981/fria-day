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

export function formatAbv(abv: unknown): string | null {
  if (abv == null) return null;
  const n = typeof abv === "number" ? abv : Number(abv.toString());
  if (Number.isNaN(n)) return null;
  return `${n.toFixed(1)}%`;
}
