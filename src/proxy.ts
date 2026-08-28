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

  // getSessionCookie solo verifica PRESENCIA de la cookie (sin DB). La validez
  // real la comprueba cada página con getSession().
  const hasSession = !!getSessionCookie(req);

  // Solo un guardia: sin cookie en ruta protegida → /login. Un usuario sin
  // cookie que aún así llega aquí sin sesión válida lo maneja requireUser().
  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // NO rebotar /login → / por mera PRESENCIA de cookie: una cookie inválida
  // (p.ej. sesión expirada que Safari no borró) engañaba al proxy y creaba un
  // bucle de redirección con requireUser() (que la rechaza en /). El caso
  // "usuario YA logueado que visita /login" se maneja en (auth)/layout con
  // getSession() real (validación, no presencia).
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
