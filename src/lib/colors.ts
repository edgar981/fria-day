/**
 * La cascada de color de la share-card (Pasada SC) — lógica pura, sin dependencias.
 *
 * Tres niveles, todos leídos del ÚLTIMO check-in de la salida (decisión del tablero):
 *   1. color de MARCA (el del empaque, `Beer.color`) — "el verde de la Costeñita es SU verde".
 *   2. color de la FOTO (`SessionPhoto.color`) — el tono dominante ya ajustado a la rueda de 12.
 *   3. la HORA — la franja horaria del último check-in; sin ventana real, `#N mod 5`.
 *
 * Las parejas color/tinta están FIJADAS (no se calculan en render). La tinta sale de la regla
 * de contraste (L* ≥ 45 → oscura del mismo matiz; < 45 → crema), todas ≥ 4,5:1. Para un color
 * fuera de las tablas (no debería pasar) se calcula por la misma regla como respaldo.
 */

export interface ColorPair {
  hex: string;
  ink: string;
}

/** La rueda de doce (5 de la hora + 7 intermedios). Aprobada por Edgar. */
export const WHEEL: readonly ColorPair[] = [
  { hex: "#F2A016", ink: "#3A1E00" }, // 7a–8p · ámbar
  { hex: "#FF6B35", ink: "#38120A" }, // 8–10p · brasa
  { hex: "#3E8F6B", ink: "#041913" }, // 10p–12 · verde noche
  { hex: "#3A6FD8", ink: "#FBFCFF" }, // 12–2a · azul
  { hex: "#7A4DD6", ink: "#F2ECFF" }, // 2–7a · violeta
  { hex: "#CE2F2F", ink: "#F7F3F3" }, // rojo
  { hex: "#D15C86", ink: "#350F1C" }, // rosa
  { hex: "#A93FB0", ink: "#F7F3F7" }, // magenta
  { hex: "#5B54C8", ink: "#F3F3F7" }, // índigo
  { hex: "#37ADCB", ink: "#123B46" }, // cian
  { hex: "#33A896", ink: "#103530" }, // teal
  { hex: "#84B23A", ink: "#2F3F15" }, // lima
];

/** Las 5 franjas horarias (un subconjunto de la rueda). Cubren 24h sin hueco (hora de Bogotá). */
const HOUR_BANDS: readonly { from: number; to: number; pair: ColorPair }[] = [
  { from: 7, to: 20, pair: WHEEL[0] }, // 7 a.m. – 8 p.m.
  { from: 20, to: 22, pair: WHEEL[1] }, // 8 – 10 p.m.
  { from: 22, to: 24, pair: WHEEL[2] }, // 10 p.m. – 12
  { from: 0, to: 2, pair: WHEEL[3] }, // 12 – 2 a.m.
  { from: 2, to: 7, pair: WHEEL[4] }, // 2 – 7 a.m.
];
/** El respaldo `#N mod 5` recorre las 5 de la hora. */
const HOUR_PAIRS: readonly ColorPair[] = [WHEEL[0], WHEEL[1], WHEEL[2], WHEEL[3], WHEEL[4]];

/**
 * Mapa de marca → color de empaque (nivel 1), sembrado del turno 4. Con el cambio de Edgar
 * (Águila azul) y el asterisco ya aplicado (las oscuras usan su dorado secundario). 3 Cord.
 * Negra subida de #9A6B3A a #B5863F para pasar 4,5:1 (el original no pasaba). La clave es el
 * FRAGMENTO en minúscula que debe aparecer en el nombre de la bebida.
 */
export const BRAND_SEED: readonly { key: string; hex: string }[] = [
  { key: "póker", hex: "#F2C21A" }, { key: "poker", hex: "#F2C21A" },
  { key: "costeñita", hex: "#1E7A4B" }, { key: "costeña", hex: "#1E7A4B" },
  { key: "águila", hex: "#3A6FD8" }, { key: "aguila", hex: "#3A6FD8" },
  { key: "club colombia dorada", hex: "#E0A526" }, { key: "club colombia roja", hex: "#B0312C" }, { key: "club colombia negra", hex: "#C8A04A" },
  { key: "pilsen", hex: "#C4161C" },
  { key: "chapinero porter", hex: "#8A5A2E" }, { key: "cajicá honey", hex: "#D79A2B" }, { key: "cajica honey", hex: "#D79A2B" },
  { key: "monserrate", hex: "#A33A28" }, { key: "chía weiss", hex: "#E6C55A" }, { key: "chia weiss", hex: "#E6C55A" }, { key: "candelaria", hex: "#C9922E" },
  { key: "mestiza", hex: "#C87A2A" }, { key: "rosada", hex: "#D96A8E" }, { key: "blanca", hex: "#E8DCC0" }, { key: "negra", hex: "#B5863F" }, { key: "mulata", hex: "#7A4A2A" },
  { key: "corona", hex: "#F5D34B" }, { key: "heineken", hex: "#1E7A3C" }, { key: "stella", hex: "#C8102E" }, { key: "modelo", hex: "#D9B44A" }, { key: "guinness", hex: "#C8A04A" },
];

