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
  dateShort: string; // "VIE 6 SEP" — la fecha compacta del pie del 4:5 (T6)
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
  photoColor: string | null; // T6 · tono dominante de la foto (SessionPhoto.color) — tiñe el velo/scrim
  luminance: number | null; // T6 · brillo real de la foto (0–1) — decide el alfa del velo (null = respaldo)
  single: boolean; // una sola fila de check-in → hero de bebida a todo color
  color: string; // color de la cascada (hex)
  ink: string; // tinta emparejada con el color (≥ 4,5:1)
  lastLabel: string | null; // "hasta las 5:30 am" (siempre, T6) — la hora del último check-in
  // T5 · stats para llenar la story:
  ruleta: { rondas: number; loserName: string; losses: number } | null; // la ruleta de la salida
  formato: string | null; // "3 botellas · 1 copa" (solo con más de un formato)
  distinct: number; // bebidas distintas (para "N distintas" cuando el recorrido se trunca)
}

const DARK = "#070B16"; // el fondo de los estados con banda
const CREAM = "#FBFCFF"; // texto sobre el fondo oscuro
const MUTED = "#8496C4"; // subetiquetas / acompañantes sobre el fondo oscuro
const DISP = "Big Shoulders Display";
const SANS = "Outfit";

// Zona segura de la STORY (T5): Instagram tapa la parte de arriba (progreso + perfil + cerrar) y,
// sobre todo, la de abajo (el campo "Add a caption" + la barra de compartir). El pie de la v2 a
// 240px del borde quedaba TAPADO. Estos márgenes dejan el contenido libre del chrome de IG; se
// marcan y se verifican contra la UI real, no contra el lienzo vacío.
const STORY_TOP_SAFE = 150; // franja oscura arriba: despeja el chrome superior sin gastar color
const STORY_BOTTOM_SAFE = 380; // el pie termina aquí, holgado por encima de "Add a caption"

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
// rgba desde hex — para las paradas de los degradados del velo (T6), teñidas y con alfa.
function rgba(hex: string, a: number): string { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

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

// La ruleta (T5): recuadro con el borde del color — contenido nativo de FriaDay que llena la
// story. "N RONDAS" grande + "{quién} perdió {n}" a la derecha, en el color (solo si alguien
// perdió 2 o más; repartida, basta el número de rondas).
function ruletaBox(r: NonNullable<ShareData["ruleta"]>, p: Palette): ReactElement {
  const repeat = r.losses >= 2;
  return (
    <div style={{ display: "flex", alignItems: "center", marginTop: 40, flex: "none", border: `2px solid ${p.color}`, borderRadius: 18, padding: "24px 28px" }}>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
        {eyebrow("LA RULETA", p.accentSoft, 19)}
        {disp(`${r.rondas} ${r.rondas === 1 ? "RONDA" : "RONDAS"}`, 50, CREAM, { marginTop: 14 })}
      </div>
      {repeat ? sans(`${r.loserName} perdió ${r.losses}`, 27, p.color, { fontWeight: 600 }) : null}
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

// La banda de color superior del MODO COLOR (FriaDay + lugar). En la STORY es COMPACTA (T5). T6:
// FUERA la fecha/hora del header — arriba queda SOLO el lugar (ambos formatos comparten cabecera);
// la hora («hasta las X») vive en el pie y, en el 4:5, la fecha también.
function colorBand(d: ShareData, p: Palette, placeSize: number, story: boolean): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "none", background: p.color, padding: story ? "40px 64px 40px" : "64px 64px 54px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {disp("FRIADAY", 40, p.ink, { letterSpacing: 2.4 })}
        {eyebrow("PRIVADO · POR INVITACIÓN", p.ink, 22)}
      </div>
      {disp((d.place || `Salida de ${d.ownerName}`).toUpperCase(), placeSize, p.ink, { marginTop: story ? 32 : 44, lineHeight: 0.9 })}
    </div>
  );
}

// Columnas de stats del pie (T6): [duración + «hasta las X» si hubo ventana ≥1h] · bebidas · #N ·
// [fecha, SOLO en 4:5]. La HORA va de subetiqueta de la duración; sin duración, el pie la muestra
// como línea aparte (para que «hasta las X» salga SIEMPRE). Colores parametrizados (foto / color).
function statCols(d: ShareData, text: string, muted: string, accent: string, size: number, story: boolean): ReactNode[] {
  const cols: ReactNode[] = [];
  if (d.duration) cols.push(metric(d.duration.value, d.lastLabel ?? d.duration.window, text, muted, size));
  cols.push(metric(String(d.total), d.total === 1 ? "bebida" : "bebidas", text, muted, size));
  cols.push(metric(`#${d.outing}`, "salida", accent, muted, size));
  if (!story) {
    // 4:5 · la fecha baja al pie como cuarto dato (T6): "6 SEP" grande, el día de semana debajo.
    const [wd, ...rest] = d.dateShort.split(" ");
    cols.push(metric(rest.join(" "), (wd ?? "").toLowerCase(), text, muted, size));
  }
  return cols;
}

// El pie común (T6): parche + «con …» · [«hasta las X» aparte si no hubo duración] · las stats.
// Cada modo pasa sus colores (foto: crema/velo; color: crema/tenue).
function footerBlock(d: ShareData, o: { text: string; muted: string; accent: string; avatarSize: number; statSize: number; story: boolean }): ReactElement {
  const companions = companionsLabel(d.companions);
  const cols = statCols(d, o.text, o.muted, o.accent, o.statSize, o.story);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "none" }}>
      <div style={{ display: "flex", alignItems: "center", flex: "none" }}>
        {avatarStack(d.avatars, o.avatarSize, 16)}
        {companions ? sans(`con ${companions}`, 28, o.muted, { marginLeft: 20 }) : null}
      </div>
      {!d.duration ? <div style={{ display: "flex", marginTop: 16 }}>{sans(d.lastLabel ?? "", 26, o.muted)}</div> : null}
      <div style={{ display: "flex", alignItems: "flex-end", flex: "none", marginTop: 26 }}>
        {cols.map((c, i) => (
          <div key={i} style={{ display: "flex", marginRight: i < cols.length - 1 ? 52 : 0 }}>{c}</div>
        ))}
      </div>
    </div>
  );
}

