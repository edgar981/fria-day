import { FORMAT_LABEL, joinMeta } from "@/lib/format";
import { FoamStrip } from "@/components/FoamStrip";
import { Glasses } from "@/components/Glasses";
import type { BeerFormat } from "@/lib/domain";

export interface ReadCheckIn {
  id: string;
  quantity: number;
  format: BeerFormat;
  rating: number | null;
  beerName: string;
  brewery: string | null;
}

/**
 * Lista de bebidas en LECTURA (DS · rediseño del detalle, estados 1a/1d). Una sola
 * tarjeta coronada por la costura de espuma (no una franja por fila), filas en tres
 * datos: cantidad, nombre con casa y formato, y rating SOLO si existe. En lectura no hay
 * "Sin calificar" por fila (si casi nunca se califica en el bar, seis píldoras grises son
 * seis reproches — la invitación a calificar vive en Editar). Sin interacción.
 */
export function CheckInReadList({ checkIns }: { checkIns: ReadCheckIn[] }) {
  return (
    <div style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 20, overflow: "hidden" }}>
      <FoamStrip size="sm" />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {checkIns.map((c, i) => (
          <div key={c.id}>
            {i > 0 && <div style={{ height: 1, background: "#241A12", margin: "0 14px" }} />}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px" }}>
              <span style={{ minWidth: 34, height: 30, padding: "0 8px", borderRadius: 9, background: "#2E2217", color: "var(--color-ambar)", font: "700 14px var(--font-sans)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                {c.quantity}×
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 15.5px/1.2 var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.beerName}</div>
                <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue)" }}>{joinMeta(c.brewery, FORMAT_LABEL[c.format])}</div>
              </div>
              {/* Rating solo si existe (nada de "Sin calificar" en lectura). */}
              {c.rating != null && <Glasses value={c.rating} size="xs" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
