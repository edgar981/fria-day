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
      className="btn btn-ghost"
      style={{ padding: "0.25rem 0.5rem", fontSize: "0.9rem", opacity: pending ? 0.5 : 1 }}
    >
      ×
    </button>
  );
}
