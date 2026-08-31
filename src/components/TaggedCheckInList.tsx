"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { yoTambien, undoYoTambien } from "@/app/actions/sessions";
import { FORMAT_LABEL, joinMeta } from "@/lib/format";
import { FoamStrip } from "@/components/FoamStrip";
import { RatingCell } from "@/components/Glasses";
import type { BeerFormat } from "@/lib/domain";

export interface TaggedCheckIn {
  id: string;
  quantity: number;
  format: BeerFormat;
  rating: number | null;
  beerName: string;
  brewery: string | null;
  photoUrl: string | null;
}

/**
 * Lista de bebidas de una salida AJENA en solo lectura (Pasada C) con "Yo también"
 * por bebida (Pasada Y). "Yo también" registra esa bebida en TU salida de esa fecha:
 * es un check-in TUYO, así que el invariante se mantiene. Confirmación mínima: aviso
 * de éxito con "Deshacer" (mismo patrón que quitar un check-in), sin diálogo previo.
 */
export function TaggedCheckInList({
  checkIns,
  canYoTambien,
}: {
  checkIns: TaggedCheckIn[];
  canYoTambien: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ checkInId: string; sessionCreated: boolean } | null>(null);
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
    setUndo({ checkInId: res.checkInId, sessionCreated: res.sessionCreated });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), 8000);
    router.refresh();
  }

  function doUndo() {
    if (!undo) return;
    const u = undo;
    if (timer.current) clearTimeout(timer.current);
    setUndo(null);
    void undoYoTambien(u.checkInId, u.sessionCreated).then(() => router.refresh());
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {checkIns.map((c) => (
          <div key={c.id} style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 18, overflow: "hidden" }}>
            <FoamStrip size="sm" />
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11 }}>
              {c.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photoUrl} alt="Foto de la bebida" width={46} height={46} loading="lazy" style={{ width: 46, height: 46, borderRadius: 14, objectFit: "cover", flex: "none", border: "1px solid var(--color-borde)" }} />
              )}
              <span style={{ minWidth: 36, height: 34, padding: "0 9px", borderRadius: 11, background: "#2E2217", color: "var(--color-ambar)", font: "700 16px var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{c.quantity}×</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 16px/1.2 var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.beerName}</div>
                <div style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>{joinMeta(c.brewery, FORMAT_LABEL[c.format])}</div>
              </div>
              <RatingCell value={c.rating} size="sm" />
            </div>
            {canYoTambien && (
              <button
                type="button"
                onClick={() => add(c.id)}
                disabled={busyId === c.id}
                style={{ width: "100%", borderTop: "1px solid var(--color-borde)", background: "transparent", color: "var(--color-ambar)", font: "700 13.5px var(--font-sans)", padding: "11px 0", cursor: busyId === c.id ? "default" : "pointer", border: "none", borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "var(--color-borde)" }}
              >
                {busyId === c.id ? "Agregando…" : "＋ Yo también"}
              </button>
            )}
          </div>
        ))}
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
