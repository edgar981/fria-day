// Forma de una cerveza tal como la devuelven las acciones de búsqueda/creación.
export interface BeerOption {
  id: string;
  name: string;
  brewery: string;
  style: string | null;
  abv: string | null;
}
