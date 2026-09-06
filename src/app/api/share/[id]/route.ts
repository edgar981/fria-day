import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getSessionDetail, loadCircle } from "@/lib/queries";
import { isOurBlobUrl } from "@/lib/blob";
import {
  drinkingSpanMinutes,
  DURATION_MIN_MINUTES,
  formatDurationLabel,
  firstTimeDrink,
  outingNumber,
} from "@/lib/domain";
import { FORMAT_LABEL, formatAbv, formatDayLong, formatTimeWindow, joinMeta, shareFileName } from "@/lib/format";
import { renderShareCard, renderFontProbe, type ShareData } from "./card";
import { avatarImg } from "./avatars";
import { SYNE_800, OUTFIT_400, OUTFIT_700 } from "./fonts";

// Node runtime (no edge): usamos Prisma + auth por cookie. ImageResponse (next/og)
// funciona en Node. Nada de esto consume la cuota de Optimización de Imágenes de
// Vercel (esa es de next/image); es cómputo de función normal.
export const dynamic = "force-dynamic";
// B-1 bug 1: el primer intento en frío (Neon cold start ~3.6s + fetch de la foto remota
// en el render + satori) medía ~7s y chocaba con el timeout por defecto de la función →
// la conexión se caía ("Se cortó la conexión" en el cliente). Damos margen holgado; en
// caliente la ruta responde en ~2s.
export const maxDuration = 30;

