"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BeerSheet, type SheetDraft } from "@/components/BeerSheet";
import { Icon } from "@/components/Icon";
import { addCheckIn } from "@/app/actions/sessions";

export function AddCheckInButton({
  sessionId,
  variant = "dashed",
}: {
  sessionId: string;
  // "dashed": botón punteado "Agregar otra bebida". "primary" (DS · modo Editar): píldora
  // sólida ámbar "＋ Bebida" para anclar al pulgar.
  variant?: "dashed" | "primary";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onAdd(d: SheetDraft) {
    const res = await addCheckIn({
      sessionId,
      beerId: d.beer.id,
      quantity: 1,
      format: d.format,
      rating: d.rating >= 1 ? d.rating : null,
    });
    if (res.ok) router.refresh();
  }

  return (
    <>
      {variant === "primary" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 56, borderRadius: 17, border: "none", background: "var(--color-ambar)", color: "#241609", font: "700 17px var(--font-sans)", cursor: "pointer" }}
        >
          <Icon name="plus" size={20} /> Bebida
        </button>
      ) : (
        <button type="button" className="btn btn-dashed" style={{ width: "100%" }} onClick={() => setOpen(true)}>
          <Icon name="plus" size={20} /> Agregar otra bebida
        </button>
      )}
      <BeerSheet open={open} onClose={() => setOpen(false)} onAdd={onAdd} />
    </>
  );
}
