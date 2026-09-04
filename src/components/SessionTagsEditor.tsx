"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { TagPicker, type DisplayTag } from "@/components/TagPicker";
import { addTag, removeTag } from "@/app/actions/sessions";

export interface EditorTag {
  id: string;
  taggedUserId: string | null;
  taggedUserName: string | null;
  freeText: string | null;
}

export function SessionTagsEditor({
  sessionId,
  tags,
  bare = false,
}: {
  sessionId: string;
  tags: EditorTag[];
  // DS.2: dentro del colapsable de Editar, sin el título propio (lo pone el colapsable).
  bare?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const display: DisplayTag[] = tags.map((t) => ({
    key: t.id,
    kind: t.taggedUserId ? "user" : "text",
    label: t.taggedUserId ? t.taggedUserName ?? "Usuario" : t.freeText ?? "",
  }));

  const excludeUserIds = tags
    .filter((t) => t.taggedUserId)
    .map((t) => t.taggedUserId!) as string[];

  return (
    <section style={{ display: "grid", gap: "0.6rem", opacity: pending ? 0.7 : 1 }}>
      {!bare && <h2 style={{ fontWeight: 700 }}>Compañía</h2>}
      <TagPicker
        tags={display}
        excludeUserIds={excludeUserIds}
        onAddUser={(u) =>
          startTransition(async () => {
            await addTag({ sessionId, taggedUserId: u.id });
            router.refresh();
          })
        }
        onAddText={(text) =>
          startTransition(async () => {
            await addTag({ sessionId, freeText: text });
            router.refresh();
          })
        }
        onRemove={(key) =>
          startTransition(async () => {
            await removeTag(key);
            router.refresh();
          })
        }
      />
    </section>
  );
}
