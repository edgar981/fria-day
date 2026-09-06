import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth.handler);

// B-1.7: Better Auth maneja y loguea sus propios errores (normalmente DEVUELVE respuestas
// de error, no lanza). Esta envoltura delgada es solo red de seguridad: si algo inesperado
// llegara a lanzar, deja rastro con etiqueta [auth] antes del 500. Re-lanza → comportamiento
// sin cambios.
export async function GET(req: Request): Promise<Response> {
  try {
    return await handlers.GET(req);
  } catch (e) {
    console.error("[auth] throw no controlado en GET:", e);
    throw e;
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    return await handlers.POST(req);
  } catch (e) {
    console.error("[auth] throw no controlado en POST:", e);
    throw e;
  }
}
