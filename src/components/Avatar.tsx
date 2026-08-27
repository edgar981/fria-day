import { resolveAvatar } from "@/lib/avatars";

export function Avatar({
  avatar,
  size = 40,
  radius,
}: {
  avatar: string | null | undefined;
  size?: number;
  radius?: number;
}) {
  const m = resolveAvatar(avatar);
  const r = radius ?? Math.round(size * 0.32);
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: m.bg,
        display: "block",
        flex: "none",
        ...(m.anon ? { border: "1px dashed #4A3A28" } : null),
      }}
    >
      <use href={`#${m.symbol}`} />
    </svg>
  );
}
