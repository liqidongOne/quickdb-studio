const KEY = "quickdb_query_history_v1";
const OLD_KEY = "solo_query_history_v1";
const MAX_ITEMS = 50;

export type QueryHistoryItem = {
  id: string;
  connId: string;
  db: string;
  sql: string;
  createdAt: number; // ms
};

function stableId(input: string): string {
  // djb2 hash
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return `qh_${(h >>> 0).toString(16)}`;
}

export function loadHistory(): QueryHistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const items = data
      .map((x) => x as any)
      .filter((x) => typeof x?.sql === "string" && typeof x?.connId === "string" && typeof x?.db === "string")
      .map(
        (x) =>
          ({
            id: String(x.id || stableId(`${x.connId}::${x.db}::${x.sql}`)),
            connId: String(x.connId),
            db: String(x.db),
            sql: String(x.sql),
            createdAt: Number(x.createdAt || Date.now())
          }) satisfies QueryHistoryItem
      );
    // Migration: persist to new key if we read from old key.
    if (!localStorage.getItem(KEY) && localStorage.getItem(OLD_KEY)) {
      saveHistory(items);
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

export function saveHistory(items: QueryHistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore
  }
}

export function pushHistory(input: { connId: string; db: string; sql: string }): QueryHistoryItem[] {
  const connId = input.connId.trim();
  const db = input.db.trim();
  const sql = input.sql.trim();
  if (!connId || !db || !sql) return loadHistory();

  const now = Date.now();
  const id = stableId(`${connId}::${db}::${sql}`);
  const items = loadHistory();

  // 去重：同 connId+db+sql 置顶
  const next: QueryHistoryItem[] = [{ id, connId, db, sql, createdAt: now }, ...items.filter((x) => x.id !== id)];
  saveHistory(next);
  return next;
}
