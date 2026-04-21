const KEY = "quickdb_redis_recent_patterns_v1";
const OLD_KEY = "solo_redis_recent_patterns_v1";
const MAX_ITEMS = 20;

export type RecentPatternItem = { pattern: string; usedAt: number; pinned?: boolean };

export function listRecentPatterns(): RecentPatternItem[] {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const items = data
      .map((x) => x as any)
      .filter((x) => typeof x?.pattern === "string")
      .map((x) => ({ pattern: String(x.pattern), usedAt: Number(x.usedAt || Date.now()), pinned: Boolean(x.pinned) }))
      .slice(0, MAX_ITEMS);
    // 排序：pinned 在前，其次 usedAt 倒序
    const sorted = items.sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (b.usedAt ?? 0) - (a.usedAt ?? 0);
    });
    // Migration: persist to new key if we read from old key.
    if (!localStorage.getItem(KEY) && localStorage.getItem(OLD_KEY)) {
      save(sorted);
      localStorage.removeItem(OLD_KEY);
    }
    return sorted;
  } catch {
    return [];
  }
}

function save(items: RecentPatternItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // ignore
  }
}

export function pushRecentPattern(pattern: string): RecentPatternItem[] {
  const p = (pattern ?? "").trim();
  if (!p) return listRecentPatterns();
  const now = Date.now();
  const items = listRecentPatterns();
  const existing = items.find((x) => x.pattern === p);
  const next: RecentPatternItem[] = [{ pattern: p, usedAt: now, pinned: existing?.pinned }, ...items.filter((x) => x.pattern !== p)];
  save(next);
  return next;
}

export function removeRecentPattern(pattern: string): RecentPatternItem[] {
  const p = (pattern ?? "").trim();
  const items = listRecentPatterns().filter((x) => x.pattern !== p);
  save(items);
  return items;
}

export function clearRecentPatterns(): RecentPatternItem[] {
  save([]);
  return [];
}

export function togglePinPattern(pattern: string): RecentPatternItem[] {
  const p = (pattern ?? "").trim();
  const items = listRecentPatterns().map((x) => (x.pattern === p ? { ...x, pinned: !x.pinned } : x));
  save(items);
  return items;
}
