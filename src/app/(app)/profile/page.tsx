import { requireUser } from "@/lib/session";
import { getProfile } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { BottomNav } from "@/components/BottomNav";
import { ProfileAvatarEditor } from "@/components/ProfileAvatarEditor";
import { AccountAccess } from "@/components/AccountAccess";
import { LogoutButton } from "@/components/LogoutButton";
import { Avatar } from "@/components/Avatar";
import { Tally } from "@/components/Tally";

export const dynamic = "force-dynamic";

const monthFmt = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ flex: 1, background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 20, padding: 15 }}>
      <div style={{ font: "800 32px/1 var(--font-display)", color: "var(--color-ambar)" }}>{value}</div>
      <div style={{ font: "400 13px/1.35 var(--font-sans)", color: "var(--color-tenue)", marginTop: 5 }}>{label}</div>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  const { stats, board, avatarById } = await getProfile(user.id);
  const [passkeyCount, credentialCount] = await Promise.all([
    prisma.passkey.count({ where: { userId: user.id } }),
    prisma.account.count({ where: { userId: user.id, providerId: "credential" } }),
  ]);
  const userEmail = (user as { email?: string | null }).email ?? null;
  const styles = Object.entries(stats.byStyle).sort((a, b) => b[1] - a[1]);
  const maxStyle = styles.length ? styles[0][1] : 1;
  const maxUnits = board.length ? Math.max(...board.map((b) => b.units), 1) : 1;
  const createdAt = (user as { createdAt?: string | Date }).createdAt;
  const since = createdAt ? `en el parche desde ${monthFmt.format(new Date(createdAt))}` : "en el parche";

  return (
    <div className="pb-nav">
      <main style={{ padding: "calc(18px + env(safe-area-inset-top)) 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <ProfileAvatarEditor displayName={user.displayName} avatar={user.avatar ?? null} since={since} />

        {/* Total histórico */}
        <div style={{ background: "linear-gradient(180deg,#C4620A,#8A4208)", borderRadius: 24, padding: 20, overflow: "hidden" }}>
          <div style={{ font: "700 11px/1 var(--font-sans)", letterSpacing: ".16em", color: "rgba(251,240,213,.75)" }}>TOTAL HISTÓRICO</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 6 }}>
            <span style={{ font: "800 60px/.85 var(--font-display)", letterSpacing: "-.04em", color: "var(--color-espuma)" }}>{stats.totalUnits}</span>
            <span style={{ font: "600 16px var(--font-sans)", color: "rgba(251,240,213,.8)", paddingBottom: 8 }}>cervezas</span>
          </div>
          {stats.totalUnits > 0 && (
            <div style={{ marginTop: 16 }}>
              <Tally count={stats.totalUnits} color="var(--color-espuma)" barW={2.5} barH={15} gap={3} maxGroups={4} labelColor="rgba(251,240,213,.6)" />
            </div>
          )}
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 11 }}>
          <StatCard value={stats.distinctBeers} label="cervezas distintas probadas" />
          <StatCard value={stats.sessionsCount} label="salidas registradas" />
        </div>

        {/* El parche (leaderboard) */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 11 }}>
            <span className="eyebrow">El parche</span>
            <span style={{ font: "400 11.5px var(--font-sans)", color: "var(--color-tenue-2)" }}>solo salidas propias</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {board.map((row, i) => {
              const me = row.userId === user.id;
              const barColor = me || i === 0 ? "var(--color-ambar)" : "#8A5E1E";
              return (
                <div
                  key={row.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    ...(me ? { background: "#1F1811", border: "1px solid #4A3A28", borderRadius: 16, padding: "8px 11px", margin: "0 -11px" } : null),
                  }}
                >
                  <span style={{ font: "800 17px var(--font-display)", color: i <= 1 ? "var(--color-ambar)" : "var(--color-tenue)", width: 20, flex: "none" }}>{i + 1}</span>
                  <Avatar avatar={avatarById[row.userId] ?? null} size={36} radius={11} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ font: `${me ? 700 : 600} 15px var(--font-sans)`, display: "block" }}>{me ? "Tú" : row.displayName}</span>
                    <span style={{ display: "block", height: 6, borderRadius: 99, background: "var(--color-borde)", marginTop: 5, overflow: "hidden" }}>
                      <span style={{ display: "block", height: 6, width: `${Math.round((row.units / maxUnits) * 100)}%`, background: barColor }} />
                    </span>
                  </span>
                  <span style={{ font: "700 16px var(--font-display)", color: me ? "var(--color-ambar)" : "var(--color-tenue)", flex: "none" }}>{row.units}</span>
                </div>
              );
            })}
          </div>
          <p style={{ font: "400 12px/1.45 var(--font-sans)", color: "var(--color-tenue-2)", margin: "14px 0 0" }}>
            Que te etiqueten no te acredita cervezas. Solo cuentan las salidas que registras tú.
          </p>
        </section>

        {/* Por estilo */}
        {styles.length > 0 && (
          <section>
            <div className="eyebrow" style={{ marginBottom: 11 }}>Por estilo</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {styles.map(([style, units]) => (
                <div key={style} className="card" style={{ padding: "10px 13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", font: "500 13.5px var(--font-sans)", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{style}</span>
                    <span style={{ color: "var(--color-tenue)" }}>{units}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--color-barra-alta)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${Math.round((units / maxStyle) * 100)}%`, height: "100%", background: "var(--color-ambar)" }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <AccountAccess email={userEmail} hasPassword={credentialCount > 0} passkeyCount={passkeyCount} />

        <div style={{ marginTop: 4 }}>
          <LogoutButton />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