/** El color de marca sembrado para un nombre de bebida, o null (→ cascada al nivel 2, estilo). */
export function brandColorFor(beerName: string): string | null {
  const n = beerName.toLowerCase();
  for (const b of BRAND_SEED) if (n.includes(b.key)) return b.hex;
  return null;
}

const stripAccents = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Mapa ESTILO → tono de la rueda (Pasada SC.1 · nivel 2). Reemplaza al selector: el color se
 * deriva del estilo, dato que el catálogo ya quiere. Por palabra clave (sin acentos, substring),
 * ORDENADO por especificidad: "lager negra" cae en oscura antes que "lager" en dorada. La rueda
 * no tiene negro/café → las oscuras usan índigo (decisión de Edgar). Un estilo fuera del mapa (o
 * vacío, como los cócteles) → null → la cascada baja al nivel 3 (la foto).
 */
const STYLE_MAP: readonly [string, string][] = [
  ["negra", "#5B54C8"], ["stout", "#5B54C8"], ["porter", "#5B54C8"], ["oscura", "#5B54C8"], ["black", "#5B54C8"],
  ["roja", "#CE2F2F"], ["red", "#CE2F2F"],
  ["sour", "#D15C86"], ["rose", "#D15C86"], ["rosad", "#D15C86"], ["fruit", "#D15C86"], ["frut", "#D15C86"],
  ["ipa", "#FF6B35"], ["pale ale", "#FF6B35"], ["apa", "#FF6B35"], ["amber", "#FF6B35"], ["ambar", "#FF6B35"], ["saison", "#FF6B35"], ["strong", "#FF6B35"],
  ["pilsn", "#F2A016"], ["pilsen", "#F2A016"], ["lager", "#F2A016"], ["blonde", "#F2A016"], ["golden", "#F2A016"], ["dorada", "#F2A016"], ["rubia", "#F2A016"], ["honey", "#F2A016"], ["miel", "#F2A016"],
  ["weiss", "#F2A016"], ["wit", "#F2A016"], ["trigo", "#F2A016"], ["wheat", "#F2A016"], ["blanca", "#F2A016"], ["sin alcohol", "#F2A016"],
];

/** El tono de la rueda para un estilo de cerveza, o null (→ cascada al nivel 3). */
export function styleColorFor(style: string | null | undefined): string | null {
  if (!style || !style.trim()) return null;
  const n = stripAccents(style);
  for (const [k, hex] of STYLE_MAP) if (n.includes(stripAccents(k))) return hex;
  return null;
}

