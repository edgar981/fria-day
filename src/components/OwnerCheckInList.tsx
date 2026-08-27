"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCheckIn, addCheckIn, updateCheckIn } from "@/app/actions/sessions";
import { FORMAT_LABEL } from "@/lib/format";
import type { BeerFormat } from "@/lib/domain";

export interface OwnerCheckIn {
  id: string;
  quantity: number;
  format: BeerFormat;
  rating: number | null;
  beerId: string;
  beerName: string;
  brewery: string;
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

  const visible = checkIns.filter((c) => !removed.has(c.id));

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {visible.map((c, i) => (
          <div key={c.id} style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 18, overflow: "hidden" }}>
            {i === 0 && <div style={{ height: 6, background: "radial-gradient(circle at 50% 100%,#FBF0D5 4.5px,transparent 5px) 0 0/10px 6px repeat-x" }} />}
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ minWidth: 36, height: 34, padding: "0 9px", borderRadius: 11, background: "#2E2217", color: "var(--color-ambar)", font: "700 16px var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{c.quantity}×</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 16px/1.2 var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.beerName}</div>
                <div style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)" }}>{c.brewery} · {FORMAT_LABEL[c.format]}</div>
              </div>
              <RatingEditor checkInId={c.id} initial={c.rating} />
              <button
                type="button"
                aria-label="Quitar cerveza"
                onClick={() => remove(c)}
                style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid var(--color-borde)", background: "transparent", color: "var(--color-tenue)", cursor: "pointer", fontSize: 15, lineHeight: 1, flex: "none" }}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Aviso deshacer (item A.1-2) */}
      {undo && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom,0px) + 18px)", display: "flex", justifyContent: "center", zIndex: 70, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 14, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 14, padding: "12px 16px", boxShadow: "0 12px 30px rgba(0,0,0,.5)", maxWidth: 360 }}>
            <span style={{ font: "500 14px var(--font-sans)", color: "var(--color-crema)" }}>Cerveza eliminada</span>
            <button type="button" onClick={doUndo} style={{ font: "700 14px var(--font-sans)", color: "var(--color-ambar)", background: "none", border: "none", cursor: "pointer" }}>Deshacer</button>
          </div>
        </div>
      )}
    </>
  );
}
