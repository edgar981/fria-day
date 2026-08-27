"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSession } from "@/app/actions/sessions";

export function DeleteSessionButton({
  sessionId,
  checkInCount,
}: {
  sessionId: string;
  checkInCount: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
        Borrar salida
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: "0.85rem", display: "grid", gap: "0.6rem", borderColor: "var(--danger)" }}>
      <p style={{ margin: 0, fontSize: "0.9rem" }}>
        Vas a borrar esta salida
        {checkInCount > 0 ? (
          <>
            {" "}y se perderán <strong>{checkInCount} check-in{checkInCount !== 1 ? "s" : ""}</strong>
          </>
        ) : null}
        . Esto no se puede deshacer.
      </p>
      {error && <p style={{ color: "var(--danger)", fontSize: "0.82rem", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await deleteSession(sessionId);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              router.push("/");
              router.refresh();
            })
          }
        >
          {pending ? "Borrando…" : "Sí, borrar"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
