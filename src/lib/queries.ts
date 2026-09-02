import "server-only";
import { prisma } from "@/lib/prisma";
import {
  leaderboard,
  leaderboardVariety,
  userStats,
  beerRanking,
  sessionTotalUnits,
  registrationStreak,
  dayKeyUTC,
  normalizeKey,
  ownBeerRating,
  circleOf,
  formatBreakdown,
  leaderboardSessions,
  groupReactions,
  type SessionData,
  type UserRef,
} from "@/lib/domain";

/** Set `${userId}|${dayKey}` de TODAS las salidas propias (emparejamiento fecha↔usuario). */
async function loadRegisteredDays(): Promise<Set<string>> {
  const rows = await prisma.session.findMany({ select: { userId: true, date: true } });
  const set = new Set<string>();
  for (const r of rows) set.add(`${r.userId}|${dayKeyUTC(r.date)}`);
  return set;
}

/**
 * El círculo del usuario (Pasada C): las personas con las que ha salido, derivado
 * de las etiquetas. Aristas = etiquetas a usuarios de la app (el texto libre no
 * genera arista); las descartadas (`dismissedAt`) SÍ cuentan, por eso NO se filtran.
 * Una sola implementación (circleOf), usada por feed, permisos y leaderboard.
 */
export async function loadCircle(userId: string): Promise<Set<string>> {
  const rows = await prisma.sessionTag.findMany({
    where: { taggedUserId: { not: null } },
    select: { taggedUserId: true, session: { select: { userId: true } } },
  });
  const edges = rows.map((r) => ({ ownerId: r.session.userId, taggedUserId: r.taggedUserId as string }));
  return circleOf(userId, edges);
}

/**
 * Feed social (Pasada C): salidas de cualquiera de MI CÍRCULO — propias, donde me
 * etiquetaron, y de gente con la que he salido aunque esta salida no me etiquete.
 * Como etiquetar es simétrico, "el dueño está en mi círculo" cubre los tres casos
 * (a quien me etiqueta lo tengo en el círculo, así que sus salidas ya entran).
 */
