import "server-only";
import { del } from "@vercel/blob";

/**
 * Utilidades de Vercel Blob del lado servidor (Pasada F). Las fotos viven FUERA de
 * Postgres, así que borrar un check-in/salida o reemplazar una foto debe borrar
 * también el archivo — si no, quedan huérfanos pagando espacio. Ver
 * scripts/clean-orphan-blobs.ts para el barrido de los que se escapen.
 */

/** ¿Hay token de escritura configurado? Sin él, subir/borrar es un no-op. */
export const BLOB_CONFIGURED = !!process.env.BLOB_READ_WRITE_TOKEN;

/** Solo tocamos URLs de nuestro almacén de Blob (defensa: nunca del() de algo ajeno). */
export function isOurBlobUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * Borra un blob SIN lanzar. Un fallo aquí (red, token, archivo ya ausente) NO debe
 * revertir el borrado del check-in (Pasada F): se registra y se sigue. Un huérfano
 * ocasional es aceptable; un check-in que no se deja borrar, no.
 */
export async function deleteBlobQuietly(url: string | null | undefined): Promise<void> {
  if (!isOurBlobUrl(url)) return;
  if (!BLOB_CONFIGURED) {
    console.warn("[blob] BLOB_READ_WRITE_TOKEN ausente: no se borró", url);
    return;
  }
  try {
    await del(url);
  } catch (e) {
    console.error("[blob] fallo al borrar (huérfano, se sigue):", url, e);
  }
}

/** Borra varios blobs en paralelo, cada uno best-effort. */
export async function deleteBlobsQuietly(urls: (string | null | undefined)[]): Promise<void> {
  await Promise.allSettled(urls.map((u) => deleteBlobQuietly(u)));
}
