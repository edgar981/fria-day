/* eslint-disable @next/next/no-img-element */
import type { ReactElement, ReactNode } from "react";
import { recorrido } from "@/lib/domain";
import { companionsLabel } from "@/lib/format";
import type { AvatarImg } from "./avatars";

/**
 * Plantilla de la share-card v3 (Pasada SC · Tanda 2): el REGISTRO de una noche pintado con
 * el COLOR de la cascada (marca → estilo → foto → hora), tipografía Big Shoulders Display
 * (mayúsculas, "el registro de la carta impresa"). Tres estados por DATO:
 *   · con foto  → fondo oscuro + banda de color arriba + la foto + el recorrido + métricas.
 *   · sin foto (varias bebidas / rica) → mismo fondo oscuro + banda de color + recorrido + la
 *     mejor de la noche + métricas.
 *   · una sola bebida sin foto (incluye el "caso pobre" retroactivo) → fondo A TODO COLOR,
 *     tinta emparejada, el nombre gigante y un pie invertido (fondo = tinta) con las métricas.
 * El color/tinta llega resuelto desde la ruta (`resolveCardColor`); la tarjeta no calcula la
 * cascada, solo deriva tonos de apoyo (acento suave, barra apagada, pie) del par color/tinta.
 *
 * Se renderiza con satori (next/og): SOLO flex, sin grid, sin emoji, avatares inlineados como
 * data-URI, fuentes embebidas (Big Shoulders 700/800 estáticas — satori no interpola variables).
 * NUNCA la cantidad de alcohol como logro (restricción de la Pasada S).
 */

export interface ShareData {
  place: string | null;
  dateLabel: string; // "Sábado 6 de septiembre"
  ownerName: string;
  avatars: AvatarImg[]; // el parche: dueño primero, cortado a 3
  companions: string[]; // nombres SIN el dueño
  total: number; // bebidas (suma de cantidades)
  duration: { value: string; window: string } | null; // null = retroactiva (sin ventana)
  outing: number; // salida #N del dueño
  firstTime: string | null; // "primera vez" (o null)
  best: { name: string; rating: number } | null; // mejor calificada (o null)
  drinks: { name: string; meta: string; rating: number | null }[]; // orden de registro
  photoUrl: string | null;
  single: boolean; // una sola fila de check-in → hero de bebida a todo color
  color: string; // color de la cascada (hex)
  ink: string; // tinta emparejada con el color (≥ 4,5:1)
  lastLabel: string | null; // "hasta las 5:30 am" (ventana real) o null (retroactiva)
}

const DARK = "#070B16"; // el fondo de los estados con banda
const CREAM = "#FBFCFF"; // texto sobre el fondo oscuro
const MUTED = "#8496C4"; // subetiquetas / acompañantes sobre el fondo oscuro
const DISP = "Big Shoulders Display";
const SANS = "Outfit";

// ---- Derivación de tonos de apoyo desde el par (color, tinta) ----
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function toHex([r, g, b]: number[]): string {
  return "#" + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("");
}
function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  return toHex([0, 1, 2].map((i) => ra[i] + (rb[i] - ra[i]) * t));
}
const linChan = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
function lum(hex: string): number { const [r, g, b] = hexToRgb(hex).map(linChan); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

interface Palette {
  color: string;
  ink: string;
  accentSoft: string; // acento aclarado (eyebrow "la mejor…" sobre el fondo oscuro)
  dimBar: string; // barra de rating vacía sobre el fondo oscuro
  footerBg: string; // pie del hero a todo color = la tinta
  footerText: string; // valores grandes del pie (crema u oscuro, según la tinta)
  footerMuted: string; // subetiquetas del pie
  heroDim: string; // barra de rating vacía sobre el fondo a todo color
}
function palette(color: string, ink: string): Palette {
  const inkDark = lum(ink) < 0.4;
  const footerText = inkDark ? "#FBF0D5" : "#241609";
  return {
    color,
    ink,
    accentSoft: mix(color, "#FFFFFF", 0.3),
    dimBar: mix(color, DARK, 0.8),
    footerBg: ink,
    footerText,
    footerMuted: mix(footerText, ink, 0.44),
    heroDim: mix(ink, color, 0.62),
  };
}

// ---- Primitivas tipográficas ----
function disp(text: string, size: number, color: string, extra: Record<string, unknown> = {}): ReactElement {
  return <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: size, lineHeight: 1, color, ...extra }}>{text}</div>;
}
function eyebrow(text: string, color: string, size = 22): ReactElement {
  return <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: size, lineHeight: 1, letterSpacing: size * 0.09, color }}>{text}</div>;
}
function sans(text: string, size: number, color: string, extra: Record<string, unknown> = {}): ReactElement {
  return <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: size, color, ...extra }}>{text}</div>;
}

