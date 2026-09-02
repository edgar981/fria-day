"use client";

import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";

/**
 * QR del código de invitación (Pasada Q). Codifica la URL de registro con el código:
 *   `${window.location.origin}/register?code=<CODE>`
 * El origin sale del RUNTIME (no hardcodeado) → en preview apunta al preview y en
 * producción a producción, sin config por entorno. Así se puede gatear escaneando.
 *
 * Se genera en el CLIENTE con qrcode-generator (~4KB, sin dependencias) y se dibuja como
 * SVG vectorial (nítido a cualquier tamaño, peso mínimo; solo carga al abrir la hoja).
 *
 * Tema oscuro: NO se usa QR de trazo claro sobre fondo oscuro (riesgo con algunos
 * escáneres). Se dibuja el clásico —módulos oscuros sobre teja BLANCA con zona de
 * silencio— que escanea en cualquier lector. Guardado con `mounted` para no renderizar
 * en SSR (el origin no existe ahí) y evitar desajustes de hidratación.
 */
export function QrCode({ code, size = 128 }: { code: string; size?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const model = useMemo(() => {
    if (!mounted) return null;
    const url = `${window.location.origin}/register?code=${code}`;
    const qr = qrcode(0, "M"); // tipo 0 = auto; nivel M (15% de recuperación)
    qr.addData(url);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { d, count };
  }, [mounted, code]);

  const tile = size + 16; // teja blanca con 8px de zona de silencio a cada lado
  const box: React.CSSProperties = { width: tile, height: tile, borderRadius: 10, background: "#ffffff", flex: "none" };

  // Placeholder del MISMO tamaño en SSR / primer render (evita salto y desajuste).
  if (!model) return <div style={box} aria-hidden />;

  const pad = 2; // zona de silencio interna, en módulos
  const vb = model.count + pad * 2;
  return (
    <div style={{ ...box, padding: 8, lineHeight: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${vb} ${vb}`}
        role="img"
        aria-label="Código QR para unirse"
        shapeRendering="crispEdges"
      >
        <path transform={`translate(${pad} ${pad})`} d={model.d} fill="#111111" />
      </svg>
    </div>
  );
}
