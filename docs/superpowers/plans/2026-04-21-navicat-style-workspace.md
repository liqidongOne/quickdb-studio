# Navicat 风格工作区（分组树 + 多 Tab + Schema/Key 预览）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 solo-db-client 从 “三页 Tabs” 升级为 Navicat 风格：左侧分组资源树（MySQL/Redis）+ 右侧多 Tab 工作区（MySQL 查询上下分栏、Redis keys 列表与 key 预览），并在后端增加聚合接口减少请求次数。

**Architecture:** 后端新增 `nav`、MySQL table meta、Redis keys search 与 key preview 聚合 API（保持只读与鉴权）；前端引入 workspace 状态（tabs + tree selection），用 Ant Design `Layout/Sider/Tree/Tabs/Splitter`（或可替代实现）构建两栏布局，并将原 Connections 管理迁移为 Drawer/Modal 入口。

**Tech Stack:** Go + chi、MySQL driver、go-redis/v9；WebUI：Vite + React + TS + Ant Design v5。

---

## 0) 文件结构与职责（锁定分层）

### 后端（Go）
**Create**
- `internal/httpapi/handlers_nav.go`：`GET /api/v1/nav/tree`
- `internal/httpapi/handlers_mysql_meta.go`：`GET /api/v1/mysql/{connId}/table/meta`
- `internal/httpapi/handlers_redis_preview.go`：`POST /api/v1/redis/{connId}/keys/search`、`GET /api/v1/redis/{connId}/key/preview`
- `internal/model/nav.go`：导航树返回结构
- `internal/model/mysql_meta.go`：表 meta 返回结构（columns/indexes）
- `internal/model/redis_preview.go`：key preview 返回结构（meta+data）

**Modify**
- `internal/httpapi/router.go`：挂载新路由
- `internal/httpapi/handlers_mysql.go`：抽取/复用 columns/indexes 逻辑（如已实现 table 查询）
- `internal/redix/readers.go`：确保各读取函数返回结构满足 preview 所需（如缺少结构体类型则补齐）

### 前端（webui）
**Create**
- `webui/src/workspace/types.ts`：TreeNode/Tab 模型
- `webui/src/workspace/state.ts`：tabs reducer（open/focus/close/update）
- `webui/src/workspace/Workspace.tsx`：主工作区（Sider Tree + Tabs）
- `webui/src/workspace/TreePanel.tsx`：左侧树（lazy load）
- `webui/src/workspace/tabs/MysqlQueryTab.tsx`：上 SQL 下 Result
- `webui/src/workspace/tabs/RedisKeysTab.tsx`：pattern/scan/more + keys 列表
- `webui/src/workspace/tabs/RedisKeyTab.tsx`：meta + 值预览
- `webui/src/api/nav.ts`：封装新 nav API
- `webui/src/api/mysql.ts`：封装 mysql meta/query/schema API
- `webui/src/api/redis.ts`：封装 redis search/preview API

**Modify**
- `webui/src/App.tsx`：入口从 Tabs 改为 Workspace（Token bar 继续保留在顶部）
- `webui/src/pages/Connections.tsx`：改成可嵌入式组件（供 Drawer/Modal 使用）

---

## Task 1: 后端新增 Nav Tree API（/api/v1/nav/tree）

**Files:**
- Create: `internal/model/nav.go`
- Create: `internal/httpapi/handlers_nav.go`
- Modify: `internal/httpapi/router.go`

- [ ] **Step 1: 定义返回结构**

`internal/model/nav.go`：
```go
package model

type NavConn struct {
	ID   string   `json:"id"`
	Name string   `json:"name"`
	Type ConnType `json:"type"`
}

type NavTreeResp struct {
	MySQL []NavConn `json:"mysql"`
	Redis []NavConn `json:"redis"`
}
```

- [ ] **Step 2: 实现 handler**

`internal/httpapi/handlers_nav.go`：
```go
package httpapi

import (
	"net/http"

	"solo-db-client/internal/model"
)

func (r *Router) handleNavTree(w http.ResponseWriter, req *http.Request) {
	conns, err := r.store.LoadConnections()
	if err != nil {
		writeJSON(w, 500, model.ErrorResp{Error: "storage_error", Details: err.Error()})
		return
	}
	out := model.NavTreeResp{}
	for _, c := range conns {
		n := model.NavConn{ID: c.ID, Name: c.Name, Type: c.Type}
		switch c.Type {
		case model.ConnTypeMySQL:
			out.MySQL = append(out.MySQL, n)
		case model.ConnTypeRedis:
			out.Redis = append(out.Redis, n)
		}
	}
	writeJSON(w, 200, out)
}
```

