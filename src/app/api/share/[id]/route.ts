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
  formatBreakdown,
  firstTimeDrink,
  outingNumber,
} from "@/lib/domain";
import { FORMAT_LABEL, formatAbv, formatBreakdownText, formatClock, formatDayLong, formatSheetDate, formatTimeWindow, joinMeta, shareFileName } from "@/lib/format";
import { resolveCardColor, styleColorFor } from "@/lib/colors";
import { renderShareCard, renderFontProbe, type ShareData } from "./card";
import { avatarImg } from "./avatars";
import { BIG_SHOULDERS_700, BIG_SHOULDERS_800, OUTFIT_400, OUTFIT_700 } from "./fonts";

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

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    return await handleShare(req, ctx);
  } catch (e) {
    // B-1.7: cualquier throw no controlado (consultas, auth, armado de datos) se LOGUEA con
    // su motivo antes del 500 — así el próximo fallo deja rastro. El render tiene su propio
    // try con más contexto (session/format/hasPhoto).
    console.error("[share] error no controlado generando la card:", e);
    return new Response("No se pudo generar la imagen", { status: 500 });
  }
}

async function handleShare(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const t0 = performance.now(); // B-1.1: tiempo desde que entra el request (elapsed_ms)
  const { id } = await ctx.params;
  const reqUrl = new URL(req.url);
  const format = reqUrl.searchParams.get("format") === "story" ? "story" : "post";
  // B-1.1 · instrumentación de diagnóstico: ?debug mide los tramos (dbMain, dbExtra,
  // photoFetch, render) + elapsed_ms + region y devuelve JSON en vez de la imagen.
  // B-1.6 · GATEADA: nunca se expone en producción (solo dev/preview) — en prod, ?debug cae
  // al camino de imagen normal. Se lee por PRESENCIA del parámetro para no fallar callado.
  const debug = reqUrl.searchParams.has("debug") && process.env.VERCEL_ENV !== "production";
  const T: Record<string, number> = {};
  let mark = performance.now();
  const lap = (k: string) => { T[k] = Math.round(performance.now() - mark); mark = performance.now(); };

  // B-1.5 · diagnóstico de auth: auth (getCurrentUser) es el PRIMER toque a la DB, así que
  // paga la apertura de la conexión al pooler de Neon. Un `SELECT 1` cronometrado ANTES
  // aísla ese costo: si `connWarm` se lleva los ~900ms y `auth` cae, era la conexión (no
  // Better Auth). Solo en debug; reinicia `mark` para no contaminar dbMain.
  if (debug) {
    const tc = performance.now();
    try { await prisma.$queryRaw`SELECT 1`; } catch {}
    T.connWarm = Math.round(performance.now() - tc);
    mark = performance.now();
  }

  // Permiso: solo quien puede VER la salida (dueño o círculo). B-1.2: auth va primero
  // (todo depende de viewer.id), pero getSessionDetail y loadCircle son independientes →
  // en paralelo. B-1.3: instrumentado por dentro (auth / getSessionDetail / loadCircle) para
  // ver dónde está el costo — el Promise.all no bajó dbMain.
  const tAuth = performance.now();
  const viewer = await getCurrentUser();
  T.auth = Math.round(performance.now() - tAuth);
  if (!viewer) return new Response("No autorizado", { status: 401 });
  const tPar = performance.now();
  const [session, circle] = await Promise.all([
    getSessionDetail(id, viewer.id).then((r) => { T.getSessionDetail = Math.round(performance.now() - tPar); return r; }),
    loadCircle(viewer.id).then((r) => { T.loadCircle = Math.round(performance.now() - tPar); return r; }),
  ]);
  if (!session) return new Response("No existe", { status: 404 });
  if (!circle.has(session.userId)) return new Response("No puedes ver esa salida", { status: 403 });
  lap("dbMain"); // auth (serie) + [getSessionDetail ∥ loadCircle]; ver T.auth/getSessionDetail/loadCircle

  const checkIns = session.checkIns; // ya en createdAt asc (el orden del recorrido)
  const single = checkIns.length === 1;

  // Duración (T6): CONDICIONAL a una ventana real (≥ 1h). El T5 la mostraba siempre ("así sea 2m"),
  // pero el turno 6 la vuelve condicional y saca la hora aparte: la duración solo aparece cuando
  // hubo noche de verdad; la HORA ("hasta las X") va SIEMPRE, en el pie, del último check-in. Así
  // "duración" no miente con "2m" de un registro en tandas, y el pie siempre ancla la salida en el
  // tiempo. La cascada de color usa la misma ventana real (hasRealWindow) para el nivel hora.
  const times = checkIns.map((c) => c.createdAt);
  const span = drinkingSpanMinutes(times);
  const ms = times.map((t) => t.getTime());
  // La duración solo cuenta como una NOCHE plausible: ≥ 1h y ≤ 20h. Un span mayor no es una salida
  // (un check-in rezagado días después, un registro corregido) → no se muestra "162h 53m"; el pie
  // igual ancla la hora con "hasta las X".
  const NIGHT_MAX_MINUTES = 20 * 60;
  let duration: ShareData["duration"] = null;
  if (span >= DURATION_MIN_MINUTES && span <= NIGHT_MAX_MINUTES) {
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
  const photo = session.photos.find((p) => isOurBlobUrl(p.url)) ?? null;
  const photoUrl = photo?.url ?? null;

  // SC · Tanda 2: el color de la cascada se lee del ÚLTIMO check-in (createdAt asc → el último
  // del arreglo). marca (Beer.color) → estilo (styleColorFor) → foto (SessionPhoto.color, ya
  // ajustado a la rueda) → hora del último check-in → respaldo #N mod 5. La tinta viene
  // emparejada. `hasRealWindow` = hay ventana (misma regla que la duración).
  const last = checkIns[checkIns.length - 1];
  const hasRealWindow = span >= DURATION_MIN_MINUTES;
  const { hex: color, ink } = resolveCardColor({
    brandColor: last.beer.color ?? null,
    styleColor: styleColorFor(last.beer.style),
    photoColor: photo?.color ?? null,
    lastCheckInAt: last.createdAt,
    hasRealWindow,
    outingNumber: outing,
  });
  // "hasta las {hora del último check-in}" — SIEMPRE (T6): la hora vive en el pie y ancla la salida
  // en el tiempo aunque no haya ventana ≥1h. La fecha sale del header de la story (vive 24h); en el
  // 4:5 la fecha baja al pie como cuarto dato.
  const lastLabel = `hasta las ${formatClock(last.createdAt)}`;

  // T5 · stats propias para LLENAR la story (sobre todo sin foto y con pocas bebidas):
  // La RULETA — contenido nativo de FriaDay, imposible de copiar. "N rondas · {quién} perdió {n}":
  // se agrega por perdedor; a empate gana el de la ronda más reciente (rounds vienen desc). Sin
  // rondas → null (el bloque no se dibuja).
  let ruleta: ShareData["ruleta"] = null;
  if (session.rounds.length > 0) {
    const tally = new Map<string, { name: string; count: number }>();
    for (const r of session.rounds) {
      const e = tally.get(r.loserId) ?? { name: r.loser.displayName, count: 0 };
      e.count++;
      tally.set(r.loserId, e);
    }
    const top = [...tally.values()].sort((a, b) => b.count - a.count)[0];
    ruleta = { rondas: session.rounds.length, loserName: top.name, losses: top.count };
  }
  // Formato: "3 botellas · 1 copa" — solo con MÁS de un formato (con uno es redundante).
  const fb = formatBreakdown(checkIns.map((c) => ({ format: c.format, quantity: c.quantity })));
  const formato = fb.length > 1 ? formatBreakdownText(fb) : null;
  // Bebidas distintas: para "N distintas" cuando el recorrido se trunca (no se ven todas).
  const distinct = beerIds.length;

  const data: ShareData = {
    photoColor: photo?.color ?? null,
    luminance: photo?.luminance ?? null,
    place: session.placeName,
    dateLabel: formatDayLong(session.date),
    dateShort: formatSheetDate(session.date),
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
    color,
    ink,
    lastLabel,
    ruleta,
    formato,
    distinct,
  };

  // SC · Tanda 3 · ?meta: JSON liviano (sin render de satori) para el CHROME del sheet — el
  // encabezado (lugar · #N · fecha), las stats compactas y el color de acento. El sheet lo pide
  // al abrir para poblar la hoja mientras la IMAGEN se genera en paralelo. Mismo auth/círculo que
  // la imagen. `defaultFormat`: el caso pobre (una bebida, sin foto) abre en Publicación (menos
  // lienzo que llenar); el resto en Historia.
  if (reqUrl.searchParams.has("meta")) {
    return Response.json({
      place: data.place,
      ownerName: data.ownerName,
      outing,
      dateShort: formatSheetDate(session.date),
      total: data.total,
      duration,
      single,
      hasPhoto: !!photoUrl,
      defaultFormat: single && !photoUrl ? "post" : "story",
      color,
      ink,
    });
  }

  // Fuentes EMBEBIDAS (S.1): sin fetch en runtime. El fetch al mismo origen fallaba en
  // previews con Deployment Protection (devolvía el HTML del SSO en vez del woff → satori
  // 500). Embebidas funciona igual en local, preview y prod.
  // SC · Tanda 2: Big Shoulders Display en instancias ESTÁTICAS 700/800 (satori 0.25 no
  // interpola ejes variables → una variable saldría en su master fino). Syne salió (era la
  // display de la v2). Outfit 400/700 se queda para el texto de apoyo.
  const fonts = [
    { name: "Big Shoulders Display", data: BIG_SHOULDERS_700, weight: 700 as const, style: "normal" as const },
    { name: "Big Shoulders Display", data: BIG_SHOULDERS_800, weight: 800 as const, style: "normal" as const },
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
      // B-1.4: región donde CORRE la función (Vercel la inyecta). Si es iad1 (Washington) y
      // Neon está en sa-east-1 (São Paulo), cada consulta paga la ida y vuelta cruzada.
      region: process.env.VERCEL_REGION ?? "local",
      single,
      hasPhoto: !!photoUrl,
      photoBytes,
      format,
      elapsed_ms: Math.round(performance.now() - t0),
      tramos_ms: T,
      ...(render_ms ? { render_ms } : {}),
    });
  }

  // B-1.7 · observabilidad + robustez: se BUFFERIZA el render (`await arrayBuffer()`) dentro
  // de un try, en vez de devolver el stream perezoso. Así, si satori/resvg revienta al
  // rasterizar (p.ej. una foto real que no decodifica), el throw cae AQUÍ: se loguea el
  // motivo real y se devuelve un 500 limpio. Antes el error ocurría al drenar el stream ya
  // enviado → el cliente lo veía como "problemas de conexión" y no quedaba rastro en logs
  // (el fallo intermitente de producción de B-1.7).
  try {
    const img = new ImageResponse(renderShareCard(data, format), { ...DIM[format], fonts });
    const png = await img.arrayBuffer();
    // Se conserva el Content-Type/Cache-Control de ImageResponse y solo se AÑADE el
    // Content-Disposition (nombre legible, S.3 §2) que el cliente lee para el File.
    const headers = new Headers(img.headers);
    headers.set("Content-Disposition", `inline; filename="${shareFileName(session.placeName, session.date)}"`);
    return new Response(png, { status: 200, headers });
  } catch (e) {
    console.error(`[share] fallo al generar la card · session=${id} format=${format} hasPhoto=${!!photoUrl}:`, e);
    return new Response("No se pudo generar la imagen", { status: 500 });
  }
}
