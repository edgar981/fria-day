"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { takeCuenta } from "@/app/actions/points";
import { CuentaReceipt } from "@/components/CuentaReceipt";
import type { CuentaLine } from "@/lib/points";

// Detalle de salida = /sessions/<id>, excluyendo /sessions/new.
const DETAIL = /^\/sessions\/(?!new$)([^/]+)$/;

/**
 * Dispara "la cuenta" al SALIR del detalle (Pasada PT · §5). Vive en el layout (app) → sobrevive
 * al cambio de ruta y funciona con las tres salidas por igual (botón atrás, gesto de iOS, tocar
 * una pestaña): las tres cambian el pathname. No se puede interceptar el gesto de iOS, así que se
 * detecta la TRANSICIÓN de ruta, no el mecanismo. Si la app se cierra dentro del detalle no hay
 * transición → los puntos quedan no vistos y salen la próxima vez que se sale de un detalle
 * editado (nunca al abrir). `takeCuenta` lee y marca visto en el mismo paso → no se repite.
 */
export function CuentaWatcher() {
  const pathname = usePathname();
  const prev = useRef<string | null>(null);
  const [receipt, setReceipt] = useState<{ lines: CuentaLine[]; total: number } | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = pathname;
    if (!before) return; // primer render: no hay "salida" todavía
    const m = before.match(DETAIL);
    if (!m || DETAIL.test(pathname)) return; // no venimos de un detalle, o vamos a otro detalle
    takeCuenta(m[1])
      .then((r) => { if (r.lines.length > 0) setReceipt(r); })
      .catch(() => {});
  }, [pathname]);

  if (!receipt) return null;
  return <CuentaReceipt lines={receipt.lines} total={receipt.total} onClose={() => setReceipt(null)} />;
}
