"use client";

import { useState } from "react";

// Comparte CUALQUIER código con navigator.share; respaldo = copiar al
// portapapeles con confirmación (item A.2-6).
export function ShareCodeButton({
  code,
  variant = "ghost",
}: {
  code: string;
  variant?: "ghost" | "primary";
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const link =
      typeof window !== "undefined" ? `${window.location.origin}/register?code=${code}` : "";
    const text = `Únete a FriaDay con mi código: ${code}\n${link}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "FriaDay", text });
      } catch {
        /* cancelado por el usuario */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* sin portapapeles: nada que hacer */
    }
  }

  if (variant === "primary") {
    return (
      <button type="button" className="btn btn-primary" style={{ width: "100%", height: 48 }} onClick={share}>
        {copied ? "✓ Copiado al portapapeles" : "Compartir"}
      </button>
    );
  }
  return (
    <button type="button" className="btn btn-ghost" style={{ height: 38, fontSize: 13, flex: "none" }} onClick={share}>
      {copied ? "✓ Copiado" : "Compartir"}
    </button>
  );
}
