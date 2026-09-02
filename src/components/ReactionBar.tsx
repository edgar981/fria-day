"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/app/actions/sessions";
import { REACTIONS } from "@/lib/domain";

type Group = { emoji: string; count: number; mine: boolean };

function toCounts(groups: Group[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const g of groups) m[g.emoji] = g.count;
  return m;
}

/**
 * Barra de reacciones (Pasada R; optimista en N.2): el set fijo de emojis como toggles.
 * La del viewer queda resaltada; el conteo aparece al lado. Tocar la misma la quita,
 * otra la cambia. Se usa en el feed (dentro de un <Link>, por eso cada botón corta la
 * navegación) y en el detalle. Puede reaccionar cualquiera que pueda ver la salida.
 *
 * N.2 · lag: antes el botón NO era optimista — pintaba solo con los props del servidor,
 * y `tap` hacía `await toggleReaction()` + `router.refresh()`, así que el repintado
 * esperaba DOS viajes a Neon (sa-east-1). Medido: ~3.1s toque→repintado (y ~4.8s con
 * +1200ms de latencia). Ahora el toggle se aplica LOCAL al instante y la persistencia
 * va en segundo plano; el refresh solo trae la verdad del servidor cuando ya no hay
 * toques en vuelo. Las escrituras se SERIALIZAN (cadena de promesas) para que tocar
 * rápido no llegue desordenado al servidor (create/delete/update no son conmutativos).
 */
export function ReactionBar({
  sessionId,
  groups,
  mine,
}: {
  sessionId: string;
  groups: Group[];
  mine: string | null;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>(() => toCounts(groups));
  const [myEmoji, setMyEmoji] = useState<string | null>(mine);
  const pending = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  // Resincroniza con el servidor cuando llegan props nuevas (tras el refresh), pero
  // solo sin toques en vuelo: si no, un refresh en camino pisaría un toque más nuevo
  // (mismo criterio que el stepper de cantidad).
  useEffect(() => {
    if (pending.current === 0) {
      setCounts(toCounts(groups));
      setMyEmoji(mine);
    }
  }, [groups, mine]);

  function tap(e: React.MouseEvent, emoji: string) {
    e.preventDefault(); // no navegar si está dentro de la tarjeta-Link del feed
    e.stopPropagation();

    // 1) Toggle LOCAL: pinta ya, sin esperar al servidor. Semántica igual a la acción:
    //    misma emoji → quitar; otra → cambiar (quita la anterior) o añadir.
    const prev = myEmoji;
    setCounts((c) => {
      const n = { ...c };
      if (prev === emoji) {
        n[emoji] = Math.max(0, (n[emoji] ?? 0) - 1);
      } else {
        if (prev) n[prev] = Math.max(0, (n[prev] ?? 0) - 1);
        n[emoji] = (n[emoji] ?? 0) + 1;
      }
      return n;
    });
    setMyEmoji(prev === emoji ? null : emoji);

    // 2) Persiste en segundo plano, en orden (cadena). No se espera para pintar.
    pending.current++;
    chain.current = chain.current
      .catch(() => {})
      .then(() => toggleReaction(sessionId, emoji))
      .finally(() => {
        pending.current--;
        // Cuando drena la cadena, trae la verdad del servidor (reacciones de otros).
        if (pending.current === 0) router.refresh();
      });
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {REACTIONS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const on = myEmoji === emoji;
        return (
          <button
            key={emoji}
            type="button"
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
              cursor: "pointer",
              border: `1px solid ${on ? "var(--color-ambar)" : "var(--color-borde)"}`,
              background: on ? "rgba(242,160,22,.14)" : "var(--color-barra-alta)",
              opacity: count > 0 || on ? 1 : 0.72,
              transition: "background .1s ease, border-color .1s ease",
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
