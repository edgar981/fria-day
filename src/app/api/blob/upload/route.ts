import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getCurrentUser } from "@/lib/session";
import { blobToken } from "@/lib/blob";

/**
 * Subida de fotos a Vercel Blob por client-upload (Pasada F). El navegador sube
 * los bytes DIRECTO al blob (no pasan por esta función serverless → mejor en 4G y
 * sin el tope de 4.5 MB del body); esta ruta solo AUTORIZA y acuña un token corto.
 *
 * - La autorización es en servidor: sin sesión, no hay token → nadie sin cuenta
 *   escribe en el blob (validación, no confianza en el cliente).
 * - Solo image/*; tope de tamaño (el cliente ya comprime, esto es el cinturón).
 * - onUploadCompleted NO corre en localhost (necesita webhook público); no
 *   dependemos de él: el photoUrl se guarda con una Server Action tras `upload()`.
 *
 * El proxy excluye /api, así que esta ruta maneja su propia auth.
 */

// Tope en servidor (5 MB). El cliente comprime muy por debajo; esto ataja abusos.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const token = blobToken();
  if (!token) {
    return Response.json(
      { error: "Almacenamiento de fotos no configurado." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      token,
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Autorización: exige sesión válida ANTES de acuñar el token de subida.
        const user = await getCurrentUser();
        if (!user) throw new Error("No autenticado");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true, // URL pública no adivinable
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      // No-op útil solo en producción (webhook). El guardado real del photoUrl lo
      // hace el cliente con setCheckInPhoto tras resolver upload().
      onUploadCompleted: async () => {},
    });
    return Response.json(jsonResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de subida";
    return Response.json({ error: msg }, { status: 400 });
  }
}
