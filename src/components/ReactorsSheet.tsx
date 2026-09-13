"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ReactionGlyph } from "@/components/ReactionGlyph";
import { useSheetDrag } from "@/lib/useSheetDrag";
import { useSheetEnter, sheetEnterTransform } from "@/lib/useSheetEnter";
import { profileHref } from "@/lib/profile-link";

type Reactor = { userId: string; name: string; avatar: string | null; emoji: string };

/**
 * "Quiénes brindaron" (Pasada PA.1, tablero 1b): tocar el racimo de avatares del pie abre esta hoja
 * — cada quien con la reacción que dejó, TU fila primero, y avatar+nombre abren su perfil (`/u/[id]`).
 * Por createPortal al body: sus enlaces NO quedan anidados dentro del Link de la tarjeta del feed.
 * Sin líneas que expliquen estado (regla Pasada T).
 */
export function ReactorsSheet({
  open,
  onClose,
  reactors,
  viewerId,
}: {
  open: boolean;
  onClose: () => void;
  reactors: Reactor[];
  viewerId: string;
}) {
  const [mounted, setMounted] = useState(false);
  const { dragY, dragging, dragHandlers } = useSheetDrag(onClose);
  const entered = useSheetEnter(open);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Tu fila primero; el resto en el orden dado.
  const ordered = [...reactors].sort((a, b) => (a.userId === viewerId ? -1 : b.userId === viewerId ? 1 : 0));

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 85 }} role="dialog" aria-modal="true" aria-label="Quiénes brindaron">
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(10,7,4,.62)" }} />
      <div
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, maxWidth: 440, margin: "0 auto", maxHeight: "90vh", overflowY: "auto",
          background: "var(--color-noche)", borderTop: "1px solid var(--color-borde)", borderRadius: "22px 22px 0 0",
          padding: "10px 18px calc(env(safe-area-inset-bottom,0px) + 22px)", display: "flex", flexDirection: "column", gap: 14,
          transform: sheetEnterTransform(entered, dragY), transition: dragging ? "none" : "transform 0.25s ease",
        }}
      >
        <div {...dragHandlers}>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
            <span style={{ width: 40, height: 4, borderRadius: 99, background: "var(--color-borde)" }} />
          </div>
          <h2 style={{ font: "800 24px/1 var(--font-display)", letterSpacing: "-.02em", margin: "12px 0 0", paddingRight: 44 }}>Quiénes brindaron</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: 11, border: "1px solid var(--color-borde)", background: "var(--color-noche)", color: "var(--color-tenue)", cursor: "pointer", fontSize: 17, lineHeight: 1, zIndex: 1 }}>×</button>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {ordered.map((r) => {
            const me = r.userId === viewerId;
            return (
              <Link
                key={r.userId}
                href={profileHref(r.userId, viewerId)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderBottom: "1px solid #241A12", textDecoration: "none", color: "var(--color-crema)" }}
              >
                <Avatar avatar={r.avatar} size={38} radius={12} />
                <span style={{ flex: 1, minWidth: 0, font: `${me ? 700 : 600} 15.5px var(--font-sans)`, color: me ? "var(--color-espuma)" : "var(--color-crema)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {me ? "Tú" : r.name}
                </span>
                <ReactionGlyph emoji={r.emoji} size={22} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
