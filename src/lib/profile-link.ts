// Pasada PA — a dónde lleva tocar a una persona: tu propio id va a tu panel completo (/profile);
// el de otro, a su ficha (/u/[id]). Centralizado para que todos los caminos decidan igual.
export function profileHref(targetId: string, viewerId: string): string {
  return targetId === viewerId ? "/profile" : `/u/${targetId}`;
}
