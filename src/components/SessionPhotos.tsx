"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { compressImage, ImageError } from "@/lib/image";
import { addSessionPhoto, removeSessionPhoto } from "@/app/actions/sessions";
import { MAX_SESSION_PHOTOS } from "@/lib/domain";

/**
 * Fotos de la salida (Pasada I-2). Carrusel deslizable en el detalle; tocar una abre a
 * pantalla completa (fondo oscuro, cerrar tocando afuera o arrastrando hacia abajo —
 * la física de A.4). Solo el dueño sube (compresión cliente 1200px → blob →
 * addSessionPhoto) y borra; el círculo las ve. Reordenar no va en v1: el orden es el de
 * subida. Sin next/image: se sirve el original ya comprimido (≤1200px), sin cuota.
 */
interface Photo {
  id: string;
  url: string;
}

export function SessionPhotos({
  sessionId,
  photos,
  isOwner,
}: {
  sessionId: string;
  photos: Photo[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [full, setFull] = useState<number | null>(null); // índice abierto a pantalla completa
  // I-2.1: borrar = deshacer, no diálogo. La foto se oculta al instante y el borrado
  // REAL (fila + blob) se DIFIERE hasta que expire la ventana (10s). Así deshacer
  // restaura sin re-subir nada, y no hay huérfanos: fila y blob se van juntos al
  // expirar, o no se van. `pending` = la foto en ventana de deshacer (una a la vez).
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shown = photos.filter((p) => !removing.has(p.id));
  const atLimit = shown.length >= MAX_SESSION_PHOTOS;

  function setPendingBoth(id: string | null) {
    pendingRef.current = id;
    setPending(id);
  }

  // Ejecuta el borrado real (fila + blob) al expirar la ventana.
  function commit(id: string) {
    void removeSessionPhoto(id).then((res) => {
      if (!res.ok) {
        setRemoving((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  // Al desmontar (cerrar/recargar la pestaña): si queda una pendiente, cométela ya —
  // no dejar la foto en un limbo (oculta pero no borrada). En navegación SPA el timer
  // sigue vivo, así que el borrado se confirma igual a los 10s.
  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (pendingRef.current) void removeSessionPhoto(pendingRef.current);
    };
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reelegir el mismo archivo
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { blob, filename } = await compressImage(file);
      const uploaded = await upload(filename, blob, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        contentType: "image/jpeg",
      });
      const res = await addSessionPhoto(sessionId, uploaded.url);
      if (!res.ok) setError(res.error);
      else router.refresh();
    } catch (err) {
      setError(err instanceof ImageError ? err.message : "No se pudo subir la foto. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    if (full != null) setFull(null);
    // Una sola ranura de deshacer: si había otra pendiente, cométela ya.
    if (pendingRef.current && pendingRef.current !== id) {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      commit(pendingRef.current);
    }
    setError(null);
    setRemoving((s) => new Set(s).add(id)); // oculta al instante (optimista)
    setPendingBoth(id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    // 10s (más que los 8 del check-in: una foto no se puede rehacer si ya no estás ahí).
    undoTimer.current = setTimeout(() => {
      setPendingBoth(null);
      commit(id);
    }, 10000);
  }

  function undo() {
    const id = pendingRef.current;
    if (!id) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setPendingBoth(null);
    // Restaura en su posición: nunca se borró nada, solo estaba oculta.
    setRemoving((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }

  if (shown.length === 0 && !isOwner) return null;

  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 11 }}>Fotos</div>

      {shown.length > 0 && (
        // Carrusel deslizable: scroll-snap nativo. Coexiste con el scroll vertical de la
        // página sin pelear ejes (el navegador desambigua el gesto), y trae momentum.
        <div
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            margin: "0 -18px",
            padding: "0 18px 4px",
          }}
        >
          {shown.map((p, i) => (
            <div
              key={p.id}
              style={{ position: "relative", flex: "none", width: "82%", scrollSnapAlign: "center", borderRadius: 18, overflow: "hidden", border: "1px solid var(--color-borde)", background: "var(--color-barra-alta)", aspectRatio: "4 / 3" }}
            >
              <button
                type="button"
                onClick={() => setFull(i)}
                aria-label="Ver foto"
                style={{ display: "block", width: "100%", height: "100%", padding: 0, border: "none", background: "transparent", cursor: "pointer" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label="Quitar foto"
                  style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(10,7,4,.72)", color: "var(--color-espuma)", cursor: "pointer", fontSize: 17, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <div style={{ marginTop: shown.length > 0 ? 12 : 0 }}>
          <input ref={inputRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
          <button
            type="button"
            className="btn btn-dashed"
            style={{ width: "100%" }}
            disabled={busy || atLimit}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Subiendo…" : atLimit ? `Máximo ${MAX_SESSION_PHOTOS} fotos` : "＋ Agregar foto"}
          </button>
          <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue-2)", marginTop: 6, textAlign: "center" }}>
            {shown.length}/{MAX_SESSION_PHOTOS}
          </div>
        </div>
      )}

      {error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: "9px 0 0" }}>{error}</p>}

      {/* Aviso deshacer (I-2.1): mismo patrón que quitar un check-in, pero 10s (una foto
          no se puede rehacer). El blob no se toca hasta que este aviso expire. */}
      {pending && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom,0px) + 18px)", display: "flex", justifyContent: "center", zIndex: 95, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 14, background: "var(--color-barra-alta)", border: "1px solid var(--color-borde)", borderRadius: 14, padding: "12px 16px", boxShadow: "0 12px 30px rgba(0,0,0,.5)", maxWidth: 360 }}>
            <span style={{ font: "500 14px var(--font-sans)", color: "var(--color-crema)" }}>Foto eliminada</span>
            <button type="button" onClick={undo} style={{ font: "700 14px var(--font-sans)", color: "var(--color-ambar)", background: "none", border: "none", cursor: "pointer" }}>Deshacer</button>
          </div>
        </div>
      )}

      {full != null && shown[full] && (
        <Fullscreen
          photos={shown}
          start={full}
          isOwner={isOwner}
          onClose={() => setFull(null)}
          onRemove={remove}
        />
      )}
    </section>
  );
}

/**
 * Visor a pantalla completa: fondo oscuro, swipe horizontal entre fotos y arrastre hacia
 * abajo para cerrar (misma física de la hoja de bebida, A.4: umbral de distancia o
 * flick de velocidad). Tocar el fondo también cierra.
 */
function Fullscreen({
  photos,
  start,
  isOwner,
  onClose,
  onRemove,
}: {
  photos: Photo[];
  start: number;
  isOwner: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const [index, setIndex] = useState(start);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ x0: 0, y0: 0, dx: 0, dy: 0, axis: "" as "" | "x" | "y", vy: 0, prevY: 0, prevT: 0, active: false });

  function down(e: React.PointerEvent) {
    drag.current = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, axis: "", vy: 0, prevY: e.clientY, prevT: e.timeStamp, active: true };
    setDragging(true);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    const dt = e.timeStamp - d.prevT;
    if (dt > 0) d.vy = (e.clientY - d.prevY) / dt;
    d.prevY = e.clientY;
    d.prevT = e.timeStamp;
    if (d.axis === "x") {
      d.dx = dx;
      setDragX(dx);
    } else {
      d.dy = Math.max(0, dy); // solo hacia abajo
      setDragY(d.dy);
    }
  }
  function up() {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    setDragging(false);
    if (d.axis === "y") {
      if (d.dy > 110 || d.vy > 0.6) return onClose();
      setDragY(0);
    } else if (d.axis === "x") {
      const w = trackRef.current?.clientWidth ?? 320;
      let next = index;
      if (d.dx < -w * 0.22) next = Math.min(photos.length - 1, index + 1);
      else if (d.dx > w * 0.22) next = Math.max(0, index - 1);
      setIndex(next);
      setDragX(0);
    }
  }

  const cur = photos[index];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", flexDirection: "column", background: `rgba(8,5,3,${Math.max(0.4, 1 - dragY / 400)})`, transition: dragging ? "none" : "background .2s ease" }}>
      {/* Fondo: tocar cierra */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />

      <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", overflow: "hidden" }}>
        <div
          ref={trackRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            touchAction: "none",
            transform: `translate(calc(${-index * 100}% + ${dragX}px), ${dragY}px)`,
            transition: dragging ? "none" : "transform .28s ease",
          }}
        >
          {photos.map((p) => (
            <div key={p.id} style={{ flex: "none", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" draggable={false} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8, pointerEvents: "none" }} />
            </div>
          ))}
        </div>
      </div>

      {/* Controles */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 14px)", right: 16, width: 38, height: 38, borderRadius: "50%", border: "none", background: "rgba(251,240,213,.14)", color: "var(--color-espuma)", cursor: "pointer", fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        ×
      </button>

      {photos.length > 1 && (
        <div style={{ position: "absolute", bottom: "calc(env(safe-area-inset-bottom,0px) + 20px)", left: 0, right: 0, display: "flex", justifyContent: "center", gap: 7, pointerEvents: "none" }}>
          {photos.map((p, i) => (
            <span key={p.id} style={{ width: i === index ? 22 : 7, height: 7, borderRadius: 99, background: i === index ? "var(--color-espuma)" : "rgba(251,240,213,.4)", transition: "width .2s ease" }} />
          ))}
        </div>
      )}

      {isOwner && cur && (
        <button
          type="button"
          onClick={() => onRemove(cur.id)}
          style={{ position: "absolute", bottom: "calc(env(safe-area-inset-bottom,0px) + 44px)", left: "50%", transform: "translateX(-50%)", border: "1px solid rgba(251,240,213,.2)", background: "rgba(10,7,4,.6)", color: "var(--color-espuma)", font: "600 13px var(--font-sans)", borderRadius: 999, padding: "8px 16px", cursor: "pointer" }}
        >
          Quitar foto
        </button>
      )}
    </div>
  );
}