// El tamaño de una cadena que debe caber: primera pareja [maxLen, px] cuyo largo alcance.
function fitSize(text: string, table: [number, number][]): number {
  const n = text.length;
  for (const [maxLen, px] of table) if (n <= maxLen) return px;
  return table[table.length - 1][1];
}

// Flecha del recorrido (satori no garantiza el glifo →): barra + triángulo en el color.
function arrow(color: string, key: string, small: boolean): ReactElement {
  return (
    <div key={key} style={{ display: "flex", alignItems: "center", flex: "none", marginLeft: small ? 16 : 20, marginRight: small ? 16 : 20, paddingBottom: small ? 12 : 16 }}>
      <div style={{ width: small ? 22 : 28, height: small ? 5 : 6, background: color }} />
      <div style={{ width: 0, height: 0, borderLeft: `${small ? 11 : 14}px solid ${color}`, borderTop: `${small ? 7 : 9}px solid transparent`, borderBottom: `${small ? 7 : 9}px solid transparent` }} />
    </div>
  );
}

// Medidor de rating: 5 barras (llenas en `fill`, vacías en `empty`).
function ratingBars(rating: number, fill: string, empty: string, h = 34): ReactElement {
  return (
    <div style={{ display: "flex", flex: "none" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} style={{ width: 13, height: h, borderRadius: 2, marginLeft: n === 1 ? 0 : 6, background: n <= rating ? fill : empty }} />
      ))}
    </div>
  );
}

// Pila de avatares del parche: campo de color + símbolo inlineado, superpuestos.
function avatarStack(avatars: AvatarImg[], size: number, overlap: number): ReactElement {
  return (
    <div style={{ display: "flex", flex: "none" }}>
      {avatars.map((a, i) => (
        <div key={i} style={{ display: "flex", width: size, height: size, borderRadius: 999, background: a.bg, marginLeft: i === 0 ? 0 : -overlap, overflow: "hidden", flexShrink: 0 }}>
          <img src={a.uri} width={size} height={size} alt="" style={{ width: size, height: size }} />
        </div>
      ))}
    </div>
  );
}

// El recorrido: nombres (MAYÚSCULA) en orden de registro con flechas, cortado a 3 + "+N".
function recorridoBlock(names: string[], size: number, small: boolean, p: Palette): ReactElement {
  const { names: shown, extra } = recorrido(names, 3);
  const nodes: ReactNode[] = [];
  shown.forEach((n, i) => {
    if (i > 0) nodes.push(arrow(p.color, `a${i}`, small));
    nodes.push(
      <div key={`n${i}`} style={{ display: "flex", fontFamily: DISP, fontWeight: 700, fontSize: size, lineHeight: 1.12, color: CREAM, flex: "none" }}>{n.toUpperCase()}</div>,
    );
  });
  if (extra > 0) {
    nodes.push(
      <div key="extra" style={{ display: "flex", alignItems: "center", flex: "none", marginLeft: small ? 16 : 18, paddingBottom: small ? 10 : 16, fontFamily: DISP, fontWeight: 700, fontSize: Math.round(size * 0.62), color: p.color }}>{`+${extra}`}</div>,
    );
  }
  return <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline" }}>{nodes}</div>;
}

// Banda de highlight (máximo UNA, prioridad primera-vez → mejor de la noche): recuadro con
// borde del color, nombre en crema; la "mejor" además lleva sus barras de rating.
type Highlight = { kind: "first"; name: string } | { kind: "best"; name: string; rating: number };
function highlightBand(h: Highlight, p: Palette): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: 40, flex: "none", border: `2px solid ${p.color}`, borderRadius: 18, padding: "24px 28px" }}>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        {eyebrow(h.kind === "first" ? "PRIMERA VEZ" : "LA MEJOR DE LA NOCHE", p.accentSoft, 19)}
        {disp(h.name.toUpperCase(), 50, CREAM, { marginTop: 14 })}
      </div>
      {h.kind === "best" ? ratingBars(h.rating, p.color, p.dimBar) : null}
    </div>
  );
}

