"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { useSheetDrag } from "@/lib/useSheetDrag";
import { useSheetEnter, sheetEnterTransform } from "@/lib/useSheetEnter";

/**
 * Botón "Compartir" + su hoja (Pasada SC · Tanda 3): UN SOLO sheet. Al abrir se dispara la
 * generación de la imagen (Historia por defecto; el caso pobre abre en Publicación) y se pide el
 * meta (encabezado + stats). El usuario ve el PREVIEW y elige formato mientras tanto; cuando toca
 * Compartir el toque es FRESCO y la imagen YA está en memoria → `navigator.share` entra en la
 * ventana de activación de iOS sin el baile de re-armado de la v2. Cada formato se genera una vez
 * y queda en caché (volver al otro es instantáneo). La app es privada: se comparte una IMAGEN.
 *
 * El chrome usa el tema de la app (noche) con el COLOR de la cascada de la tarjeta como acento
 * (el mismo color/tinta que pinta la card, que trae el meta). Nunca se ofrece Compartir sin
 * imagen: si la generación falla, el preview informa y el botón primario pasa a Reintentar.
 */

type Format = "post" | "story";

interface ShareMeta {
  place: string | null;
  ownerName: string;
  outing: number;
  dateShort: string; // "VIE 28 AGO"
  total: number;
  duration: { value: string; window: string } | null;
  single: boolean;
  hasPhoto: boolean;
  defaultFormat: Format;
  color: string;
  ink: string;
}

type SlotStatus = "idle" | "loading" | "ready" | "error";
interface Slot {
  status: SlotStatus;
  url?: string; // object URL para el <img> del preview
  message?: string; // texto de error para el preview
}

