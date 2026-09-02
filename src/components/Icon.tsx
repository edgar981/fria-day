export type IconName =
  | "home"
  | "mug"
  | "chart"
  | "mail"
  | "plus"
  | "back"
  | "search"
  | "lock"
  | "user"
  | "users"
  | "share";

// "user"/"users" (Pasada N: Perfil e Invitar) se dibujan INLINE, no en el sprite:
// Sprite.tsx está marcado "No editar a mano" (se regenera desde Claude Design) y
// meter símbolos ahí se perdería en el próximo regen, dejando <use> colgando. Van
// aquí, con el mismo trazo (stroke 1.9, sin relleno, redondeado) que el resto.
const INLINE: Partial<Record<IconName, React.ReactNode>> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3 19a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M15.5 6.2a3.3 3.3 0 0 1 0 6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M16.5 13.4A6 6 0 0 1 21 19" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
  share: (
    <>
      <path d="M12 3.5v11" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8 7l4-3.5L16 7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11H5.5A1.5 1.5 0 0 0 4 12.5v6A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18.5 11H18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

export function Icon({
  name,
  size = 23,
  color = "currentColor",
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const inline = INLINE[name];
  if (inline) {
    return (
      <svg aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, color }}>
        {inline}
      </svg>
    );
  }
  return (
    <svg aria-hidden style={{ width: size, height: size, color }}>
      <use href={`#ic-${name}`} />
    </svg>
  );
}