// Línea secundaria (T5): formato ("3 botellas · 1 copa") y, cuando el recorrido se trunca,
// "N distintas". Da textura sin números grandes. Vacía → no se dibuja.
function secondaryText(d: ShareData): string {
  const parts: string[] = [];
  if (d.formato) parts.push(d.formato);
  if (d.drinks.length > 3 && d.distinct >= 2) parts.push(`${d.distinct} distintas`);
  return parts.join("   ·   ");
}

/** Estados CON banda (con foto / sin foto multi): fondo oscuro + banda de color. */
function bandedCard(d: ShareData, p: Palette, story: boolean): ReactElement {
  // MODO COLOR, varias bebidas (con foto → photoCard; una bebida sin foto → heroCard).
  const place = (d.place || `Salida de ${d.ownerName}`).toUpperCase();
  const highlight: Highlight | null = d.firstTime
    ? { kind: "first", name: d.firstTime }
    : d.best
      ? { kind: "best", name: d.best.name, rating: d.best.rating }
      : null;
  const placeSize = fitSize(place, [[10, story ? 128 : 142], [18, story ? 96 : 100], [26, 74], [99, 56]]);
  const recSize = story ? 96 : 74;
  const secondary = secondaryText(d);

  const mainBlock = recorridoBlock(d.drinks.map((dr) => dr.name), recSize, false, p);
  const hlBlock = highlight ? highlightBand(highlight, p) : null;
  const rulBlock = d.ruleta ? ruletaBox(d.ruleta, p) : null;

  const bottomCluster = (
    <div style={{ display: "flex", flexDirection: "column", flex: "none" }}>
      {secondary ? sans(secondary, story ? 27 : 24, MUTED, { marginBottom: 22 }) : null}
      {footerBlock(d, { text: CREAM, muted: MUTED, accent: p.color, avatarSize: 58, statSize: story ? 68 : 56, story })}
    </div>
  );

  // STORY (T5): franja oscura de zona segura arriba + banda compacta; el cuerpo REPARTE su alto
  // (justify-between) para que aun con pocas bebidas se vea lleno y no un hueco negro; la ruleta
  // (si hubo) llena el centro; el pie termina sobre la zona de "Add a caption".
  if (story) {
    // "Rico" = hay FOTO (ancla arriba) o RULETA (pie alto): el cuerpo REPARTE su alto
    // (space-between) y llena. Si solo hay recorrido (con o sin highlight/stats), se CENTRA en
    // bloque compacto: el aire queda equilibrado arriba y abajo (se lee intencional, no un hueco
    // negro al fondo) y las stats quedan lejos del chrome de IG igual. El highlight solo no basta
    // para repartir: pinchado con el recorrido, centrado se ve mejor que un pie bajo con hueco.
    const rich = !!rulBlock;
    return (
      <div style={{ width: 1080, height: 1920, display: "flex", flexDirection: "column", background: DARK }}>
        <div style={{ display: "flex", flex: "none", height: STORY_TOP_SAFE }} />
        {colorBand(d, p, placeSize, true)}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: rich ? "space-between" : "center", padding: `44px 64px ${STORY_BOTTOM_SAFE}px` }}>
          <div style={{ display: "flex", flexDirection: "column", flex: "none" }}>
            {mainBlock}
            {hlBlock}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: "none", marginTop: rich ? 0 : 72 }}>
            {rulBlock}
            <div style={{ display: "flex", flexDirection: "column", marginTop: rulBlock ? 40 : 0 }}>{bottomCluster}</div>
          </div>
        </div>
      </div>
    );
  }

  // PUBLICACIÓN (4:5): anclada (el pie abajo). La ruleta entra solo cuando no hay highlight (para no
  // reventar el alto del 4:5).
  return (
    <div style={{ width: 1080, height: 1350, display: "flex", flexDirection: "column", background: DARK }}>
      {colorBand(d, p, placeSize, false)}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "52px 64px 60px" }}>
        {mainBlock}
        {hlBlock}
        {!hlBlock && rulBlock ? rulBlock : null}
        <div style={{ display: "flex", flexGrow: 1 }} />
        {bottomCluster}
      </div>
    </div>
  );
}