// Métrica de pie (valor grande + subetiqueta). `accent` pinta el valor con el color.
function metric(value: string, label: string, valueColor: string, labelColor: string, size: number): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {disp(value, size, valueColor)}
      {sans(label, size >= 56 ? 24 : 25, labelColor, { marginTop: 12 })}
    </div>
  );
}

// La banda de color superior (FriaDay + lugar + fecha), común a con-foto y sin-foto.
function colorBand(d: ShareData, p: Palette, placeSize: number, story: boolean): ReactElement {
  const dateLine = d.lastLabel ? `${d.dateLabel} · ${d.lastLabel}` : d.dateLabel;
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "none", background: p.color, padding: story ? "200px 64px 54px" : "64px 64px 54px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {disp("FRIADAY", 40, p.ink, { letterSpacing: 2.4 })}
        {eyebrow("PRIVADO · POR INVITACIÓN", p.ink, 22)}
      </div>
      {disp((d.place || `Salida de ${d.ownerName}`).toUpperCase(), placeSize, p.ink, { marginTop: 44, lineHeight: 0.9 })}
      {sans(dateLine, 32, p.ink, { marginTop: 24 })}
    </div>
  );
}

// El parche + "con …" (sobre fondo oscuro).
function companionsRow(d: ShareData, companions: string): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", flex: "none", marginBottom: 34 }}>
      {avatarStack(d.avatars, 58, 16)}
      {companions ? sans(`con ${companions}`, 29, MUTED, { marginLeft: 22 }) : null}
    </div>
  );
}

// Métricas de pie sobre fondo oscuro (duración · total · salida #N — el #N en el color).
function darkStats(d: ShareData, p: Palette): ReactElement {
  const cols: ReactNode[] = [];
  if (d.duration) cols.push(metric(d.duration.value, d.duration.window, CREAM, MUTED, 56));
  cols.push(metric(String(d.total), d.total === 1 ? "bebida" : "bebidas", CREAM, MUTED, 56));
  cols.push(metric(`#${d.outing}`, "salida", p.color, MUTED, 56));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", flex: "none" }}>
      {cols.map((c, i) => (
        <div key={i} style={{ display: "flex", marginRight: i < cols.length - 1 ? 60 : 0 }}>{c}</div>
      ))}
    </div>
  );
}

/** Estados CON banda (con foto / sin foto multi): fondo oscuro + banda de color. */
function bandedCard(d: ShareData, p: Palette, story: boolean): ReactElement {
  const place = (d.place || `Salida de ${d.ownerName}`).toUpperCase();
  const companions = companionsLabel(d.companions);
  const single = d.single;
  // Highlight máximo uno (primera vez → mejor de la noche). Solo multi-bebida y sin foto: con
  // foto, la foto es el hero; en single, el nombre grande YA es el highlight.
  const highlight: Highlight | null = d.firstTime
    ? { kind: "first", name: d.firstTime }
    : d.best
      ? { kind: "best", name: d.best.name, rating: d.best.rating }
      : null;

  const placeSize = d.photoUrl
    ? fitSize(place, [[12, 76], [20, 58], [99, 46]])
    : fitSize(place, [[10, story ? 150 : 142], [18, story ? 108 : 100], [26, 74], [99, 56]]);
  const recSize = d.photoUrl ? 52 : story ? 82 : 74;
  // Con foto la imagen ES el hero: ocupa alto para no dejar un vacío bajo la banda.
  const photoH = story ? 1000 : 480;

  return (
    <div style={{ width: 1080, height: story ? 1920 : 1350, display: "flex", flexDirection: "column", background: DARK }}>
      {colorBand(d, p, placeSize, story)}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "52px 64px 60px" }}>
        {d.photoUrl ? (
          <div style={{ display: "flex", borderRadius: 28, overflow: "hidden", flex: "none", marginBottom: 40 }}>
            <img src={d.photoUrl} width={952} height={photoH} alt="" style={{ width: 952, height: photoH, objectFit: "cover" }} />
          </div>
        ) : null}

        {single && d.photoUrl ? (
          <div style={{ display: "flex", flexDirection: "column", flex: "none" }}>
            {eyebrow(d.firstTime ? "PRIMERA VEZ" : "LA DE ESA NOCHE", p.accentSoft, 20)}
            {disp(d.drinks[0].name.toUpperCase(), story ? 92 : 78, CREAM, { marginTop: 18, lineHeight: 1.02 })}
            {d.drinks[0].meta ? sans(d.drinks[0].meta, 28, MUTED, { marginTop: 16 }) : null}
            {d.drinks[0].rating != null ? <div style={{ display: "flex", marginTop: 26 }}>{ratingBars(d.drinks[0].rating, p.color, p.dimBar)}</div> : null}
          </div>
        ) : (
          recorridoBlock(d.drinks.map((dr) => dr.name), recSize, !!d.photoUrl, p)
        )}

        {/* Highlight (primera vez → mejor): solo multi-bebida y sin foto. */}
        {!single && !d.photoUrl && highlight ? highlightBand(highlight, p) : null}

        <div style={{ display: "flex", flexGrow: 1 }} />
        {companionsRow(d, companions)}
        {darkStats(d, p)}
      </div>
    </div>
  );
}