const DIM = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
} as const;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const t0 = performance.now(); // B-1.1: tiempo desde que entra el request (elapsed_ms)
  const { id } = await ctx.params;
  const reqUrl = new URL(req.url);
  const format = reqUrl.searchParams.get("format") === "story" ? "story" : "post";
  // B-1.1 · instrumentación: ?debug=1 mide los tramos (dbMain, dbExtra, photoFetch, render)
  // + elapsed_ms y devuelve JSON en vez de la imagen, para diagnosticar los ~7s en frío por
  // partes. Se lee en el preview (autenticado) donde Code no llega por el SSO de Vercel. Se
  // lee por PRESENCIA del parámetro (?debug, ?debug=1, ?debug=true) para no caer al camino de
  // imagen en silencio si algo normaliza el valor distinto.
  const debug = reqUrl.searchParams.has("debug");
  const T: Record<string, number> = {};
  let mark = performance.now();
  const lap = (k: string) => { T[k] = Math.round(performance.now() - mark); mark = performance.now(); };

  // Permiso: solo quien puede VER la salida (dueño o círculo). B-1.2: auth va primero
  // (todo depende de viewer.id), pero getSessionDetail y loadCircle son independientes →
  // en paralelo, para no encadenar dos idas y vueltas a sa-east-1.
  const viewer = await getCurrentUser();
  if (!viewer) return new Response("No autorizado", { status: 401 });
  const [session, circle] = await Promise.all([
    getSessionDetail(id, viewer.id),
    loadCircle(viewer.id),
  ]);
  if (!session) return new Response("No existe", { status: 404 });
  if (!circle.has(session.userId)) return new Response("No puedes ver esa salida", { status: 403 });
  lap("dbMain"); // auth (serie) + [getSessionDetail ∥ loadCircle]

  const checkIns = session.checkIns; // ya en createdAt asc (el orden del recorrido)
  const single = checkIns.length === 1;

  // Duración: ventana real de la noche (min→max de createdAt). Se OMITE si abarca menos
  // de ~1h — típico del registro retroactivo (todo cargado de una) — sin dejar hueco.
  const times = checkIns.map((c) => c.createdAt);
  const span = drinkingSpanMinutes(times);
  let duration: ShareData["duration"] = null;
  if (span >= DURATION_MIN_MINUTES) {
    const ms = times.map((t) => t.getTime());
    duration = {
      value: formatDurationLabel(span),
      window: formatTimeWindow(new Date(Math.min(...ms)), new Date(Math.max(...ms))),
    };
  }

  // "Primera vez" — acotada al DUEÑO (S.2 §4): beerIds que el dueño ya había registrado
  // en una salida estrictamente anterior. Consulta barata (solo las bebidas de ESTA
  // salida, indexada por beerId). La versión "nadie del parche" exigiría el historial de
  // todo el círculo; se descartó por costo, no por diseño.
  // B-1.2: las dos consultas extra (primera-vez y salida #N) son independientes entre sí
  // → en paralelo.
  const beerIds = [...new Set(checkIns.map((c) => c.beerId))];
  const [ownerPrior, ownerSessions] = await Promise.all([
    prisma.checkIn.findMany({
      where: { beerId: { in: beerIds }, session: { userId: session.userId } },
      select: { beerId: true, session: { select: { date: true, createdAt: true } } },
    }),
    // Salida #N del dueño: su puesto entre TODAS sus salidas (date, createdAt) asc.
    prisma.session.findMany({
      where: { userId: session.userId },
      select: { id: true, date: true, createdAt: true },
    }),
  ]);
  const thisKey = session.date.getTime();
  const thisCreated = session.createdAt.getTime();
  const seenBefore = new Set(
    ownerPrior
      .filter((r) => {
        const k = r.session.date.getTime();
        return k < thisKey || (k === thisKey && r.session.createdAt.getTime() < thisCreated);
      })
      .map((r) => r.beerId),
  );
  const firstTime = firstTimeDrink(
    checkIns.map((c) => ({ beerId: c.beerId, name: c.beer.name })),
    seenBefore,
  );

  const outing = outingNumber(ownerSessions, id);
  lap("dbExtra"); // [ownerPrior ∥ ownerSessions]

  // El parche: dueño primero + etiquetados (usuario o texto libre → avatar anónimo),
  // cortado a 3 caras. Los nombres (sin el dueño) van en la línea "con …".
  const avatars = [session.user.avatar, ...session.tags.map((t) => t.taggedUser?.avatar ?? null)]
    .slice(0, 3)
    .map(avatarImg);
  const companions = session.tags
    .map((t) => t.taggedUser?.displayName ?? t.freeText ?? "")
    .filter((s): s is string => !!s);

  const rated = checkIns.filter((c) => c.rating != null);
  const bestCi = rated.length ? rated.reduce((a, b) => ((b.rating ?? 0) > (a.rating ?? 0) ? b : a)) : null;
  // I-2: la foto es de la salida (primera de SessionPhoto), ya no del check-in.
  const photoUrl = session.photos.find((p) => isOurBlobUrl(p.url))?.url ?? null;

  const data: ShareData = {
    place: session.placeName,
    dateLabel: formatDayLong(session.date),
    ownerName: session.user.displayName,
    avatars,
    companions,
    total: checkIns.reduce((n, c) => n + c.quantity, 0),
    duration,
    outing,
    firstTime,
    best: bestCi ? { name: bestCi.beer.name, rating: bestCi.rating as number } : null,
    drinks: checkIns.map((c) => ({
      name: c.beer.name,
      meta: joinMeta(c.beer.brewery, c.beer.style, formatAbv(c.beer.abv), FORMAT_LABEL[c.format]),
      rating: c.rating,
    })),
    photoUrl,
    single,
  };

  // Fuentes EMBEBIDAS (S.1): sin fetch en runtime. El fetch al mismo origen fallaba en
  // previews con Deployment Protection (devolvía el HTML del SSO en vez del woff → satori
  // 500). Embebidas funciona igual en local, preview y prod.
  const fonts = [
    { name: "Syne", data: SYNE_800, weight: 800 as const, style: "normal" as const },
    { name: "Outfit", data: OUTFIT_400, weight: 400 as const, style: "normal" as const },
    { name: "Outfit", data: OUTFIT_700, weight: 700 as const, style: "normal" as const },
  ];

  // B-1.1 · modo diagnóstico: mide los tramos y devuelve JSON (no la imagen). Aísla el fetch
  // de la foto remota (satori lo hace en serie durante el render) y MIDE el render forzándolo
  // (se drena el body; la foto va como data-URI para no re-bajarla → `render` queda puro).
  // `elapsed_ms` = tiempo total desde que entró el request. `commit` confirma el build.
  if (debug) {
    let photoBytes = 0;
    let dataUri: string | null = null;
    if (photoUrl) {
      try {
        const r = await fetch(photoUrl, { cache: "no-store" });
        const buf = await r.arrayBuffer();
        photoBytes = buf.byteLength;
        dataUri = `data:${r.headers.get("content-type") || "image/jpeg"};base64,${Buffer.from(buf).toString("base64")}`;
      } catch {}
    }
    lap("photoFetch");
    const story = format === "story";
    const withPhoto = { ...data, photoUrl: dataUri ?? photoUrl };
    const timeRender = async (el: ReactElement) => {
      const t = performance.now();
      try { await new ImageResponse(el, { ...DIM[format], fonts }).arrayBuffer(); } catch {}
      return Math.round(performance.now() - t);
    };
    // Tramo oficial "render" = la tarjeta real (con foto como data-URI → render puro).
    T.render = await timeRender(renderShareCard(withPhoto, format));
    // ?renderbreak=1: descompone el render por partes (no cuenta para elapsed). Costo fijo
    // de fuentes vs foto vs avatares vs base (festón+texto+nodos).
    let render_ms: Record<string, number> | undefined;
    if (reqUrl.searchParams.has("renderbreak")) {
      render_ms = {
        full: T.render,
        nophoto: await timeRender(renderShareCard({ ...data, photoUrl: null }, format)),
        noavatars: await timeRender(renderShareCard({ ...withPhoto, avatars: [] }, format)),
        base: await timeRender(renderShareCard({ ...data, photoUrl: null, avatars: [] }, format)),
        fontsOnly: await timeRender(renderFontProbe(story)),
      };
    }
    return Response.json({
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      single,
      hasPhoto: !!photoUrl,
      photoBytes,
      format,
      elapsed_ms: Math.round(performance.now() - t0),
      tramos_ms: T,
      ...(render_ms ? { render_ms } : {}),
    });
  }

  const img = new ImageResponse(renderShareCard(data, format), { ...DIM[format], fonts });

  // Nombre de archivo legible (S.3 §2). Se envuelve la respuesta para conservar el
  // Content-Type/Cache-Control que pone ImageResponse y solo AÑADIR Content-Disposition;
  // el cliente lo lee para nombrar el File que comparte/descarga.
  const headers = new Headers(img.headers);
  headers.set("Content-Disposition", `inline; filename="${shareFileName(session.placeName, session.date)}"`);
  return new Response(img.body, { status: img.status, statusText: img.statusText, headers });
}
