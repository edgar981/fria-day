import { z } from "zod";
import { BEER_FORMATS } from "@/lib/domain";

export const registerSchema = z.object({
  displayName: z.string().trim().min(1, "Pon tu nombre").max(40),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  code: z.string().trim().min(1, "Necesitas un código de invitación"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export const beerSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(80),
  brewery: z.string().trim().min(1, "Cervecería requerida").max(80),
  style: z.string().trim().max(60).optional().or(z.literal("")),
  abv: z
    .union([z.coerce.number().min(0).max(60), z.literal("")])
    .optional(),
});

export const checkInSchema = z.object({
  beerId: z.string().min(1, "Elige una cerveza"),
  quantity: z.coerce.number().int().min(1, "Mínimo 1").max(99),
  format: z.enum(BEER_FORMATS),
  // Rating opcional: null/ausente = sin calificar. Si viene, debe ser 1..5.
  rating: z
    .union([z.null(), z.coerce.number().int().min(1, "Rating 1–5").max(5, "Rating 1–5")])
    .optional(),
  photoUrl: z.string().trim().url().optional().or(z.literal("")),
});

const tagSchema = z
  .object({
    taggedUserId: z.string().optional().nullable(),
    freeText: z.string().trim().max(60).optional().nullable(),
  })
  .refine(
    (t) => {
      const hasUser = !!t.taggedUserId;
      const hasText = !!(t.freeText && t.freeText.trim());
      return hasUser !== hasText; // XOR
    },
    { message: "Cada etiqueta es un usuario O texto libre, no ambos" },
  );

export const sessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  placeName: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  tags: z.array(tagSchema).max(30).default([]),
  checkIns: z.array(checkInSchema).max(50).default([]),
});

export const inviteSchema = z.object({
  // días de validez opcional; vacío = sin expiración
  expiresInDays: z
    .union([z.coerce.number().int().min(1).max(365), z.literal("")])
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type BeerInput = z.infer<typeof beerSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
