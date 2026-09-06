/* eslint-disable @next/next/no-img-element */
import type { ReactElement, ReactNode } from "react";
import { recorrido } from "@/lib/domain";
import { companionsLabel } from "@/lib/format";
import type { AvatarImg } from "./avatars";

/**
 * Plantilla de la share-card v2 (Pasada S.2): el REGISTRO de una noche, no un
 * inventario. El cuerpo es el RECORRIDO (bebidas en orden de registro); la duración,
 * el total y la salida #N son métricas entre iguales; el highlight es máximo uno
 * (primera vez → mejor de la noche → ninguno). Cinco estados 4:5 + story, un solo
 * parámetro `format`.
 *
 * Se renderiza con satori (next/og): SOLO flex, sin grid, sin emoji, festón con divs
 * circulares, avatares inlineados como data-URI (`<use href>` no resuelve), fuentes
 * embebidas. NUNCA la cantidad de alcohol como logro (restricción de la Pasada S).
 */

export interface ShareData {
  place: string | null;
  dateLabel: string; // "Viernes 28 de agosto"
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
  single: boolean; // una sola fila de check-in → manda el héroe de bebida
}

const C = {
  noche: "#120e0a",
  marca: "#c4620a",
  espuma: "#fbf0d5",
  crema: "#f7efdd",
  tenue: "#a08d72",
  ambar: "#f2a016",
  barraAlta: "#271e16",
  borde: "#33261c",
  heroMeta: "#C9A874",
  glassOff: "rgba(251,240,213,0.16)",
};
const HERO_GRAD = "linear-gradient(180deg,#4A3413,#2A1E0E)";
const DISP = "Syne";
const SANS = "Outfit";

// Festón de espuma: fila de círculos que asoman por el borde (como FoamStrip).
function foam(width: number): ReactElement {
  const r = 18;
  const n = Math.ceil(width / (r * 2)) + 1;
  return (
    <div style={{ display: "flex", height: r, overflow: "hidden", flex: "none" }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ width: r * 2, height: r * 2, borderRadius: r, background: C.espuma, marginTop: -r, marginLeft: i === 0 ? 0 : -2, flexShrink: 0 }} />
      ))}
    </div>
  );
}

// Medidor de vasos (rating) con barras, como el componente Glasses del feed.
function glasses(rating: number): ReactElement {
  return (
    <div style={{ display: "flex", flex: "none" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} style={{ width: 14, height: 30, borderRadius: 3, marginLeft: n === 1 ? 0 : 5, background: n <= rating ? C.ambar : C.glassOff }} />
      ))}
    </div>
  );
}

// Pila de avatares del parche: campo de color + símbolo inlineado, superpuestos.
function avatarStack(avatars: AvatarImg[], size: number, radius: number, overlap: number): ReactElement {
  return (
    <div style={{ display: "flex", flex: "none" }}>
      {avatars.map((a, i) => (
        <div key={i} style={{ display: "flex", width: size, height: size, borderRadius: radius, background: a.bg, marginLeft: i === 0 ? 0 : -overlap, overflow: "hidden", flexShrink: 0 }}>
          <img src={a.uri} width={size} height={size} alt="" style={{ width: size, height: size }} />
        </div>
      ))}
    </div>
  );
}

// Flecha del recorrido: barra + triángulo (dos divs; satori no garantiza el glifo →).
function arrow(small: boolean, key: string): ReactElement {
  const mx = small ? 20 : 24;
  return (
    <div key={key} style={{ display: "flex", alignItems: "center", flex: "none", marginLeft: mx, marginRight: mx }}>
      <div style={{ width: small ? 26 : 30, height: small ? 5 : 6, borderRadius: 3, background: C.ambar }} />
      <div style={{ width: 0, height: 0, borderLeft: `${small ? 13 : 15}px solid ${C.ambar}`, borderTop: `${small ? 8 : 10}px solid transparent`, borderBottom: `${small ? 8 : 10}px solid transparent` }} />
    </div>
  );
}

function eyebrow(text: string, color = C.tenue, size = 18): ReactElement {
  return <div style={{ display: "flex", fontFamily: SANS, fontWeight: 700, fontSize: size, lineHeight: 1, letterSpacing: 3, color }}>{text}</div>;
}

