"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { formatBreakdownText } from "@/lib/format";
import type { FormatCount } from "@/lib/domain";

type UnitRow = { userId: string; displayName: string; units: number };
type VarietyRow = { userId: string; displayName: string; variety: number };

// Dos ejes al MISMO nivel: unidades y variedad. Un chip cada uno, igual peso.
export function LeaderboardTabs({
  boardUnits,
  boardVariety,
  userId,
  avatarById,
  aloneInCircle,
  breakdownByUser,
}: {
  boardUnits: UnitRow[];
  boardVariety: VarietyRow[];
  userId: string;
  avatarById: Record<string, string | null>;
  aloneInCircle: boolean;
  breakdownByUser: Record<string, FormatCount[]>;
}) {
  const [axis, setAxis] = useState<"units" | "variety">("units");

  const rows =
    axis === "units"
      ? boardUnits.map((r) => ({ userId: r.userId, displayName: r.displayName, value: r.units }))
      : boardVariety.map((r) => ({ userId: r.userId, displayName: r.displayName, value: r.variety }));
  const max = rows.length ? Math.max(...rows.map((r) => r.value), 1) : 1;
  const suffix = axis === "units" ? "" : "";

  const chip = (key: "units" | "variety", label: string) => {
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 11 }}>
        <span className="eyebrow">El parche</span>
        <span style={{ font: "400 11.5px var(--font-sans)", color: "var(--color-tenue-2)" }}>solo salidas propias</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 13 }}>
        {chip("units", "Unidades")}
        {chip("variety", "Variedad")}
      </div>

      {/* Sin círculo, el ranking eres solo tú. Una línea que INVITA a actuar (T.1):
          no describe un estado, empuja a invitar/traer gente. Sin celebrar cantidad. */}
      {aloneInCircle && (
        <div style={{ background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 14, padding: "12px 14px", marginBottom: 13 }}>
          <div style={{ font: "500 13.5px/1.4 var(--font-sans)", color: "var(--color-tenue)" }}>
            Invita a tu parche y armamos el ranking.
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {rows.map((row, i) => {
          const me = row.userId === userId;
          const barColor = me || i === 0 ? "var(--color-ambar)" : "#8A5E1E";
          // Desglose por formato bajo el nombre, solo en el eje Unidades y si hay
          // más de un formato (Pasada D). En Variedad no aplica (cuenta distintas).
          const bd = axis === "units" ? breakdownByUser[row.userId] ?? [] : [];
          return (
            <div
              key={row.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                ...(me ? { background: "#1F1811", border: "1px solid #4A3A28", borderRadius: 16, padding: "8px 11px", margin: "0 -11px" } : null),
              }}
            >
              <span style={{ font: "800 17px var(--font-display)", color: i <= 1 ? "var(--color-ambar)" : "var(--color-tenue)", width: 20, flex: "none" }}>{i + 1}</span>
              <Avatar avatar={avatarById[row.userId] ?? null} size={36} radius={11} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ font: `${me ? 700 : 600} 15px var(--font-sans)`, display: "block" }}>{me ? "Tú" : row.displayName}</span>
                {bd.length > 1 && (
                  <span style={{ display: "block", font: "400 11px var(--font-sans)", color: "var(--color-tenue-2)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {formatBreakdownText(bd)}
                  </span>
                )}
                <span style={{ display: "block", height: 6, borderRadius: 99, background: "var(--color-borde)", marginTop: 5, overflow: "hidden" }}>
                  <span style={{ display: "block", height: 6, width: `${Math.round((row.value / max) * 100)}%`, background: barColor }} />
                </span>
              </span>
              <span style={{ font: "700 16px var(--font-display)", color: me ? "var(--color-ambar)" : "var(--color-tenue)", flex: "none" }}>{row.value}{suffix}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
