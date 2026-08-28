import { Skeleton } from "@/components/Skeleton";

export default function BeerDetailLoading() {
  return (
    <div>
      <div style={{ padding: "calc(12px + env(safe-area-inset-top)) 18px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #241A12" }}>
        <Skeleton w={44} h={44} r={14} />
        <Skeleton w={90} h={20} />
      </div>
      <main style={{ padding: "18px 18px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <Skeleton w="60%" h={30} />
          <Skeleton w="40%" h={14} style={{ marginTop: 8 }} />
        </div>
        <Skeleton w="100%" h={72} r={24} />
        <Skeleton w={140} h={12} />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} w="100%" h={60} r={24} />
        ))}
      </main>
    </div>
  );
}
