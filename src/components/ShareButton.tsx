"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";

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
export function ShareButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "post" | "story">(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function share(format: "post" | "story") {
    setError(null);
    setBusy(format);
    try {
      const res = await fetch(`/api/share/${sessionId}?format=${format}`);
      if (!res.ok) {
        // Mensaje distinto según la causa, sin exponer detalles técnicos, y dejando
        // claro si vale la pena reintentar (S.1).
        setError(
          res.status === 401 || res.status === 403
            ? "No tienes permiso para compartir esta salida."
            : res.status === 404
              ? "No se encontró la salida."
              : res.status === 504 || res.status === 408
                ? "Se tardó demasiado. Reintenta."
                : "El servidor no pudo crear la imagen. Reintenta.",
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
      setError("Se cortó la conexión. Reintenta.");
    } finally {
      setBusy(null);
    }
  }

  function openSheet(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Compartir"
        onClick={openSheet}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 34,
          padding: "0 14px 0 11px",
          borderRadius: 999,
          cursor: "pointer",
          border: "1px solid var(--color-borde)",
          background: "var(--color-barra-alta)",
          color: "var(--color-tenue)",
          font: "700 13.5px var(--font-sans)",
        }}
      >
        <Icon name="share" size={17} />
        Compartir
      </button>

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
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 2 }}>
                <span style={{ width: 40, height: 4, borderRadius: 99, background: "var(--color-borde)" }} />
              </div>
              <h2 style={{ font: "800 22px/1 var(--font-display)", letterSpacing: "-.02em", margin: 0 }}>Compartir esta salida</h2>
              <p style={{ font: "400 13.5px/1.45 var(--font-sans)", color: "var(--color-tenue)", margin: 0 }}>
                Se genera una imagen para mandar por donde quieras.
              </p>
              {error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: 0 }}>{error}</p>}
              <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={!!busy} onClick={() => share("story")}>
                {busy === "story" ? "Generando…" : "Historia"}
              </button>
              <button type="button" className="btn btn-ghost" style={{ width: "100%", height: 52 }} disabled={!!busy} onClick={() => share("post")}>
                {busy === "post" ? "Generando…" : "Publicación"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
