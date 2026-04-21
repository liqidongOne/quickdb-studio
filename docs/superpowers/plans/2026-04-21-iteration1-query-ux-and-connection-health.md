# 迭代 1：查询体验 + 连接/安全体验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 MySQL Query Tab 增加查询历史/收藏/导出（CSV+JSON）与复制增强；为连接管理增加“测试连接”（MySQL/Redis）；并在鉴权失败时提供更友好的引导。

**Architecture:** 前端新增 `storage` 模块封装 localStorage（history/favorites），Query Tab 在执行成功后写入历史；导出通过前端生成 Blob 下载。后端新增两个 test endpoints（MySQL ping / Redis ping）并复用现有 loadConn 与客户端连接逻辑。

**Tech Stack:** Go + chi；React + TS + Ant Design。

---

## 0) 文件结构（新增/修改）

### 前端（webui）
**Create**
- `webui/src/storage/queryHistory.ts`：历史读写（去重、截断）
- `webui/src/storage/queryFavorites.ts`：收藏读写（CRUD）
- `webui/src/utils/download.ts`：Blob 下载工具
- `webui/src/utils/serialize.ts`：CSV/JSON 序列化（从 columns+rows 生成）

**Modify**
- `webui/src/workspace/tabs/MysqlQueryTab.tsx`：加入历史/收藏 UI、导出 UI、复制增强
- `webui/src/pages/Connections.tsx`：新增“测试连接”按钮
- `webui/src/api/mysql.ts`：新增 `testMySQLConnection(connId)`
- `webui/src/api/redis.ts`：新增 `testRedisConnection(connId)`

### 后端（Go）
**Create**
- `internal/httpapi/handlers_mysql_test.go`
- `internal/httpapi/handlers_redis_test.go`
- `internal/model/test_resp.go`：`{ok, latencyMs}`

**Modify**
- `internal/httpapi/router.go`：挂载 `/mysql/{connId}/test` 与 `/redis/{connId}/test`

---

## Task 1：后端增加 MySQL/Redis 测试连接 API

**Files:**
- Create: `internal/model/test_resp.go`
- Create: `internal/httpapi/handlers_mysql_test.go`
- Create: `internal/httpapi/handlers_redis_test.go`
- Modify: `internal/httpapi/router.go`

- [ ] **Step 1: 定义响应结构**

`internal/model/test_resp.go`：
```go
package model

type TestConnResp struct {
	Ok        bool  `json:"ok"`
	LatencyMs int64 `json:"latencyMs"`
}
```

- [ ] **Step 2: MySQL test handler**

`internal/httpapi/handlers_mysql_test.go`（伪码骨架，按你现有 mysqlx.Open 与 timeout 写）：
```go
func (r *Router) handleMySQLTest(w http.ResponseWriter, req *http.Request) {
  connID := chi.URLParam(req, "connId")
  conn, err := loadConn(r.store, connID, model.ConnTypeMySQL)
  if err != nil { r.writeConnLoadErr(w, err); return }
  if conn.MySQL == nil { writeJSON(w, 400, model.ErrorResp{Error:"bad_request", Details:"missing mysql config"}); return }

  start := time.Now()
  db, err := mysqlx.Open(*conn.MySQL)
  if err != nil { writeJSON(w, 502, model.ErrorResp{Error:"mysql_open_error", Details: err.Error()}); return }
  defer db.Close()

  ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
  defer cancel()
  if err := db.PingContext(ctx); err != nil { writeJSON(w, 502, model.ErrorResp{Error:"mysql_unreachable", Details: err.Error()}); return }

  writeJSON(w, 200, model.TestConnResp{Ok:true, LatencyMs: time.Since(start).Milliseconds()})
}
```

- [ ] **Step 3: Redis test handler**

`internal/httpapi/handlers_redis_test.go`：复用 `redix.Open`，用 `PING`（或你现有 meta/scan 的最小调用）验证连通性：
```go
func (r *Router) handleRedisTest(w http.ResponseWriter, req *http.Request) { ... }
```

- [ ] **Step 4: 路由挂载**

在 `internal/httpapi/router.go`：
```go
mysql.Post("/test", r.handleMySQLTest)
rd.Post("/test", r.handleRedisTest)
```

---

## Task 2：前端 Connections 增加“测试连接”

**Files:**
- Modify: `webui/src/pages/Connections.tsx`
- Modify: `webui/src/api/mysql.ts`
- Modify: `webui/src/api/redis.ts`

- [ ] **Step 1: API 封装**

