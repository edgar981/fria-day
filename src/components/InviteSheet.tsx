"use client";

import { useEffect } from "react";
import { InviteGenerator } from "@/components/InviteGenerator";
import { ShareCodeButton } from "@/components/ShareCodeButton";
import { QrCode } from "@/components/QrCode";
import { formatDay } from "@/lib/format";
import { useSheetDrag } from "@/lib/useSheetDrag";

export interface InviteRow {
  id: string;
  code: string;
  createdAt: Date;
  expiresAt: Date | null;
}

/**
 * Hoja de invitación (Pasada N): la misma funcionalidad que tenía la pantalla
 * /invite —generar código, ver los disponibles, compartir— pero sin pantalla propia.
 * Se abre desde el icono de personas del header del Leaderboard (y desde el copy del
 * ranking vacío / el feed vacío vía ?invite=1). Overlay tipo hoja, igual que BeerSheet.
 */
export function InviteSheet({
  open,
  onClose,
  invitations,
}: {
  open: boolean;
  onClose: () => void;
  invitations: InviteRow[];
}) {
  const { dragY, dragging, dragHandlers } = useSheetDrag(onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }} role="dialog" aria-modal="true" aria-label="Invitar al parche">
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,7,4,.62)" }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 440,
          margin: "0 auto",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--color-noche)",
          borderTop: "1px solid var(--color-borde)",
          borderRadius: "22px 22px 0 0",
          padding: "10px 18px calc(env(safe-area-inset-bottom,0px) + 22px)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform 0.25s ease",
        }}
      >
        {/* Zona de agarre (B-1 bug 3): grabber + encabezado arrastran para cerrar. La X
            queda FUERA de la zona para que su toque no lo trague el pointer capture. */}
        <div {...dragHandlers}>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
            <span style={{ width: 40, height: 4, borderRadius: 99, background: "var(--color-borde)" }} />
          </div>
          <div style={{ marginTop: 12, paddingRight: 44 }}>
            <h2 style={{ font: "800 24px/1 var(--font-display)", letterSpacing: "-.02em", margin: 0 }}>Invitar al parche</h2>
            <p style={{ font: "400 13.5px/1.45 var(--font-sans)", color: "var(--color-tenue)", margin: "7px 0 0" }}>
              FriaDay es solo por invitación. Genera un código y pásaselo a tu parcero.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: 11, border: "1px solid var(--color-borde)", background: "var(--color-noche)", color: "var(--color-tenue)", cursor: "pointer", fontSize: 17, lineHeight: 1, flex: "none", zIndex: 1 }}
        >
          ×
        </button>

        <InviteGenerator />

        <section>
          <div className="eyebrow" style={{ marginBottom: 11 }}>Códigos disponibles</div>
          {invitations.length === 0 ? (
            <p style={{ font: "400 14px var(--font-sans)", color: "var(--color-tenue)" }}>
              Ninguno todavía. Genera uno arriba.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {invitations.map((inv) => (
                <div key={inv.id} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Pasada Q: QR de cada código disponible. */}
                  <QrCode code={inv.code} size={84} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      {/* I-1.4: código seleccionable/copiable a mano (la app está en
                          user-select:none por el hold de reacciones; aquí se re-habilita). */}
                      <div style={{ font: "700 17px var(--font-display)", letterSpacing: ".12em", color: "var(--color-espuma)", WebkitUserSelect: "text", userSelect: "text", WebkitTouchCallout: "default" }}>{inv.code}</div>
                      {/* suppressHydrationWarning: la abreviatura de mes de Intl difiere
                          entre Node ("sep.") y WebKit ("sept") → desajuste cosmético de
                          hidratación cuando la hoja se abre por SSR (?invite=1). */}
                      <div suppressHydrationWarning style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue-2)", marginTop: 2 }}>
                        Creada {formatDay(inv.createdAt)}
                        {inv.expiresAt ? ` · expira ${formatDay(inv.expiresAt)}` : ""}
                      </div>
                    </div>
                    <ShareCodeButton code={inv.code} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
