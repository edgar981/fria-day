export function Icon({
  name,
  size = 23,
  color = "currentColor",
}: {
  name: "home" | "mug" | "chart" | "mail" | "plus" | "back" | "search" | "lock";
  size?: number;
  color?: string;
}) {
  return (
    <svg aria-hidden style={{ width: size, height: size, color }}>
      <use href={`#ic-${name}`} />
    </svg>
  );
}
