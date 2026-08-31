import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getSessionDetail } from "@/lib/queries";
import { toDateInputValue } from "@/lib/format";
import { BackHeader } from "@/components/BackHeader";
import { SessionHeaderEditor } from "@/components/SessionHeaderEditor";
import { SessionTagsEditor } from "@/components/SessionTagsEditor";

export const dynamic = "force-dynamic";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireUser();
  const s = await getSessionDetail(id, viewer.id);
  if (!s) notFound();
  if (s.userId !== viewer.id) redirect(`/sessions/${id}`);

  return (
    <div>
      <BackHeader title="Editar salida" href={`/sessions/${id}`} />
      <main style={{ padding: "18px 18px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <SessionHeaderEditor
          session={{ id: s.id, date: toDateInputValue(s.date), placeName: s.placeName ?? "", notes: s.notes ?? "" }}
        />
        <SessionTagsEditor
          sessionId={s.id}
          tags={s.tags.map((t) => ({ id: t.id, taggedUserId: t.taggedUserId, taggedUserName: t.taggedUser?.displayName ?? null, freeText: t.freeText }))}
        />
        <Link href={`/sessions/${id}`} className="btn btn-primary" style={{ width: "100%", textDecoration: "none" }}>
          Ver la salida →
        </Link>
      </main>
    </div>
  );
}
