"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Feed", icon: "🏠" },
  { href: "/beers", label: "Catálogo", icon: "🍺" },
  { href: "/sessions/new", label: "Nueva", icon: "➕", primary: true },
  { href: "/profile", label: "Perfil", icon: "📊" },
  { href: "/invite", label: "Invitar", icon: "✉️" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        borderTop: "1px solid var(--border)",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        backdropFilter: "blur(8px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          alignItems: "center",
        }}
      >
        {ITEMS.map((it) => {
          const active =
            it.href === "/"
              ? pathname === "/"
              : pathname === it.href || pathname.startsWith(`${it.href}/`);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.15rem",
                padding: "0.55rem 0.25rem",
                textDecoration: "none",
                color: active ? "var(--accent)" : "var(--muted)",
                fontSize: "0.68rem",
                fontWeight: active ? 700 : 500,
              }}
            >
              <span
                style={{
                  fontSize: it.primary ? "1.5rem" : "1.25rem",
                  filter: active ? "none" : "grayscale(0.2)",
                  transform: it.primary ? "translateY(-1px)" : "none",
                }}
                aria-hidden
              >
                {it.icon}
              </span>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
