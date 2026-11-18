import Link from "next/link";
import { Avatar } from "@/components/Avatar";

const headerStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  padding: "calc(16px + env(safe-area-inset-top)) 16px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "var(--color-noche)",
};

export function AppHeader({ avatar }: { avatar: string | null }) {
  return (
    <header style={headerStyle}>
      <Link
        href="/"
        style={{ textDecoration: "none", color: "var(--color-crema)", font: "900 30px/1 var(--font-display)", letterSpacing: 0 }}
      >
        FriaDay
      </Link>
      <Link href="/profile" aria-label="Tu perfil">
        <Avatar avatar={avatar} size={34} radius={11} />
      </Link>
    </header>
  );
}
