"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { getRouletteDynamic, getRouletteChallenge } from "@/lib/roulette";

export type RoundView = {
  id: string;
  roundNumber: number;
  dynamicKey: string;
  challengeKey: string;
  loserId: string;
  loserName: string;
  loserAvatar: string | null;
  completed: boolean;
  passed: boolean;
};

const EYEBROW: React.CSSProperties = { font: "700 11px/1 var(--font-sans)", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--color-tenue)" };

function dynName(key: string) {
  return getRouletteDynamic(key)?.name ?? "La ruleta";
}
function challengeText(key: string) {
  return getRouletteChallenge(key)?.challenge.text ?? "";
}

/**
 * Bloque "La ruleta" del detalle (RU · §8). Arranca COLAPSADO (RU.1 · §3): la ronda más
 * reciente completa y las anteriores tras "N rondas · ver historial" que expande. El feed
 * y el detalle son privados → convención "tú" conjugada: "Perdiste" / "{Nombre} perdió"
 * (RU.1 · §1). "Girar otra vez" solo para el dueño.
 */
export function RouletteBlock({
  rounds,
  isOwner,
  viewerId,
  sessionId,
}: {
  rounds: RoundView[];
  isOwner: boolean;
  viewerId: string;
  sessionId: string;
}) {
  const [open, setOpen] = useState(false);
  // "Perdiste" si el viewer perdió; si no, "{Nombre} perdió".
  const lostPhrase = (r: RoundView) => (r.loserId === viewerId ? "Perdiste" : `${r.loserName} perdió`);
  const label = (r: RoundView) => (r.loserId === viewerId ? "Tú" : r.loserName);

  // Sin rondas: invitación solo al dueño; para otros, el bloque no aparece.
  if (rounds.length === 0) {
    if (!isOwner) return null;
    return (
      <div style={{ margin: "8px 18px 0", background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 24, overflow: "hidden" }}>
        <div aria-hidden style={{ height: 6, background: "radial-gradient(circle at 50% 100%,var(--color-espuma) 4.5px,transparent 5px) 0 0/10px 6px repeat-x" }} />
        <div style={{ padding: "14px 15px 15px" }}>
          <span style={EYEBROW}>La ruleta</span>
          <p style={{ font: "400 13.5px/1.5 var(--font-sans)", color: "var(--color-tenue)", margin: "8px 0 12px" }}>Primera ronda. Pon el teléfono en la mesa.</p>
          <Link href={`/ruleta?session=${sessionId}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: 14, background: "transparent", border: "1px dashed #6b5334", color: "var(--color-ambar)", font: "600 14.5px var(--font-sans)", textDecoration: "none" }}>
            <span aria-hidden style={{ width: 18, height: 18, borderRadius: "50%", border: "2px dotted var(--color-ambar)", display: "block" }} />
            Girar
          </Link>
        </div>
      </div>
    );
  }

  const latest = rounds[0]!; // rounds vienen desc (más reciente primero)
  const older = rounds.slice(1);

  return (
    <div style={{ margin: "8px 18px 0", background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 24, overflow: "hidden" }}>
      <div aria-hidden style={{ height: 6, background: "radial-gradient(circle at 50% 100%,var(--color-espuma) 4.5px,transparent 5px) 0 0/10px 6px repeat-x" }} />
      <div style={{ padding: "13px 15px 15px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={EYEBROW}>La ruleta</span>
          <span style={{ font: "500 12px var(--font-sans)", color: "var(--color-tenue-2)" }}>{rounds.length} ronda{rounds.length === 1 ? "" : "s"}</span>
        </div>

        {/* Última ronda, completa */}
        <div style={{ marginTop: 12, background: "var(--color-barra-alta)", borderRadius: 18, padding: "13px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar avatar={latest.loserAvatar} size={38} radius={12} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "600 15.5px var(--font-sans)", color: "var(--color-crema)" }}>{lostPhrase(latest)}</div>
              <div style={{ font: "400 12.5px var(--font-sans)", color: "#c9a874", marginTop: 1 }}>{dynName(latest.dynamicKey)} · ronda {latest.roundNumber}</div>
            </div>
            {latest.completed && <span style={{ font: "600 11.5px var(--font-sans)", color: "#6FC79C", background: "rgba(62,143,107,.16)", border: "1px solid rgba(62,143,107,.42)", borderRadius: 999, padding: "4px 9px", flex: "none" }}>Cumplido</span>}
            {latest.passed && <span style={{ font: "600 11.5px var(--font-sans)", color: "var(--color-tenue)", background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 999, padding: "4px 9px", flex: "none" }}>Pasó</span>}
          </div>
          <div style={{ font: "700 17px/1.3 var(--font-display)", color: "var(--color-espuma)", marginTop: 11, textWrap: "pretty" }}>{challengeText(latest.challengeKey)}</div>
        </div>

        {/* Historial (colapsado por defecto · RU.1 §3). */}
        {older.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              style={{ width: "100%", marginTop: 10, height: 38, display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", cursor: "pointer", font: "600 13px var(--font-sans)", color: "var(--color-tenue)", padding: "0 2px" }}
            >
              <span>{open ? "Ocultar historial" : `${rounds.length} rondas · ver historial`}</span>
              <span aria-hidden style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", fontSize: 11 }}>▾</span>
            </button>
            {open && (
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {older.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--color-noche)" }}>
                    <Avatar avatar={r.loserAvatar} size={28} radius={9} />
                    <span style={{ flex: 1, minWidth: 0, font: "500 13.5px var(--font-sans)", color: "#d6c7ae", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {label(r)} · {dynName(r.dynamicKey)} · {challengeText(r.challengeKey)}
                    </span>
                    <span style={{ font: "500 11.5px var(--font-sans)", color: "var(--color-tenue-2)", flex: "none" }}>R{r.roundNumber}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {isOwner && (
          <Link href={`/ruleta?session=${sessionId}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 44, marginTop: 12, borderRadius: 14, background: "transparent", border: "1px dashed #6b5334", color: "var(--color-ambar)", font: "600 14.5px var(--font-sans)", textDecoration: "none" }}>
            Girar otra vez
          </Link>
        )}
      </div>
    </div>
  );
}
