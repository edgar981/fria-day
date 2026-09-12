// Set fijo de avatares (fauna colombiana). Sin subida de imágenes.
// La clave se guarda en User.avatar; null = anónimo.

export const AVATAR_KEYS = [
  "capibara",
  "tucan",
  "jaguar",
  "mono",
  "rana",
  "chucha",
  "armadillo",
  "condor",
  "iguana",
  "oso-andino",
  // Pasada de ajustes: 6 fauna más (el parche crece y las variantes se agotaban).
  "perezoso",
  "delfin",
  "colibri",
  "babilla",
  "venado",
  "tortuga",
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

interface AvatarMeta {
  symbol: string; // id del <symbol> en el sprite
  bg: string; // color de campo del avatar
  label: string;
}

export const AVATAR_META: Record<AvatarKey, AvatarMeta> = {
  capibara: { symbol: "av-capibara", bg: "#2F6B4F", label: "Capibara" },
  tucan: { symbol: "av-tucan", bg: "#C4620A", label: "Tucán" },
  jaguar: { symbol: "av-jaguar", bg: "#8A4A12", label: "Jaguar" },
  mono: { symbol: "av-mono", bg: "#B0762A", label: "Mono" },
  rana: { symbol: "av-rana", bg: "#4A5C2A", label: "Rana" },
  chucha: { symbol: "av-chucha", bg: "#6E3A1E", label: "Chucha" },
  armadillo: { symbol: "av-armadillo", bg: "#7A5C2E", label: "Armadillo" },
  condor: { symbol: "av-condor", bg: "#5C4A3A", label: "Cóndor" },
  iguana: { symbol: "av-iguana", bg: "#3A6B4A", label: "Iguana" },
  "oso-andino": { symbol: "av-oso", bg: "#4A3524", label: "Oso andino" },
  perezoso: { symbol: "av-perezoso", bg: "#6B5A3A", label: "Perezoso" },
  delfin: { symbol: "av-delfin", bg: "#A85A6E", label: "Delfín" },
  colibri: { symbol: "av-colibri", bg: "#2E7D6B", label: "Colibrí" },
  babilla: { symbol: "av-babilla", bg: "#45542B", label: "Babilla" },
  venado: { symbol: "av-venado", bg: "#9C6B3A", label: "Venado" },
  tortuga: { symbol: "av-tortuga", bg: "#3E6B47", label: "Tortuga" },
};

export const ANON_META: AvatarMeta = {
  symbol: "av-anon",
  bg: "#2A2018",
  label: "Anónimo",
};

export function isAvatarKey(v: unknown): v is AvatarKey {
  return typeof v === "string" && (AVATAR_KEYS as readonly string[]).includes(v);
}

/** Resuelve la meta de un avatar; null o clave inválida → anónimo. */
export function resolveAvatar(key: string | null | undefined): AvatarMeta & {
  anon: boolean;
} {
  if (isAvatarKey(key)) return { ...AVATAR_META[key], anon: false };
  return { ...ANON_META, anon: true };
}
