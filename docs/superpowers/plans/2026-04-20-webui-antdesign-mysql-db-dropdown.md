# WebUI（Ant Design 美化 + MySQL 库下拉）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `webui/` 从简陋表单升级为 Ant Design 风格的统一布局，并在 MySQL 页面实现“选择连接 → 自动拉取数据库下拉 → 选库执行 SQL 默认使用该库”的体验（不再手动输入 connId/db）。

**Architecture:** 前端仅做 UI/交互增强，不改后端 API。统一在前端建立 `api` + `hooks`：加载 connections（按类型过滤）、按 connId 拉取 MySQL databases、Redis scan 翻页。UI 使用 AntD `Layout/Tabs/Form/Select/Table/Card/Alert/Tag/Modal` 组成。

**Tech Stack:** Vite + React + TS、Ant Design v5、@ant-design/icons、原有 `webui/src/api/client.ts`。

---

## 0) 文件改动范围

**Modify:**
- `webui/package.json`（增加依赖）
- `webui/src/main.tsx`（引入 AntD reset css）
- `webui/src/App.tsx`（整体 Layout + Tabs + Token bar）
- `webui/src/api/client.ts`（补充类型与通用错误展示可选）
- `webui/src/pages/Connections.tsx`（AntD Table + Modal Form + Copy connId）
- `webui/src/pages/Mysql.tsx`（连接下拉 + DB 下拉 + Query 表格）
- `webui/src/pages/Redis.tsx`（连接下拉 + Scan + More + List）

**Create:**
- `webui/src/hooks/useConnections.ts`（加载/缓存 connections）
- `webui/src/hooks/useMysqlDatabases.ts`（按 connId 获取 databases）
- `webui/src/components/CopyText.tsx`（复制按钮）
- `webui/src/components/JsonCode.tsx`（调试输出可折叠）
- `webui/src/components/PageContainer.tsx`（统一页面容器：标题/描述/右侧操作区）

---

## Task 1: 引入 Ant Design 与全局样式

**Files:**
- Modify: `webui/package.json`
- Modify: `webui/src/main.tsx`

- [ ] **Step 1: package.json 增加依赖**

在 `webui/package.json` 增加：
```json
"dependencies": {
  "antd": "^5.20.0",
  "@ant-design/icons": "^5.3.7",
  "react": "...",
  "react-dom": "..."
}
```

- [ ] **Step 2: main.tsx 引入 AntD reset**

```ts
import "antd/dist/reset.css";
```

- [ ] **Step 3: 本地验证**

Run:
```bash
cd webui
npm install
npm run dev
```
Expected：页面正常渲染，无样式错乱。

---

## Task 2: 通用 hooks 与组件（避免页面代码臃肿）

**Files:**
- Create: `webui/src/hooks/useConnections.ts`
- Create: `webui/src/hooks/useMysqlDatabases.ts`
- Create: `webui/src/components/CopyText.tsx`
- Create: `webui/src/components/PageContainer.tsx`

- [ ] **Step 1: useConnections（加载 connections + 按 type 过滤）**

实现：
- `useConnections()` 返回 `{ loading, error, connections, mysqlConnections, redisConnections, refresh }`
- 内部调用 `apiGet("/api/v1/connections")`

- [ ] **Step 2: useMysqlDatabases（connId 变化自动拉取）**

实现：
- `useMysqlDatabases(connId?: string)` 返回 `{ loading, error, databases, refresh }`
- 调用 `apiGet(/api/v1/mysql/${connId}/databases)`

- [ ] **Step 3: CopyText**

AntD `Button` + `navigator.clipboard.writeText`；复制成功用 `message.success` 提示。

- [ ] **Step 4: PageContainer**

统一 `Card` 样式：标题、描述、右侧操作区（如刷新按钮）。

---

## Task 3: App 全局布局（更像工具）

**Files:**
- Modify: `webui/src/App.tsx`

- [ ] **Step 1: 使用 AntD Layout**

结构：
- Header：logo/title + Token 输入（Input.Password）+ Save/Clear + 状态 Tag
- Content：Tabs（Connections / MySQL / Redis）

- [ ] **Step 2: Token 输入交互**
- Save：`setToken(tokenInput)`
- Clear：`clearToken()`
- 未设置 token 时显示 Warning Alert（提示接口会 401）

---

## Task 4: Connections 页面重构（Table + Modal Form）

**Files:**
- Modify: `webui/src/pages/Connections.tsx`

- [ ] **Step 1: 使用 useConnections**
- Table 数据源：connections
- Columns：Name/Type/Host/DB/ID（含 Copy 按钮）

- [ ] **Step 2: 新建连接 Modal（Form）**
- FormItem：type/name + mysql 或 redis 的字段
- submit：POST `/api/v1/connections`
- 成功后关闭 modal、refresh、message.success

- [ ] **Step 3: 删除连接（可选）**
- Popconfirm + `apiDelete(/api/v1/connections/${id})`

---

## Task 5: MySQL 页面重构（连接下拉 + 数据库下拉）

**Files:**
- Modify: `webui/src/pages/Mysql.tsx`

- [ ] **Step 1: 连接下拉**
- Select options：`mysqlConnections`（label=name，value=id）
- 选择后自动触发 `useMysqlDatabases(connId)`

- [ ] **Step 2: 数据库下拉（自动加载）**
- Select options：`databases`（来自 `/databases`）
- 默认选中：如果连接配置里有 `defaultDatabase` 且存在于列表，则默认选中；否则选择第一个库。

- [ ] **Step 3: SQL 编辑与执行**
- 编辑器：`Input.TextArea`
- 执行：POST `/api/v1/mysql/${connId}/query` body `{ sql, db: selectedDb }`

- [ ] **Step 4: 结果表格**
- 动态 columns（从 resp.columns）
- 数据映射：rows -> row objects（key: colName）
- 顶部显示：elapsedMs、truncated Tag、warnings Alert

---

## Task 6: Redis 页面重构（连接下拉 + Scan）

**Files:**
- Modify: `webui/src/pages/Redis.tsx`

- [ ] **Step 1: 连接下拉**
- Select options：`redisConnections`

- [ ] **Step 2: Scan 表单与分页**
- pattern Input、count InputNumber
- Scan(reset)：cursor=0；More：cursor=nextCursor
- 展示：List / Table（key 列表），上方显示 cursor/nextCursor

---

## 验证清单

- [ ] `npm run dev` 正常启动，无控制台报错
- [ ] Connections 能创建 mysql/redis 连接，列表正常渲染，能复制 connId
- [ ] MySQL：选择连接后能自动加载 databases 下拉；执行 SQL 默认带 db
- [ ] Redis：选择连接后 scan 正常，More 正常追加 keys

---

## 执行交接（你已选择 Subagent-Driven）

计划写完后将按 Task 逐个派发子代理实现；每个 Task 完成后我会 review 并让你在本机执行 `npm run dev` 快速验证再继续。

