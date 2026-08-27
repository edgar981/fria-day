"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
    <input
      className="input"
      placeholder="Buscar cerveza o cervecería…"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      aria-label="Buscar en el catálogo"
    />
  );
}
