import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/Skeleton";

export default function InviteLoading() {
  return (
    <div className="pb-nav">
      <div className="pb-scroll">
      <main style={{ padding: "calc(18px + env(safe-area-inset-top)) 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <Skeleton w={220} h={28} />
        <Skeleton w="90%" h={40} />
        <Skeleton w="100%" h={180} r={24} />
        <Skeleton w={160} h={16} />
        <Skeleton w="100%" h={70} r={24} />
      </main>
      </div>
      <BottomNav />
    </div>
  );
}