- [ ] **Step 3: 路由挂载**

在 `internal/httpapi/router.go` 的 secure group 中加入：
```go
secure.Get("/nav/tree", r.handleNavTree)
```

- [ ] **Step 4: 手动验证**

```bash
curl -H "Authorization: Bearer <TOKEN>" http://127.0.0.1:17890/api/v1/nav/tree
```

---

## Task 2: 后端 MySQL Table Meta API（columns + indexes）

**Files:**
- Create: `internal/model/mysql_meta.go`
- Create: `internal/httpapi/handlers_mysql_meta.go`
- Modify: `internal/httpapi/router.go`

- [ ] **Step 1: 定义返回结构**

`internal/model/mysql_meta.go`：
```go
package model

import "solo-db-client/internal/mysqlx"

type MySQLTableMetaResp struct {
	DB      string          `json:"db"`
	Table   string          `json:"table"`
	Columns []mysqlx.TableColumn `json:"columns"`
	Indexes []mysqlx.TableIndex  `json:"indexes"`
}
```

> 说明：复用 `internal/mysqlx/schema.go` 中的结构体（若命名不同，请以实际代码为准并保持 json tag）。

- [ ] **Step 2: 实现 handler**

`internal/httpapi/handlers_mysql_meta.go`：
```go
package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"solo-db-client/internal/model"
	"solo-db-client/internal/mysqlx"
)

func (r *Router) handleMySQLTableMeta(w http.ResponseWriter, req *http.Request) {
	connID := chi.URLParam(req, "connId")
	dbName := req.URL.Query().Get("db")
	table := req.URL.Query().Get("table")
	if dbName == "" || table == "" {
		writeJSON(w, 400, model.ErrorResp{Error: "bad_request", Details: "missing db/table"})
		return
	}
	conn, err := loadConn(r.store, connID, model.ConnTypeMySQL)
	if err != nil {
		writeJSON(w, 400, model.ErrorResp{Error: "bad_connection", Details: err.Error()})
		return
	}

	cfg := *conn.MySQL
	cfg.DefaultDatabase = dbName
	db, err := mysqlx.Open(cfg)
	if err != nil { writeJSON(w, 500, model.ErrorResp{Error:"mysql_open_failed", Details: err.Error()}); return }
	defer db.Close()

	ctx, cancel := context.WithTimeout(req.Context(), 10*time.Second)
	defer cancel()

	cols, err := mysqlx.GetTableColumns(ctx, db, dbName, table)
	if err != nil { writeJSON(w, 500, model.ErrorResp{Error:"mysql_query_failed", Details: err.Error()}); return }
	idxs, err := mysqlx.GetTableIndexes(ctx, db, dbName, table)
	if err != nil { writeJSON(w, 500, model.ErrorResp{Error:"mysql_query_failed", Details: err.Error()}); return }

	writeJSON(w, 200, model.MySQLTableMetaResp{DB: dbName, Table: table, Columns: cols, Indexes: idxs})
}
```

- [ ] **Step 3: 路由挂载**

在 `internal/httpapi/router.go` 的 MySQL route 下加入：
```go
mysql.Get("/table/meta", r.handleMySQLTableMeta)
```

- [ ] **Step 4: 手动验证**

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  "http://127.0.0.1:17890/api/v1/mysql/<CONN_ID>/table/meta?db=<DB>&table=<TABLE>"
```

---

## Task 3: 后端 Redis Keys Search + Key Preview 聚合 API

**Files:**
- Create: `internal/model/redis_preview.go`
- Create: `internal/httpapi/handlers_redis_preview.go`
- Modify: `internal/httpapi/router.go`

- [ ] **Step 1: 定义返回结构**

`internal/model/redis_preview.go`：
```go
package model

import "solo-db-client/internal/redix"

