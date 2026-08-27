import { Skeleton } from "@/components/Skeleton";

export default function SessionDetailLoading() {
  return (
    <div>
      <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #241A12" }}>
        <Skeleton w={44} h={44} r={14} />
      </div>
      <main style={{ padding: "18px 18px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <Skeleton w="65%" h={32} />
          <Skeleton w="45%" h={15} style={{ marginTop: 10 }} />
        </div>
        <Skeleton w="100%" h={88} r={22} />
        <Skeleton w="100%" h={52} r={16} />
        <Skeleton w={110} h={12} />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} w="100%" h={62} r={18} />
        ))}
      </main>
    </div>
  );
}
