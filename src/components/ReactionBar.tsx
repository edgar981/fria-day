"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/app/actions/sessions";
import { REACTIONS } from "@/lib/domain";

/**
 * Barra de reacciones (Pasada R): el set fijo de emojis como toggles. La del viewer
 * queda resaltada; el conteo aparece al lado. Tocar la misma la quita, otra la cambia.
 * Se usa en el feed (dentro de un <Link>, por eso cada botón corta la navegación) y
 * en el detalle. Puede reaccionar cualquiera que pueda ver la salida (lo valida la acción).
 */
export function ReactionBar({
  sessionId,
  groups,
  mine,
}: {
  sessionId: string;
  groups: { emoji: string; count: number; mine: boolean }[];
  mine: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function tap(e: React.MouseEvent, emoji: string) {
    e.preventDefault(); // no navegar si está dentro de la tarjeta-Link del feed
    e.stopPropagation();
    start(async () => {
      await toggleReaction(sessionId, emoji);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {REACTIONS.map((emoji) => {
        const count = groups.find((g) => g.emoji === emoji)?.count ?? 0;
        const on = mine === emoji;
        return (
          <button
            key={emoji}
            type="button"
            disabled={pending}
            onClick={(e) => tap(e, emoji)}
            aria-pressed={on}
            aria-label={`Reaccionar ${emoji}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 32,
              padding: count > 0 ? "0 10px 0 8px" : "0 8px",
              borderRadius: 999,
              cursor: pending ? "default" : "pointer",
              border: `1px solid ${on ? "var(--color-ambar)" : "var(--color-borde)"}`,
              background: on ? "rgba(242,160,22,.14)" : "var(--color-barra-alta)",
              opacity: count > 0 || on ? 1 : 0.72,
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
            {count > 0 && (
              <span style={{ font: "700 12px var(--font-sans)", color: on ? "var(--color-ambar)" : "var(--color-tenue)" }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
