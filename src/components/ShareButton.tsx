"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { useSheetDrag } from "@/lib/useSheetDrag";

/**
 * Botón "Compartir" de la barra de acciones (Pasada S). Genera la share-card (imagen)
 * y abre la hoja nativa (`navigator.share` con el archivo); si no existe, descarga la
 * imagen. La app es privada, así que se comparte una IMAGEN, no un link.
 *
 * Formato (S.2 §3): "Historia" (1080×1920) primero y por defecto — Instagram close
 * friends es el destino más probable — y "Publicación" (4:5) como segunda opción, en
 * una hoja pequeña. Solo puede compartir quien ve la salida
 * (lo valida también la ruta /api/share/[id]). Dentro de la tarjeta-Link del feed, los
 * botones cortan la navegación.
 */
export function ShareButton({
  sessionId,
  variant = "bar",
  onAfterOpen,
}: {
  sessionId: string;
  // "bar": botón de la barra de acciones (feed). "icon": píldora del header (DS, círculo).
  // "menuItem": fila del menú del dueño (DS). La hoja de compartir es la misma en los tres.
  variant?: "bar" | "icon" | "menuItem";
  onAfterOpen?: () => void; // cerrar el menú del dueño al abrir la hoja
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "post" | "story">(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { dragY, dragging, dragHandlers } = useSheetDrag(() => { if (!busy) setOpen(false); });

  async function share(format: "post" | "story") {
    setError(null);
    setBusy(format);
    try {
      // B-1.2: SIN reintento transparente (escondía el problema y podía duplicar la espera).
      // La generación tarda ~2-4s (render de satori); el cliente espera con un indicador que
      // avanza (no un mensaje de error) y `maxDuration=30` le da margen a la función.
      const res = await fetch(`/api/share/${sessionId}?format=${format}`, { cache: "no-store" });
      if (!res.ok) {
        setError(
          res.status === 401 || res.status === 403
            ? "No tienes permiso para compartir esta salida."
            : res.status === 404
              ? "No se encontró la salida."
              : "No se pudo crear la imagen. Reintenta.",
        );
        return;
      }
      const blob = await res.blob();
      // Nombre legible que pone la ruta en Content-Disposition (S.3 §2): es lo que ve
      // quien recibe el archivo. Si faltara, un respaldo con el id.
      const cd = res.headers.get("content-disposition");
      const name = cd?.match(/filename="?([^";]+)"?/i)?.[1] ?? `friaday-${sessionId}.png`;
      const file = new File([blob], name, { type: "image/png" });
      const canShareFiles = typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] });
      if (canShareFiles) {
        await navigator.share({ files: [file] });
      } else {
        // Respaldo: descargar la imagen.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
      setOpen(false);
    } catch (e) {
      // AbortError = el usuario canceló la hoja nativa; no es error.
      if (e instanceof Error && e.name === "AbortError") return;
      setError("No se pudo crear la imagen. Revisa tu conexión y reintenta.");
    } finally {
      setBusy(null);
    }
  }

  function openSheet(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setOpen(true);
    onAfterOpen?.();
    // B-1.2: se retiró el warmup de Neon al abrir la hoja — el cold start (~1.5s) no era el
    // costo dominante (la base caliente ya son ~4s), así que despertar antes no lo movía.
  }

  return (
    <>
      {variant === "icon" ? (
        // Header del detalle (DS): píldora translúcida sobre la foto, como atrás.
        <button
          type="button"
          aria-label="Compartir"
          onClick={openSheet}
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: "rgba(10,7,4,.55)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(251,240,213,.16)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-espuma)",
            cursor: "pointer",
            flex: "none",
          }}
        >
          <Icon name="share" size={21} />
        </button>
      ) : variant === "menuItem" ? (
        // Fila del menú del dueño (DS).
        <button
          type="button"
          onClick={openSheet}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            width: "100%",
            height: 44,
            padding: "0 14px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            font: "600 14.5px var(--font-sans)",
            color: "var(--color-crema)",
          }}
        >
          <Icon name="share" size={18} color="var(--color-tenue)" />
          Compartir
        </button>
      ) : (
        <button
          type="button"
          aria-label="Compartir"
          onClick={openSheet}
          style={{
            // Acción 1a: flex:1, transparente, sin borde (misma fila que Brindar/Comentar).
            flex: 1,
            minWidth: 0,
            height: 40,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            font: "600 13.5px var(--font-sans)",
            color: "var(--color-tenue-2)",
          }}
        >
          <Icon name="share" size={17} />
          Compartir
        </button>
      )}

      {mounted && open &&
        createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 85 }} role="dialog" aria-modal="true" aria-label="Compartir salida">
            <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!busy) setOpen(false); }} style={{ position: "absolute", inset: 0, background: "rgba(10,7,4,.62)" }} />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                maxWidth: 440,
                margin: "0 auto",
                background: "var(--color-noche)",
                borderTop: "1px solid var(--color-borde)",
                borderRadius: "22px 22px 0 0",
                padding: "12px 18px calc(env(safe-area-inset-bottom,0px) + 22px)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                transform: `translateY(${dragY}px)`,
                transition: dragging ? "none" : "transform 0.25s ease",
              }}
            >
              {/* Zona de agarre (B-1 bug 3): grabber + encabezado arrastran para cerrar
                  (los botones quedan fuera para no pelear con el toque). */}
              <div {...dragHandlers} style={{ ...dragHandlers.style, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 2 }}>
                  <span style={{ width: 40, height: 4, borderRadius: 99, background: "var(--color-borde)" }} />
                </div>
                <h2 style={{ font: "800 22px/1 var(--font-display)", letterSpacing: "-.02em", margin: 0 }}>Compartir esta salida</h2>
                <p style={{ font: "400 13.5px/1.45 var(--font-sans)", color: "var(--color-tenue)", margin: 0 }}>
                  Se genera una imagen para mandar por donde quieras.
                </p>
              </div>
              {error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: 0 }}>{error}</p>}
              {busy ? (
                // Progreso honesto (B-1.2): una barra que AVANZA mientras se genera, con copy
                // franco. Nada de "está tardando"/error a los N segundos — la generación toma
                // sus ~2-4s y el indicador comunica que está trabajando, no que falló.
                <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "6px 0 2px" }} aria-live="polite">
                  {/* Copy honesto (B-1.3): no promete un tiempo ("la primera vez…" ya no era
                      cierto — en caliente igual son ~4-5s). Solo dice que está trabajando. */}
                  <div style={{ font: "600 14.5px var(--font-sans)", color: "var(--color-crema)" }}>
                    Armando tu {busy === "story" ? "historia" : "publicación"}…
                  </div>
                  <div aria-hidden style={{ position: "relative", height: 6, borderRadius: 99, background: "var(--color-barra-alta)", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, bottom: 0, width: "40%", borderRadius: 99, background: "var(--color-ambar)", animation: "fd-indeterminate 1.1s ease-in-out infinite" }} />
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={() => share("story")}>
                    Historia
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ width: "100%", height: 52 }} onClick={() => share("post")}>
                    Publicación
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