`webui/src/api/mysql.ts`：
```ts
export async function testMySQLConnection(connId: string): Promise<{ ok: boolean; latencyMs: number }> {
  return apiPost(`/api/v1/mysql/${encodeURIComponent(connId)}/test`, {});
}
```

`webui/src/api/redis.ts`：
```ts
export async function testRedisConnection(connId: string): Promise<{ ok: boolean; latencyMs: number }> {
  return apiPost(`/api/v1/redis/${encodeURIComponent(connId)}/test`, {});
}
```

- [ ] **Step 2: UI 加按钮 + loading 状态**

Connections 表格操作列新增“测试”按钮：
- 点击后根据 `type` 调对应 test API
- 成功：`message.success("连接正常 (xxms)")`
- 失败：`message.error("连接失败: ...")`

---

## Task 3：前端查询历史模块

**Files:**
- Create: `webui/src/storage/queryHistory.ts`
- Modify: `webui/src/workspace/tabs/MysqlQueryTab.tsx`

- [ ] **Step 1: 实现 storage**

`queryHistory.ts`：
```ts
const KEY = "solo_query_history_v1";
export type QueryHistoryItem = { id: string; connId: string; db: string; sql: string; createdAt: number };

export function loadHistory(): QueryHistoryItem[] { ... }
export function pushHistory(item: Omit<QueryHistoryItem, "id"|"createdAt">): QueryHistoryItem[] { ... } // 去重、置顶、截断 50
```

- [ ] **Step 2: 查询成功后写入历史**

在 `MysqlQueryTab.run()` 成功 `setResp(data)` 后：
```ts
pushHistory({ connId, db, sql: sqlStr });
```

- [ ] **Step 3: 历史 UI**

在 Query Tab 顶部按钮区加入 “历史”：
- 用 `Drawer` 列表展示（按当前 connId+db 过滤）
- 点击一条：`setSql(item.sql)`

---

## Task 4：收藏模块

**Files:**
- Create: `webui/src/storage/queryFavorites.ts`
- Modify: `webui/src/workspace/tabs/MysqlQueryTab.tsx`

- [ ] **Step 1: storage CRUD**

`queryFavorites.ts`：
```ts
const KEY = "solo_query_favorites_v1";
export type FavoriteItem = { id: string; name: string; connId?: string; db?: string; sql: string; note?: string; createdAt: number };
export function listFavorites(): FavoriteItem[] { ... }
export function addFavorite(input: Omit<FavoriteItem, "id"|"createdAt">): FavoriteItem { ... }
export function removeFavorite(id: string): void { ... }
```

- [ ] **Step 2: UI**
- “收藏当前 SQL”：Modal 输入 name/note
- “收藏列表”：Drawer 列表，支持回填/删除

---

## Task 5：导出 CSV + JSON（当前页/全部）

**Files:**
- Create: `webui/src/utils/serialize.ts`
- Create: `webui/src/utils/download.ts`
- Modify: `webui/src/workspace/tabs/MysqlQueryTab.tsx`

- [ ] **Step 1: 序列化**

`serialize.ts`：
```ts
export function rowsToJson(columns: string[], rows: any[][]): any[] { ... }
export function rowsToCsv(columns: string[], rows: any[][]): string { ... } // 处理逗号/引号/换行转义
```

- [ ] **Step 2: 下载**

`download.ts`：
```ts
export function downloadText(filename: string, text: string, mime: string): void { ... }
```

- [ ] **Step 3: Query Tab UI**
- 增加 `Dropdown`：“导出 CSV / 导出 JSON”
- 子选项：“当前页 / 全部”
  - 当前页：根据 `currentPage/pageSize` slice `tableData`
  - 全部：用 resp.rows 全量

---

## Task 6：复制增强（轻量）

**Files:**
- Modify: `webui/src/workspace/tabs/MysqlQueryTab.tsx`

- [ ] **Step 1: 单元格弹窗内增加“复制字段名/复制值”**

当前已有“复制全文”，再加：
- 复制字段名
- 复制该值（同全文）

- [ ] **Step 2: 可选：复制整行 JSON**

在 Table 行 `onRow` 里加右键菜单（可选，若时间不足可延后到迭代 2）。

---

## 验证步骤（手动）

- [ ] 后端：`curl -X POST /api/v1/mysql/{id}/test` 返回 `{ok:true, latencyMs}`
- [ ] 前端：Connections 点击“测试”有 toast
- [ ] Query Tab：执行后历史出现、可回填
- [ ] Query Tab：收藏可保存/删除/回填
- [ ] Query Tab：导出 CSV/JSON 文件可下载并内容正确

