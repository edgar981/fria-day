"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCheckIn } from "@/app/actions/sessions";

export function CheckInDeleteButton({ checkInId }: { checkInId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="Eliminar check-in"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteCheckIn(checkInId);
          router.refresh();
        })
      }
      style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        border: "1px solid var(--color-borde)",
        background: "transparent",
        color: "var(--color-tenue)",
        cursor: "pointer",
        fontSize: 15,
        lineHeight: 1,
        flex: "none",
        opacity: pending ? 0.5 : 1,
      }}
    >
      ×
    </button>
  );
}