/** Estado a TODO COLOR (una sola bebida sin foto, incluye el caso pobre retroactivo). */
function heroCard(d: ShareData, p: Palette, story: boolean): ReactElement {
  const drink = d.drinks[0];
  const name = (drink?.name || "").toUpperCase();
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

      {/* El pie invertido: en la story su padding inferior es la ZONA SEGURA — las stats quedan por
          encima de "Add a caption"; la tinta bleed hasta el borde queda tapada por IG. T6: el pie
          común (con «hasta las X» siempre + la fecha en el 4:5). */}
      <div style={{ display: "flex", flexDirection: "column", flex: "none", background: p.footerBg, padding: story ? `52px 64px ${STORY_BOTTOM_SAFE}px` : "52px 64px 60px" }}>
        {footerBlock(d, { text: p.footerText, muted: p.footerMuted, accent: p.color, avatarSize: 62, statSize: story ? 58 : 54, story })}
      </div>
    </div>
  );
}

/**
 * MODO FOTO (T6 · 6a): la foto es la historia — a sangre completa, el contenido ENCIMA sobre un
 * scrim de CUATRO capas, todas satori (sin filter/blur/mix-blend/máscara/radial):
 *   1. la foto: <img> absoluta, inset 0, objectFit cover, con width/height explícitos.
 *   2. el VELO: color plano (la tinta oscura del color de la foto) a TODA la imagen, con alfa según
 *      la LUMINANCIA real (.22 oscura → .46 clara; respaldo .34 sin dato). Es lo que salva la foto
 *      clara: una foto brillante recibe más velo para que el texto se lea.
 *   3. degradado superior (520px story / 300px 4:5): scrim suave para la cabecera.
 *   4. degradado inferior (1180px story / 880px 4:5): termina OPACO en la tinta oscura; las paradas
 *      llevan ese matiz, no negro, para que la zona de texto armonice con la foto.
 * Tres zonas: cabecera (arriba) · la foto RESPIRA en el medio (sin texto) · el contenido (abajo).
 * La banda de color no existe aquí (el color ya sale de la foto).
 */
