import { SPRITE } from "@/components/Sprite";
import { resolveAvatar } from "@/lib/avatars";

/**
 * Avatares para la share-card (Pasada S.2). satori NO resuelve `<use href="#av-…">`,
 * así que cada símbolo del sprite se inlinea como un SVG independiente y se sirve como
 * data-URI (`<img>`), que satori sí rasteriza con soporte SVG completo.
 *
 * El símbolo va SIN fondo: el color de campo lo pone un div contenedor (bg + radio),
 * de modo que los avatares superpuestos del parche se recorten como en el diseño.
 */
const bodyCache = new Map<string, string>();
function symbolBody(id: string): string {
  const hit = bodyCache.get(id);
  if (hit != null) return hit;
  const m = SPRITE.match(new RegExp(`<symbol id="${id}"[^>]*>([\\s\\S]*?)</symbol>`));
  const body = m ? m[1] : "";
  bodyCache.set(id, body);
  return body;
}

export interface AvatarImg {
  uri: string; // data-URI del símbolo (fondo transparente)
  bg: string; // color de campo (lo pinta el contenedor)
}

export function avatarImg(avatar: string | null | undefined): AvatarImg {
  const meta = resolveAvatar(avatar);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${symbolBody(meta.symbol)}</svg>`;
  return { uri: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, bg: meta.bg };
}
