"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { FoamStrip } from "@/components/FoamStrip";
import { Tally } from "@/components/Tally";
import { sendRequest } from "@/app/actions/requests";
import { timeOnApp } from "@/lib/format";
import type { RelationState } from "@/lib/requests";

export interface ForeignProfileData {
  id: string;
  displayName: string;
  avatar: string | null;
  createdAt: Date | string;
  points: number;
  salidasCount: number;
  relation: RelationState;
}

/**
 * La FICHA ajena (Pasada PA · §1): identidad, la ACCIÓN arriba (la razón por la que llegaste), y
 * debajo los dos números (el argumento, no el titular). Reusa la tarjeta oscura con espuma —"la
 * misma cifra, otra persona"— y las marcas de conteo. Sin racha, bebidas, historial ni total
 * histórico ámbar: el consumo de otro no se muestra. Sin líneas que expliquen el vacío (Pasada T).
 */
export function ForeignProfile({ profile }: { profile: ForeignProfileData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [relation, setRelation] = useState<RelationState>(profile.relation);
  const [error, setError] = useState<string | null>(null);
  const nf = (n: number) => n.toLocaleString("es-CO");
  const created = new Date(profile.createdAt);

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await sendRequest(profile.id);
      if (res.ok) {
        setRelation("sent");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <main style={{ padding: "20px 18px 0", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Identidad */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar avatar={profile.avatar} size={64} radius={20} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ font: "800 26px/1 var(--font-display)", letterSpacing: "-.02em" }}>{profile.displayName}</span>
            {relation === "circle" && (
              <span style={{ display: "inline-flex", alignItems: "center", background: "rgba(62,143,107,.16)", border: "1px solid rgba(62,143,107,.42)", color: "#6FC79C", font: "600 11.5px var(--font-sans)", borderRadius: 999, padding: "4px 10px" }}>
                En tu parche
              </span>
            )}
          </div>
          <div style={{ font: "400 13.5px var(--font-sans)", color: "var(--color-tenue)", marginTop: 6 }}>
            Hace {timeOnApp(created)} en FriaDay
          </div>
        </div>
      </div>

      {/* La acción, arriba. En el círculo no hay botón: el hueco es la señal (Pasada PA · 1f). */}
      {relation === "addable" && (
        <div>
          <button type="button" className="btn btn-primary" style={{ width: "100%", height: 52 }} disabled={pending} onClick={add}>
            {pending ? "Enviando…" : "Agregar al parche"}
          </button>
          {error && <p style={{ color: "var(--color-alerta)", font: "500 13.5px var(--font-sans)", margin: "9px 0 0" }}>{error}</p>}
        </div>
      )}
      {relation === "sent" && (
        // Mismo alto que el botón: no hay salto al volver. Contorno como "Brindaste" en el detalle.
        <div style={{ width: "100%", height: 52, borderRadius: 15, border: "1px solid #4A3A28", background: "#2E2217", color: "var(--color-tenue)", display: "flex", alignItems: "center", justifyContent: "center", font: "600 15px var(--font-sans)" }}>
          Solicitud enviada
        </div>
      )}

      {/* SUS PUNTOS — la tarjeta oscura con espuma, solo la cifra. */}
      <div style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 24, overflow: "hidden" }}>
        <FoamStrip size="md" />
        <div style={{ height: 8, background: "var(--color-espuma)" }} />
        <div style={{ padding: "16px 20px 18px" }}>
          <div style={{ font: "700 11px/1 var(--font-sans)", letterSpacing: ".16em", color: "var(--color-tenue)" }}>SUS PUNTOS</div>
          <div style={{ font: "800 44px/1 var(--font-display)", letterSpacing: "-.02em", color: "var(--color-espuma)", marginTop: 8 }}>{nf(profile.points)}</div>
        </div>
      </div>

      {/* Salidas — el segundo número, con marcas de conteo (trunca a 4 grupos). */}
      <div style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 20, padding: 15 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ font: "800 32px/1 var(--font-display)", color: "var(--color-ambar)" }}>{profile.salidasCount}</span>
          <span style={{ font: "400 13px var(--font-sans)", color: "var(--color-tenue)" }}>salidas registradas</span>
        </div>
        {profile.salidasCount > 0 && (
          <div style={{ marginTop: 12 }}>
            <Tally count={profile.salidasCount} color="var(--color-ambar)" barW={2.5} barH={15} gap={3} maxGroups={4} labelColor="var(--color-tenue)" />
          </div>
        )}
      </div>
    </main>
  );
}
