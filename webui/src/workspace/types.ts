export type TreeNodeKind =
  | "group_mysql"
  | "group_redis"
  | "mysql_conn"
  | "mysql_db"
  | "mysql_table"
  | "redis_conn"
  | "redis_keys_root";

export interface TreeNode {
  id: string;
  kind: TreeNodeKind;
  title: string;
  children?: TreeNode[];
  /**
   * 允许在节点上挂载任意元数据（例如 connId/db/table/tableMeta 等）。
   * TreePanel 会在 lazy load 时填充/更新该字段。
   */
  meta?: unknown;
}

export type MysqlQueryTabPayload = {
  connId: string;
  connName?: string;
  db: string;
  table?: string;
  initialSql?: string;
};

export type MysqlDataTabPayload = {
  connId: string;
  connName?: string;
  db: string;
  table: string;
  limit: number;
};

export type MysqlSchemaTabPayload = {
  connId: string;
  connName?: string;
  db: string;
  table: string;
  defaultActive: "columns" | "indexes";
};

export type RedisKeysTabPayload = {
  connId: string;
  connName?: string;
};

export type RedisKeyTabPayload = {
  connId: string;
  connName?: string;
  key: string;
};

/**
 * Workspace 内部的“标签页”模型。
 * - id：用于 Tabs 的 key（需要稳定，避免重复打开同一资源时产生多个 tab）
 * - key：业务侧的资源标识（例如 connId / database / redis db 等），用于生成稳定 id
 */
export type WorkspaceTabKind = "welcome" | "mysql_query" | "mysql_data" | "mysql_schema" | "redis_keys" | "redis_key" | TreeNodeKind;

type WorkspaceTabBase = {
  id: string;
  kind: WorkspaceTabKind;
  key: string;
  title: string;
  closable?: boolean;

  /**
   * 任意附加数据（后续扩展用）。
   */
  payload?: unknown;
};

export type WorkspaceTab =
  | (WorkspaceTabBase & { kind: "welcome"; closable?: false; payload?: undefined })
  | (WorkspaceTabBase & { kind: "mysql_query"; payload: MysqlQueryTabPayload })
  | (WorkspaceTabBase & { kind: "mysql_data"; payload: MysqlDataTabPayload })
  | (WorkspaceTabBase & { kind: "mysql_schema"; payload: MysqlSchemaTabPayload })
  | (WorkspaceTabBase & { kind: "redis_keys"; payload: RedisKeysTabPayload })
  | (WorkspaceTabBase & { kind: "redis_key"; payload: RedisKeyTabPayload })
  | (WorkspaceTabBase & { kind: Exclude<WorkspaceTabKind, "welcome" | "mysql_query" | "mysql_data" | "mysql_schema" | "redis_keys" | "redis_key"> });
