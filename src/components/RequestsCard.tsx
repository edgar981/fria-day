"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { useSheetDrag } from "@/lib/useSheetDrag";
import { useSheetEnter, sheetEnterTransform } from "@/lib/useSheetEnter";
import { acceptRequest, rejectRequest } from "@/app/actions/requests";
import { timeOnApp } from "@/lib/format";

// Espejo de PendingRequest (queries.ts es server-only): se pasa por props desde el server.
export interface PendingRequestView {
  requestId: string;
  id: string;
  displayName: string;
  avatar: string | null;
  createdAt: Date | string;
  points: number;
}

function namesSummary(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names[0]}, ${names[1]} y ${names.length - 2} más`;
}

/**
 * Las solicitudes pendientes (Pasada PA · §3): tarjeta en TU perfil, arriba, SOLO si hay alguna.
 * Borde claro (no ámbar, no punto rojo: no es alarma, son personas esperando). "Revisar" abre la
 * hoja "Quieren entrar", con Aceptar / Rechazar por persona. Sin badge en la barra. Sin líneas que
 * expliquen la mecánica (Pasada T): el título y los botones bastan.
 */
export function RequestsCard({ requests }: { requests: PendingRequestView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [acted, setActed] = useState<Record<string, "accepted" | "rejected">>({});
  const { dragY, dragging, dragHandlers } = useSheetDrag(closeSheet);
  const entered = useSheetEnter(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeSheet() {
    setOpen(false);
    // Al cerrar, refresca: las aceptadas cambian el círculo, las rechazadas ya no están.
    if (Object.keys(acted).length > 0) router.refresh();
  }

  function act(requestId: string, kind: "accepted" | "rejected") {
    startTransition(async () => {
      const res = kind === "accepted" ? await acceptRequest(requestId) : await rejectRequest(requestId);
      if (res.ok) setActed((a) => ({ ...a, [requestId]: kind }));
    });
  }

  const names = namesSummary(requests.map((r) => r.displayName));

  return (
    <>
      {/* La tarjeta, entre tu nombre y tus puntos. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "var(--color-barra)", border: "1px solid #4A3A28", borderRadius: 20, padding: "13px 15px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", flex: "none" }}>
          {requests.slice(0, 3).map((r, i) => (
            <span key={r.requestId} style={{ marginLeft: i === 0 ? 0 : -10, border: "2px solid var(--color-barra)", borderRadius: 13, display: "flex" }}>
              <Avatar avatar={r.avatar} size={34} radius={11} />
            </span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "700 15px var(--font-sans)", color: "var(--color-crema)" }}>
            {requests.length} quiere{requests.length === 1 ? "" : "n"} entrar a tu parche
          </div>
          <div style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{names}</div>
        </div>
        <span style={{ font: "700 13.5px var(--font-sans)", color: "var(--color-ambar)", flex: "none" }}>Revisar</span>
      </button>

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80 }} role="dialog" aria-modal="true" aria-label="Quieren entrar">
          <div onClick={closeSheet} style={{ position: "absolute", inset: 0, background: "rgba(10,7,4,.62)" }} />
          <div
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0, maxWidth: 440, margin: "0 auto", maxHeight: "90vh", overflowY: "auto",
              background: "var(--color-noche)", borderTop: "1px solid var(--color-borde)", borderRadius: "22px 22px 0 0",
              padding: "10px 18px calc(env(safe-area-inset-bottom,0px) + 22px)", display: "flex", flexDirection: "column", gap: 16,
              transform: sheetEnterTransform(entered, dragY), transition: dragging ? "none" : "transform 0.25s ease",
            }}
          >
            <div {...dragHandlers}>
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
                <span style={{ width: 40, height: 4, borderRadius: 99, background: "var(--color-borde)" }} />
              </div>
              <h2 style={{ font: "800 24px/1 var(--font-display)", letterSpacing: "-.02em", margin: "12px 0 0", paddingRight: 44 }}>Quieren entrar</h2>
            </div>
            <button type="button" onClick={closeSheet} aria-label="Cerrar" style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: 11, border: "1px solid var(--color-borde)", background: "var(--color-noche)", color: "var(--color-tenue)", cursor: "pointer", fontSize: 17, lineHeight: 1, flex: "none", zIndex: 1 }}>×</button>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {requests.filter((r) => acted[r.requestId] !== "rejected").map((r) => {
                const state = acted[r.requestId];
                return (
                  <div key={r.requestId} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar avatar={r.avatar} size={46} radius={15} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: "700 16px var(--font-sans)", color: "var(--color-crema)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.displayName}</div>
                        <div style={{ font: "400 12.5px var(--font-sans)", color: "var(--color-tenue)", marginTop: 2 }}>
                          Hace {timeOnApp(new Date(r.createdAt))} en FriaDay · {r.points.toLocaleString("es-CO")} puntos
                        </div>
                      </div>
                      {state === "accepted" && (
                        <span style={{ flex: "none", display: "inline-flex", alignItems: "center", background: "rgba(62,143,107,.16)", border: "1px solid rgba(62,143,107,.42)", color: "#6FC79C", font: "600 11.5px var(--font-sans)", borderRadius: 999, padding: "4px 10px" }}>En tu parche</span>
                      )}
                    </div>
                    {!state && (
                      <div style={{ display: "flex", gap: 9 }}>
                        <button type="button" className="btn btn-primary" style={{ flex: 1, height: 46 }} disabled={busy} onClick={() => act(r.requestId, "accepted")}>Aceptar</button>
                        <button type="button" className="btn btn-ghost" style={{ flex: 1, height: 46 }} disabled={busy} onClick={() => act(r.requestId, "rejected")}>Rechazar</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
