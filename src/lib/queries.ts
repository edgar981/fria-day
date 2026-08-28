import "server-only";
import { prisma } from "@/lib/prisma";
import { avisoPlazo } from "@/lib/format";
import {
  leaderboard,
  leaderboardVariety,
  userStats,
  beerRanking,
  sessionTotalUnits,
  sessionRegistration,
  registrationStreak,
  dayKeyUTC,
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

/** Feed: sesiones propias + sesiones donde estoy etiquetado, por fecha desc. */
export async function getFeed(userId: string) {
  const [sessions, registeredDays] = await Promise.all([
    prisma.session.findMany({
      where: {
        OR: [{ userId }, { tags: { some: { taggedUserId: userId } } }],
      },
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
      },
    }),
    loadRegisteredDays(),
  ]);

  const now = Date.now();
  return sessions.map((s) => ({
    ...s,
    totalUnits: sessionTotalUnits({ checkIns: s.checkIns }),
    isOwner: s.userId === userId,
    social: computeSocial(s, registeredDays, now),
  }));
}

/** Contador "quién falta" + aviso de una salida (null si no hay etiquetas de la app). */
function computeSocial(
  s: {
    userId: string;
    date: Date;
    tags: { taggedUserId: string | null; dismissedAt: Date | null; taggedUser: { id: string; displayName: string } | null }[];
  },
  registeredDays: Set<string>,
  now: number,
) {
  const active = s.tags.filter((t) => t.taggedUserId && !t.dismissedAt);
  if (active.length === 0) return null; // sin etiquetas de usuarios de la app
  const nameById = new Map<string, string>();
  for (const t of active) if (t.taggedUser) nameById.set(t.taggedUser.id, t.taggedUser.displayName);
  const r = sessionRegistration({
    registeredDays,
    ownerId: s.userId,
    taggedUserIds: active.map((t) => t.taggedUserId as string),
    sessionDayKey: dayKeyUTC(s.date),
    nowMs: now,
  });
  return {
    registered: r.registered,
    total: r.total,
    deadlineMs: r.deadlineMs,
    pending: r.pending.map((id) => ({ id, displayName: nameById.get(id) ?? "alguien" })),
    plazoLabel: r.pending.length > 0 ? avisoPlazo(r.deadlineMs, now) : "",
  };
}

export type FeedSession = Awaited<ReturnType<typeof getFeed>>[number];

export async function getSessionDetail(id: string) {
  const [session, registeredDays] = await Promise.all([
    prisma.session.findUnique({
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
      },
    }),
    loadRegisteredDays(),
  ]);
  if (!session) return null;
  return { ...session, social: computeSocial(session, registeredDays, Date.now()) };
}

export type SessionDetail = NonNullable<
  Awaited<ReturnType<typeof getSessionDetail>>
>;

/** Catálogo con ranking del grupo (promedio + nº de ratings). */
export async function getBeersWithRanking(search?: string) {
  const where = search?.trim()
    ? {
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" as const } },
          { brewery: { contains: search.trim(), mode: "insensitive" as const } },
          { style: { contains: search.trim(), mode: "insensitive" as const } },
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

export async function getBeerDetail(id: string) {
  const beer = await prisma.beer.findUnique({
    where: { id },
    include: { createdBy: { select: { displayName: true } } },
  });
  if (!beer) return null;

  const ratings = await prisma.checkIn.findMany({
    where: { beerId: id },
    select: { beerId: true, rating: true },
  });
  const rank = beerRanking(ratings)[0] ?? { avgRating: null, ratingsCount: 0 };

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

  return { beer, avgRating: rank.avgRating, ratingsCount: rank.ratingsCount, recent };
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

export async function getLeaderboard() {
  const { users, sessions } = await loadMetricsInputs();
  return leaderboard(users, sessions);
}

export async function getProfile(userId: string) {
  const { users, sessions, avatarById } = await loadMetricsInputs();

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

  return {
    stats: userStats(userId, sessions),
    board: leaderboard(users, sessions),
    boardVariety: leaderboardVariety(users, sessions),
    streak,
    avatarById,
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
  return prisma.beer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { brewery: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    select: { id: true, name: true, brewery: true, style: true, abv: true },
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
