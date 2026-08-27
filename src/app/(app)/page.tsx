import { requireUser } from "@/lib/session";
import { getFeed } from "@/lib/queries";
import { SessionCard } from "@/components/SessionCard";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { EmptyFeed } from "@/components/EmptyFeed";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await requireUser();
  const feed = await getFeed(user.id);

  return (
    <div className="pb-nav">
      <AppHeader avatar={user.avatar ?? null} />
      {feed.length === 0 ? (
        <EmptyFeed />
      ) : (
        <main style={{ padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 12 }}>
          {feed.map((s) => (
            <SessionCard key={s.id} session={s} viewerId={user.id} />
          ))}
        </main>
      )}
      <BottomNav />
    </div>
  );
}
