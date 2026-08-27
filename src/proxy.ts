import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Next 16 renombró la convención "middleware" a "proxy". Rutas públicas
// (sin sesión); todo lo demás exige cookie de sesión.
const PUBLIC_PATHS = ["/login", "/register"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // getSessionCookie solo verifica presencia (sin DB). La validez real la
  // comprueba cada página con getSession().
  const hasSession = !!getSessionCookie(req);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Excluye API (incluye /api/auth), estáticos de _next, y CUALQUIER archivo con
  // extensión (contiene un punto): friaday-icon.png, manifest.webmanifest,
  // /icons/*.png, favicon.ico, etc. Antes solo se excluían algunos por nombre, y
  // /friaday-icon.png caía en el proxy → en pantallas sin sesión (/login,
  // onboarding) se redirigía a /login y la imagen salía rota.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
