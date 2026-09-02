/* eslint-disable @next/next/no-img-element */
import type { ReactElement } from "react";

/**
 * Plantilla de la share-card (Pasada S), una sola parametrizada con 4 estados
 * (1i sin foto · 1j con foto · 1k una bebida = héroe · 1l story). Se renderiza con
 * satori (next/og): SOLO flex, sin grid, sin emoji, festón con divs circulares,
 * fuentes embebidas. Celebra la noche, el parche y la variedad — NUNCA la cantidad
 * de alcohol como logro (restricción no negociable de la Pasada S).
 */

export interface ShareData {
  place: string | null;
  dateLabel: string;
  ownerName: string;
  companions: string[];
  parche: number; // dueño + etiquetados
  total: number; // bebidas (suma de cantidades)
  distinct: number; // bebidas distintas
  best: { name: string; rating: number } | null; // mejor calificada (o null si ninguna)
  drinks: { name: string; meta: string; rating: number | null }[];
  photoUrl: string | null;
  single: boolean;
}

const C = {
  noche: "#120e0a",
  barra: "#1c1611",
  barraAlta: "#271e16",
  borde: "#33261c",
  ambar: "#f2a016",
  marca: "#c4620a",
  espuma: "#fbf0d5",
  crema: "#f7efdd",
  tenue: "#a08d72",
  tenue2: "#95815f",
  tinta: "#241609",
};
const DISP = "Syne";
const SANS = "Outfit";

// Festón de espuma: fila de círculos que asoman por el borde (como FoamStrip).
function foam(width: number): ReactElement {
  const r = 18;
  const n = Math.ceil(width / (r * 2)) + 1;
  return (
    <div style={{ display: "flex", height: r, overflow: "hidden" }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ width: r * 2, height: r * 2, borderRadius: r, background: C.espuma, marginTop: -r, marginLeft: i === 0 ? 0 : -2, flexShrink: 0 }} />
      ))}
    </div>
  );
}

// Medidor de vasos (rating) con barras, como el componente Glasses del feed.
function glasses(rating: number, big = false): ReactElement {
  const w = big ? 14 : 11;
  const h = big ? 30 : 22;
  return (
    <div style={{ display: "flex" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} style={{ width: w, height: h, borderRadius: 3, marginLeft: n === 1 ? 0 : 5, background: n <= rating ? C.ambar : "rgba(251,240,213,0.16)" }} />
      ))}
    </div>
  );
}

function stat(value: number, label: string): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: 72, color: C.ambar, lineHeight: 1 }}>{String(value)}</div>
      <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: 26, color: C.tenue, marginTop: 6 }}>{label}</div>
    </div>
  );
}

