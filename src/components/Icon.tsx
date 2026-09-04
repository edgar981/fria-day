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
  | "share"
  | "comment"
  | "more"
  | "camera";

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
  // I-3.1: burbuja de comentario del tablero 1a (trazo 1.9, redondeado).
  comment: (
    <path
      d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v6A2.5 2.5 0 0 1 17 15H10l-4 3.5V15H7a2.5 2.5 0 0 1-2.5-2.5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
  ),
  // DS: menú del dueño (tres puntos) y cámara (invitación a subir foto). El tablero los
  // trae como placeholders; van aquí y no en Sprite.tsx (que se regenera) — mismo criterio
  // que share/comment. La cámara con el trazo 1.9 redondeado del sistema.
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.7" fill="currentColor" />
    </>
  ),
  camera: (
    <>
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.3-2h6.4L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
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
