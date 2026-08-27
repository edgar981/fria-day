"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { normalizeKey } from "@/lib/domain";
import { beerSchema } from "@/lib/validation";

export type CreateBeerResult =
  | {
      ok: true;
      beer: {
        id: string;
        name: string;
        brewery: string;
        style: string | null;
        abv: string | null;
      };
      existed: boolean;
    }
  | { ok: false; error: string };

/**
 * Crea una cerveza en el catálogo, o devuelve la existente si ya hay una con el
 * mismo (name, brewery) case-insensitive. Usado también inline al crear un
 * check-in, para que registrar sea de pocos taps.
 */
export async function createBeer(input: unknown): Promise<CreateBeerResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = beerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, brewery, style, abv } = parsed.data;
  const nameKey = normalizeKey(name);
  const breweryKey = normalizeKey(brewery);

  const existing = await prisma.beer.findUnique({
    where: { nameKey_breweryKey: { nameKey, breweryKey } },
  });
  if (existing) {
    return {
      ok: true,
      existed: true,
      beer: {
        id: existing.id,
        name: existing.name,
        brewery: existing.brewery,
        style: existing.style,
        abv: existing.abv ? existing.abv.toString() : null,
      },
    };
  }

  const created = await prisma.beer.create({
    data: {
      name,
      brewery,
      style: style ? style : null,
      abv: abv === "" || abv == null ? null : abv,
      nameKey,
      breweryKey,
      createdById: user.id,
    },
  });
  revalidatePath("/beers");
  return {
    ok: true,
    existed: false,
    beer: {
      id: created.id,
      name: created.name,
      brewery: created.brewery,
      style: created.style,
      abv: created.abv ? created.abv.toString() : null,
    },
  };
}

export async function searchBeersAction(query: string) {
  const user = await getCurrentUser();
  if (!user) return [];
  const q = query.trim();
  const beers = await prisma.beer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { brewery: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    select: { id: true, name: true, brewery: true, style: true, abv: true },
    orderBy: { name: "asc" },
    take: 20,
  });
  return beers.map((b) => ({ ...b, abv: b.abv ? b.abv.toString() : null }));
}

export async function searchUsersAction(query: string) {
  const user = await getCurrentUser();
  if (!user) return [];
  const q = query.trim();
  return prisma.user.findMany({
    where: {
      id: { not: user.id },
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, displayName: true, avatar: true },
    orderBy: { displayName: "asc" },
    take: 8,
  });
}
