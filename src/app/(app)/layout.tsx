import { requireUser } from "@/lib/session";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div
      className="pb-safe"
      style={{ maxWidth: 640, margin: "0 auto", minHeight: "100dvh" }}
    >
      <TopBar displayName={user.displayName} />
      <main style={{ padding: "1rem" }}>{children}</main>
      <BottomNav />
    </div>
  );
}
