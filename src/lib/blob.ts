import "server-only";
import { del } from "@vercel/blob";

/**
 * Utilidades de Vercel Blob del lado servidor (Pasada F). Las fotos viven FUERA de
 * Postgres, así que borrar un check-in/salida o reemplazar una foto debe borrar
 * también el archivo — si no, quedan huérfanos pagando espacio. Ver
 * scripts/clean-orphan-blobs.ts para el barrido de los que se escapen.
 */

/**
 * Token del store SEGÚN el entorno. Vercel solo tiene Production y Preview, y cada
 * store quedó con su propia variable (dos stores separados, como las ramas de Neon):
 *   - Production → BLOB_READ_WRITE_TOKEN
 *   - Preview    → BLOB_PREV_READ_WRITE_TOKEN
 * LOCAL (VERCEL_ENV ausente) usa SOLO el de preview/dev, nunca el de prod — regla
 * dura del proyecto: Code jamás toca producción. El SDK lee BLOB_READ_WRITE_TOKEN
 * por defecto, así que hay que pasar el token explícito en put/del/list/handleUpload.
 */
export function blobToken(): string | undefined {
  if (process.env.VERCEL_ENV === "production") return process.env.BLOB_READ_WRITE_TOKEN;
  return process.env.BLOB_PREV_READ_WRITE_TOKEN;
}

/** ¿Hay token de escritura para este entorno? Sin él, subir/borrar es un no-op. */
export const BLOB_CONFIGURED = !!blobToken();

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
  const token = blobToken();
  if (!token) {
    console.warn("[blob] token ausente para este entorno: no se borró", url);
    return;
  }
  try {
    await del(url, { token });
  } catch (e) {
    console.error("[blob] fallo al borrar (huérfano, se sigue):", url, e);
  }
}

/** Borra varios blobs en paralelo, cada uno best-effort. */
export async function deleteBlobsQuietly(urls: (string | null | undefined)[]): Promise<void> {
  await Promise.allSettled(urls.map((u) => deleteBlobQuietly(u)));
}
