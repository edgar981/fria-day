import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getFeed } from "@/lib/queries";
import { SessionCard } from "@/components/SessionCard";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const user = await requireUser();
  const feed = await getFeed(user.id);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Feed</h1>
        <Link href="/sessions/new" className="btn btn-primary" style={{ padding: "0.5rem 0.9rem", fontSize: "0.9rem" }}>
          ＋ Nueva
        </Link>
      </div>

      {feed.length === 0 ? (
        <div className="card" style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem" }} aria-hidden>🍺</div>
          <p style={{ fontWeight: 700, marginTop: "0.5rem" }}>Aún no hay salidas</p>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0.35rem 0 1rem" }}>
            Registra tu primera sesión de cervezas.
          </p>
          <Link href="/sessions/new" className="btn btn-primary">Crear la primera</Link>
        </div>
      ) : (
        feed.map((s) => <SessionCard key={s.id} session={s} viewerId={user.id} />)
      )}
    </div>
  );
}
