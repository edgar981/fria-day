import Link from "next/link";
import { Icon } from "@/components/Icon";

export function BackHeader({
  title,
  href = "/",
  right,
}: {
  title: string;
  href?: string;
  right?: React.ReactNode;
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        padding: "calc(12px + env(safe-area-inset-top)) 18px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #241A12",
        background: "var(--color-noche)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Link
          href={href}
          aria-label="Atrás"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: "var(--color-barra)",
            border: "1px solid var(--color-borde)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-crema)",
            flex: "none",
          }}
        >
          <Icon name="back" size={22} />
        </Link>
        <span
          style={{
            font: "800 21px var(--font-display)",
            letterSpacing: "-.02em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
      </div>
      {right}
    </header>
  );
}
