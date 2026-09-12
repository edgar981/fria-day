/**
 * Compresión de imagen en el CLIENTE antes de subir (Pasada F, decisión 1). Una
 * foto cruda de iPhone son varios MB; en 4G eso mata la funcionalidad. Reducimos
 * al lado mayor y re-encodeamos a JPEG. Todo pasa por <canvas>, así que el
 * resultado SIEMPRE es JPEG aunque la entrada sea HEIC/PNG/WebP (Safari decodifica
 * HEIC a canvas; en la cámara del iPhone la captura ya suele venir en JPEG).
 */

/** Lado mayor objetivo tras comprimir. */
import { dominantWheel } from "@/lib/colors";

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
  /** Pasada SC · nivel 2: el tono dominante ya ajustado a la rueda de doce, o null si la foto
   *  es demasiado gris. La extracción va AQUÍ (canvas ya decodificado), nunca en el servidor. */
  color: string | null;
  /** Pasada SC · Turno 6: el BRILLO real de la foto (0 = negra, 1 = blanca), luminancia percibida
   *  promedio. El velo del modo-foto ajusta su alfa con esto — una foto clara necesita más velo
   *  para que el texto se lea. NO se puede derivar de `color` (que es el tono ajustado a la rueda,
   *  no el brillo). Se calcula en el MISMO canvas, best-effort → null si el canvas falla. */
  luminance: number | null;
}

/**
 * Extrae del canvas, en UNA sola lectura de píxeles: (1) el tono dominante ajustado a la rueda
 * (nivel 2 · SC — vota por matiz) y (2) la luminancia percibida promedio (0–1, Turno 6 · para el
 * alfa del velo). Best-effort: si el canvas está "tainted" u otro fallo, ambos null.
 */
function extractPhotoData(ctx: CanvasRenderingContext2D, w: number, h: number): { color: string | null; luminance: number | null } {
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return { color: null, luminance: null }; // canvas "tainted" u otro fallo: no romper el flujo
  }
  const step = Math.max(1, Math.floor((w * h) / 20000)) * 4; // ~20k muestras
  const samples: [number, number, number][] = [];
  let lumSum = 0;
  for (let i = 0; i < data.length; i += step) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    samples.push([r, g, b]);
    lumSum += 0.2126 * r + 0.7152 * g + 0.0722 * b; // luminancia percibida (Rec. 709)
  }
  const luminance = samples.length ? lumSum / (samples.length * 255) : null;
  return { color: dominantWheel(samples), luminance };
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
    throw new ImageError("Eso no es una imagen.");
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

  // Nivel 2 (SC) + brillo (T6): tono dominante y luminancia, aquí, con la imagen ya en canvas.
  // Best-effort: si falla, ambos null.
  const { color, luminance } = extractPhotoData(ctx, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new ImageError("No se pudo procesar la imagen.");
  if (blob.size > MAX_COMPRESSED_BYTES) {
    throw new ImageError("La foto sigue muy pesada. Prueba con otra.");
  }

  return { blob, filename: "beer.jpg", width: w, height: h, color, luminance };
}
