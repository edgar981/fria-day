import { Skeleton } from "@/components/Skeleton";

export default function NewSessionLoading() {
  return (
    <div>
      <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #241A12" }}>
        <Skeleton w={44} h={44} r={14} />
        <Skeleton w={140} h={22} />
      </div>
      <main style={{ padding: "16px 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <Skeleton w={80} h={12} />
        <Skeleton w="100%" h={52} r={15} />
        <Skeleton w={100} h={12} />
        <Skeleton w="100%" h={52} r={16} />
        <Skeleton w={110} h={12} />
        <Skeleton w="100%" h={70} r={16} />
        <Skeleton w="100%" h={52} r={16} />
      </main>
    </div>
  );
}
