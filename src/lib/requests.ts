// Pasada PA — reglas puras de las solicitudes de parche (la tercera vía al círculo).
// Sin acceso a datos: se testean solas y las comparten la acción de servidor y la ficha ajena,
// para que el "puede volver a pedir" y el "sigue viendo enviada" nunca se desincronicen.

/** Enfriamiento tras un rechazo: no se puede volver a pedir antes de esto (§2). */
export const REQUEST_COOLDOWN_DAYS = 15;
export const REQUEST_COOLDOWN_MS = REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/**
 * ¿Un rechazo sigue en enfriamiento? Mientras lo esté, el solicitante NO puede volver a pedir y
 * —clave para que el rechazo sea silencioso— sigue viendo "Solicitud enviada", no el botón de vuelta.
 */
export function rejectionOnCooldown(respondedAt: Date | null | undefined, now: Date): boolean {
  if (!respondedAt) return false;
  return now.getTime() - respondedAt.getTime() < REQUEST_COOLDOWN_MS;
}

export type RelationState = "self" | "circle" | "sent" | "addable";

/** El estado de la acción en la ficha ajena, a partir de la relación y la solicitud existente. */
export function relationState(opts: {
  isSelf: boolean;
  inCircle: boolean;
  request: { status: string; respondedAt: Date | null } | null;
  now: Date;
}): RelationState {
  if (opts.isSelf) return "self";
  if (opts.inCircle) return "circle"; // ya juntos por cualquiera de las tres vías
  const r = opts.request;
  if (r) {
    if (r.status === "pending") return "sent";
    // Rechazo reciente: el solicitante sigue viendo "enviada" (rechazo silencioso) hasta el corte.
    if (r.status === "rejected" && rejectionOnCooldown(r.respondedAt, opts.now)) return "sent";
  }
  return "addable";
}