/** Estado a TODO COLOR (una sola bebida sin foto, incluye el caso pobre retroactivo). */
function heroCard(d: ShareData, p: Palette, story: boolean): ReactElement {
  const drink = d.drinks[0];
  const name = (drink?.name || "").toUpperCase();
  const companions = companionsLabel(d.companions);
  const heroSize = fitSize(name, [[5, story ? 300 : 240], [8, story ? 208 : 168], [12, story ? 156 : 124], [18, story ? 116 : 92], [99, story ? 92 : 72]]);

  return (
    <div style={{ width: 1080, height: story ? 1920 : 1350, display: "flex", flexDirection: "column", background: p.color }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: "none", padding: story ? "200px 64px 0" : "64px 64px 0" }}>
        {disp("FRIADAY", 40, p.ink, { letterSpacing: 2.4 })}
        {eyebrow("PRIVADO · POR INVITACIÓN", p.ink, 22)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", padding: "0 64px" }}>
        {eyebrow(d.firstTime ? "PRIMERA VEZ" : "LA DE ESA NOCHE", p.ink, 22)}
        {disp(name, heroSize, p.ink, { marginTop: 26, lineHeight: 0.82 })}
        {drink?.meta ? sans(drink.meta, 36, p.ink, { marginTop: 32 }) : null}
        {drink?.rating != null ? <div style={{ display: "flex", marginTop: 36 }}>{ratingBars(drink.rating, p.ink, p.heroDim, 40)}</div> : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: "none", background: p.footerBg, padding: "52px 64px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", flex: "none" }}>
          {avatarStack(d.avatars, 62, 16)}
          {sans(companions ? `con ${companions}` : `Salida de ${d.ownerName} · ${d.dateLabel}`, 30, p.footerMuted, { marginLeft: 22 })}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", flex: "none", marginTop: 40 }}>
          <div style={{ display: "flex", marginRight: 64 }}>{metric(String(d.total), d.total === 1 ? "bebida" : "bebidas", p.footerText, p.footerMuted, 58)}</div>
          <div style={{ display: "flex" }}>{metric(`#${d.outing}`, "salida del parche", p.color, p.footerMuted, 58)}</div>
        </div>
      </div>
    </div>
  );
}

export function renderShareCard(d: ShareData, format: "post" | "story"): ReactElement {
  const story = format === "story";
  const p = palette(d.color, d.ink);
  // Una sola bebida y sin foto → hero a todo color (el "caso pobre" retroactivo cae aquí). El
  // resto (con foto, o varias bebidas) → tarjeta con banda de color sobre fondo oscuro.
  return d.single && !d.photoUrl ? heroCard(d, p, story) : bandedCard(d, p, story);
}

/**
 * Probe de diagnóstico (B-1.2 / SC): lienzo mínimo que solo ejercita el parseo/shaping de las
 * fuentes embebidas — Big Shoulders 700/800, Outfit 400/700, Syne 800. Aísla el costo fijo de
 * fuentes del resto del render.
 */
export function renderFontProbe(story: boolean): ReactElement {
  return (
    <div style={{ width: 1080, height: story ? 1920 : 1350, display: "flex", flexDirection: "column", background: DARK, padding: 64 }}>
      <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: 96, color: CREAM }}>BIG SHOULDERS 800 ÁÉ</div>
      <div style={{ display: "flex", fontFamily: DISP, fontWeight: 700, fontSize: 72, color: CREAM, marginTop: 20 }}>BIG SHOULDERS 700 ÑÚ</div>
      <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: 32, color: MUTED, marginTop: 20 }}>Outfit 400 regular</div>
      <div style={{ display: "flex", fontFamily: SANS, fontWeight: 700, fontSize: 32, color: MUTED, marginTop: 8 }}>Outfit 700 bold</div>
    </div>
  );
}
