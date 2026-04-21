const KEY = "quickdb_query_favorites_v1";
const OLD_KEY = "solo_query_favorites_v1";

export type FavoriteItem = {
  id: string;
  name: string;
  connId?: string;
  db?: string;
  sql: string;
  note?: string;
  createdAt: number;
};

function newId(): string {
  return `fav_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function listFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const items = data
      .map((x) => x as any)
      .filter((x) => typeof x?.name === "string" && typeof x?.sql === "string")
      .map(
        (x) =>
          ({
            id: String(x.id || newId()),
            name: String(x.name),
            connId: x.connId ? String(x.connId) : undefined,
            db: x.db ? String(x.db) : undefined,
            sql: String(x.sql),
            note: x.note ? String(x.note) : undefined,
            createdAt: Number(x.createdAt || Date.now())
          }) satisfies FavoriteItem
      );
    // Migration: persist to new key if we read from old key.
    if (!localStorage.getItem(KEY) && localStorage.getItem(OLD_KEY)) {
      saveFavorites(items);
      try {
        localStorage.removeItem(OLD_KEY);
      } catch {
        // ignore
      }
    }
    return items;
  } catch {
    return [];
  }
}

function saveFavorites(items: FavoriteItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function addFavorite(input: Omit<FavoriteItem, "id" | "createdAt">): FavoriteItem {
  const item: FavoriteItem = {
    id: newId(),
    createdAt: Date.now(),
    ...input,
    name: input.name.trim(),
    sql: input.sql.trim()
  };
  const items = [item, ...listFavorites()];
  saveFavorites(items);
  return item;
}

export function removeFavorite(id: string) {
  const items = listFavorites().filter((x) => x.id !== id);
  saveFavorites(items);
}