function photoCard(d: ShareData, story: boolean): ReactElement {
  const W = 1080, H = story ? 1920 : 1350;
  const extracted = d.photoColor ?? d.color; // el color de la foto (o el de la cascada de respaldo)
  const tintVeil = mix(extracted, "#000000", 0.76); // el velo y la parada media del degradado
  const tintTop = mix(extracted, "#000000", 0.89); // matiz del scrim superior
  const tintDeep = mix(extracted, "#000000", 0.915); // el opaco del fondo del degradado inferior
  // Alfa del velo por luminancia real (T6). Rango útil 0.15–0.75 → .22–.46; respaldo .34 sin dato.
  const veilAlpha = d.luminance != null ? clamp(0.22 + (d.luminance - 0.15) * 0.4, 0.22, 0.46) : 0.34;
  const TEXT = "#FFF4EC";
  const MUTED2 = "rgba(255,244,236,0.66)";
  const accent = mix(extracted, "#FFFFFF", 0.22); // el color de la foto aclarado para leerse en el scrim
  const single = d.single;
  const place = (d.place || `Salida de ${d.ownerName}`).toUpperCase();
  const placeSize = fitSize(place, [[12, story ? 118 : 104], [20, story ? 90 : 78], [99, story ? 64 : 56]]);
  const pAccent: Palette = { ...palette(d.color, d.ink), color: accent };
  const highlight: Highlight | null = d.firstTime ? { kind: "first", name: d.firstTime } : d.best ? { kind: "best", name: d.best.name, rating: d.best.rating } : null;
  const topH = story ? 520 : 300;
  const botH = story ? 1180 : 880;

  const drinks = single ? (
    <div style={{ display: "flex", flexDirection: "column", flex: "none" }}>
      {eyebrow(d.firstTime ? "PRIMERA VEZ" : "LA DE ESA NOCHE", accent, 20)}
      {disp(d.drinks[0].name.toUpperCase(), story ? 84 : 74, TEXT, { marginTop: 14, lineHeight: 1.02 })}
      {d.drinks[0].meta ? sans(d.drinks[0].meta, 28, MUTED2, { marginTop: 14 }) : null}
      {d.drinks[0].rating != null ? <div style={{ display: "flex", marginTop: 24 }}>{ratingBars(d.drinks[0].rating, accent, "rgba(255,255,255,0.22)")}</div> : null}
    </div>
  ) : (
    recorridoBlock(d.drinks.map((dr) => dr.name), story ? 62 : 56, true, pAccent)
  );

  return (
    <div style={{ position: "relative", width: W, height: H, display: "flex" }}>
      <img src={d.photoUrl as string} width={W} height={H} alt="" style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", background: rgba(tintVeil, veilAlpha) }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: topH, display: "flex", background: `linear-gradient(180deg, ${rgba(tintTop, 0.78)}, ${rgba(tintTop, 0.34)} 55%, ${rgba(tintTop, 0)})` }} />
      <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: botH, display: "flex", background: `linear-gradient(180deg, ${rgba(tintTop, 0)}, ${rgba(tintVeil, 0.62)} 32%, ${rgba(tintDeep, 0.93)} 66%, ${rgba(tintDeep, 1)})` }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: `${story ? 200 : 56}px 64px ${story ? STORY_BOTTOM_SAFE : 64}px` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: "none" }}>
          {disp("FRIADAY", 40, TEXT, { letterSpacing: 2.4 })}
          {eyebrow("PRIVADO · POR INVITACIÓN", TEXT, 22)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: "none" }}>
          {disp(place, placeSize, TEXT, { lineHeight: 0.9 })}
          <div style={{ display: "flex", marginTop: 26 }}>{drinks}</div>
          {!single && highlight ? (
            <div style={{ display: "flex", alignItems: "baseline", flex: "none", marginTop: 22 }}>
              {eyebrow(highlight.kind === "first" ? "PRIMERA VEZ" : "LA MEJOR", accent, 19)}
              {disp(highlight.name.toUpperCase(), 34, TEXT, { marginLeft: 18 })}
            </div>
          ) : null}
          <div style={{ display: "flex", marginTop: 32 }}>
            {footerBlock(d, { text: TEXT, muted: MUTED2, accent, avatarSize: 54, statSize: story ? 56 : 50, story })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function renderShareCard(d: ShareData, format: "post" | "story"): ReactElement {
  const story = format === "story";
  const p = palette(d.color, d.ink);
  // T6 · dos modos. CON foto → foto a sangre completa (photoCard). SIN foto: una sola bebida → hero
  // a todo color (caso pobre); varias → banda de color sobre fondo oscuro (modo color del T5).
  if (d.photoUrl) return photoCard(d, story);
  return d.single ? heroCard(d, p, story) : bandedCard(d, p, story);
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
