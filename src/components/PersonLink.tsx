"use client";

import { useRouter } from "next/navigation";

/**
 * Un tap-target a un perfil que vive DENTRO de otro Link (la tarjeta del feed navega al detalle).
 * No es un <a> anidado: intercepta el tap (stopPropagation) y navega al perfil, sin disparar la
 * navegación de la tarjeta. Mismo patrón que los botones de ReactionBar dentro de la tarjeta.
 */
export function PersonLink({
  href,
  children,
  style,
}: {
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(href);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      style={{ cursor: "pointer", ...style }}
    >
      {children}
    </span>
  );
}
