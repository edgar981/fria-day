"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { compressImage, ImageError } from "@/lib/image";

/** Ícono de cámara inline (no está en el sprite de Icon). */
function CameraGlyph({ size = 22, color = "var(--color-ambar)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ color }}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.7l.9-1.5A1 1 0 0 1 9 5h6a1 1 0 0 1 .86.5L16.8 7h1.7A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

/**
 * Control de foto reutilizable (Pasada F): elegir → comprimir (cliente) → subir a
 * Blob → devolver la URL por onChange. Es AGNÓSTICO a la persistencia: quien lo usa
 * decide qué hacer con la URL (guardarla en un borrador local, o llamar a
 * setCheckInPhoto/removeCheckInPhoto en el detalle). La foto nunca bloquea nada:
 * un fallo de subida solo muestra el error y deja el valor anterior.
 */
export function PhotoField({
  value,
  onChange,
  onBusyChange,
  size = 56,
  disabled,
}: {
  value: string | null;
  onChange: (url: string | null) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  size?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setBusyBoth(b: boolean) {
    setBusy(b);
    onBusyChange?.(b);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el MISMO archivo
    if (!file) return;
    setError(null);
    setBusyBoth(true);
    try {
      const { blob, filename } = await compressImage(file);
      const uploaded = await upload(filename, blob, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        contentType: "image/jpeg",
      });
      await onChange(uploaded.url);
    } catch (err) {
      setError(
        err instanceof ImageError
          ? err.message
          : "No se pudo subir la foto. Intenta de nuevo.",
      );
    } finally {
      setBusyBoth(false);
    }
  }

  function pick() {
    if (!busy && !disabled) inputRef.current?.click();
  }
  async function remove() {
    if (busy || disabled) return;
    setError(null);
    await onChange(null);
  }

  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 14,
    flex: "none",
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        style={{ display: "none" }}
      />

      {busy ? (
        <span style={{ ...box, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="spinner" style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid rgba(251,240,213,.25)", borderTopColor: "var(--color-ambar)", display: "block", animation: "fd-spin .7s linear infinite" }} />
        </span>
      ) : value ? (
        <span style={{ ...box, border: "1px solid var(--color-borde)" }}>
          <button
            type="button"
            onClick={pick}
            aria-label="Cambiar foto"
            disabled={disabled}
            style={{ display: "block", width: "100%", height: "100%", padding: 0, border: "none", background: "transparent", cursor: disabled ? "default" : "pointer" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Foto de la cerveza" width={size} height={size} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={remove}
              aria-label="Quitar foto"
              style={{ position: "absolute", top: 3, right: 3, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(10,7,4,.72)", color: "var(--color-espuma)", cursor: "pointer", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              ×
            </button>
          )}
        </span>
      ) : (
        <button
          type="button"
          onClick={pick}
          aria-label="Agregar foto"
          disabled={disabled}
          style={{ ...box, border: "1px dashed #6B5334", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer" }}
        >
          <CameraGlyph />
        </button>
      )}

      {error && (
        <span style={{ font: "500 11.5px/1.3 var(--font-sans)", color: "var(--color-alerta)", maxWidth: 160 }}>
          {error}
        </span>
      )}
    </div>
  );
}
