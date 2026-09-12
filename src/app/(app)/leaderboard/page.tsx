import { requireUser } from "@/lib/session";
import { getProfile, getMyInvitations } from "@/lib/queries";
import { getCirclePoints } from "@/lib/points-queries";
import { BottomNav } from "@/components/BottomNav";
import { LeaderboardScreen } from "@/components/LeaderboardScreen";

export const dynamic = "force-dynamic";

// Leaderboard como pestaña propia (Pasada N): antes vivía dentro de Perfil. La
// comparación del círculo va aquí; Perfil se queda con las métricas personales y la
// cuenta. Los datos del ranking los reusa de getProfile (mismo cálculo de siempre).
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const user = await requireUser();
  const { invite } = await searchParams;
  const [{ board, boardVariety, boardSessions, avatarById, aloneInCircle }, invites, circlePoints] =
    await Promise.all([getProfile(user.id), getMyInvitations(user.id), getCirclePoints(user.id)]);

  return (
    <div className="pb-nav">
      <div className="pb-scroll">
        <LeaderboardScreen
          boardUnits={board}
          boardVariety={boardVariety}
          boardSessions={boardSessions}
          userId={user.id}
          avatarById={avatarById}
          aloneInCircle={aloneInCircle}
          invitations={invites.map((i) => ({ id: i.id, code: i.code, createdAt: i.createdAt, expiresAt: i.expiresAt }))}
          circlePoints={circlePoints}
          autoOpenInvite={invite === "1"}
        />
      </div>
      <BottomNav />
    </div>
  );
}