// El recorrido: nombres en orden de registro con flechas, cortado a 5 + "+N más".
function recorridoBlock(names: string[], size: number, line: number, small: boolean, marginTop: number): ReactElement {
  const { names: shown, extra } = recorrido(names);
  const nodes: ReactNode[] = [];
  shown.forEach((n, i) => {
    if (i > 0) nodes.push(arrow(small, `a${i}`));
    nodes.push(
      <div key={`n${i}`} style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: size, lineHeight: line, letterSpacing: -2, color: C.crema, flex: "none" }}>{n}</div>,
    );
  });
  if (extra > 0) {
    nodes.push(
      <div key="extra" style={{ display: "flex", alignItems: "center", flex: "none", marginLeft: small ? 20 : 24, fontFamily: DISP, fontWeight: 800, fontSize: Math.round(size * 0.6), color: C.ambar }}>{`+${extra} más`}</div>,
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", marginTop }}>
      {eyebrow("EL RECORRIDO")}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", marginTop: small ? 20 : 26 }}>{nodes}</div>
    </div>
  );
}

// Banda de highlight (máximo una): primera vez → mejor de la noche.
function highlightBand(
  h: { kind: "first"; name: string } | { kind: "best"; name: string; rating: number },
  compact: boolean,
): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: h.kind === "best" ? "space-between" : "flex-start", marginTop: compact ? 26 : 34, background: C.barraAlta, border: `1px solid ${C.borde}`, borderRadius: 20, padding: compact ? "20px 26px" : "24px 30px", flex: "none" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {eyebrow(h.kind === "first" ? "PRIMERA VEZ" : "LA MEJOR DE LA NOCHE")}
        <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: h.kind === "best" ? 34 : 40, color: C.espuma, marginTop: 10 }}>{h.name}</div>
      </div>
      {h.kind === "best" && glasses(h.rating)}
    </div>
  );
}

// Bloque de UNA bebida bajo la foto (B-1 bug 2): cuando hay foto, la foto manda y esto
// sostiene la mitad inferior (crece y se centra) — el nombre grande + meta + rating.
function singleDrinkBlock(drink: { name: string; meta: string; rating: number | null }, story: boolean): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", marginTop: 30 }}>
      {eyebrow("LA DE ESA NOCHE")}
      <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: story ? 76 : 64, lineHeight: 1.04, letterSpacing: -2, color: C.espuma, marginTop: 20 }}>{drink.name}</div>
      {drink.meta ? <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: 28, color: C.heroMeta, marginTop: 16 }}>{drink.meta}</div> : null}
      {drink.rating != null ? <div style={{ display: "flex", marginTop: 26 }}>{glasses(drink.rating)}</div> : null}
    </div>
  );
}

function metric(value: string, label: string, amber: boolean, big: boolean): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: big ? 50 : 46, lineHeight: 1, letterSpacing: -1, color: amber ? C.ambar : C.crema }}>{value}</div>
      <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: big ? 26 : 24, color: C.tenue, marginTop: 12 }}>{label}</div>
    </div>
  );
}

