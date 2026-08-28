"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

type Item = { href: string; label: string; icon: "home" | "mug" | "chart" | "mail" };
const LEFT: Item[] = [
  { href: "/", label: "Feed", icon: "home" },
  { href: "/beers", label: "Catálogo", icon: "mug" },
];
const RIGHT: Item[] = [
  { href: "/profile", label: "Perfil", icon: "chart" },
  { href: "/invite", label: "Invitar", icon: "mail" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Marca la pestaña destino en el instante del toque (item A.1-5): useLinkStatus
// da `pending` mientras Next navega, antes de que el servidor responda.
function TabInner({ item, active }: { item: Item; active: boolean }) {
  const { pending } = useLinkStatus();
  const on = active || pending;
  return (
    <span
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        color: on ? "var(--color-ambar)" : "var(--color-tenue)",
        font: `${on ? 700 : 500} 11px var(--font-sans)`,
        transition: "color .1s ease",
      }}
    >
      <Icon name={item.icon} size={23} />
      {item.label}
    </span>
  );
}

function Tab({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link href={item.href} style={{ textDecoration: "none" }}>
      <TabInner item={item} active={active} />
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        // En FLUJO (último hijo flex de .pb-nav, que es 100dvh): se ancla al fondo
        // real del contenedor. Ya no es position:fixed → no deja franja bajo la
        // barra en iOS standalone. Ver DECISIONES · P-plan-B.
        flex: "none",
        borderTop: "1px solid #2C2015",
        background: "#181209",
      }}
    >
      <div
        style={{
          maxWidth: 440,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          alignItems: "center",
          padding: "9px 6px calc(env(safe-area-inset-bottom, 0px) + 14px)",
        }}
      >
        {LEFT.map((it) => (
          <Tab key={it.href} item={it} active={isActive(pathname, it.href)} />
        ))}
        <span style={{ display: "flex", justifyContent: "center" }}>
          <Link
            href="/sessions/new"
            aria-label="Nueva salida"
            style={{
              width: 56,
              height: 56,
              borderRadius: 20,
              background: "var(--color-ambar)",
              color: "var(--color-tinta)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: -22,
              boxShadow: "0 8px 20px rgba(242,160,22,.32)",
            }}
          >
            <Icon name="plus" size={28} />
          </Link>
        </span>
        {RIGHT.map((it) => (
          <Tab key={it.href} item={it} active={isActive(pathname, it.href)} />
        ))}
      </div>
    </nav>
  );
}
