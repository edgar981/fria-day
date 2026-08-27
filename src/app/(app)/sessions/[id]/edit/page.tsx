import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getSessionDetail } from "@/lib/queries";
import { toDateInputValue } from "@/lib/format";
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
  const s = await getSessionDetail(id);
  if (!s) notFound();
  if (s.userId !== viewer.id) redirect(`/sessions/${id}`); // regla 2: solo el dueño edita

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Link href={`/sessions/${id}`} className="btn btn-ghost" style={{ padding: "0.35rem 0.6rem" }}>
          ←
        </Link>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Editar sesión</h1>
      </div>

      <SessionHeaderEditor
        session={{
          id: s.id,
          date: toDateInputValue(s.date),
          placeName: s.placeName ?? "",
          notes: s.notes ?? "",
        }}
      />

      <SessionTagsEditor
        sessionId={s.id}
        tags={s.tags.map((t) => ({
          id: t.id,
          taggedUserId: t.taggedUserId,
          taggedUserName: t.taggedUser?.displayName ?? null,
          freeText: t.freeText,
        }))}
      />

      <Link href={`/sessions/${id}`} className="btn btn-primary" style={{ justifyContent: "center" }}>
        Gestionar cervezas y ver la sesión →
      </Link>
    </div>
  );
}
