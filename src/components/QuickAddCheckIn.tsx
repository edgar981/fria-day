"use client";

import { useRouter } from "next/navigation";
import { CheckInForm, type CheckInDraft } from "@/components/CheckInForm";
import { addCheckIn } from "@/app/actions/sessions";

export function QuickAddCheckIn({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  async function onSubmit(d: CheckInDraft): Promise<boolean> {
    const res = await addCheckIn({
      sessionId,
      beerId: d.beer.id,
      quantity: d.quantity,
      format: d.format,
      rating: d.rating,
    });
    if (!res.ok) throw new Error(res.error);
    router.refresh();
    return true;
  }

  return <CheckInForm onSubmit={onSubmit} submitLabel="Agregar cerveza" />;
}
