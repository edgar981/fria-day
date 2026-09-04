import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getSessionDetail, loadCircle, viewerDrinkKeysOnDate } from "@/lib/queries";
import { SessionDetail } from "@/components/SessionDetail";
import { formatDayLong, formatDayShort, formatBreakdownText, toDateInputValue } from "@/lib/format";
import { sessionTotalUnits, formatBreakdown, checkInMatchKey } from "@/lib/domain";

export const dynamic = "force-dynamic";

function companions(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names[0]}, ${names[1]} y ${names.length - 2} más`;
}

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ comment?: string }>;
}) {
  const { id } = await params;
  const { comment } = await searchParams;
  const viewer = await requireUser();
  const s = await getSessionDetail(id, viewer.id);
  if (!s) notFound();

  const isOwner = s.userId === viewer.id;
  const isTagged = s.tags.some((t) => t.taggedUserId === viewer.id);
  // Pasada C: puedo ver una salida si su dueño está en mi círculo (cubre propia,
  // etiquetado y "del parche" sin etiqueta). Fuera del círculo → 404, como antes.
  const circle = await loadCircle(viewer.id);
  if (!circle.has(s.userId)) notFound();

  const total = sessionTotalUnits({ checkIns: s.checkIns });
  const distinct = new Set(s.checkIns.map((c) => c.beerId)).size;
  // DS.1: constancia PERSISTENTE de "Yo también" — qué bebidas de esta salida ajena ya
  // tiene el viewer en la suya de esta fecha (solo aplica a no-dueños).
  const mineKeys = isOwner ? new Set<string>() : await viewerDrinkKeysOnDate(viewer.id, s.date);
  const initialMineIds = s.checkIns.filter((c) => mineKeys.has(checkInMatchKey(c))).map((c) => c.id);
  const bd = formatBreakdown(s.checkIns.map((c) => ({ format: c.format, quantity: c.quantity })));
  const compSummary = companions(
    s.tags.map((t) =>
      t.taggedUser ? (t.taggedUser.id === viewer.id ? "tú" : t.taggedUser.displayName) : t.freeText ?? "",
    ),
  );

  return (
    <SessionDetail
      sessionId={s.id}
      isOwner={isOwner}
      isTagged={isTagged}
      ownerName={s.user.displayName}
      ownerAvatar={s.user.avatar ?? null}
      viewer={{ id: viewer.id, displayName: viewer.displayName, avatar: viewer.avatar ?? null }}
      placeName={s.placeName ?? null}
      notes={s.notes ?? null}
      dateLabel={formatDayLong(s.date)}
      dateShort={formatDayShort(s.date)}
      dateInput={toDateInputValue(s.date)}
      compSummary={compSummary}
      taggedByName={isTagged ? s.user.displayName : null}
      checkIns={s.checkIns.map((c) => ({
        id: c.id,
        quantity: c.quantity,
        format: c.format,
        rating: c.rating,
        beerId: c.beerId,
        beerName: c.beer.name,
        brewery: c.beer.brewery,
      }))}
      photos={s.photos}
      tags={s.tags.map((t) => ({ id: t.id, taggedUserId: t.taggedUserId, taggedUserName: t.taggedUser?.displayName ?? null, freeText: t.freeText }))}
      reactions={s.reactions}
      comments={s.comments}
      total={total}
      distinct={distinct}
      breakdownText={bd.length > 1 ? formatBreakdownText(bd) : null}
      initialMineIds={initialMineIds}
      autoFocusComment={comment === "1"}
    />
  );
}