/** Cuerpo 4:5 de la tarjeta (1080 de ancho). */
function cardBody(d: ShareData): ReactElement {
  const companions = d.companions.length
    ? d.companions.length <= 2
      ? d.companions.join(" y ")
      : `${d.companions.slice(0, 2).join(", ")} y ${d.companions.length - 2} más`
    : null;
  const showBest = d.best != null && !d.single; // en single, la bebida ya es el héroe

  return (
    <div style={{ width: 1080, height: 1350, display: "flex", flexDirection: "column", background: C.noche, padding: 64, position: "relative" }}>
      {/* Marca */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: 40, letterSpacing: -1, color: C.espuma }}>FriaDay</div>
        <div style={{ display: "flex", fontFamily: SANS, fontWeight: 700, fontSize: 20, letterSpacing: 3, color: C.marca }}>SOLO POR INVITACIÓN</div>
      </div>

      {/* Título: lugar + fecha + compañía */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
        <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: 84, lineHeight: 1.02, letterSpacing: -2, color: C.crema }}>
          {d.place || `Salida de ${d.ownerName}`}
        </div>
        <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: 30, color: C.tenue, marginTop: 16 }}>
          {d.dateLabel}{companions ? `  ·  con ${companions}` : ""}
        </div>
      </div>

      {/* Contenido central: foto (1j) / héroe de bebida (1k) / lista (1i) */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 36, flexGrow: 1 }}>
        {d.photoUrl ? (
          <div style={{ display: "flex", flexDirection: "column", borderRadius: 28, overflow: "hidden", flexGrow: 1, border: `1px solid ${C.borde}` }}>
            {foam(952)}
            <img src={d.photoUrl} width={952} height={640} style={{ width: 952, height: 640, objectFit: "cover", flexGrow: 1 }} alt="" />
          </div>
        ) : d.single ? (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, background: "linear-gradient(180deg,#4A3413,#2A1E0E)", borderRadius: 28, padding: 48 }}>
            {foam(856)}
            <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: 68, lineHeight: 1.05, color: C.espuma, marginTop: 24 }}>{d.drinks[0].name}</div>
            <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: 28, color: "#C9A874", marginTop: 12 }}>{d.drinks[0].meta}</div>
            {d.drinks[0].rating != null && <div style={{ display: "flex", marginTop: 28 }}>{glasses(d.drinks[0].rating, true)}</div>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", background: C.barra, borderRadius: 28, border: `1px solid ${C.borde}`, padding: 36, flexGrow: 1 }}>
            {d.drinks.slice(0, 4).map((dr, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: i === 0 ? 0 : 22, marginTop: i === 0 ? 0 : 22, borderTop: i === 0 ? "0px solid transparent" : `1px solid ${C.borde}` }}>
                <div style={{ display: "flex", flexDirection: "column", flexShrink: 1 }}>
                  <div style={{ display: "flex", fontFamily: SANS, fontWeight: 700, fontSize: 34, color: C.crema }}>{dr.name}</div>
                  <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: 24, color: C.tenue, marginTop: 4 }}>{dr.meta}</div>
                </div>
                {dr.rating != null ? glasses(dr.rating) : <div style={{ display: "flex", fontFamily: SANS, fontWeight: 400, fontSize: 22, color: C.tenue2 }}>sin calificar</div>}
              </div>
            ))}
            {d.drinks.length > 4 && (
              <div style={{ display: "flex", fontFamily: SANS, fontWeight: 700, fontSize: 26, color: C.ambar, marginTop: 22 }}>{`+${d.drinks.length - 4} más`}</div>
            )}
          </div>
        )}
      </div>

      {/* Mejor de la noche (si hay rating y no es single) */}
      {showBest && d.best && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 28, background: C.barraAlta, borderRadius: 20, padding: "22px 28px", border: `1px solid ${C.borde}` }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: SANS, fontWeight: 700, fontSize: 18, letterSpacing: 3, color: C.tenue }}>LA MEJOR DE LA NOCHE</div>
            <div style={{ display: "flex", fontFamily: DISP, fontWeight: 800, fontSize: 40, color: C.espuma, marginTop: 8 }}>{d.best.name}</div>
          </div>
          {glasses(d.best.rating, true)}
        </div>
      )}

      {/* Métricas: el total comparte protagonismo (variedad + parche) */}
      <div style={{ display: "flex", alignItems: "flex-end", marginTop: 32 }}>
        <div style={{ display: "flex", marginRight: 72 }}>{stat(d.total, d.total === 1 ? "bebida" : "bebidas")}</div>
        <div style={{ display: "flex", marginRight: 72 }}>{stat(d.distinct, d.distinct === 1 ? "distinta" : "distintas")}</div>
        <div style={{ display: "flex" }}>{stat(d.parche, "en el parche")}</div>
      </div>
    </div>
  );
}

export function renderShareCard(d: ShareData, format: "post" | "story"): ReactElement {
  if (format === "story") {
    return (
      <div style={{ width: 1080, height: 1920, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: C.noche }}>
        {cardBody(d)}
      </div>
    );
  }
  return cardBody(d);
}