/** Cuerpo de la tarjeta (1080 de ancho), común a 4:5 y story. */
function cardBody(d: ShareData, story: boolean): ReactElement {
  const single = d.single;
  const heroRating = single ? d.drinks[0]?.rating ?? null : null;
  // B-1 bug 2: si hay foto, la foto manda (sin importar cuántas bebidas). El héroe
  // tipográfico (y su variante "pobre") queda reservado al caso SIN foto.
  const poor = single && heroRating == null && !d.photoUrl; // 3e: héroe grande, parche debajo
  const companions = companionsLabel(d.companions);

  // Highlight: solo multi-bebida (en single, el héroe ES el highlight). Máximo uno.
  const highlight = single
    ? null
    : d.firstTime
      ? ({ kind: "first", name: d.firstTime } as const)
      : d.best
        ? ({ kind: "best", name: d.best.name, rating: d.best.rating } as const)
        : null;

  const recSize = story ? 68 : d.photoUrl ? 52 : highlight ? 68 : 72;
  const recLine = story ? 1.3 : d.photoUrl ? 1.16 : 1.14;
  const smallArrow = !!d.photoUrl && !story;

  const parche = (size: number, radius: number, overlap: number, mt: number) => (
    <div style={{ display: "flex", alignItems: "center", marginTop: mt, flex: "none" }}>
      {avatarStack(d.avatars, size, radius, overlap)}
      {companions ? <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: size >= 72 ? 32 : 30, color: C.tenue, marginLeft: size >= 72 ? 24 : 22 }}>{`con ${companions}`}</div> : null}
    </div>
  );

  // Métricas: duración (condicional) · total · salida #N — mismo peso.
  const cols: ReactNode[] = [];
  if (d.duration) cols.push(metric(d.duration.value, d.duration.window, false, story));
  cols.push(metric(String(d.total), d.total === 1 ? "bebida" : "bebidas", false, story));
  cols.push(metric(`#${d.outing}`, "salida del parche", true, story));

  return (
    <div style={{ width: 1080, height: story ? 1920 : 1350, display: "flex", flexDirection: "column", background: C.noche, padding: story ? "200px 64px 240px" : 64 }}>
      {/* Marca */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: 40, lineHeight: 1, letterSpacing: -1, color: C.espuma }}>FriaDay</div>
        {eyebrow("PRIVADO · POR INVITACIÓN", C.marca, 20)}
      </div>

      {/* Título: lugar + fecha */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: poor ? 52 : 44 }}>
        <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: poor ? 92 : 84, lineHeight: 1.02, letterSpacing: -2, color: C.crema }}>
          {d.place || `Salida de ${d.ownerName}`}
        </div>
        <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: poor ? 32 : 30, color: C.tenue, marginTop: 16 }}>{d.dateLabel}</div>
      </div>

      {/* Parche arriba (salvo el caso pobre, que lo baja tras el héroe) */}
      {!poor && parche(64, 20, 18, d.photoUrl ? 28 : 30)}

      {/* Cuerpo: si hay FOTO, la foto manda (una o varias bebidas). Sin foto: héroe
          tipográfico (single) o recorrido (multi). Regla B-1 bug 2. */}
      {d.photoUrl ? (
        // Un solo hijo con columna explícita: satori NO aplana los Fragments (los
        // acomodaría en fila y se saldrían del lienzo).
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", borderRadius: 28, overflow: "hidden", border: `1px solid ${C.borde}`, marginTop: 30, flex: "none" }}>
            {foam(952)}
            <img src={d.photoUrl} width={952} height={story ? 620 : 330} alt="" style={{ width: 952, height: story ? 620 : 330, objectFit: "cover" }} />
          </div>
          {single
            ? singleDrinkBlock(d.drinks[0], story)
            : recorridoBlock(d.drinks.map((dr) => dr.name), recSize, recLine, smallArrow, 30)}
        </div>
      ) : single ? (
        poor ? (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", flexGrow: 1, background: HERO_GRAD, borderRadius: 28, overflow: "hidden", marginTop: 40 }}>
            {foam(952)}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, padding: 56 }}>
              {eyebrow("LA DE ESA NOCHE", C.heroMeta, 20)}
              <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: 128, lineHeight: 1, letterSpacing: -4, color: C.espuma, marginTop: 22 }}>{d.drinks[0]?.name}</div>
              {d.drinks[0]?.meta ? <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: 32, color: C.heroMeta, marginTop: 22 }}>{d.drinks[0].meta}</div> : null}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, background: HERO_GRAD, borderRadius: 28, overflow: "hidden", marginTop: 34 }}>
            {foam(952)}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, padding: 48 }}>
              <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: 96, lineHeight: 1.02, letterSpacing: -3, color: C.espuma }}>{d.drinks[0]?.name}</div>
              {d.drinks[0]?.meta ? <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: 28, color: C.heroMeta, marginTop: 20 }}>{d.drinks[0].meta}</div> : null}
              {heroRating != null ? <div style={{ display: "flex", marginTop: 32 }}>{glasses(heroRating)}</div> : null}
            </div>
          </div>
        )
      ) : (
        recorridoBlock(d.drinks.map((dr) => dr.name), recSize, recLine, smallArrow, 40)
      )}

      {/* Parche debajo del héroe (caso pobre) */}
      {poor && parche(72, 22, 20, 40)}

      {/* Highlight (máximo uno; en foto va compacto) */}
      {highlight && highlightBand(highlight, !!d.photoUrl)}

      {/* Métricas */}
      <div style={{ display: "flex", alignItems: "flex-end", marginTop: story ? 40 : 32, flex: "none" }}>
        {cols.map((c, i) => (
          <div key={i} style={{ display: "flex", marginRight: i < cols.length - 1 ? (story ? 56 : 52) : 0 }}>{c}</div>
        ))}
      </div>
    </div>
  );
}

export function renderShareCard(d: ShareData, format: "post" | "story"): ReactElement {
  return cardBody(d, format === "story");
}

/**
 * B-1.2 · probe de diagnóstico: lienzo mínimo que solo ejercita el parseo/shaping de las
 * TRES fuentes embebidas (Syne 800, Outfit 400/700). Sirve para aislar cuánto del render
 * de satori es costo fijo de fuentes vs. el dibujo del resto (foto, avatares, festón, nodos).
 */
export function renderFontProbe(story: boolean): ReactElement {
  return (
    <div style={{ width: 1080, height: story ? 1920 : 1350, display: "flex", flexDirection: "column", background: C.noche, padding: 64 }}>
      <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: 84, color: C.crema }}>FriaDay Aa</div>
      <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: 32, color: C.tenue }}>Outfit 400 regular</div>
      <div style={{ display: "flex", fontFamily: SANS, fontWeight: 700, fontSize: 32, color: C.tenue }}>Outfit 700 bold</div>
    </div>
  );
}
