import type { ReactElement } from "react";

/**
 * Glifos SVG propios de las seis reacciones (Pasada A-1). Reemplazan al emoji Unicode:
 * las animaciones CSS sobre el glifo nativo se veían planas. Cada glifo se dibuja con las
 * formas del sistema y sus partes (`data-p`) se animan por separado. Cuatro vienen del
 * tablero (1e–1h); ❤️ es propio; el sexto (clave 🫡 en REACTIONS/DB) se dibuja como
 * «sopla» — un matasuegras (8e), decisión de diseño: el gesto pasó de saludo a soplar.
 *
 * Sirve al selector (grande, animado) y al racimo del pie (pequeño, estático). A tamaño
 * chico se omite el detalle fino (papelillos y pliegues del pito) por legibilidad (8f).
 * Solo se anima la reacción recién elegida (la barra pone `go`); el resto van quietos.
 */
const C = { ambar: "#f2a016", espuma: "#fbf0d5", tinta: "#241609", marca: "#c4620a", rojo: "#e4564a", lengua: "#e4614a" };

// origin en fill-box: cada parte pivota sobre SU caja, no la del SVG.
const fb = (origin: string): React.CSSProperties => ({ transformBox: "fill-box", transformOrigin: origin });
const cssvar = (dx?: string, dy?: string): React.CSSProperties => ({ ...(dx ? { ["--dx" as string]: dx } : {}), ...(dy ? { ["--dy" as string]: dy } : {}) });

