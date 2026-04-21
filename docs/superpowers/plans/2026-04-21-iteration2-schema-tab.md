# 迭代2（第二部分）：表结构详情 Schema Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从左侧树的 Columns/Indexes 叶子节点打开 Schema Tab，展示 MySQL 表的 columns+indexes，支持搜索与复制。

**Architecture:** 新增 `MysqlSchemaTab` 组件，输入 connId/db/table + defaultActive（columns|indexes）。优先读取 TreeNode.meta.tableMeta（若存在），否则调用现有 `getTableMeta`。Workspace 新增 `mysql_schema` tab kind，并在 Tree leaf 点击时打开/聚焦该 tab。

**Tech Stack:** React + TypeScript + Ant Design。

---

## 0) 文件结构

**Create**
- `webui/src/workspace/tabs/MysqlSchemaTab.tsx`

**Modify**
- `webui/src/workspace/types.ts`
- `webui/src/workspace/Workspace.tsx`
- （可选）`webui/src/api/mysql.ts`（若需要更强类型的 meta）

---

## Task 1：新增 mysql_schema tab 类型

**Files:**
- Modify: `webui/src/workspace/types.ts`

- [ ] **Step 1: 定义 payload**

```ts
export type MysqlSchemaTabPayload = {
  connId: string;
  connName?: string;
  db: string;
  table: string;
  defaultActive: "columns" | "indexes";
  // 可选：TreePanel 已拿到的 meta，避免二次请求
  tableMeta?: import("../../api/mysql").MySQLTableMetaResp;
};
```

- [ ] **Step 2: WorkspaceTabKind 增加 mysql_schema，并扩展 WorkspaceTab union**

```ts
export type WorkspaceTabKind = ... | "mysql_schema" | ...
...
| (WorkspaceTabBase & { kind: "mysql_schema"; payload: MysqlSchemaTabPayload })
```

---

## Task 2：实现 MysqlSchemaTab 组件

**Files:**
- Create: `webui/src/workspace/tabs/MysqlSchemaTab.tsx`

- [ ] **Step 1: 基础结构**

Props 直接用 `MysqlSchemaTabPayload`。

State:
- `loading/error`
- `activeTab`（"columns"|"indexes"）
- `search`（string）
- `meta`（MySQLTableMetaResp | null）

加载逻辑：
1. 若 props.tableMeta 存在：setMeta(props.tableMeta)
2. 否则调用 `getTableMeta(connId, db, table)`

- [ ] **Step 2: 顶部工具条**

展示 Tag：
- connName/connId
- db
- table

组件：
- `<Input placeholder="搜索列/索引/注释..." allowClear />`
- Refresh Button（重新请求）

- [ ] **Step 3: Columns Tab 表格**

columns 定义（示意）：
```ts
const cols: ColumnsType<MySQLTableColumn> = [
 { title:"name", dataIndex:"name", render:(v)=> <CopyText ... /> },
 { title:"dataType", dataIndex:"dataType" },
 ...
];
```

过滤：
```ts
const q = search.trim().toLowerCase();
const filtered = meta.columns.filter(c => [c.name,c.dataType,c.columnType,c.comment].some(x=>String(x||"").toLowerCase().includes(q)));
```

- [ ] **Step 4: Indexes Tab 表格**

显示 nonUnique：
- `nonUnique=false` → Unique
- `nonUnique=true` → Non-Unique

同样支持复制 index name / columnName。

---

## Task 3：Workspace 从树叶子打开 Schema Tab

**Files:**
- Modify: `webui/src/workspace/Workspace.tsx`

- [ ] **Step 1: 在 renderTabContent 增加 mysql_schema 分支**

```tsx
if (tab.kind === "mysql_schema") return <MysqlSchemaTab {...tab.payload} />
```

- [ ] **Step 2: onTreeSelect 识别 columns/indexes leaf**

在 `onTreeSelect` 最前面加一个分支：
- 若 `node.kind === "mysql_table"` 且 `node.id` 以 `:columns` 或 `:indexes` 结尾：
  - 从 `node.id` 解析出 `connId/db/table`（也可从 meta 上取，如果 TreePanel 透传了）
  - 构造 schemaTabKey：`mysql_schema::{connId}::{db}::{table}`
  - payload.defaultActive = columns/indexes
  - 同时把 `tableMeta` 从父节点 meta（若已存在）透传给 Schema Tab

> 备注：TreePanel 当前的 leaf meta 只标记了 leaf 类型；为了拿到 connId/db/table，你可以从 node.id 解析（格式固定：`mysql_table:<connId>:<db>:<table>:columns`）。

---

## Task 4：手动验证

- [ ] 展开 MySQL 表节点后，点击 `Columns (N)` 打开 Schema Tab 且默认展示 Columns
- [ ] 点击 `Indexes (N)` 打开 Schema Tab 且默认展示 Indexes
- [ ] 搜索框可过滤
- [ ] 复制按钮工作正常

