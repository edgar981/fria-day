"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { yoTambien, undoYoTambien } from "@/app/actions/sessions";
import { FORMAT_LABEL, joinMeta } from "@/lib/format";
import { FoamStrip } from "@/components/FoamStrip";
import { Icon } from "@/components/Icon";
import type { BeerFormat } from "@/lib/domain";

export interface TaggedCheckIn {
  id: string;
  quantity: number;
  format: BeerFormat;
  rating: number | null;
  beerName: string;
  brewery: string | null;
}

/**
 * Bebidas de una salida AJENA donde te etiquetaron (DS · estado 1e), en una sola tarjeta
 * coronada por la costura de espuma. "Yo también" por fila (Pasada Y) registra esa bebida
 * en TU salida de esa fecha: es un check-in TUYO, así que el invariante se mantiene.
 *
 * Tras usarlo, la fila deja CONSTANCIA ("✓ En tu salida") en vez de que el botón se quede
 * igual — el título "Las bebidas de X", el contador y estos botones ya dicen la regla; no
 * hace falta el banner que la explicaba (se quitó, Pasada T).
 *
 * La constancia sale de los DATOS (DS.1): `initialAddedIds` marca las bebidas que el viewer
 * ya tiene en su salida de esa fecha (el servidor las calcula con la misma clave de
 * emparejamiento que `yoTambien`), así que sobrevive a la recarga y re-tocar no duplica.
 * El estado local encima da el optimismo instantáneo del tap y el Deshacer.
 */
export function TaggedCheckInList({
  checkIns,
  canYoTambien,
  initialAddedIds = [],
  onAddedCountChange,
}: {
  checkIns: TaggedCheckIn[];
  canYoTambien: boolean;
  // DS.1: bebidas que el viewer YA tiene en su salida de la fecha (constancia persistente).
  initialAddedIds?: string[];
  // DS · 1e: cuántas filas llevan constancia, para el contador "N tuyas, ya sumadas".
  onAddedCountChange?: (n: number) => void;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(() => new Set(initialAddedIds));
  useEffect(() => { onAddedCountChange?.(added.size); }, [added, onAddedCountChange]);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ sourceId: string; checkInId: string; sessionCreated: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function add(sourceId: string) {
    setError(null);
    setBusyId(sourceId);
    const res = await yoTambien(sourceId);
    setBusyId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAdded((s) => new Set(s).add(sourceId));
    setUndo({ sourceId, checkInId: res.checkInId, sessionCreated: res.sessionCreated });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), 8000);
    router.refresh();
  }

  function doUndo() {
    if (!undo) return;
    const u = undo;
    if (timer.current) clearTimeout(timer.current);
    setUndo(null);
    setAdded((s) => {
      const n = new Set(s);
      n.delete(u.sourceId);
      return n;
    });
    void undoYoTambien(u.checkInId, u.sessionCreated).then(() => router.refresh());
  }

  return (
    <>
      <div style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 20, overflow: "hidden" }}>
        <FoamStrip size="sm" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {checkIns.map((c, i) => {
            const isAdded = added.has(c.id);
            return (
              <div key={c.id}>
                {i > 0 && <div style={{ height: 1, background: "#241A12", margin: "0 12px" }} />}
                <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px 11px 14px", background: isAdded ? "rgba(62,143,107,.07)" : "transparent" }}>
                  <span style={{ minWidth: 34, height: 30, padding: "0 8px", borderRadius: 9, background: "#2E2217", color: "var(--color-ambar)", font: "700 14px var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    {c.quantity}×
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 15px/1.2 var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.beerName}</div>
                    <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue)" }}>{joinMeta(c.brewery, FORMAT_LABEL[c.format])}</div>
                  </div>
                  {canYoTambien &&
                    (isAdded ? (
                      <span style={{ height: 38, display: "flex", alignItems: "center", gap: 6, padding: "0 13px", borderRadius: 12, background: "rgba(62,143,107,.16)", border: "1px solid rgba(62,143,107,.42)", font: "600 13px var(--font-sans)", color: "#6FC79C", flex: "none", whiteSpace: "nowrap" }}>
                        ✓ En tu salida
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => add(c.id)}
                        disabled={busyId === c.id}
                        style={{ height: 38, display: "flex", alignItems: "center", gap: 6, padding: "0 13px", borderRadius: 12, border: "1px solid #4A3A28", background: "transparent", font: "700 13px var(--font-sans)", color: "var(--color-ambar)", flex: "none", cursor: busyId === c.id ? "default" : "pointer", whiteSpace: "nowrap" }}
                      >
                        {busyId === c.id ? "Agregando…" : <><Icon name="plus" size={16} /> Yo también</>}
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: "9px 0 0" }}>{error}</p>}

      {/* Aviso de éxito con Deshacer (mismo patrón que quitar un check-in). */}
      {undo && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom,0px) + 18px)", display: "flex", justifyContent: "center", zIndex: 70, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 14, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 14, padding: "12px 16px", boxShadow: "0 12px 30px rgba(0,0,0,.5)", maxWidth: 360 }}>
            <span style={{ font: "500 14px var(--font-sans)", color: "var(--color-crema)" }}>Agregada a tu salida</span>
            <button type="button" onClick={doUndo} style={{ font: "700 14px var(--font-sans)", color: "var(--color-ambar)", background: "none", border: "none", cursor: "pointer" }}>Deshacer</button>
          </div>
        </div>
      )}
    </>
  );
}