type RedisKeyPreviewResp struct {
	Key   string `json:"key"`
	Type  string `json:"type"`
	TTLMS int64  `json:"ttlMs"`
	Data  any    `json:"data"`
}

type RedisStringData struct {
	Value     string `json:"value"`
	Truncated bool   `json:"truncated"`
}

type RedisHashData struct {
	Items      []redix.HashEntry `json:"items"`
	NextCursor string           `json:"nextCursor"`
}

type RedisSetData struct {
	Members    []string `json:"members"`
	NextCursor string   `json:"nextCursor"`
}

type RedisZSetData struct {
	Items      []redix.ZSetEntry `json:"items"`
	NextCursor string           `json:"nextCursor"`
}

type RedisListData struct {
	Items []string `json:"items"`
}
```

- [ ] **Step 2: keys/search（语义化 scan）**

在 `internal/httpapi/handlers_redis_preview.go` 中实现：
```go
type redisKeysSearchReq struct {
	Pattern string `json:"pattern"`
	Cursor  string `json:"cursor"`
	Count   int64  `json:"count"`
}

type redisKeysSearchResp struct {
	Keys       []string `json:"keys"`
	NextCursor string   `json:"nextCursor"`
}
```
内部调用现有 `redix.ScanKeys`，并把 cursor 统一成字符串。

- [ ] **Step 3: key/preview（meta + value 聚合）**

实现 `GET /key/preview`：
- 先取 `key` 参数
- `KeyMeta` 得到 type + ttl
- switch type：
  - string：`GetString(maxBytes=64KB)`
  - hash：`HScan(cursor,count)`
  - set：`SScan(cursor,count)`
  - zset：`ZScan(cursor,count)`
  - list：`LRange(start,stop)`（start/stop query 参数；默认 0..99）
- 统一输出 `model.RedisKeyPreviewResp{..., Data: ...}`

- [ ] **Step 4: 路由挂载**

在 `internal/httpapi/router.go` 的 redis route 下加入：
```go
rd.Post("/keys/search", r.handleRedisKeysSearch)
rd.Get("/key/preview", r.handleRedisKeyPreview)
```

- [ ] **Step 5: 手动验证**

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  -X POST "http://127.0.0.1:17890/api/v1/redis/<CONN_ID>/keys/search" \
  -d '{"pattern":"*","cursor":"0","count":200}'

curl -H "Authorization: Bearer <TOKEN>" \
  "http://127.0.0.1:17890/api/v1/redis/<CONN_ID>/key/preview?key=<KEY>"
```

---

## Task 4: 前端 Workspace 状态与骨架（左树 + 多 Tabs）

**Files:**
- Create: `webui/src/workspace/types.ts`
- Create: `webui/src/workspace/state.ts`
- Create: `webui/src/workspace/Workspace.tsx`
- Create: `webui/src/workspace/TreePanel.tsx`
- Modify: `webui/src/App.tsx`

- [ ] **Step 1: 定义类型**

`webui/src/workspace/types.ts`：
```ts
export type TreeNodeKind =
  | "group_mysql"
  | "group_redis"
  | "mysql_conn"
  | "mysql_db"
  | "mysql_table"
  | "redis_conn"
  | "redis_keys_root";

export type TreeNode = {
  key: string;
  kind: TreeNodeKind;
  title: string;
  isLeaf?: boolean;
  children?: TreeNode[];
  meta?: Record<string, any>;
};

export type WorkspaceTab =
  | { id: string; type: "mysql_query"; title: string; connId: string; db?: string; sql: string }
  | { id: string; type: "redis_keys"; title: string; connId: string; pattern: string; cursor: string; keys: string[]; nextCursor: string }
  | { id: string; type: "redis_key"; title: string; connId: string; key: string };
```

- [ ] **Step 2: tabs reducer**

`webui/src/workspace/state.ts` 提供：
- `openOrFocusTab(tabs, newTab)`：如 id 已存在则 focus，否则 push
- `closeTab(tabs, id)`：返回新 tabs 与 nextActiveId
- `updateTab(tabs, id, patch)`

- [ ] **Step 3: Workspace 组件**

`Workspace.tsx`：
- AntD `Layout`：`Sider` 放 TreePanel；`Content` 放 `Tabs`（editable-card）
- `activeKey` 由 state 管理
- `onEdit` 实现关闭 tab

