"use client";

import { useRef, useState } from "react";
import { Fullscreen } from "@/components/SessionPhotos";

interface Photo {
  id: string;
  url: string;
}

/**
 * Foto como TITULAR del detalle (DS · rediseño, estados 1a/1d/1e). La foto absorbe el
 * header: dueño, lugar, fecha y compañía se leen sobre la imagen (van como `children`,
 * superpuestos). Varias fotos = carrusel con scroll-snap nativo (swipe + momentum),
 * contador "1/N", puntos de progreso, y tocar abre el visor a pantalla completa (el mismo
 * de SessionPhotos, en solo lectura). Sin foto, este componente no se usa (lo decide
 * SessionDetail: el título sube y aparece la invitación "Ponle una foto").
 */
export function PhotoHero({
  photos,
  height = 330,
  children,
}: {
  photos: Photo[];
  height?: number;
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    setIndex(Math.max(0, Math.min(photos.length - 1, Math.round(el.scrollLeft / w))));
  }

  return (
    <div style={{ position: "relative", height }}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{
          display: "flex",
          height: "100%",
          overflowX: photos.length > 1 ? "auto" : "hidden",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            aria-label="Ver foto"
            onClick={() => setFull(i)}
            style={{ flex: "none", width: "100%", height: "100%", scrollSnapAlign: "center", padding: 0, border: "none", background: "transparent", cursor: "pointer", display: "block" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </button>
        ))}
      </div>

      {/* Degradado inferior para que el texto se lea sobre la foto. */}
      <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.min(Math.round(height * 0.58), 190), background: "linear-gradient(180deg,transparent,rgba(18,14,10,.72) 45%,var(--color-noche))", pointerEvents: "none" }} />

      {/* Contador "1/N". */}
      {photos.length > 1 && (
        <span style={{ position: "absolute", top: 82, right: 16, background: "rgba(10,7,4,.66)", color: "var(--color-espuma)", font: "600 11.5px var(--font-sans)", borderRadius: 999, padding: "4px 10px", letterSpacing: ".02em", pointerEvents: "none" }}>
          {index + 1}/{photos.length}
        </span>
      )}

      {/* Overlay inferior: puntos de progreso + título (children). pointer-events:none →
          el swipe llega al carrusel de abajo; los hijos no necesitan interacción. */}
      <div style={{ position: "absolute", left: 18, right: 18, bottom: 16, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
        {photos.length > 1 && (
          <div style={{ display: "flex", gap: 5 }}>
            {photos.map((p, i) => (
              <i key={p.id} style={{ width: 22, height: 3, borderRadius: 2, background: i === index ? "var(--color-espuma)" : "rgba(251,240,213,.3)", display: "block", transition: "background .2s ease" }} />
            ))}
          </div>
        )}
        {children}
      </div>

      {full != null && photos[full] && (
        <Fullscreen photos={photos} start={full} isOwner={false} onClose={() => setFull(null)} onRemove={() => {}} />
      )}
    </div>
  );
}
