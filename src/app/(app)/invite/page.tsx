import { requireUser } from "@/lib/session";
import { getMyInvitations } from "@/lib/queries";
import { InviteGenerator } from "@/components/InviteGenerator";
import { ShareCodeButton } from "@/components/ShareCodeButton";
import { BottomNav } from "@/components/BottomNav";
import { formatDay } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InvitePage() {
  const user = await requireUser();
  const invites = await getMyInvitations(user.id); // solo disponibles

  return (
    <div className="pb-nav">
      <div className="pb-scroll">
      <main style={{ padding: "calc(18px + env(safe-area-inset-top)) 18px 0", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1 style={{ font: "800 28px/1 var(--font-display)", letterSpacing: "-.02em" }}>Invitar al parche</h1>
          <p style={{ font: "400 14px/1.45 var(--font-sans)", color: "var(--color-tenue)", margin: "8px 0 0" }}>
            FriaDay es solo por invitación. Genera un código y pásaselo a tu parcero. Cada código sirve una sola vez.
          </p>
        </div>

        <InviteGenerator />

        <section>
          <div className="eyebrow" style={{ marginBottom: 11 }}>Códigos disponibles</div>
          {invites.length === 0 ? (
            <p style={{ font: "400 14px var(--font-sans)", color: "var(--color-tenue)" }}>
              No tienes códigos disponibles. Genera uno arriba.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {invites.map((inv) => (
                <div key={inv.id} className="card" style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: "700 17px var(--font-display)", letterSpacing: ".12em", color: "var(--color-espuma)" }}>{inv.code}</div>
                    <div style={{ font: "400 12px var(--font-sans)", color: "var(--color-tenue-2)", marginTop: 2 }}>
                      Creada {formatDay(inv.createdAt)}
                      {inv.expiresAt ? ` · expira ${formatDay(inv.expiresAt)}` : ""}
                    </div>
                  </div>
                  <ShareCodeButton code={inv.code} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      </div>
      <BottomNav />
    </div>
  );
}
