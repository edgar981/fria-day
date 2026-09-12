import { getAuthenticatorName } from "@better-auth/passkey";
import { requireUser } from "@/lib/session";
import { getProfile } from "@/lib/queries";
import { getPointsSummary } from "@/lib/points-queries";
import { prisma } from "@/lib/prisma";
import { PointsCard } from "@/components/PointsCard";
import { BottomNav } from "@/components/BottomNav";
import { ProfileAvatarEditor } from "@/components/ProfileAvatarEditor";
import { AccountAccess } from "@/components/AccountAccess";
import { LogoutButton } from "@/components/LogoutButton";
import { Tally } from "@/components/Tally";
import { formatBreakdownText } from "@/lib/format";

export const dynamic = "force-dynamic";

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
  // Leaderboard salió a su propia pestaña (Pasada N): Perfil ya no usa board*/círculo,
  // solo las métricas personales (stats, breakdown propio, racha).
  const { stats, breakdown, streak } = await getProfile(user.id);
  const points = await getPointsSummary(user.id);
  const [passkeyRows, credentialCount] = await Promise.all([
    prisma.passkey.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, aaguid: true, backedUp: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.account.count({ where: { userId: user.id, providerId: "credential" } }),
  ]);
  const userEmail = (user as { email?: string | null }).email ?? null;
  const pkDateFmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });
  const passkeys = passkeyRows.map((p) => ({
    id: p.id,
    name: getAuthenticatorName(p.aaguid) ?? p.name ?? "Passkey",
    synced: p.backedUp,
    created: p.createdAt ? pkDateFmt.format(p.createdAt) : null,
  }));
  const styles = Object.entries(stats.byStyle).sort((a, b) => b[1] - a[1]);
  const maxStyle = styles.length ? styles[0][1] : 1;

  return (
    <div className="pb-nav">
      <div className="pb-scroll">
      <main style={{ padding: "calc(18px + env(safe-area-inset-top)) 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <ProfileAvatarEditor displayName={user.displayName} avatar={user.avatar ?? null} />

        {/* Los puntos (PT §6): arriba del total histórico, tarjeta oscura para no competir. */}
        <PointsCard summary={points} />

        {/* Total histórico */}
        <div style={{ background: "linear-gradient(180deg,#C4620A,#8A4208)", borderRadius: 24, padding: 20, overflow: "hidden" }}>
          <div style={{ font: "700 11px/1 var(--font-sans)", letterSpacing: ".16em", color: "rgba(251,240,213,.75)" }}>TOTAL HISTÓRICO</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 6 }}>
            <span style={{ font: "800 60px/.85 var(--font-display)", letterSpacing: "-.04em", color: "var(--color-espuma)" }}>{stats.totalUnits}</span>
            <span style={{ font: "600 16px var(--font-sans)", color: "rgba(251,240,213,.8)", paddingBottom: 8 }}>bebidas</span>
          </div>
          {/* Desglose por formato (Pasada D): textura sin inventar volumen. Solo si
              hay más de un formato (con uno, es redundante). */}
          {breakdown.length > 1 && (
            <div style={{ font: "500 13.5px var(--font-sans)", color: "rgba(251,240,213,.72)", marginTop: 8 }}>
              {formatBreakdownText(breakdown)}
            </div>
          )}
          {stats.totalUnits > 0 && (
            <div style={{ marginTop: 16 }}>
              <Tally count={stats.totalUnits} color="var(--color-espuma)" barW={2.5} barH={15} gap={3} maxGroups={4} labelColor="rgba(251,240,213,.6)" />
            </div>
          )}
        </div>

        {/* Racha de registro (Pasada B): días que registraste, NO frecuencia. */}
        {streak > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 11, background: "var(--color-barra)", border: "1px solid var(--color-borde)", borderRadius: 18, padding: "13px 16px" }}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>🔥</span>
            <span style={{ font: "600 15px var(--font-sans)", color: "var(--color-crema)" }}>
              <b style={{ color: "var(--color-ambar)", fontWeight: 800 }}>{streak}</b> salida{streak !== 1 ? "s" : ""} seguida{streak !== 1 ? "s" : ""} registrada{streak !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 11 }}>
          <StatCard value={stats.distinctBeers} label="bebidas distintas probadas" />
          <StatCard value={stats.sessionsCount} label="salidas registradas" />
        </div>

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

        <AccountAccess userId={user.id} email={userEmail} hasPassword={credentialCount > 0} passkeys={passkeys} />

        <div style={{ marginTop: 4 }}>
          <LogoutButton />
        </div>
      </main>
      </div>
      <BottomNav />
    </div>
  );
}
