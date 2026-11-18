"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { RouletteMenu } from "@/components/RouletteMenu";

type Item = { href: string; label: string; icon: IconName };
// Barra (Pasada N): Feed · Catálogo · [+] · Tabla · Perfil. "Invitar" salió de la
// barra (es acción de dos veces en la vida, no un lugar; pasó a una hoja en el header
// de la Tabla). La Tabla (antes "Leaderboard") subió a pestaña propia: antes vivía dentro
// de Perfil. La ruta sigue siendo /leaderboard (no visible); solo cambió la etiqueta.
const LEFT: Item[] = [
  { href: "/", label: "Feed", icon: "home" },
  { href: "/beers", label: "Catálogo", icon: "mug" },
];
const RIGHT: Item[] = [
  { href: "/leaderboard", label: "Tabla", icon: "chart" },
  { href: "/profile", label: "Perfil", icon: "user" },
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
        color: on ? "var(--color-ambar)" : "#8a8a8a",
        // 10.5px / 600 (rediseño): cabe de sobra en el 1fr a 320px. whiteSpace:nowrap:
        // nunca parte en dos líneas.
        font: "600 10.5px var(--font-sans)",
        whiteSpace: "nowrap",
        transition: "color .1s ease",
      }}
    >
      <Icon name={item.icon} size={22} />
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
        // Flotante (rediseño): position:absolute DENTRO de .pb-nav (que es relative y
        // 100dvh), anclada al contenedor y NUNCA al viewport (position:fixed deja la
        // franja bajo la barra en iOS standalone: G.1, P-plan-B). El z-index mantiene
        // la barra por ENCIMA del scroller hermano (.pb-scroll, capa de composición en
        // iOS: B.1). Va centrada porque .app-shell mide como máximo 440px.
        position: "absolute",
        left: 14,
        right: 14,
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        height: 62,
        borderRadius: 31,
        zIndex: 2,
        background: "rgba(30,30,30,.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 0 0 1px rgba(255,255,255,.07), 0 10px 30px rgba(0,0,0,.7)",
      }}
    >
      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          alignItems: "center",
        }}
      >
        {LEFT.map((it) => (
          <Tab key={it.href} item={it} active={isActive(pathname, it.href)} />
        ))}
        {/* RU · §1: tap = Nueva salida; hold = menú de dinámicas de la ruleta. */}
        <RouletteMenu />
        {RIGHT.map((it) => (
          <Tab key={it.href} item={it} active={isActive(pathname, it.href)} />
        ))}
      </div>
    </nav>
  );
}
