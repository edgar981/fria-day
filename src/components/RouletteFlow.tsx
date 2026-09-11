"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { ROULETTE_DYNAMICS, getRouletteDynamic, getRouletteChallenge } from "@/lib/roulette";
import { spinRound, setRoundOutcome } from "@/app/actions/rounds";

export type RoulettePlayer = { id: string; name: string; avatar: string | null };
export type RouletteLatestRound = {
  id: string;
  roundNumber: number;
  dynamicKey: string;
  challengeKey: string;
  loserId: string;
  completed: boolean;
  passed: boolean;
};

const SPIN_MS = 5100; // duración total del giro (RU · §5)
const TURNS = 6;

type Phase = "dinamica" | "jugadores" | "girar" | "reto";

function haptic(pattern: number | number[]) {
  try {
    // iOS Safari/PWA NO soporta la Vibration API → no-op ahí (limitación conocida).
    navigator.vibrate?.(pattern);
  } catch {}
}

/**
 * La ruleta (Pasada RU) — arquitectura A (un solo teléfono). El perdedor y el reto los
 * decide el SERVIDOR (spinRound); esta animación solo REVELA. Un refresh trae la última
 * ronda persistida y la muestra sin re-animar.
 */
export function RouletteFlow({
  players,
  viewerId,
  sessionId,
  preselectedDyn,
  latestRound,
}: {
  players: RoulettePlayer[];
  viewerId: string;
  sessionId: string | null;
  preselectedDyn: string | null;
  latestRound: RouletteLatestRound | null;
}) {
  const router = useRouter();
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const [curSessionId, setCurSessionId] = useState<string | null>(sessionId);
  const [phase, setPhase] = useState<Phase>(
    latestRound ? "reto" : preselectedDyn ? "jugadores" : "dinamica",
  );
  const [dyn, setDyn] = useState<string | null>(preselectedDyn ?? latestRound?.dynamicKey ?? null);
  const [roundNumber, setRoundNumber] = useState<number>(latestRound?.roundNumber ?? 0);
  const [roundId, setRoundId] = useState<string | null>(latestRound?.id ?? null);
  const [challengeKey, setChallengeKey] = useState<string | null>(latestRound?.challengeKey ?? null);
  const [outcome, setOutcome] = useState<"completed" | "passed" | "pending">(
    latestRound?.completed ? "completed" : latestRound?.passed ? "passed" : "pending",
  );

  const [charging, setCharging] = useState(false);
  const [charge, setCharge] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [verdictId, setVerdictId] = useState<string | null>(latestRound?.loserId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [tableMode, setTableMode] = useState(false);

  const wheelRef = useRef<HTMLDivElement>(null);
  const rot = useRef(0);
  const chargeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hapticTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (chargeTimer.current) clearInterval(chargeTimer.current);
    if (hapticTimer.current) clearInterval(hapticTimer.current);
    if (spinTimer.current) clearTimeout(spinTimer.current);
  }, []);

  const n = players.length;
  const seg = n > 0 ? 360 / n : 360;
  const loserIdx = verdictId ? players.findIndex((p) => p.id === verdictId) : -1;
  const enoughPlayers = n >= 2;

  const wheelBg = useMemo(() => {
    const stops = players
      .map((_, i) => {
        const a = i * seg, b = (i + 1) * seg;
        const dim = verdictId != null && i !== loserIdx;
        const c = verdictId != null && i === loserIdx ? "#f2a016" : dim ? (i % 2 ? "#1a130d" : "#211812") : i % 2 ? "#2a1d12" : "#3a2713";
        return `${c} ${a}deg ${b}deg`;
      })
      .join(",");
    return `conic-gradient(${stops})`;
  }, [players, seg, verdictId, loserIdx]);

  function setWheel(deg: number, ms: number) {
    const el = wheelRef.current;
    if (!el) return;
    el.style.transition = ms ? `transform ${ms}ms cubic-bezier(.08,.82,.16,1)` : "transform 900ms cubic-bezier(.3,.9,.4,1)";
    el.style.transform = `rotate(${deg}deg)`;
  }

  function pickDynamic(key: string) {
    setDyn(key);
    setPhase("jugadores");
  }

  function toGirar() {
    setError(null);
    setVerdictId(null);
    setOutcome("pending");
    setRoundId(null);
    setChallengeKey(null);
    if (wheelRef.current) setWheel(rot.current, 0);
    setPhase("girar");
  }

  function holdStart() {
    if (spinning || !enoughPlayers) return;
    setError(null);
    setCharging(true);
    setCharge(0);
    setVerdictId(null);
    if (!reduce.current) setWheel(rot.current - 22, 900); // retrocede al cargar (§5·2)
    chargeTimer.current = setInterval(() => setCharge((c) => Math.min(100, c + 7)), 60);
    haptic(8);
    hapticTimer.current = setInterval(() => haptic(6), 300); // háptico ligero al cargar
  }

  async function holdEnd() {
    if (!charging) return;
    setCharging(false);
    if (chargeTimer.current) clearInterval(chargeTimer.current);
    if (hapticTimer.current) clearInterval(hapticTimer.current);
    setCharge(0);
    setSpinning(true);

    const res = await spinRound({ sessionId: curSessionId ?? undefined, dynamicKey: dyn! });
    if (!res.ok) {
      setSpinning(false);
      setError(res.error);
      setWheel(rot.current, 0);
      return;
    }
    const r = res.round;
    setCurSessionId(r.sessionId);
    setRoundId(r.id);
    setRoundNumber(r.roundNumber);
    setChallengeKey(r.challengeKey);
    const idx = players.findIndex((p) => p.id === r.loserId);

    const reveal = () => {
      setSpinning(false);
      setVerdictId(r.loserId);
      haptic([30, 40, 60]); // háptico fuerte del veredicto
      // El veredicto queda en la pantalla del giro (con modo mesa · §8); la carta del
      // reto sube al tocar "Ver el reto". Manual, no auto: así el toggle de modo mesa es
      // usable sobre el nombre del perdedor antes de pasar a la carta.
    };

    if (reduce.current) {
      // Sin giro: barajado corto de 600ms entre nombres y el veredicto (§5).
      spinTimer.current = setTimeout(reveal, 600);
      return;
    }

    const cur = ((rot.current % 360) + 360) % 360;
    const jitter = 10 + Math.random() * (seg - 20); // 6-10°+ dentro de la casilla, nunca en el borde
    const desired = (360 - (idx * seg + jitter)) % 360;
    const delta = (((desired - cur) % 360) + 360) % 360;
    const target = rot.current + 360 * TURNS + delta;
    rot.current = target;
    requestAnimationFrame(() => setWheel(target, SPIN_MS));
    spinTimer.current = setTimeout(reveal, SPIN_MS);
  }

  async function mark(next: "completed" | "passed") {
    if (!roundId) return;
    const value = outcome === next ? "pending" : next;
    setOutcome(value); // optimista
    const res = await setRoundOutcome(roundId, value);
    if (!res.ok) setError(res.error);
  }

  const backHref = curSessionId ? `/sessions/${curSessionId}` : "/";
  const dynObj = dyn ? getRouletteDynamic(dyn) : null;
  const loser = loserIdx >= 0 ? players[loserIdx] : null;
  const challenge = challengeKey ? getRouletteChallenge(challengeKey)?.challenge : null;

  const stepLabel = phase === "dinamica" ? "La ruleta" : dynObj?.name ?? "La ruleta";

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--color-noche)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(20px + env(safe-area-inset-top)) 16px 10px", flex: "none" }}>
        <button
          type="button"
          aria-label="Volver"
          onClick={() => {
            if (phase === "jugadores") { if (preselectedDyn) router.push(backHref); else setPhase("dinamica"); }
            else if (phase === "girar") setPhase("jugadores");
            else router.push(backHref); // reto o dinamica → salir
          }}
          style={{ width: 42, height: 42, borderRadius: 14, background: "var(--color-barra)", border: "1px solid var(--color-borde)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-crema)", flex: "none", cursor: "pointer" }}
        >
          <Icon name="back" size={22} />
        </button>
        <span className="eyebrow" style={{ color: "var(--color-ambar)" }}>{stepLabel}</span>
        <div style={{ minWidth: 42, textAlign: "right", font: "600 12px var(--font-sans)", color: "var(--color-tenue)" }}>
          {phase === "dinamica" ? "" : roundNumber > 0 ? `Ronda ${phase === "reto" ? roundNumber : roundNumber + (verdictId ? 0 : 1)}` : ""}
        </div>
      </div>

      {/* ---- Fase: elegir dinámica ---- */}
      {phase === "dinamica" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 24px" }}>
          <div style={{ font: "800 30px/1.05 var(--font-display)", letterSpacing: "-.03em", color: "var(--color-espuma)" }}>¿Qué se juega?</div>
          <div style={{ font: "400 14px/1.5 var(--font-sans)", color: "var(--color-tenue)", marginTop: 6 }}>{n} en la mesa</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 18 }}>
            {ROULETTE_DYNAMICS.map((d, i) => (
              <button key={d.key} type="button" onClick={() => pickDynamic(d.key)} style={{ textAlign: "left", background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 20, padding: "14px 15px", cursor: "pointer", display: "flex", gap: 13, alignItems: "center", width: "100%" }}>
                <span style={{ width: 44, height: 44, borderRadius: 14, background: "var(--color-barra-alta)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", font: "800 17px var(--font-display)", color: "var(--color-ambar)" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", font: "700 16.5px/1.2 var(--font-sans)", color: "var(--color-crema)" }}>{d.name}</span>
                  <span style={{ display: "block", font: "400 13px/1.45 var(--font-sans)", color: "var(--color-tenue)", marginTop: 3 }}>{d.pitch}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- Fase: jugadores ---- */}
      {phase === "jugadores" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 24px", display: "flex", flexDirection: "column" }}>
          <div style={{ font: "800 30px/1.05 var(--font-display)", letterSpacing: "-.03em", color: "var(--color-espuma)" }}>{dynObj?.name}</div>
          <p style={{ font: "400 14.5px/1.55 var(--font-sans)", color: "var(--color-crema)", margin: "8px 0 0" }}>{dynObj?.rule}</p>
          <div style={{ height: 6, margin: "18px 0 14px", background: "radial-gradient(circle at 50% 100%,var(--color-espuma) 4.5px,transparent 5px) 0 0/10px 6px repeat-x" }} />
          <div className="eyebrow">En la ruleta · {n}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 11 }}>
            {players.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 16, padding: "9px 13px 9px 9px" }}>
                <Avatar avatar={p.avatar} size={36} radius={12} />
                <span style={{ flex: 1, font: "600 15px var(--font-sans)", color: "var(--color-crema)" }}>{p.id === viewerId ? "Tú" : p.name}</span>
                <span style={{ font: "500 11.5px var(--font-sans)", color: "var(--color-tenue-2)" }}>{p.id === players[0]?.id ? "dueño" : "etiquetado"}</span>
              </div>
            ))}
          </div>
          <p style={{ font: "400 12.5px/1.5 var(--font-sans)", color: "var(--color-tenue-2)", margin: "10px 2px 0" }}>
            La compañía de texto libre no entra: sin cuenta no hay a quién asignarle el reto.
          </p>
          <div style={{ marginTop: "auto", paddingTop: 18 }}>
            {enoughPlayers ? (
              <button type="button" className="btn btn-primary" style={{ width: "100%", height: 56 }} onClick={toGirar}>Armar la ruleta</button>
            ) : (
              <div>
                <p style={{ font: "500 13.5px/1.5 var(--font-sans)", color: "var(--color-alerta)", margin: "0 0 10px" }}>
                  La ruleta necesita al menos 2 personas de la app. Etiquetá a alguien en la salida para jugar.
                </p>
                <button type="button" className="btn btn-ghost" style={{ width: "100%", height: 52 }} onClick={() => router.push(backHref)}>Ir a la salida</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Fase: girar / veredicto ---- */}
      {phase === "girar" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "2px 18px 22px" }}>
          <div style={{ font: "800 26px/1.05 var(--font-display)", letterSpacing: "-.03em", color: "var(--color-espuma)", textAlign: "center" }}>{dynObj?.name}</div>
          <div style={{ font: "400 13.5px/1.45 var(--font-sans)", color: "var(--color-tenue)", marginTop: 5, textAlign: "center", minHeight: 20 }}>
            {spinning ? "…" : verdictId ? "El pin no miente" : charging ? "Suéltalo" : "Teléfono al centro de la mesa"}
          </div>

          <div className={!spinning && !verdictId && !charging ? "fd-rl-breathe" : undefined} style={{ position: "relative", width: 300, height: 300, marginTop: 16, flex: "none", animation: !spinning && !verdictId && !charging ? "fd-rl-breathe 3.2s ease-in-out infinite" : undefined }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "5px dotted var(--color-espuma)", opacity: charging || spinning ? 1 : 0.55 }} />
            <div ref={wheelRef} style={{ position: "absolute", inset: 11, borderRadius: "50%", background: wheelBg, filter: spinning ? "blur(1.5px)" : "none" }}>
              {players.map((p, i) => {
                const center = i * seg + seg / 2;
                const textRot = center > 100 && center < 260 ? 180 : 0;
                const ink = verdictId ? (i === loserIdx ? "#241609" : "rgba(247,239,221,.28)") : "var(--color-crema)";
                return (
                  <div key={p.id} style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, transform: `rotate(${center}deg)` }}>
                    <span style={{ position: "absolute", left: -51, top: -122, width: 102, textAlign: "center", font: "700 15px/1.1 var(--font-sans)", color: ink, transform: `rotate(${textRot}deg)` }}>{p.id === viewerId ? "Tú" : p.name}</span>
                  </div>
                );
              })}
            </div>
            {/* Hub */}
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 94, height: 94, borderRadius: "50%", background: "var(--color-barra)", border: "1px solid var(--color-borde)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
              <span style={{ font: "800 22px/1 var(--font-display)", color: verdictId ? "var(--color-alerta)" : "var(--color-ambar)" }}>{verdictId ? "×" : spinning ? "" : String(n)}</span>
              <span style={{ font: "500 10.5px/1 var(--font-sans)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--color-tenue-2)" }}>{verdictId ? "perdió" : spinning ? "girando" : "casillas"}</span>
            </div>
            {/* Pin */}
            <div className={spinning ? "fd-rl-tick" : undefined} style={{ position: "absolute", left: "50%", top: -9, transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "11px solid transparent", borderRight: "11px solid transparent", borderTop: "22px solid var(--color-ambar)", filter: "drop-shadow(0 3px 6px rgba(0,0,0,.6))", animation: spinning ? "fd-rl-tick .09s linear infinite" : undefined }} />
            {/* Flash */}
            {verdictId && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--color-ambar)", pointerEvents: "none", opacity: 0, animation: "fd-rl-flash .5s ease-out 1 both" }} />}
          </div>

          {verdictId && loser && (
            <div style={{ marginTop: 18, textAlign: "center", animation: "fd-rl-rise .45s cubic-bezier(.2,1.2,.3,1) both" }}>
              <div style={{ font: "700 11px/1 var(--font-sans)", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--color-alerta)" }}>Perdió</div>
              <div style={{ font: "800 40px/1 var(--font-display)", letterSpacing: "-.03em", color: "var(--color-espuma)", marginTop: 7, transform: tableMode ? "rotate(180deg)" : undefined }}>{loser.id === viewerId ? "Tú" : loser.name}</div>
            </div>
          )}

          {error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: "12px 0 0", textAlign: "center" }}>{error}</p>}

          <div style={{ marginTop: "auto", width: "100%", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {!verdictId ? (
              <>
                {charging && <div style={{ height: 4, borderRadius: 3, background: "var(--color-barra-alta)", overflow: "hidden" }}><div style={{ height: "100%", background: "var(--color-ambar)", width: `${charge}%` }} /></div>}
                <button
                  type="button"
                  aria-label="Mantén para girar"
                  onPointerDown={(e) => { e.preventDefault(); holdStart(); }}
                  onPointerUp={holdEnd}
                  onPointerLeave={holdEnd}
                  onPointerCancel={holdEnd}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={spinning || !enoughPlayers}
                  style={{ width: "100%", height: 60, borderRadius: 18, background: charging ? "#ffb93a" : spinning ? "var(--color-tenue-2)" : "var(--color-ambar)", color: "var(--color-tinta)", border: "none", font: "700 17px var(--font-sans)", cursor: "pointer", touchAction: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
                >
                  {spinning ? "Girando…" : charging ? "Suelta" : "Mantén para girar"}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setTableMode((v) => !v)} style={{ alignSelf: "center", background: "transparent", border: "1px solid var(--color-borde)", borderRadius: 999, padding: "6px 13px", font: "600 12px var(--font-sans)", color: "var(--color-tenue)", cursor: "pointer" }}>
                  {tableMode ? "Vista normal" : "Modo mesa"}
                </button>
                <button type="button" className="btn btn-primary" style={{ width: "100%", height: 60 }} onClick={() => setPhase("reto")}>Ver el reto</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- Fase: reto ---- */}
      {phase === "reto" && loser && challenge && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2px 18px 22px", animation: "fd-rl-rise .5s cubic-bezier(.2,1.1,.3,1) both" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ background: "linear-gradient(180deg,#4a3413,#2a1e0e)", borderRadius: 26, overflow: "hidden", border: "1px solid rgba(251,240,213,.14)" }}>
              <div style={{ height: 8, background: "radial-gradient(circle at 50% 100%,var(--color-espuma) 6px,transparent 6.5px) 0 0/13px 8px repeat-x" }} />
              <div style={{ height: 10, background: "var(--color-espuma)" }} />
              <div style={{ padding: "20px 20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <Avatar avatar={loser.avatar} size={44} radius={14} />
                  <div style={{ minWidth: 0 }}>
                    <div className="eyebrow" style={{ color: "#c9a874" }}>El reto de</div>
                    <div style={{ font: "800 24px/1.1 var(--font-display)", letterSpacing: "-.02em", color: "var(--color-espuma)", marginTop: 4, transform: tableMode ? "rotate(180deg)" : undefined }}>{loser.id === viewerId ? "Tú" : loser.name}</div>
                  </div>
                </div>
                <div style={{ font: "700 25px/1.22 var(--font-display)", letterSpacing: "-.02em", color: "var(--color-espuma)", marginTop: 18, textWrap: "pretty" }}>{challenge.text}</div>
                <div style={{ font: "400 13.5px/1.5 var(--font-sans)", color: "#c9a874", marginTop: 10 }}>{challenge.note}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ font: "600 12px var(--font-sans)", color: "var(--color-tenue-2)", border: "1px solid var(--color-borde)", borderRadius: 999, padding: "7px 12px", whiteSpace: "nowrap" }}>{dynObj?.name}</span>
              <span style={{ font: "600 12px var(--font-sans)", color: "var(--color-tenue-2)", border: "1px solid var(--color-borde)", borderRadius: 999, padding: "7px 12px", whiteSpace: "nowrap" }}>Ronda {roundNumber}</span>
            </div>
            {/* Cumplir / Paso (el paso NUNCA penaliza · §6) */}
            <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
              <button type="button" onClick={() => mark("completed")} aria-pressed={outcome === "completed"} style={{ flex: 1, height: 46, borderRadius: 14, cursor: "pointer", font: "700 14px var(--font-sans)", border: outcome === "completed" ? "none" : "1px solid rgba(62,143,107,.42)", background: outcome === "completed" ? "var(--color-botella)" : "transparent", color: outcome === "completed" ? "#241609" : "var(--color-botella)" }}>
                {outcome === "completed" ? "Cumplido ✓" : "Cumplido"}
              </button>
              <button type="button" onClick={() => mark("passed")} aria-pressed={outcome === "passed"} style={{ flex: 1, height: 46, borderRadius: 14, cursor: "pointer", font: "700 14px var(--font-sans)", border: outcome === "passed" ? "none" : "1px solid var(--color-borde)", background: outcome === "passed" ? "var(--color-barra-alta)" : "transparent", color: "var(--color-tenue)" }}>
                {outcome === "passed" ? "Pasó ✓" : "Paso"}
              </button>
            </div>
            {error && <p role="alert" style={{ color: "var(--color-alerta)", font: "500 13px var(--font-sans)", margin: "10px 0 0" }}>{error}</p>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <button type="button" className="btn btn-primary" style={{ width: "100%", height: 56 }} onClick={toGirar}>Otra ronda</button>
            <button type="button" className="btn btn-ghost" style={{ width: "100%", height: 48 }} onClick={() => router.push(backHref)}>Guardar y volver a la salida</button>
          </div>
        </div>
      )}
    </div>
  );
}
