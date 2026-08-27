import { requireUser } from "@/lib/session";
import { getProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";

function StatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="card" style={{ padding: "0.9rem", textAlign: "center" }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--accent)" }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  const { stats, board } = await getProfile(user.id);

  const styles = Object.entries(stats.byStyle).sort((a, b) => b[1] - a[1]);
  const maxStyle = styles.length ? styles[0][1] : 0;
  const maxUnits = board.length ? Math.max(...board.map((b) => b.units), 1) : 1;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>{user.displayName}</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Tus métricas (solo tus check-ins).</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.6rem" }}>
        <StatTile value={stats.totalUnits} label="unidades" />
        <StatTile value={stats.distinctBeers} label="cervezas distintas" />
        <StatTile value={stats.sessionsCount} label="salidas" />
      </div>

      <section style={{ display: "grid", gap: "0.6rem" }}>
        <h2 style={{ fontWeight: 700 }}>Por estilo</h2>
        {styles.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Registra cervezas para ver tu desglose.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
            {styles.map(([style, units]) => (
              <li key={style} className="card" style={{ padding: "0.6rem 0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: "0.3rem" }}>
                  <span style={{ fontWeight: 600 }}>{style}</span>
                  <span style={{ color: "var(--muted)" }}>{units}</span>
                </div>
                <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 999 }}>
                  <div style={{ width: `${Math.round((units / maxStyle) * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: 999 }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ display: "grid", gap: "0.6rem" }}>
        <h2 style={{ fontWeight: 700 }}>Leaderboard del grupo</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "-0.4rem" }}>
          Unidades por check-ins propios. Estar etiquetado no suma.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
          {board.map((row, i) => {
            const me = row.userId === user.id;
            return (
              <li
                key={row.userId}
                className="card"
                style={{
                  padding: "0.6rem 0.8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.7rem",
                  borderColor: me ? "var(--accent)" : "var(--border)",
                }}
              >
                <span style={{ fontWeight: 800, color: "var(--muted)", minWidth: 20, textAlign: "right" }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontWeight: me ? 800 : 600 }}>
                      {row.displayName} {me && <span style={{ color: "var(--accent)" }}>· tú</span>}
                    </span>
                    <span style={{ color: "var(--muted)" }}>{row.units}</span>
                  </div>
                  <div style={{ height: 5, background: "var(--surface-2)", borderRadius: 999 }}>
                    <div style={{ width: `${Math.round((row.units / maxUnits) * 100)}%`, height: "100%", background: me ? "var(--accent)" : "var(--muted)", borderRadius: 999 }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
