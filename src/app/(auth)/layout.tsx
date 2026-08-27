export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="app-shell" style={{ display: "flex", flexDirection: "column" }}>{children}</div>;
}
