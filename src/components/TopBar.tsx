import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

export function TopBar({ displayName }: { displayName: string }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderBottom: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        backdropFilter: "blur(8px)",
      }}
    >
      <Link
        href="/"
        style={{
          fontWeight: 800,
          fontSize: "1.15rem",
          textDecoration: "none",
          color: "var(--text)",
          letterSpacing: "-0.02em",
        }}
      >
        <span aria-hidden>🍺</span> FriaDay
      </Link>
      <form
        action={logoutAction}
        style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}
      >
        <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          {displayName}
        </span>
        <button
          type="submit"
          className="btn btn-ghost"
          style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
        >
          Salir
        </button>
      </form>
    </header>
  );
}
