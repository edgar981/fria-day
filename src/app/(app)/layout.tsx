import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Cada pantalla monta su propio header (AppHeader o BackHeader) y, si es una
// pestaña, el BottomNav — igual que en los mockups. El layout solo protege la
// ruta y centra el contenedor mobile-first.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <div className="app-shell">{children}</div>;
}
