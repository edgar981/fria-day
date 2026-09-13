"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { profileHref } from "@/lib/profile-link";

type UnitRow = { userId: string; displayName: string; units: number };
type VarietyRow = { userId: string; displayName: string; variety: number };
type SessionsRow = { userId: string; displayName: string; sessions: number };
type Axis = "units" | "variety" | "sessions";

// TRES ejes al MISMO nivel: unidades, variedad y salidas (presencia). Un chip cada
// uno, igual peso. Unidades por defecto. Salidas es el único que no depende de consumo.
export function LeaderboardTabs({
  boardUnits,
  boardVariety,
  boardSessions,
  userId,
  avatarById,
  aloneInCircle,
  onInvite,
}: {
  boardUnits: UnitRow[];
  boardVariety: VarietyRow[];
  boardSessions: SessionsRow[];
  userId: string;
  avatarById: Record<string, string | null>;
  aloneInCircle: boolean;
  // Pasada N: abrir la hoja de invitación desde el copy del ranking vacío. Opcional
  // (si no se pasa, el copy no muestra el botón).
  onInvite?: () => void;
}) {
  const [axis, setAxis] = useState<Axis>("units");

  const rows =
    axis === "units"
      ? boardUnits.map((r) => ({ userId: r.userId, displayName: r.displayName, value: r.units }))
      : axis === "variety"
        ? boardVariety.map((r) => ({ userId: r.userId, displayName: r.displayName, value: r.variety }))
        : boardSessions.map((r) => ({ userId: r.userId, displayName: r.displayName, value: r.sessions }));
  const max = rows.length ? Math.max(...rows.map((r) => r.value), 1) : 1;

  const chip = (key: Axis, label: string) => {
    const on = axis === key;
    return (
      <button
        type="button"
        onClick={() => setAxis(key)}
        aria-pressed={on}
        style={{
          flex: 1,
          height: 40,
          borderRadius: 12,
          border: `1px solid ${on ? "var(--color-ambar)" : "var(--color-borde)"}`,
          background: on ? "rgba(242,160,22,.12)" : "transparent",
          color: on ? "var(--color-ambar)" : "var(--color-tenue)",
          font: `${on ? 700 : 600} 14px var(--font-sans)`,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <section>
      {/* El título del parche y el "solo salidas propias" viven ahora en el header de
          la pantalla (Pasada N). Aquí quedan solo los ejes y el ranking. */}
      <div style={{ display: "flex", gap: 7, marginBottom: 13 }}>
        {chip("units", "Unidades")}
        {chip("variety", "Variedad")}
        {chip("sessions", "Salidas")}
      </div>

      {/* Sin círculo, el ranking eres solo tú. Una línea que INVITA a actuar (T.1):
          no describe un estado, empuja a invitar/traer gente. Sin celebrar cantidad. */}
      {aloneInCircle && (
        <div style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 14, padding: "14px", marginBottom: 13, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ font: "500 13.5px/1.4 var(--font-sans)", color: "var(--color-tenue)" }}>
            Invita a tu parche y armamos el ranking.
          </div>
          {/* Pasada N: el copy ya tiene a dónde apuntar — abre la hoja de invitación. */}
          {onInvite && (
            <button type="button" onClick={onInvite} className="btn btn-primary" style={{ alignSelf: "flex-start", height: 42, padding: "0 18px" }}>
              Invitar al parche
            </button>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map((row, i) => {
          const me = row.userId === userId;
          const barColor = me || i === 0 ? "var(--color-ambar)" : "#8A5E1E";
          return (
            // Cada fila abre el perfil de esa persona (Pasada PA · camino 1d).
            <Link
              key={row.userId}
              href={profileHref(row.userId, userId)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                textDecoration: "none",
                color: "var(--color-crema)",
                ...(me ? { background: "#1F1811", border: "1px solid #4A3A28", borderRadius: 16, padding: "8px 11px", margin: "0 -11px" } : null),
              }}
            >
              <span style={{ font: "800 17px var(--font-display)", color: i <= 1 ? "var(--color-ambar)" : "var(--color-tenue)", width: 20, flex: "none" }}>{i + 1}</span>
              <Avatar avatar={avatarById[row.userId] ?? null} size={36} radius={11} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ font: `${me ? 700 : 600} 15px var(--font-sans)`, display: "block" }}>{me ? "Tú" : row.displayName}</span>
                {/* N.2: el desglose por formato se quitó del leaderboard (ilegible en una
                    lista de personas). Sigue en la tarjeta del feed y en el perfil. */}
                <span style={{ display: "block", height: 6, borderRadius: 99, background: "var(--color-borde)", marginTop: 5, overflow: "hidden" }}>
                  <span style={{ display: "block", height: 6, width: `${Math.round((row.value / max) * 100)}%`, background: barColor }} />
                </span>
              </span>
              <span style={{ font: "700 16px var(--font-display)", color: me ? "var(--color-ambar)" : "var(--color-tenue)", flex: "none" }}>{row.value}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
