import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/Skeleton";

export default function ProfileLoading() {
  return (
    <div className="pb-nav">
      <div className="pb-scroll">
      <main style={{ padding: "calc(18px + env(safe-area-inset-top)) 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <Skeleton w={60} h={60} r={19} />
          <div style={{ flex: 1 }}>
            <Skeleton w="50%" h={24} />
            <Skeleton w="70%" h={13} style={{ marginTop: 8 }} />
          </div>
        </div>
        <Skeleton w="100%" h={150} r={24} />
        <div style={{ display: "flex", gap: 11 }}>
          <Skeleton w="100%" h={96} r={20} />
          <Skeleton w="100%" h={96} r={20} />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} w="100%" h={48} r={16} />
        ))}
      </main>
      </div>
      <BottomNav />
    </div>
  );
}
