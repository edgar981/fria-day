"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { LeaderboardTabs } from "@/components/LeaderboardTabs";
import { InviteSheet, type InviteRow } from "@/components/InviteSheet";
import type { CircleMemberPoints } from "@/lib/points-queries";

type UnitRow = { userId: string; displayName: string; units: number };
type VarietyRow = { userId: string; displayName: string; variety: number };
type SessionsRow = { userId: string; displayName: string; sessions: number };

/**
 * Pantalla del Leaderboard (Pasada N): antes vivía dentro de Perfil. Ahora es pestaña
 * propia, con el título del parche y —en el header— un icono de personas que abre la
 * hoja de invitación. La hoja también se abre desde el copy del ranking vacío y, vía
 * ?invite=1, desde el feed vacío. Envuelve LeaderboardTabs para compartir ese "abrir".
 */
export function LeaderboardScreen({
  boardUnits,
  boardVariety,
  boardSessions,
  userId,
  avatarById,
  aloneInCircle,
  invitations,
  circlePoints,
  autoOpenInvite = false,
}: {
  boardUnits: UnitRow[];
  boardVariety: VarietyRow[];
  boardSessions: SessionsRow[];
  userId: string;
  avatarById: Record<string, string | null>;
  aloneInCircle: boolean;
  invitations: InviteRow[];
  circlePoints: CircleMemberPoints[];
  autoOpenInvite?: boolean;
}) {
  const [inviteOpen, setInviteOpen] = useState(autoOpenInvite);

  return (
    <main style={{ padding: "calc(18px + env(safe-area-inset-top)) 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ font: "800 28px/1 var(--font-display)", letterSpacing: "-.02em", margin: 0 }}>El parche</h1>
          <p style={{ font: "400 13.5px/1.4 var(--font-sans)", color: "var(--color-tenue)", margin: "7px 0 0" }}>
            El ranking de tu círculo
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          aria-label="Invitar al parche"
          style={{ width: 44, height: 44, borderRadius: 14, border: "1px solid var(--color-borde)", background: "var(--color-barra)", color: "var(--color-ambar)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flex: "none" }}
        >
          <Icon name="users" size={22} />
        </button>
      </div>

      <LeaderboardTabs
        boardUnits={boardUnits}
        boardVariety={boardVariety}
        boardSessions={boardSessions}
        userId={userId}
        avatarById={avatarById}
        aloneInCircle={aloneInCircle}
        onInvite={() => setInviteOpen(true)}
      />

      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} invitations={invitations} circlePoints={circlePoints} userId={userId} />
    </main>
  );
}
