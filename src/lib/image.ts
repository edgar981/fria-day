/**
 * Compresión de imagen en el CLIENTE antes de subir (Pasada F, decisión 1). Una
 * foto cruda de iPhone son varios MB; en 4G eso mata la funcionalidad. Reducimos
 * al lado mayor y re-encodeamos a JPEG. Todo pasa por <canvas>, así que el
 * resultado SIEMPRE es JPEG aunque la entrada sea HEIC/PNG/WebP (Safari decodifica
 * HEIC a canvas; en la cámara del iPhone la captura ya suele venir en JPEG).
 */

/** Lado mayor objetivo tras comprimir. */
export const MAX_SIDE = 1200;
/** Calidad JPEG. Equilibrio tamaño/nitidez para fotos de bar con poca luz. */
export const JPEG_QUALITY = 0.82;
/**
 * Tope duro tras comprimir. Una foto de 1200px en JPEG 0.82 pesa ~150–400 KB; si
 * por lo que sea supera esto, es un error explícito (no un fallo silencioso). El
 * servidor rechaza por encima de este mismo tope (ver la ruta de subida).
 */
export const MAX_COMPRESSED_BYTES = 5 * 1024 * 1024;

export class ImageError extends Error {}

export interface CompressedImage {
  blob: Blob;
  /** Nombre sugerido (.jpg) para el objeto en Blob. */
  filename: string;
  width: number;
  height: number;
}

/** Escala (w,h) para que el lado mayor no supere `max`, sin agrandar. */
function fit(w: number, h: number, max: number): { w: number; h: number } {
  if (w <= max && h <= max) return { w, h };
  const s = max / Math.max(w, h);
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

/**
 * Comprime `file` a JPEG. Lanza `ImageError` con mensaje claro si no es imagen o
 * no se puede procesar. NO sube nada: solo devuelve el blob listo para subir.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) {
    throw new ImageError("Solo se permiten imágenes.");
  }

  // createImageBitmap respeta la orientación EXIF (fotos verticales de iPhone) y
  // es más rápido que un <img>. imageOrientation: "from-image" es clave en iOS.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("No se pudo leer la imagen. Prueba con otra.");
  }

  const { w, h } = fit(bitmap.width, bitmap.height, MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new ImageError("No se pudo procesar la imagen.");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new ImageError("No se pudo procesar la imagen.");
  if (blob.size > MAX_COMPRESSED_BYTES) {
    throw new ImageError("La foto sigue muy pesada. Prueba con otra.");
  }

  return { blob, filename: "beer.jpg", width: w, height: h };
}
