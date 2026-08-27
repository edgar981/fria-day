import { requireUser } from "@/lib/session";
import { getMyInvitations } from "@/lib/queries";
import { InviteGenerator } from "@/components/InviteGenerator";
import { BottomNav } from "@/components/BottomNav";
import { formatDay } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusOf(inv: { usedBy: { displayName: string } | null; expiresAt: Date | null }): { label: string; color: string } {
  if (inv.usedBy) return { label: `Usada por ${inv.usedBy.displayName}`, color: "var(--color-tenue)" };
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) return { label: "Expirada", color: "var(--color-alerta)" };
  return { label: "Disponible", color: "var(--color-ambar)" };
}

export default async function InvitePage() {
  const user = await requireUser();
  const invites = await getMyInvitations(user.id);

  return (
    <div className="pb-nav">
      <main style={{ padding: "18px 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1 style={{ font: "800 28px/1 var(--font-display)", letterSpacing: "-.02em" }}>Invitar al parche</h1>
          <p style={{ font: "400 14px/1.45 var(--font-sans)", color: "var(--color-tenue)", margin: "8px 0 0" }}>
            FriaDay es solo por invitación. Genera un código y pásaselo a tu parcero. Cada código sirve una sola vez.
          </p>
        </div>

        <InviteGenerator />

        <section>
          <div className="eyebrow" style={{ marginBottom: 11 }}>Tus invitaciones</div>
          {invites.length === 0 ? (
            <p style={{ font: "400 14px var(--font-sans)", color: "var(--color-tenue)" }}>Aún no has generado ninguna.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {invites.map((inv) => {
                const st = statusOf(inv);
                return (
                  <div key={inv.id} className="card" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <div style={{ font: "700 17px var(--font-display)", letterSpacing: ".12em", color: "var(--color-espuma)" }}>{inv.code}</div>
                      <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue-2)", marginTop: 2 }}>
                        Creada {formatDay(inv.createdAt)}
                        {inv.expiresAt ? ` · expira ${formatDay(inv.expiresAt)}` : ""}
                      </div>
                    </div>
                    <span style={{ font: "600 12.5px var(--font-sans)", color: st.color }}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