// ---- Color helpers (para snapping y la tinta de respaldo) ----

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function rgbToHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("").toUpperCase();
}
const linChan = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
function relLuminance(rgb: number[]): number { const [r, g, b] = rgb.map(linChan); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(hexToRgb(a)), lb = relLuminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function labLstar(hex: string): number { const Y = relLuminance(hexToRgb(hex)); const f = (t: number) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29); return 116 * f(Y) - 16; }
export function rgbToHsl([r, g, b]: number[]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}
function hslToHex(h: number, s: number, l: number): string {
  h = ((((h % 360) + 360) % 360)) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return rgbToHex([hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map((x) => x * 255));
}

// Tabla hex→tinta (rueda + marcas), calculada UNA vez. Para el respaldo, la misma regla.
function computeInk(hex: string): string {
  const [h, s] = rgbToHsl(hexToRgb(hex));
  const L = labLstar(hex);
  let dark: string | null = null;
  for (let l = 0.42; l >= 0.04; l -= 0.004) { const ink = hslToHex(h, Math.min(s, 0.85), l); if (contrastRatio(hex, ink) >= 4.5) { dark = ink; break; } }
  let cream: string | null = null;
  for (const [l, sat] of [[0.96, 0.2], [0.98, 0.12], [0.995, 0.05]] as const) { const ink = hslToHex(h, sat, l); if (contrastRatio(hex, ink) >= 4.5) { cream = ink; break; } }
  return (L >= 45 ? dark ?? cream : cream ?? dark) ?? "#0A0906";
}
const INK_BY_HEX = new Map<string, string>();
for (const p of WHEEL) INK_BY_HEX.set(p.hex.toUpperCase(), p.ink);
for (const b of BRAND_SEED) if (!INK_BY_HEX.has(b.hex.toUpperCase())) INK_BY_HEX.set(b.hex.toUpperCase(), computeInk(b.hex));

/** La tinta de un color de fondo: fijada si es de la rueda o una marca; si no, por la regla. */
export function inkFor(hex: string): string {
  return INK_BY_HEX.get(hex.toUpperCase()) ?? computeInk(hex);
}

const hueDist = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/**
 * Ajusta un color extraído (nivel 2) al más cercano de la rueda POR MATIZ. Devuelve null si el
 * tono es demasiado gris/apagado para tener matiz confiable (→ la cascada baja al nivel 3).
 */
export function snapToWheel(hex: string): string | null {
  const [h, s] = rgbToHsl(hexToRgb(hex));
  if (s < 0.12) return null; // casi gris: sin matiz confiable
  let best = WHEEL[0].hex, bestD = Infinity;
  for (const p of WHEEL) { const d = hueDist(h, rgbToHsl(hexToRgb(p.hex))[0]); if (d < bestD) { bestD = d; best = p.hex; } }
  return best;
}

/**
 * Vota el tono dominante de una imagen (nivel 2) sobre la rueda: cada píxel con saturación y luz
 * suficientes suma a la casilla más cercana en matiz; gana la más votada. null si casi no hay
 * color (foto gris → la cascada baja al nivel 3). Puro: recibe los RGB muestreados.
 */
export function dominantWheel(rgbs: Iterable<readonly [number, number, number]>): string | null {
  const wheelHues = WHEEL.map((p) => rgbToHsl(hexToRgb(p.hex))[0]);
  const votes = new Array(WHEEL.length).fill(0);
  let counted = 0;
  for (const [r, g, b] of rgbs) {
    const [h, s, l] = rgbToHsl([r, g, b]);
    if (s < 0.18 || l < 0.12 || l > 0.9) continue;
    let best = 0, bestD = Infinity;
    for (let k = 0; k < wheelHues.length; k++) { const d = Math.abs(h - wheelHues[k]); const dd = d > 180 ? 360 - d : d; if (dd < bestD) { bestD = dd; best = k; } }
    votes[best]++; counted++;
  }
  if (counted < 40) return null;
  let win = 0;
  for (let k = 1; k < votes.length; k++) if (votes[k] > votes[win]) win = k;
  return WHEEL[win].hex;
}

/** Hora de Bogotá (UTC-5, sin horario de verano) de un instante. */
function bogotaHour(at: Date): number { return (((at.getUTCHours() - 5) % 24) + 24) % 24; }

/** Nivel 3: la franja horaria del último check-in. */
export function hourColor(at: Date): ColorPair {
  const hr = bogotaHour(at);
  for (const band of HOUR_BANDS) { if (band.from < band.to ? hr >= band.from && hr < band.to : hr >= band.from || hr < band.to) return band.pair; }
  return WHEEL[0];
}

/**
 * La cascada completa (SC.1, CUATRO niveles): marca → estilo → foto → hora (→ `#N mod 5` sin
 * ventana real). Todo del último check-in. Devuelve el par color/tinta que pinta la tarjeta.
 */
export function resolveCardColor(input: {
  brandColor?: string | null;
  styleColor?: string | null;
  photoColor?: string | null;
  lastCheckInAt?: Date | null;
  hasRealWindow?: boolean;
  outingNumber: number;
}): ColorPair {
  if (input.brandColor) return { hex: input.brandColor, ink: inkFor(input.brandColor) };
  if (input.styleColor) return { hex: input.styleColor, ink: inkFor(input.styleColor) };
  if (input.photoColor) return { hex: input.photoColor, ink: inkFor(input.photoColor) };
  if (input.hasRealWindow && input.lastCheckInAt) return hourColor(input.lastCheckInAt);
  return HOUR_PAIRS[((input.outingNumber % 5) + 5) % 5]; // respaldo #N mod 5
}
