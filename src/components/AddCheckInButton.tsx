"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BeerSheet, type SheetDraft } from "@/components/BeerSheet";
import { Icon } from "@/components/Icon";
import { addCheckIn, setCheckInPhoto } from "@/app/actions/sessions";

export function AddCheckInButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onAdd(d: SheetDraft) {
    // El check-in se guarda PRIMERO; la foto se adjunta después (nunca la bloquea).
    const res = await addCheckIn({
      sessionId,
      beerId: d.beer.id,
      quantity: 1,
      format: d.format,
      rating: d.rating >= 1 ? d.rating : null,
    });
    if (res.ok) {
      if (d.photoUrl) await setCheckInPhoto(res.checkInId, d.photoUrl);
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className="btn btn-dashed" style={{ width: "100%" }} onClick={() => setOpen(true)}>
        <Icon name="plus" size={20} /> Agregar otra bebida
      </button>
      <BeerSheet open={open} onClose={() => setOpen(false)} onAdd={onAdd} />
    </>
  );
}
