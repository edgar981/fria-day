import { BottomNav } from "@/components/BottomNav";
import { HeaderSkeleton, SessionCardSkeleton } from "@/components/Skeleton";

export default function FeedLoading() {
  return (
    <div className="pb-nav">
      <div className="pb-scroll">
        <HeaderSkeleton />
        <main style={{ padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 12 }}>
          <SessionCardSkeleton />
          <SessionCardSkeleton />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
