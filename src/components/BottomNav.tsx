"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { RouletteMenu } from "@/components/RouletteMenu";

type Item = { href: string; label: string; icon: IconName };
// Barra (Pasada N): Feed · Catálogo · [+] · Leaderboard · Perfil. "Invitar" salió de la
// barra (es acción de dos veces en la vida, no un lugar; pasó a una hoja en el header
// del Leaderboard). El leaderboard subió a pestaña propia: antes vivía dentro de Perfil.
const LEFT: Item[] = [
  { href: "/", label: "Feed", icon: "home" },
  { href: "/beers", label: "Catálogo", icon: "mug" },
];
const RIGHT: Item[] = [
  { href: "/leaderboard", label: "Leaderboard", icon: "chart" },
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
        color: on ? "var(--color-ambar)" : "var(--color-tenue)",
        // 10.5px + tracking apretado: "Leaderboard" es la etiqueta más larga y a 320px
        // (iPhone SE) el 1fr le queda al ras. Bajarla un pelo le da holgura sin que se
        // note frente a las demás. whiteSpace:nowrap para que nunca parta en dos líneas.
        font: `${on ? 700 : 500} 10.5px var(--font-sans)`,
        letterSpacing: "-.015em",
        whiteSpace: "nowrap",
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
        // El "+" sobresale 9px por encima de la barra (marginTop:-22). Al salir de
        // position:fixed/z-index:40, la barra perdió su contexto de apilado y en iOS
        // el scroller hermano (.pb-scroll, overflow:auto → capa de composición)
        // ocluía ese saliente. position:relative + z-index devuelve el apilado por
        // ENCIMA del scroller sin sacarla del flujo. Ver DECISIONES · B.1.
        position: "relative",
        zIndex: 2,
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
        {/* RU · §1: tap = Nueva salida; hold = menú de dinámicas de la ruleta. */}
        <RouletteMenu />
        {RIGHT.map((it) => (
          <Tab key={it.href} item={it} active={isActive(pathname, it.href)} />
        ))}
      </div>
    </nav>
  );
}
