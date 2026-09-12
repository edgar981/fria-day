"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { AvatarPicker } from "@/components/AvatarPicker";
import { updateAvatar } from "@/app/actions/profile";

export function ProfileAvatarEditor({
  displayName,
  avatar,
}: {
  displayName: string;
  avatar: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <Avatar avatar={avatar} size={60} radius={19} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "800 25px/1 var(--font-display)", letterSpacing: "-.02em" }}>{displayName}</div>
        </div>
        <button type="button" className="btn btn-ghost" style={{ height: 40, fontSize: 13 }} onClick={() => setOpen((v) => !v)}>
          {open ? "Cerrar" : "Cambiar avatar"}
        </button>
      </div>
      {open && (
        <div className="card" style={{ padding: 16, marginTop: 14, opacity: pending ? 0.6 : 1 }}>
          <AvatarPicker
            value={avatar}
            onSelect={(key) =>
              startTransition(async () => {
                await updateAvatar(key);
                router.refresh();
              })
            }
          />
        </div>
      )}
    </div>
  );
}
