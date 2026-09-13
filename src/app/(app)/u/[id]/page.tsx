import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getForeignProfile } from "@/lib/queries";
import { BackHeader } from "@/components/BackHeader";
import { BottomNav } from "@/components/BottomNav";
import { ForeignProfile } from "@/components/ForeignProfile";

export const dynamic = "force-dynamic";

// Pasada PA — la ficha de otra persona. Cualquier usuario logueado puede verla (son datos
// agregados, no contenido), esté o no en tu círculo. Tu propio id va a tu panel completo.
export default async function ForeignProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireUser();
  if (id === viewer.id) redirect("/profile");

  const profile = await getForeignProfile(id, viewer.id);
  if (!profile) notFound();

  return (
    <div className="pb-nav">
      <div className="pb-scroll">
        <BackHeader title="Perfil" href="/" />
        <ForeignProfile profile={profile} />
      </div>
      <BottomNav />
    </div>
  );
}
