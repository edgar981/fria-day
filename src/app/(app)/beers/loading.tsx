import { BottomNav } from "@/components/BottomNav";
import { Skeleton } from "@/components/Skeleton";

export default function BeersLoading() {
  return (
    <div className="pb-nav">
      <header style={{ padding: "calc(16px + env(safe-area-inset-top)) 18px 12px", borderBottom: "1px solid #241A12", display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton w={200} h={26} />
        <Skeleton w="100%" h={50} r={16} />
        <Skeleton w={150} h={34} r={999} />
      </header>
      <main style={{ padding: "12px 18px 0", display: "flex", flexDirection: "column", gap: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <Skeleton w={20} h={22} />
            <div style={{ flex: 1 }}>
              <Skeleton w="60%" h={16} />
              <Skeleton w="40%" h={12} style={{ marginTop: 7 }} />
            </div>
            <Skeleton w={40} h={22} />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  );
}
