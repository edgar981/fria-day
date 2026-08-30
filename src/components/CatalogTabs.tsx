"use client";

import { useState } from "react";
import Link from "next/link";
import { joinMeta } from "@/lib/format";
import type { DrinkKind } from "@/lib/domain";

export interface CatalogBeer {
  id: string;
  name: string;
  brewery: string | null;
  style: string | null;
  kind: DrinkKind;
  avgRating: number | null;
  ratingsCount: number;
}

function RankRow({ beer, rank }: { beer: CatalogBeer; rank: number }) {
  return (
    <Link
      href={`/beers/${beer.id}`}
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderBottom: "1px solid #241A12", textDecoration: "none", color: "var(--color-crema)" }}
    >
      <span style={{ font: "800 20px var(--font-display)", color: rank <= 2 ? "var(--color-ambar)" : "var(--color-tenue)", width: 24, flex: "none" }}>{rank + 1}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ font: "600 16px/1.2 var(--font-sans)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{beer.name}</span>
        <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>{joinMeta(beer.brewery, beer.style)}</span>
      </span>
      <span style={{ textAlign: "right", flex: "none" }}>
        <span style={{ font: "800 20px/1 var(--font-display)", color: "var(--color-espuma)", display: "block" }}>{beer.avgRating!.toFixed(1)}</span>
        <span style={{ font: "400 11px var(--font-sans)", color: "var(--color-tenue)" }}>{beer.ratingsCount} rating{beer.ratingsCount !== 1 ? "s" : ""}</span>
      </span>
    </Link>
  );
}

/**
 * Catálogo partido por tipo (Pasada D): pestañas Cervezas / Cócteles. Misma búsqueda,
 * mismo ranking (promedio desc, sin calificar al final), misma edición de campos en el
 * detalle. La búsqueda (q) aplica a ambos; el conteo vive en cada pestaña.
 */
export function CatalogTabs({
  cervezas,
  cocteles,
  q,
}: {
  cervezas: CatalogBeer[];
  cocteles: CatalogBeer[];
  q: string;
}) {
  const [tab, setTab] = useState<DrinkKind>("CERVEZA");
  const list = tab === "CERVEZA" ? cervezas : cocteles;
  const rated = list.filter((b) => b.avgRating != null);
  const unrated = list.filter((b) => b.avgRating == null);

  const chip = (k: DrinkKind, label: string, n: number) => {
    const on = tab === k;
    return (
      <button
        type="button"
        onClick={() => setTab(k)}
        aria-pressed={on}
        style={{ flex: 1, height: 40, borderRadius: 12, border: `1px solid ${on ? "var(--color-ambar)" : "var(--color-borde)"}`, background: on ? "rgba(242,160,22,.12)" : "transparent", color: on ? "var(--color-ambar)" : "var(--color-tenue)", font: `${on ? 700 : 600} 14px var(--font-sans)`, cursor: "pointer" }}
      >
        {label} · {n}
      </button>
    );
  };

  const emptyMsg = q
    ? "Nada coincide."
    : tab === "CERVEZA"
      ? "Todavía sin cervezas."
      : "Todavía sin cócteles.";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {chip("CERVEZA", "Cervezas", cervezas.length)}
        {chip("COCTEL", "Cócteles", cocteles.length)}
      </div>

      {list.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--color-tenue)", marginTop: 12 }}>
          {emptyMsg}
        </div>
      ) : (
        <>
          {rated.map((b, i) => (
            <RankRow key={b.id} beer={b} rank={i} />
          ))}
          {unrated.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 4px" }}>
                <span className="eyebrow">Sin calificar · {unrated.length}</span>
                <span style={{ flex: 1, height: 1, background: "#241A12" }} />
              </div>
              {unrated.map((b) => (
                <Link key={b.id} href={`/beers/${b.id}`} style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 0", borderBottom: "1px solid #241A12", textDecoration: "none" }}>
                  <span style={{ width: 24, flex: "none" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ font: "600 16px/1.2 var(--font-sans)", display: "block", color: "#D6C7AE" }}>{b.name}</span>
                    <span style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>{joinMeta(b.brewery, b.style)}</span>
                  </span>
                  <span style={{ font: "600 12.5px var(--font-sans)", color: "var(--color-ambar)", border: "1px dashed #6B5334", borderRadius: 999, padding: "7px 13px", flex: "none" }}>Calificála</span>
                </Link>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
