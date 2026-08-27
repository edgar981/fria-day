import { requireUser } from "@/lib/session";
import { getMyInvitations } from "@/lib/queries";
import { InviteGenerator } from "@/components/InviteGenerator";
import { formatDay } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusOf(inv: {
  usedBy: { displayName: string } | null;
  expiresAt: Date | null;
}): { label: string; color: string } {
  if (inv.usedBy) return { label: `Usada por ${inv.usedBy.displayName}`, color: "var(--muted)" };
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now())
    return { label: "Expirada", color: "var(--danger)" };
  return { label: "Disponible", color: "var(--accent)" };
}

export default async function InvitePage() {
  const user = await requireUser();
  const invites = await getMyInvitations(user.id);

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Invitar</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          FriaDay es solo por invitación. Genera un código y pásaselo a tu parcero.
        </p>
      </div>

      <InviteGenerator />

      <section style={{ display: "grid", gap: "0.6rem" }}>
        <h2 style={{ fontWeight: 700 }}>Tus invitaciones</h2>
        {invites.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Aún no has generado ninguna.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
            {invites.map((inv) => {
              const st = statusOf(inv);
              return (
                <li key={inv.id} className="card" style={{ padding: "0.6rem 0.8rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <div>
                    <div style={{ fontWeight: 700, letterSpacing: "0.1em", fontFamily: "ui-monospace, monospace" }}>
                      {inv.code}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                      Creada {formatDay(inv.createdAt)}
                      {inv.expiresAt ? ` · expira ${formatDay(inv.expiresAt)}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: st.color }}>{st.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
