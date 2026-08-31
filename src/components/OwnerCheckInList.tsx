"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCheckIn, addCheckIn, updateCheckIn, setCheckInPhoto, removeCheckInPhoto, bumpCheckInQuantity } from "@/app/actions/sessions";
import { FORMAT_LABEL, joinMeta } from "@/lib/format";
import { FoamStrip } from "@/components/FoamStrip";
import { PhotoField } from "@/components/PhotoField";
import type { BeerFormat } from "@/lib/domain";

export interface OwnerCheckIn {
  id: string;
  quantity: number;
  format: BeerFormat;
  rating: number | null;
  beerId: string;
  beerName: string;
  brewery: string | null;
  photoUrl: string | null;
}

// Item A.1-1: editar el rating tocando el medidor de vasos.
function RatingEditor({ checkInId, initial }: { checkInId: string; initial: number | null }) {
  const router = useRouter();
  const [val, setVal] = useState<number | null>(initial);
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();

  function commit(next: number | null) {
    setVal(next);
    setEditing(next != null ? false : true);
    start(async () => {
      await updateCheckIn({ checkInId, rating: next });
      router.refresh();
    });
  }

  if (val == null && !editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} style={{ font: "500 12px var(--font-sans)", color: "var(--color-tenue-2)", border: "1px dashed #3A2A1A", borderRadius: 999, padding: "6px 11px", background: "transparent", cursor: "pointer" }}>
        Calificar
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`${n} de 5`} onClick={() => commit(val === n ? null : n)} style={{ padding: "6px 2px", background: "transparent", border: "none", cursor: "pointer" }}>
          <span style={{ width: 8, height: 17, borderRadius: 2, background: n <= (val ?? 0) ? "var(--color-ambar)" : "#3A2A1A", display: "block" }} />
        </button>
      ))}
    </span>
  );
}

/**
 * Stepper de cantidad (Pasada R): −/+ inmediato al servidor. "me tomé otra igual" es
 * un toque. Mínimo 1 (bajar a 0 no borra: para eso está la X con Deshacer).
 *
 * Robustez de taps rápidos: el bump es RELATIVO (±1) y atómico en el servidor, y el
 * efecto NO va dentro del updater de setState (StrictMode lo invoca dos veces en dev y
 * doblaría los taps). Se usa un ref con la cantidad actual, se calcula fuera y se
 * dispara el bump una vez por tap. router.refresh solo tras asentarse (debounce), para
 * no pisar el optimismo ni el conteo en vuelo.
 */
function QtyStepper({ checkInId, initial }: { checkInId: string; initial: number }) {
  const router = useRouter();
  const [qty, setQty] = useState(initial);
  const qtyRef = useRef(initial);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resincroniza con el servidor cuando llegan props nuevas (tras refresh), si no hay
  // taps en vuelo. En el caso normal ya coinciden (optimismo == servidor) → no-op.
  useEffect(() => {
    if (pending.current === 0) {
      qtyRef.current = initial;
      setQty(initial);
    }
  }, [initial]);

  function bump(delta: 1 | -1) {
    const next = Math.max(1, qtyRef.current + delta);
    if (next === qtyRef.current) return; // ya en el mínimo: "−" no hace nada
    qtyRef.current = next;
    setQty(next);
    pending.current++;
    void bumpCheckInQuantity(checkInId, delta).finally(() => {
      pending.current--;
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (pending.current === 0) router.refresh();
    }, 1200);
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--color-borde)", borderRadius: 12, overflow: "hidden", background: "var(--color-barra-alta)", flex: "none" }}>
      <button type="button" aria-label="Una menos" onClick={() => bump(-1)} disabled={qty <= 1} style={{ width: 44, height: 40, border: "none", background: "transparent", font: "600 20px var(--font-sans)", color: qty <= 1 ? "#4A3A28" : "var(--color-tenue)", cursor: qty <= 1 ? "default" : "pointer" }}>−</button>
      <span style={{ minWidth: 40, textAlign: "center", font: "700 17px var(--font-display)", color: "var(--color-crema)" }}>{qty}×</span>
      <button type="button" aria-label="Una más" onClick={() => bump(1)} style={{ width: 44, height: 40, border: "none", background: "var(--color-borde)", font: "600 20px var(--font-sans)", color: "var(--color-ambar)", cursor: "pointer" }}>＋</button>
    </div>
  );
}

export function OwnerCheckInList({
  sessionId,
  checkIns,
}: {
  sessionId: string;
  checkIns: OwnerCheckIn[];
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<OwnerCheckIn | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function remove(c: OwnerCheckIn) {
    // Se aplica de inmediato (item A.1-2): borrar en servidor y ocultar.
    setRemoved((s) => new Set(s).add(c.id));
    setUndo(c);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), 8000);
    void deleteCheckIn(c.id).then(() => router.refresh());
  }

  function doUndo() {
    if (!undo) return;
    const c = undo;
    if (timer.current) clearTimeout(timer.current);
    setUndo(null);
    // Restaura con los mismos valores (nuevo id).
    void addCheckIn({ sessionId, beerId: c.beerId, quantity: c.quantity, format: c.format, rating: c.rating }).then(() => {
      setRemoved((s) => {
        const n = new Set(s);
        n.delete(c.id);
        return n;
      });
      router.refresh();
    });
  }

  // Foto en el detalle: adjuntar/reemplazar/quitar (solo el dueño). setCheckInPhoto
  // borra el archivo anterior al reemplazar; removeCheckInPhoto lo borra al quitar.
  async function onRowPhoto(id: string, url: string | null) {
    if (url) await setCheckInPhoto(id, url);
    else await removeCheckInPhoto(id);
    router.refresh();
  }

  const visible = checkIns.filter((c) => !removed.has(c.id));

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {visible.map((c) => (
          <div key={c.id} style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 18, overflow: "hidden" }}>
            <FoamStrip size="sm" />
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PhotoField value={c.photoUrl} onChange={(url) => onRowPhoto(c.id, url)} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 15.5px/1.2 var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.beerName}</div>
                  <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue)" }}>{joinMeta(c.brewery, FORMAT_LABEL[c.format])}</div>
                </div>
                <button
                  type="button"
                  aria-label="Quitar bebida"
                  onClick={() => remove(c)}
                  style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid var(--color-borde)", background: "transparent", color: "var(--color-tenue)", cursor: "pointer", fontSize: 15, lineHeight: 1, flex: "none" }}
                >
                  ×
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <QtyStepper checkInId={c.id} initial={c.quantity} />
                <RatingEditor checkInId={c.id} initial={c.rating} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Aviso deshacer (item A.1-2) */}
      {undo && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom,0px) + 18px)", display: "flex", justifyContent: "center", zIndex: 70, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 14, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 14, padding: "12px 16px", boxShadow: "0 12px 30px rgba(0,0,0,.5)", maxWidth: 360 }}>
            <span style={{ font: "500 14px var(--font-sans)", color: "var(--color-crema)" }}>Bebida eliminada</span>
            <button type="button" onClick={doUndo} style={{ font: "700 14px var(--font-sans)", color: "var(--color-ambar)", background: "none", border: "none", cursor: "pointer" }}>Deshacer</button>
          </div>
        </div>
      )}
    </>
  );
}
