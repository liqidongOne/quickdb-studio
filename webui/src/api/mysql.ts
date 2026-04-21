import { apiGet, apiPost } from "./client";

function normalizeName(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const anyV = v as any;
    if (anyV && typeof anyV.name === "string") return anyV.name;
  }
  return String(v);
}

export type MySQLTableColumn = {
  name: string;
  dataType: string;
  columnType: string;
  isNullable: boolean;
  defaultValue?: string | null;
  extra?: string;
  columnKey?: string;
  ordinalPosition: number;
  comment?: string;
};

export type MySQLTableIndex = {
  name: string;
  nonUnique: boolean;
  seqInIndex: number;
  columnName: string;
  collation?: string | null;
  nullable?: boolean | null;
  indexType?: string;
  comment?: string | null;
};

export type MySQLTableMetaResp = {
  database: string;
  table: string;
  columns: MySQLTableColumn[];
  indexes: MySQLTableIndex[];
};

export async function listDatabases(connId: string): Promise<string[]> {
  const id = connId.trim();
  if (!id) return [];
  const data = await apiGet<unknown>(`/api/v1/mysql/${encodeURIComponent(id)}/databases`);
  if (!Array.isArray(data)) return [];
  return data.map((x) => normalizeName(x)).filter((s) => !!s);
}

export async function listTables(connId: string, db: string): Promise<string[]> {
  const id = connId.trim();
  const dbName = db.trim();
  if (!id || !dbName) return [];
  const qs = new URLSearchParams({ db: dbName });
  const data = await apiGet<unknown>(`/api/v1/mysql/${encodeURIComponent(id)}/tables?${qs.toString()}`);
  if (!Array.isArray(data)) return [];
  return data.map((x) => normalizeName(x)).filter((s) => !!s);
}

export async function getTableMeta(connId: string, db: string, table: string): Promise<MySQLTableMetaResp> {
  const id = connId.trim();
  const dbName = db.trim();
  const tableName = table.trim();
  const qs = new URLSearchParams({ db: dbName, table: tableName });
  return apiGet<MySQLTableMetaResp>(`/api/v1/mysql/${encodeURIComponent(id)}/table/meta?${qs.toString()}`);
}

export type TestConnResp = { ok: boolean; latencyMs: number };

export async function testMySQLConnection(connId: string): Promise<TestConnResp> {
  const id = connId.trim();
  return apiPost<TestConnResp>(`/api/v1/mysql/${encodeURIComponent(id)}/test`, {});
}