export async function getFeed(userId: string) {
  const circle = await loadCircle(userId);
  const sessions = await prisma.session.findMany({
    where: { userId: { in: [...circle] } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      user: { select: { id: true, displayName: true, avatar: true } },
      tags: {
        include: { taggedUser: { select: { id: true, displayName: true, avatar: true } } },
        orderBy: { createdAt: "asc" },
      },
      checkIns: {
        include: {
          beer: { select: { id: true, name: true, brewery: true, style: true, abv: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      reactions: { select: { emoji: true, userId: true } }, // Pasada R
    },
  });

  return sessions.map((s) => ({
    ...s,
    totalUnits: sessionTotalUnits({ checkIns: s.checkIns }),
    isOwner: s.userId === userId,
    // El distintivo "X te etiquetó" SOLO cuando hay etiqueta real (no por círculo).
    viewerTagged: s.tags.some((t) => t.taggedUserId === userId),
    // Pasada R: reacciones agrupadas + la del viewer. El contador social se quitó.
    reactions: groupReactions(s.reactions, userId),
  }));
}

export type FeedSession = Awaited<ReturnType<typeof getFeed>>[number];

export async function getSessionDetail(id: string, viewerId: string) {
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, displayName: true, avatar: true } },
      tags: {
        include: { taggedUser: { select: { id: true, displayName: true, avatar: true } } },
        orderBy: { createdAt: "asc" },
      },
      checkIns: {
        include: {
          beer: { select: { id: true, name: true, brewery: true, style: true, abv: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      reactions: { select: { emoji: true, userId: true, user: { select: { displayName: true } } } }, // Pasada R
    },
  });
  if (!session) return null;
  const { reactions, ...rest } = session;
  const grouped = groupReactions(reactions, viewerId);
  // "Quién reaccionó" (solo en el detalle): nombres por emoji, en el orden de los grupos.
  const whoByEmoji = new Map<string, string[]>();
  for (const r of reactions) {
    const arr = whoByEmoji.get(r.emoji) ?? [];
    arr.push(r.userId === viewerId ? "tú" : r.user.displayName);
    whoByEmoji.set(r.emoji, arr);
  }
  const reactionWho = grouped.groups.map((g) => ({ emoji: g.emoji, names: whoByEmoji.get(g.emoji) ?? [] }));
  return { ...rest, reactions: grouped, reactionWho };
}

export type SessionDetail = NonNullable<
  Awaited<ReturnType<typeof getSessionDetail>>
>;

/** Catálogo con ranking del grupo (promedio + nº de ratings). */
export async function getBeersWithRanking(search?: string) {
  // Búsqueda insensible a acentos (G.2): sobre nameKey/breweryKey (ya sin acentos,
  // minúsculas) con la query normalizada. El estilo va aparte (no tiene clave).
  const q = search?.trim();
  const nk = q ? normalizeKey(q) : "";
  const where = q
    ? {
        OR: [
          { nameKey: { contains: nk } },
          { breweryKey: { contains: nk } },
          { style: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const beers = await prisma.beer.findMany({
    where,
    orderBy: [{ name: "asc" }],
    include: { _count: { select: { checkIns: true } } },
  });

  const ratings = await prisma.checkIn.findMany({
    select: { beerId: true, rating: true },
  });
  const rankMap = new Map(beerRanking(ratings).map((r) => [r.beerId, r]));

  return beers
    .map((b) => {
      const r = rankMap.get(b.id);
      return {
        ...b,
        avgRating: r?.avgRating ?? null,
        ratingsCount: r?.ratingsCount ?? 0,
      };
    })
    .sort((a, b) => {
      // ranking: por promedio desc (los sin ratings al final), luego nombre
      if (a.avgRating == null && b.avgRating == null)
        return a.name.localeCompare(b.name);
      if (a.avgRating == null) return 1;
      if (b.avgRating == null) return -1;
      return b.avgRating - a.avgRating || b.ratingsCount - a.ratingsCount;
    });
}

export async function getBeerDetail(id: string, userId: string) {
  const beer = await prisma.beer.findUnique({
    where: { id },
    include: { createdBy: { select: { displayName: true } } },
  });
  if (!beer) return null;

  // Todos los check-ins de la cerveza con dueño de la salida y fechas: sirve para el
  // ranking del grupo, el rating PROPIO (G.3) y saber si alguien más la calificó.
  const checkIns = await prisma.checkIn.findMany({
    where: { beerId: id },
    select: { rating: true, createdAt: true, session: { select: { userId: true, date: true } } },
  });
  const rank = beerRanking(checkIns.map((c) => ({ beerId: id, rating: c.rating })))[0] ?? { avgRating: null, ratingsCount: 0 };

  // Rating propio: solo check-ins de salidas del propio usuario (invariante intacto).
  const own = ownBeerRating(
    checkIns
      .filter((c) => c.session.userId === userId)
      .map((c) => ({ rating: c.rating, date: c.session.date, createdAt: c.createdAt })),
  );
  // ¿alguien MÁS del grupo la calificó? (para colapsar cuando el único eres tú)
  const otherRated = checkIns.some((c) => c.rating != null && c.session.userId !== userId);

  const recent = await prisma.checkIn.findMany({
    where: { beerId: id },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: {
      session: {
        select: {
          id: true,
          date: true,
          user: { select: { displayName: true, avatar: true } },
        },
      },
    },
  });

  return { beer, avgRating: rank.avgRating, ratingsCount: rank.ratingsCount, own, otherRated, recent };
}

/** Carga usuarios + sesiones (mínimo) y calcula métricas con la lógica pura. */
async function loadMetricsInputs(): Promise<{
  users: UserRef[];
  sessions: SessionData[];
  avatarById: Record<string, string | null>;
}> {
  const [users, sessions] = await Promise.all([
    prisma.user.findMany({ select: { id: true, displayName: true, avatar: true } }),
    prisma.session.findMany({
      select: {
        id: true,
        userId: true,
        date: true,
        checkIns: {
          select: {
            beerId: true,
            quantity: true,
            format: true,
            rating: true,
            beer: { select: { style: true } },
          },
        },
      },
    }),
  ]);

  const mapped: SessionData[] = sessions.map((s) => ({
    id: s.id,
    ownerId: s.userId,
    date: s.date,
    checkIns: s.checkIns.map((c) => ({
      beerId: c.beerId,
      beerStyle: c.beer.style,
      quantity: c.quantity,
      format: c.format,
      rating: c.rating,
    })),
  }));

  const avatarById: Record<string, string | null> = {};
  for (const u of users) avatarById[u.id] = u.avatar;

  return { users, sessions: mapped, avatarById };
}

export async function getProfile(userId: string) {
  const { users, sessions, avatarById } = await loadMetricsInputs();

  // Pasada C: "EL PARCHE" es el CÍRCULO del usuario + él mismo, no todos los que
  // alguna vez recibieron un código. El invariante sigue: solo cuentan check-ins
  // propios de cada uno (leaderboard/leaderboardVariety no cambian).
  const circle = await loadCircle(userId);
  const circleUsers = users.filter((u) => circle.has(u.id));

  // Racha (PIEZA 1): se calcula en cada lectura (NO cachear). Eventos del usuario =
  // días con salida propia ∪ días donde lo etiquetaron y NO descartó.
  const registeredDays = new Set<string>();
  for (const s of sessions) registeredDays.add(`${s.ownerId}|${dayKeyUTC(s.date)}`);
  const taggedRows = await prisma.sessionTag.findMany({
    where: { taggedUserId: userId, dismissedAt: null },
    select: { session: { select: { date: true } } },
  });
  const eventDayKeys = [
    ...sessions.filter((s) => s.ownerId === userId).map((s) => dayKeyUTC(s.date)),
    ...taggedRows.map((t) => dayKeyUTC(t.session.date)),
  ];
  const streak = registrationStreak({ registeredDays, userId, eventDayKeys, nowMs: Date.now() });

  // Desglose por formato del PROPIO total (Pasada D) para el perfil. El desglose
  // por usuario del leaderboard se quitó en N.2 (ilegible en lista de personas), así
  // que ya no se calcula breakdownByUser.
  const ownCheckIns = (uid: string) =>
    sessions.filter((s) => s.ownerId === uid).flatMap((s) => s.checkIns);
  const breakdown = formatBreakdown(ownCheckIns(userId));

  return {
    stats: userStats(userId, sessions),
    board: leaderboard(circleUsers, sessions),
    boardVariety: leaderboardVariety(circleUsers, sessions),
    boardSessions: leaderboardSessions(circleUsers, sessions),
    breakdown,
    streak,
    avatarById,
    // Sin círculo (solo él): el leaderboard muestra copy explicativo, no un vacío raro.
    aloneInCircle: circle.size === 1,
  };
}

export async function searchUsers(query: string, excludeId: string) {
  const q = query.trim();
  return prisma.user.findMany({
    where: {
      id: { not: excludeId },
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
    take: 8,
  });
}

export async function getBeerOptions(search?: string) {
  const q = search?.trim();
  const nk = q ? normalizeKey(q) : "";
  return prisma.beer.findMany({
    where: q
      ? {
          OR: [
            { nameKey: { contains: nk } },
            { breweryKey: { contains: nk } },
          ],
        }
      : {},
    select: { id: true, name: true, brewery: true, style: true, abv: true, kind: true },
    orderBy: { name: "asc" },
    take: 20,
  });
}

/** Solo invitaciones DISPONIBLES (sin usar y sin expirar) — item A.2-6. */
export async function getMyInvitations(userId: string) {
  return prisma.invitation.findMany({
    where: {
      createdById: userId,
      usedById: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
}
