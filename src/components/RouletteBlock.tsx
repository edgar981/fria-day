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
 * Bloque "La ruleta" del detalle de salida (RU · §8). La ronda más reciente va completa;
 * las anteriores colapsan a una línea. Estado vacío para el dueño (invitación a girar).
 * "Girar otra vez" solo para el dueño (la salida es personal).
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
  const name = (r: RoundView) => (r.loserId === viewerId ? "Tú" : r.loserName);

  // Sin rondas: invitación solo al dueño; para otros, el bloque no aparece.
  if (rounds.length === 0) {
    if (!isOwner) return null;
    return (
      <div style={{ margin: "8px 18px 0", background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 24, overflow: "hidden" }}>
        <div aria-hidden style={{ height: 6, background: "radial-gradient(circle at 50% 100%,var(--color-espuma) 4.5px,transparent 5px) 0 0/10px 6px repeat-x" }} />
        <div style={{ padding: "14px 15px 15px" }}>
          <span style={EYEBROW}>La ruleta</span>
          <p style={{ font: "400 13.5px/1.5 var(--font-sans)", color: "var(--color-tenue)", margin: "8px 0 12px" }}>Nadie ha girado todavía. Pon el teléfono al centro.</p>
          <Link href={`/ruleta?session=${sessionId}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 44, borderRadius: 14, background: "transparent", border: "1px dashed #6b5334", color: "var(--color-ambar)", font: "600 14.5px var(--font-sans)", textDecoration: "none" }}>
            <span aria-hidden style={{ width: 18, height: 18, borderRadius: "50%", border: "2px dotted var(--color-ambar)", display: "block" }} />
            Girar
          </Link>
        </div>
      </div>
    );
  }

  const [latest, ...older] = rounds; // rounds vienen desc (más reciente primero)

  return (
    <div style={{ margin: "8px 18px 0", background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 24, overflow: "hidden" }}>
      <div aria-hidden style={{ height: 6, background: "radial-gradient(circle at 50% 100%,var(--color-espuma) 4.5px,transparent 5px) 0 0/10px 6px repeat-x" }} />
      <div style={{ padding: "13px 15px 15px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={EYEBROW}>La ruleta</span>
          <span style={{ font: "500 12px var(--font-sans)", color: "var(--color-tenue-2)" }}>{rounds.length} ronda{rounds.length === 1 ? "" : "s"}</span>
        </div>

        {/* Última ronda, completa */}
        {latest && (
          <div style={{ marginTop: 12, background: "var(--color-barra-alta)", borderRadius: 18, padding: "13px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar avatar={latest.loserAvatar} size={38} radius={12} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 15.5px var(--font-sans)", color: "var(--color-crema)" }}>{name(latest)} perdió</div>
                <div style={{ font: "400 12.5px var(--font-sans)", color: "#c9a874", marginTop: 1 }}>{dynName(latest.dynamicKey)} · ronda {latest.roundNumber}</div>
              </div>
              {latest.completed && <span style={{ font: "600 11.5px var(--font-sans)", color: "#6FC79C", background: "rgba(62,143,107,.16)", border: "1px solid rgba(62,143,107,.42)", borderRadius: 999, padding: "4px 9px", flex: "none" }}>Cumplido</span>}
              {latest.passed && <span style={{ font: "600 11.5px var(--font-sans)", color: "var(--color-tenue)", background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 999, padding: "4px 9px", flex: "none" }}>Pasó</span>}
            </div>
            <div style={{ font: "700 17px/1.3 var(--font-display)", color: "var(--color-espuma)", marginTop: 11, textWrap: "pretty" }}>{challengeText(latest.challengeKey)}</div>
          </div>
        )}

        {/* Anteriores, colapsadas a una línea */}
        {older.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 10 }}>
            {older.map((r, i) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderTop: i === 0 ? "none" : "1px solid var(--color-noche)" }}>
                <Avatar avatar={r.loserAvatar} size={28} radius={9} />
                <span style={{ flex: 1, minWidth: 0, font: "500 13.5px var(--font-sans)", color: "#d6c7ae", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {name(r)} · {dynName(r.dynamicKey)} · {challengeText(r.challengeKey)}
                </span>
                <span style={{ font: "500 11.5px var(--font-sans)", color: "var(--color-tenue-2)", flex: "none" }}>R{r.roundNumber}</span>
              </div>
            ))}
          </div>
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
