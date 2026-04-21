(continuing)

- Tabs 支持新增/关闭/切换（editable-card）
- Tab 类型：
  1. `mysql_query`：绑定 `connId + db?`，上 SQL 下 Result（上下分栏）
  2. `redis_keys`：绑定 `connId`，keys 列表 + 搜索分页
  3. `redis_key`：绑定 `connId + key`，meta + 值预览

Tab 标题建议：
- MySQL Query：`<connName> / <db>`（无 db 时 `<connName>`）
- Redis Keys：`Redis <connName> Keys`
- Redis Key：`<connName>: <key>`

---

## 4. 前端状态模型（核心）

### 4.1 Tree Node 类型
用类型区分节点行为（便于 click/expand 时分发逻辑）：
- `group_mysql`, `group_redis`
- `mysql_conn`, `mysql_db`, `mysql_table`, `mysql_columns`, `mysql_indexes`
- `redis_conn`, `redis_keys_root`

### 4.2 Workspace Tab 模型
```ts
type WorkspaceTab =
  | { id: string; type: "mysql_query"; connId: string; db?: string; sql: string }
  | { id: string; type: "redis_keys"; connId: string; pattern: string; cursor: string; keys: string[] }
  | { id: string; type: "redis_key"; connId: string; key: string };
```

### 4.3 交互规则
- **单击树节点**：优先“聚焦已存在 Tab”；若不存在则新建 Tab
- **点击 MySQL table**：
  - 打开/聚焦 MySQL Query Tab（connId + db）
  - 自动填充 SQL 模板：`SELECT * FROM <db>.<table> LIMIT 200;`
  -（可选）不自动执行，留给用户点击运行
- **点击 Redis Keys**：打开/聚焦 Redis Keys Tab
- **点击 Redis key（在 Keys Tab 列表中）**：打开 Redis Key Tab

---

## 5. 后端 API 设计（方案二：聚合/预览接口）

现有 API 可继续保留；新增更贴 UI 的聚合接口以减少请求次数、提升树展开体验。

### 5.1 导航树（连接分组）
`GET /api/v1/nav/tree`

返回示例：
```json
{
  "mysql": [{ "id": "c1", "name": "prod-ro" }],
  "redis": [{ "id": "c2", "name": "cache" }]
}
```

说明：
- 只返回“连接列表 + 基本信息”，不返回 schema/key 细节
- 连接数据来自 `connections.json`

### 5.2 MySQL：数据库列表（可沿用现有）
`GET /api/v1/mysql/{connId}/databases`

返回：`string[]`

### 5.3 MySQL：库下表列表（可沿用现有）
`GET /api/v1/mysql/{connId}/tables?db=<db>`

返回：`string[]`

### 5.4 MySQL：表细节（列/索引）（推荐新增或复用现有 /table）
`GET /api/v1/mysql/{connId}/table/meta?db=<db>&table=<table>`

返回示例：
```json
{
  "db": "db_main",
  "table": "users",
  "columns": [{ "name": "id", "dataType": "bigint(20)", "isNullable": false }],
  "indexes": [{ "name": "PRIMARY", "unique": true, "columns": [{ "seq": 1, "name": "id" }] }]
}
```

> 如果现有 `/api/v1/mysql/{connId}/table?db=&table=` 已返回 columns/indexes，可直接改名或兼容两者。

### 5.5 Redis：keys 搜索（统一 scan）
`POST /api/v1/redis/{connId}/keys/search`

请求：
```json
{ "pattern": "*", "cursor": "0", "count": 200 }
```

响应：
```json
{ "keys": ["k1","k2"], "nextCursor": "123" }
```

说明：
- 这是对现有 `/redis/{connId}/scan` 的语义化封装（可保留旧接口兼容）

### 5.6 Redis：key 预览（聚合 meta + value）
`GET /api/v1/redis/{connId}/key/preview?key=<key>&cursor=<cursor>&count=<count>&start=<start>&stop=<stop>`

响应示例（string）：
```json
{
  "key": "k:string",
  "type": "string",
  "ttlMs": 12345,
  "data": { "value": "hello", "truncated": false }
}
```

响应示例（hash）：
```json
{
  "key": "k:hash",
  "type": "hash",
  "ttlMs": -1,
  "data": { "items": [{"field":"f1","value":"v1"}], "nextCursor": "0" }
}
```

说明：
- 后端根据 TYPE 分发到现有读取函数（GetString/HScan/SScan/ZScan/LRange）
- 统一返回 meta + data，前端只需一次请求即可渲染 key 详情

---

## 6. 安全与只读约束

1) 仅监听 `127.0.0.1`（默认不对外网开放）
2) `/api/v1/health` 公开，其余全部 Bearer Token
3) MySQL Query 必须通过只读校验（现有 `ValidateMySQLReadonly`）
4) Redis 只提供读取命令（SCAN/TYPE/PTTL/GET/HSCAN/SSCAN/ZSCAN/LRANGE）
5) UI 不展示密码，后端禁止日志打印密码字段

---

## 7. 性能策略（第一版）

- Tree 展开采用“按需加载”（lazy load）：
  - 展开 MySQL conn 才加载 databases
  - 展开 db 才加载 tables
  - 展开 table 才加载 columns/indexes（B 要求）
- Redis keys 不进树，放到列表 Tab（分页 scan）
- 前端对 schema/key 详情可做短期缓存（内存 Map + TTL，例如 30s），避免频繁点选导致重复请求

---

## 8. 迁移策略

1) 保留现有 Connections CRUD 页面能力，但入口可以放到 Toolbar（“新建连接/管理连接”）
2) 新的 Navicat 工作区作为默认首页
3) 后端新增 API 不破坏现有 API（保留兼容期）

