import type { DrinkKind } from "@/lib/domain";

// Forma de una bebida tal como la devuelven las acciones de búsqueda/creación.
export interface BeerOption {
  id: string;
  name: string;
  brewery: string | null; // opcional: los cócteles no tienen cervecería (Pasada D)
  style: string | null;
  abv: string | null;
  kind: DrinkKind; // el selector de formato depende del tipo
}