const GLYPHS: Record<string, { anim: string; node: (small: boolean) => ReactElement }> = {
  // 🍻 Brindis (1e): dos jarras (l/r) que se inclinan y chocan + espuma que salta (s).
  "🍻": {
    anim: "clink",
    node: () => (
      <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden>
        <g data-p="l" style={fb("85% 100%")}>
          <path d="M5 16h13v18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill={C.ambar} />
          <path d="M5 16h13v5H5z" fill={C.espuma} />
          <path d="M5 21H1.6a2.6 2.6 0 0 0 0 6H5" fill="none" stroke={C.ambar} strokeWidth="2.4" />
          <path d="M9 24v8" stroke="rgba(36,22,9,.25)" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <g data-p="r" style={fb("15% 100%")}>
          <path d="M30 16h13v18a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3z" fill={C.ambar} />
          <path d="M30 16h13v5H30z" fill={C.espuma} />
          <path d="M43 21h3.4a2.6 2.6 0 0 1 0 6H43" fill="none" stroke={C.ambar} strokeWidth="2.4" />
          <path d="M39 24v8" stroke="rgba(36,22,9,.25)" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <circle data-p="s" cx="24" cy="14" r="2.2" fill={C.espuma} style={{ ...fb("50% 50%"), ...cssvar(undefined, "-12px") }} />
        <circle data-p="s" cx="17" cy="12" r="1.5" fill={C.espuma} style={{ ...fb("50% 50%"), ...cssvar("-10px", "-8px") }} />
        <circle data-p="s" cx="31" cy="12" r="1.5" fill={C.espuma} style={{ ...fb("50% 50%"), ...cssvar("10px", "-8px") }} />
      </svg>
    ),
  },
  // 🔥 Fuego (1f): dos lenguas (f1/f2) desfasadas + núcleo (core) + brasas (e).
  "🔥": {
    anim: "fire",
    node: () => (
      <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden>
        <path data-p="f1" d="M24 4c7 8 13 11 13 20a13 13 0 0 1-26 0C11 16 17 12 24 4z" fill={C.marca} style={fb("50% 100%")} />
        <path data-p="f2" d="M24 13c4.5 5.5 8 8 8 13.5a8 8 0 0 1-16 0C16 21 19.5 18.5 24 13z" fill={C.ambar} style={fb("50% 100%")} />
        <path data-p="core" d="M24 22c2.4 3 4 4.4 4 7a4 4 0 0 1-8 0c0-2.6 1.6-4 4-7z" fill={C.espuma} style={fb("50% 100%")} />
        <circle data-p="e" cx="14" cy="14" r="1.6" fill={C.ambar} style={fb("50% 50%")} />
        <circle data-p="e" cx="35" cy="18" r="1.2" fill={C.ambar} style={fb("50% 50%")} />
      </svg>
    ),
  },
  // 😂 Risa (1g): cara (face) squash-stretch, ojos (eye), boca (mouth) y lágrimas (tear).
  "😂": {
    anim: "laugh",
    node: () => (
      <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden>
        <g data-p="face" style={fb("50% 60%")}>
          <circle cx="24" cy="24" r="18" fill={C.ambar} />
          <path data-p="eye" d="M12.5 19q3.5-4 7 0" fill="none" stroke={C.tinta} strokeWidth="2.4" strokeLinecap="round" style={fb("50% 100%")} />
          <path data-p="eye" d="M28.5 19q3.5-4 7 0" fill="none" stroke={C.tinta} strokeWidth="2.4" strokeLinecap="round" style={fb("50% 100%")} />
          <g data-p="mouth" style={fb("50% 0%")}>
            <path d="M13 27h22a11 11 0 0 1-22 0z" fill={C.tinta} />
            <path d="M18 34.5q6 4 12 0a10 10 0 0 1-12 0z" fill={C.lengua} />
          </g>
        </g>
        <path data-p="tear" d="M9 22c1.6 2 2.6 3 2.6 4.2A2.6 2.6 0 0 1 6.4 26c0-1.2 1-2.2 2.6-4z" fill={C.espuma} style={fb("50% 50%")} />
        <path data-p="tear" d="M39 22c1.6 2 2.6 3 2.6 4.2A2.6 2.6 0 0 1 36.4 26c0-1.2 1-2.2 2.6-4z" fill={C.espuma} style={fb("50% 50%")} />
      </svg>
    ),
  },
  // 🤤 Baba (1h): cara + hilo (strand) que se estira del labio y gota (drop) que cae.
  "🤤": {
    anim: "drool",
    node: () => (
      <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden>
        <circle cx="24" cy="22" r="17" fill={C.ambar} />
        <path d="M12 17q3.5 3 7 0" fill="none" stroke={C.tinta} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="31.5" cy="17.5" r="2.4" fill={C.tinta} />
        <path d="M17 28h13a6.5 6.5 0 0 1-13 0z" fill={C.tinta} />
        <g data-p="strand" style={fb("50% 0%")}>
          <path d="M26.6 32h3.4v9a1.7 1.7 0 0 1-3.4 0z" fill={C.espuma} />
        </g>
        <circle data-p="drop" cx="28.3" cy="41" r="2.4" fill={C.espuma} style={fb("50% 50%")} />
      </svg>
    ),
  },
  // ❤️ Corazón (propio): un path; anima escalando el glifo entero.
  "❤️": {
    anim: "heart",
    node: () => (
      <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden>
        <path d="M24 41C7.5 29.5 7 19.5 12.5 15.2 17 11.7 22 14 24 18c2-4 7-6.3 11.5-2.8C41 19.5 40.5 29.5 24 41z" fill={C.rojo} />
      </svg>
    ),
  },
  // 🫡 (clave) → «sopla» (8e): matasuegras. cabeza (head) + gorro (cone) + pito (tube) +
  // rollo de la punta (knob) + papelillos (s). Chico: sin papelillos ni pliegues (8f).
  "🫡": {
    anim: "blow",
    node: (small) => (
      <svg viewBox="-6 -6 60 60" width="100%" height="100%" aria-hidden>
        <g data-p="head" style={fb("50% 100%")}>
          <circle cx="20" cy="30" r="15" fill={C.ambar} />
          <path d="M12.2 30.6q3.4-3.8 6.8 0M21.2 30.6q3.4-3.8 6.8 0" fill="none" stroke={C.tinta} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="20.8" cy="36.2" r="3.3" fill={C.tinta} />
        </g>
        <g data-p="cone" style={fb("50% 100%")}>
          <path d="M14 17 27 17 15.9 2.9z" fill={C.espuma} />
          <path d="M15.1 12.2 22.4 12.2" stroke={C.marca} strokeWidth="2.4" />
        </g>
        <g data-p="tube" style={fb("0% 50%")}>
          <path d="M21.5 34.4 38.6 31.9 39.1 35.3 22 37.8z" fill={C.espuma} />
          {!small && <path d="M27 33.4v3.7M32.5 32.6v3.7" stroke="rgba(36,22,9,.22)" strokeWidth="1.3" />}
        </g>
        <circle data-p="knob" cx="40.2" cy="33.6" r="2.9" fill={C.marca} style={fb("50% 50%")} />
        {!small && <circle data-p="s" cx="43" cy="32" r="1.8" fill={C.espuma} style={{ ...fb("50% 50%"), ...cssvar("11px", "-7px") }} />}
        {!small && <circle data-p="s" cx="43" cy="33.6" r="1.4" fill={C.lengua} style={{ ...fb("50% 50%"), ...cssvar("13px", "2px") }} />}
      </svg>
    ),
  },
};

export function ReactionGlyph({
  emoji,
  size = 24,
  animate = false,
  animKey,
}: {
  emoji: string;
  size?: number;
  animate?: boolean;
  animKey?: number; // cambia para re-disparar la animación (un run por tap)
}) {
  const g = GLYPHS[emoji];
  if (!g) return <span style={{ fontSize: size * 0.82, lineHeight: 1 }}>{emoji}</span>; // fallback Unicode
  const small = size < 30; // racimo del pie: sin detalle fino
  return (
    <span
      key={animate ? `a${animKey}` : "s"}
      data-anim={g.anim}
      className={animate ? "fd-rg go" : "fd-rg"}
      style={{ display: "inline-block", width: size, height: size, lineHeight: 0, flex: "none" }}
    >
      {g.node(small)}
    </span>
  );
}

/** Emojis con glifo propio (para saber cuándo usar el glifo vs el emoji Unicode). */
export const GLYPH_EMOJIS = Object.keys(GLYPHS);