export function ShareButton({
  sessionId,
  variant = "bar",
  onClose,
}: {
  sessionId: string;
  variant?: "bar" | "icon" | "menuItem";
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [format, setFormat] = useState<Format>("story");
  const [slots, setSlots] = useState<Record<Format, Slot>>({ post: { status: "idle" }, story: { status: "idle" } });
  const [shareError, setShareError] = useState<string | null>(null);

  // Espejo síncrono de `slots` para leer el estado más reciente sin cerrar sobre el render (el
  // guard de `generate` y evitar regenerar un formato ya en caché). `setSlot` actualiza ambos.
  const slotsRef = useRef<Record<Format, Slot>>({ post: { status: "idle" }, story: { status: "idle" } });
  function setSlot(fmt: Format, slot: Slot) {
    slotsRef.current = { ...slotsRef.current, [fmt]: slot };
    setSlots((s) => ({ ...s, [fmt]: slot }));
  }
  function resetSlots() {
    slotsRef.current = { post: { status: "idle" }, story: { status: "idle" } };
    setSlots({ post: { status: "idle" }, story: { status: "idle" } });
  }

  // La imagen ya generada (File) para el gesto de compartir, sin pasar por el estado (evita
  // cierres obsoletos en el onClick). Se llena a la par que el slot "ready".
  const filesRef = useRef<Partial<Record<Format, File>>>({});
  const urlsRef = useRef<string[]>([]); // object URLs a revocar al cerrar
  // Época de apertura: una generación en vuelo NO escribe estado de una hoja ya cerrada/reabierta.
  const epochRef = useRef(0);

  useEffect(() => setMounted(true), []);
  const entered = useSheetEnter(open);

  function revokeUrls() {
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current = [];
  }
  function closeSheet() {
    epochRef.current++; // invalida generaciones en vuelo
    setOpen(false);
    revokeUrls();
    filesRef.current = {};
    onClose?.();
  }
  useEffect(() => () => revokeUrls(), []); // limpieza al desmontar

  const { dragY, dragging, dragHandlers } = useSheetDrag(() => closeSheet());

  function downloadFile(file: File) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Genera (o no) la imagen de un formato. Idempotente: si ya está lista o en curso, no repite
  // (así el toggle no re-dispara). Guarda el File y un object URL para el preview.
  async function generate(fmt: Format) {
    // Guard con el estado MÁS RECIENTE (el ref, no el render): si ya está lista o en curso, no
    // repite. Así volver a un formato ya generado es instantáneo (caché).
    const cur = slotsRef.current[fmt].status;
    if (cur === "ready" || cur === "loading") return;
    const epoch = epochRef.current;
    setSlot(fmt, { status: "loading" });
    try {
      const res = await fetch(`/api/share/${sessionId}?format=${fmt}`, { cache: "no-store" });
      if (!res.ok) {
        const message =
          res.status === 401 || res.status === 403
            ? "No tienes permiso para compartir esta salida."
            : res.status === 404
              ? "No se encontró la salida."
              : "No se pudo crear la imagen.";
        if (epoch === epochRef.current) setSlot(fmt, { status: "error", message });
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      const name = cd?.match(/filename="?([^";]+)"?/i)?.[1] ?? `friaday-${sessionId}.png`;
      const file = new File([blob], name, { type: "image/png" });
      if (epoch !== epochRef.current) return; // hoja cerrada/reabierta: descarta
      const url = URL.createObjectURL(blob);
      urlsRef.current.push(url);
      filesRef.current[fmt] = file;
      setSlot(fmt, { status: "ready", url });
    } catch {
      if (epoch === epochRef.current) {
        setSlot(fmt, { status: "error", message: "No se pudo conectar. Revisa tu conexión." });
      }
    }
  }

  function openSheet(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    epochRef.current++;
    revokeUrls();
    filesRef.current = {};
    setMeta(null);
    setShareError(null);
    setFormat("story");
    resetSlots();
    setOpen(true);
    // Genera Historia de una (el default más común) y pide el meta en paralelo. Si el meta dice
    // que el default es Publicación (caso pobre), cambia y genera ese; Historia queda en caché.
    generate("story");
    const epoch = epochRef.current;
    fetch(`/api/share/${sessionId}?meta=1`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: ShareMeta | null) => {
        if (!m || epoch !== epochRef.current) return;
        setMeta(m);
        if (m.defaultFormat !== "story") {
          setFormat(m.defaultFormat);
          generate(m.defaultFormat);
        }
      })
      .catch(() => {});
  }

  function selectFormat(fmt: Format) {
    setShareError(null);
    setFormat(fmt);
    generate(fmt);
  }

  // El gesto de compartir: la imagen ya está en memoria, así que se llama a navigator.share
  // SIN await previo → la activación de usuario del toque sigue viva (el arreglo de raíz de RU.6.2).
  function shareNow() {
    const file = filesRef.current[format];
    if (!file) return;
    setShareError(null);
    const canShare = typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] });
    if (!canShare) {
      // Escritorio (sin compartir nativo): descargar.
      downloadFile(file);
      closeSheet();
      return;
    }
    navigator
      .share({ files: [file] })
      .then(() => closeSheet())
      .catch((err: unknown) => {
        // AbortError = la hoja abrió y el usuario canceló: normal.
        if (err instanceof Error && err.name === "AbortError") return;
        setShareError("No se pudo abrir el menú para compartir. Descarga la imagen y compártela a mano.");
      });
  }

  const accent = meta?.color ?? "var(--color-ambar)";
  const onAccent = meta?.ink ?? "#1A0400";
  const slot = slots[format];
  const title = meta?.place || (meta ? `Salida de ${meta.ownerName}` : "Compartir salida");
  const subtitle = meta ? `#${meta.outing} · ${meta.dateShort}` : "";
  // La caja del preview conserva su alto; el ancho sigue la proporción del formato.
  const boxH = 340;
  const boxW = Math.round(boxH * (format === "story" ? 1080 / 1920 : 1080 / 1350));

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          aria-label="Compartir"
          onClick={openSheet}
          style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(10,7,4,.55)", backdropFilter: "blur(6px)", border: "1px solid rgba(251,240,213,.16)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-espuma)", cursor: "pointer", flex: "none" }}
        >
          <Icon name="share" size={21} />
        </button>
      ) : variant === "menuItem" ? (
        <button
          type="button"
          onClick={openSheet}
          style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", height: 44, padding: "0 14px", background: "transparent", border: "none", cursor: "pointer", font: "600 14.5px var(--font-sans)", color: "var(--color-crema)" }}
        >
          <Icon name="share" size={18} color="var(--color-tenue)" />
          Compartir
        </button>
      ) : (
        <button
          type="button"
          aria-label="Compartir"
          onClick={openSheet}
          style={{ flex: 1, minWidth: 0, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "transparent", border: "none", borderRadius: 12, cursor: "pointer", font: "600 13.5px var(--font-sans)", color: "var(--color-tenue-2)" }}
        >
          <Icon name="share" size={17} />
          Compartir
        </button>
      )}

      {mounted && open &&
        createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 85 }} role="dialog" aria-modal="true" aria-label="Compartir salida">
            <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); closeSheet(); }} style={{ position: "absolute", inset: 0, background: "rgba(10,7,4,.62)" }} />
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
                padding: "12px 18px calc(env(safe-area-inset-bottom,0px) + 20px)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                transform: sheetEnterTransform(entered, dragY),
                transition: dragging ? "none" : "transform 0.25s ease",
              }}
            >
              {/* Agarre + encabezado: zona de arrastre para cerrar. */}
              <div {...dragHandlers} style={{ ...dragHandlers.style, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 2 }}>
                  <span style={{ width: 40, height: 4, borderRadius: 99, background: "var(--color-borde)" }} />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <h2 style={{ font: "800 24px/1 var(--font-display)", letterSpacing: "-.01em", margin: 0, color: "var(--color-espuma)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h2>
                  {subtitle && <span style={{ font: "600 11.5px/1 var(--font-sans)", letterSpacing: ".14em", color: "var(--color-tenue)", flex: "none" }}>{subtitle}</span>}
                </div>
              </div>

              {/* Preview: la imagen real (o el esqueleto mientras genera, o el error). */}
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{ width: boxW, height: boxH, borderRadius: 12, overflow: "hidden", border: "1px solid var(--color-borde)", background: "var(--color-noche)", display: "flex", flexShrink: 0 }}>
                  {slot.status === "ready" && slot.url ? (
                    <img src={slot.url} alt="" width={boxW} height={boxH} style={{ width: boxW, height: boxH, objectFit: "cover" }} />
                  ) : slot.status === "error" ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, padding: 20, gap: 8, textAlign: "center" }}>
                      <span style={{ font: "600 13px/1.4 var(--font-sans)", color: "var(--color-crema)" }}>No se pudo crear la imagen</span>
                      <span style={{ font: "400 12px/1.4 var(--font-sans)", color: "var(--color-tenue)" }}>{slot.message}</span>
                    </div>
                  ) : (
                    // Esqueleto: banda de acento arriba (guiño al color de la card) + barras que
                    // laten (shimmer del tema). Imita la composición, no un spinner.
                    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: 10, padding: 14 }} aria-hidden>
                      <div style={{ height: 26, borderRadius: 4, background: accent, opacity: 0.85, flex: "none" }} />
                      <div className="skeleton" style={{ height: 14, width: "70%", borderRadius: 3, flex: "none" }} />
                      <div className="skeleton" style={{ flexGrow: 1, borderRadius: 6 }} />
                      <div className="skeleton" style={{ height: 12, width: "55%", borderRadius: 3, flex: "none" }} />
                      <div className="skeleton" style={{ height: 12, width: "40%", borderRadius: 3, flex: "none" }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Stats compactas (cuando llega el meta): duración · bebidas · salida #N. */}
              {meta && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                  {meta.duration && (
                    <>
                      <Stat value={meta.duration.value} label="de noche" />
                      <span style={{ width: 1, height: 22, background: "var(--color-borde)" }} />
                    </>
                  )}
                  <Stat value={String(meta.total)} label={meta.total === 1 ? "bebida" : "bebidas"} />
                  <span style={{ width: 1, height: 22, background: "var(--color-borde)" }} />
                  <Stat value={`#${meta.outing}`} label="salida" color={accent} />
                </div>
              )}

              {shareError && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: 0, textAlign: "center" }}>{shareError}</p>}

              {/* Selector de formato. */}
              <div style={{ display: "flex", gap: 8 }}>
                <FormatButton kind="story" active={format === "story"} accent={accent} onClick={() => selectFormat("story")} />
                <FormatButton kind="post" active={format === "post"} accent={accent} onClick={() => selectFormat("post")} />
              </div>

              {/* Botón primario: Reintentar si falló; Compartir si está lista; deshabilitado mientras genera. */}
              {slot.status === "error" ? (
                <button type="button" onClick={() => generate(format)} style={{ width: "100%", height: 54, borderRadius: 12, border: "none", cursor: "pointer", font: "700 16px var(--font-sans)", background: accent, color: onAccent }}>
                  Reintentar
                </button>
              ) : slot.status === "ready" ? (
                <button type="button" onClick={shareNow} style={{ width: "100%", height: 54, borderRadius: 12, border: "none", cursor: "pointer", font: "700 16px var(--font-sans)", background: accent, color: onAccent, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Icon name="share" size={18} color={onAccent} />
                  Compartir
                </button>
              ) : (
                <button type="button" disabled aria-live="polite" style={{ width: "100%", height: 54, borderRadius: 12, border: "none", cursor: "default", font: "700 16px var(--font-sans)", background: "var(--color-barra-alta)", color: "var(--color-tenue)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--color-tenue)", animation: "fd-rl-flash 1.1s ease-in-out infinite" }} />
                  Armando tu {format === "story" ? "historia" : "publicación"}…
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ font: "800 18px/1 var(--font-display)", color: color ?? "var(--color-espuma)" }}>{value}</span>
      <span style={{ font: "500 10.5px/1 var(--font-sans)", color: "var(--color-tenue)", marginTop: 4 }}>{label}</span>
    </div>
  );
}

// Botón de formato: forma (historia = alto, publicación = ancho) + nombre. Activo = acento.
function FormatButton({ kind, active, accent, onClick }: { kind: Format; active: boolean; accent: string; onClick: () => void }) {
  const shape = kind === "story" ? { width: 11, height: 19 } : { width: 17, height: 14 };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        height: 44,
        borderRadius: 10,
        background: active ? "var(--color-barra-alta)" : "transparent",
        border: `1px solid ${active ? accent : "var(--color-borde)"}`,
        color: active ? "var(--color-espuma)" : "var(--color-tenue)",
        font: `${active ? 600 : 500} 14px var(--font-sans)`,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
      }}
    >
      <span style={{ ...shape, borderRadius: 2, background: active ? accent : "var(--color-borde)", display: "block", flex: "none" }} />
      {kind === "story" ? "Historia" : "Publicación"}
    </button>
  );
}