- [ ] **Step 4: App.tsx 改造**

保留现有 Token bar（Header），Content 从原 Tabs 三页改为渲染 `<Workspace />`。

---

## Task 5: 前端 TreePanel（lazy load：conn->db->table->meta）

**Files:**
- Create: `webui/src/api/nav.ts`
- Create: `webui/src/api/mysql.ts`
- Create: `webui/src/api/redis.ts`
- Modify: `webui/src/workspace/TreePanel.tsx`

- [ ] **Step 1: api 封装**

`api/nav.ts`：`getNavTree(): Promise<{mysql: {id,name}[], redis: {id,name}[]}>`

`api/mysql.ts`：
- `listDatabases(connId)`
- `listTables(connId, db)`
- `getTableMeta(connId, db, table)`

`api/redis.ts`：
- `keysSearch(connId, {pattern,cursor,count})`
- `keyPreview(connId, params)`

- [ ] **Step 2: Tree 初始节点**

TreePanel 首次加载调用 `/api/v1/nav/tree`，构造两组根节点（MySQL/Redis）。

- [ ] **Step 3: onLoadData（展开加载）**

AntD Tree `loadData`：
- 展开 mysql_conn：加载 databases，并作为子节点
- 展开 mysql_db：加载 tables，并作为子节点
- 展开 mysql_table：加载 table/meta，生成两个子叶子节点：Columns、Indexes（把 meta 放 node.meta，供右侧 tab 使用）

Redis conn 下只放一个 Keys 子节点（leaf=false，点击打开 tab）。

---

## Task 6: MySQL Query Tab（上下分栏：SQL / Result）

**Files:**
- Create: `webui/src/workspace/tabs/MysqlQueryTab.tsx`
- Modify: `webui/src/workspace/Workspace.tsx`（按 tab.type 渲染）

- [ ] **Step 1: Tab UI**

使用 AntD `Card` + `Input.TextArea` + `Button` + `Table`。

- [ ] **Step 2: 执行 query**

调用现有：
`POST /api/v1/mysql/{connId}/query` body `{sql, db}`。

- [ ] **Step 3: 与树联动**

当用户点击 table 节点：
- open/focus 对应 mysql_query tab（id = `mysql:${connId}:${db}`）
- 注入 sql 模板：`SELECT * FROM ${db}.${table} LIMIT 200;`

---

## Task 7: Redis Keys Tab + Redis Key Tab

**Files:**
- Create: `webui/src/workspace/tabs/RedisKeysTab.tsx`
- Create: `webui/src/workspace/tabs/RedisKeyTab.tsx`
- Modify: `webui/src/workspace/Workspace.tsx`

- [ ] **Step 1: Keys Tab**
- pattern 输入 + Scan(reset)/More(append)
- 调用 `POST /redis/{connId}/keys/search`
- keys 用 `List` 展示
- 点击某个 key：openOrFocus `redis_key` tab（id = `redis:${connId}:${key}`）

- [ ] **Step 2: Key Tab**
- 调用 `GET /redis/{connId}/key/preview?...`
- 按 type 渲染不同内容（string/hash/list/set/zset），并支持 hash/set/zset 的 cursor 翻页（调用 preview 带 cursor/count）

---

## Task 8: Connections 管理入口迁移（Toolbar Drawer）

**Files:**
- Modify: `webui/src/pages/Connections.tsx`（确保可嵌入）
- Modify: `webui/src/App.tsx`（Toolbar 增加“管理连接”）

- [ ] **Step 1: Drawer**

Toolbar 增加按钮 “管理连接”，打开 `Drawer`，Drawer body 渲染 `Connections` 组件。

---

## 验证清单（手动）

- [ ] 后端新增 API 均要求 Bearer Token，返回 JSON 正确
- [ ] 左侧树可按需展开（conn->db->table->meta），无明显卡顿
- [ ] 点击 table 自动打开 MySQL 查询 tab 并填充 SQL 模板
- [ ] Redis Keys tab 可搜索+分页，点击 key 打开预览 tab
- [ ] 预览 tab 能显示不同类型，并支持分页参数

---

## 执行方式

你已选择 Subagent-Driven：接下来我会按 Task 1→8 逐个派发子代理实现并在每个 Task 完成后 review，再进入下一 Task。

