import Link from "next/link";
import { Avatar } from "@/components/Avatar";

const headerStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  padding: "12px 18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #241A12",
  background: "var(--color-noche)",
};

export function AppHeader({ avatar }: { avatar: string | null }) {
  return (
    <header style={headerStyle}>
      <Link
        href="/"
        style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--color-crema)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/friaday-icon.png" alt="" width={30} height={30} style={{ borderRadius: 9, display: "block" }} />
        <span style={{ font: "800 22px var(--font-display)", letterSpacing: "-.02em" }}>FriaDay</span>
      </Link>
      <Link href="/profile" aria-label="Tu perfil">
        <Avatar avatar={avatar} size={36} radius={11} />
      </Link>
    </header>
  );
}
