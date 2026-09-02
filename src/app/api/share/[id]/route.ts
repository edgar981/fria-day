import { ImageResponse } from "next/og";
import { getCurrentUser } from "@/lib/session";
import { getSessionDetail, loadCircle } from "@/lib/queries";
import { isOurBlobUrl } from "@/lib/blob";
import { FORMAT_LABEL, formatDay, joinMeta } from "@/lib/format";
import { renderShareCard, type ShareData } from "./card";

// Node runtime (no edge): usamos Prisma + auth por cookie. ImageResponse (next/og)
// funciona en Node. Nada de esto consume la cuota de Optimización de Imágenes de
// Vercel (esa es de next/image); es cómputo de función normal.
export const dynamic = "force-dynamic";

const DIM = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const reqUrl = new URL(req.url);
  const format = reqUrl.searchParams.get("format") === "story" ? "story" : "post";

  // Permiso: solo quien puede VER la salida (dueño o círculo).
  const viewer = await getCurrentUser();
  if (!viewer) return new Response("No autorizado", { status: 401 });
  const session = await getSessionDetail(id, viewer.id);
  if (!session) return new Response("No existe", { status: 404 });
  const circle = await loadCircle(viewer.id);
  if (!circle.has(session.userId)) return new Response("No puedes ver esa salida", { status: 403 });

  // Métricas — todo de datos que ya existen (nada de perfil/leaderboard/rachas).
  const checkIns = session.checkIns;
  const total = checkIns.reduce((n, c) => n + c.quantity, 0);
  const distinct = new Set(checkIns.map((c) => c.beerId)).size;
  const companions = session.tags
    .map((t) => t.taggedUser?.displayName ?? t.freeText ?? "")
    .filter((s): s is string => !!s);
  const parche = 1 + session.tags.length; // dueño + etiquetados
  const rated = checkIns.filter((c) => c.rating != null);
  const bestCi = rated.length ? rated.reduce((a, b) => ((b.rating ?? 0) > (a.rating ?? 0) ? b : a)) : null;
  const photoUrl = checkIns.find((c) => isOurBlobUrl(c.photoUrl))?.photoUrl ?? null;

  const data: ShareData = {
    place: session.placeName,
    dateLabel: formatDay(session.date),
    ownerName: session.user.displayName,
    companions,
    parche,
    total,
    distinct,
    best: bestCi ? { name: bestCi.beer.name, rating: bestCi.rating as number } : null,
    drinks: checkIns.map((c) => ({
      name: c.beer.name,
      meta: joinMeta(c.beer.brewery, FORMAT_LABEL[c.format]),
      rating: c.rating,
    })),
    photoUrl,
    single: checkIns.length === 1,
  };

  // Fuentes desde /public (mismo origen). Robusto en dev y prod, sin resolver assets
  // por el bundler ni tracing de fs. satori soporta woff (no woff2).
  const font = (f: string) => fetch(new URL(`/fonts/${f}`, reqUrl.origin)).then((r) => r.arrayBuffer());
  const [syne800, outfit400, outfit700] = await Promise.all([
    font("Syne-800.woff"),
    font("Outfit-400.woff"),
    font("Outfit-700.woff"),
  ]);

  return new ImageResponse(renderShareCard(data, format), {
    ...DIM[format],
    fonts: [
      { name: "Syne", data: syne800, weight: 800, style: "normal" },
      { name: "Outfit", data: outfit400, weight: 400, style: "normal" },
      { name: "Outfit", data: outfit700, weight: 700, style: "normal" },
    ],
  });
}
