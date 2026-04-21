import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client";

function normalizeDbName(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const anyV = v as any;
    if (typeof anyV.name === "string") return anyV.name;
  }
  return String(v);
}

export function useMysqlDatabases(connId: string) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const refresh = useCallback(async () => {
    const id = connId.trim();
    if (!id) {
      setDatabases([]);
      setError("");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const data = await apiGet<unknown>(`/api/v1/mysql/${encodeURIComponent(id)}/databases`);
      if (!Array.isArray(data)) {
        setDatabases([]);
        return;
      }
      const names = data.map((x) => normalizeDbName(x)).filter((s) => !!s);
      setDatabases(names);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [connId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { databases, loading, error, refresh };
}

export default useMysqlDatabases;
