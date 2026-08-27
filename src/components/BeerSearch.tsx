"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export function BeerSearch({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const query = q.trim();
      router.replace(query ? `/beers?q=${encodeURIComponent(query)}` : "/beers");
    }, 220);
    return () => clearTimeout(t);
  }, [q, router]);

  return (
    <div style={{ height: 50, border: "1px solid var(--color-borde)", borderRadius: 16, background: "var(--color-barra-alta)", display: "flex", alignItems: "center", gap: 11, padding: "0 15px" }}>
      <Icon name="search" size={20} color="var(--color-tenue)" />
      <input
        className="field"
        style={{ height: "auto", border: "none", background: "transparent", padding: 0, fontSize: 15.5 }}
        placeholder="Buscar cerveza o cervecería…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Buscar en el catálogo"
      />
    </div>
  );
}
