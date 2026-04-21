# 迭代2（第一部分）：表数据预览 Data Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 点击左侧 MySQL 表节点时自动打开 Data Tab，以只读方式预览 `SELECT * LIMIT N` 的结果，并复用现有结果表格体验。

**Architecture:** 新增 `MysqlDataTab` 组件：内部复用 `MysqlQueryTab` 的“结果表格渲染模块”（抽取为可复用组件），或在 Data Tab 内调用同一套 Table 展示逻辑。Workspace 在点击表节点时同时 openOrFocus `mysql_data` Tab。

**Tech Stack:** React + TS + Ant Design。

---

## 0) 文件结构

**Create**
- `webui/src/workspace/tabs/MysqlDataTab.tsx`

**Modify**
- `webui/src/workspace/types.ts`：增加 `mysql_data` kind + payload 类型
- `webui/src/workspace/Workspace.tsx`：点击表节点时打开 Data Tab；渲染 mysql_data tab
- （可选）`webui/src/workspace/tabs/mysqlResultTable.tsx`：把 Query Tab 的表格展示抽出来复用

---

## Task 1：定义 mysql_data tab 类型

**Files:**
- Modify: `webui/src/workspace/types.ts`

- [ ] **Step 1: 新增 payload 类型**

```ts
export type MysqlDataTabPayload = {
  connId: string;
  connName?: string;
  db: string;
  table: string;
  limit: number;
};
```

- [ ] **Step 2: 扩展 WorkspaceTabKind 与 WorkspaceTab union**

```ts
export type WorkspaceTabKind = ... | "mysql_data" | ...
...
| (WorkspaceTabBase & { kind: "mysql_data"; payload: MysqlDataTabPayload })
```

---

## Task 2：新增 MysqlDataTab 组件

**Files:**
- Create: `webui/src/workspace/tabs/MysqlDataTab.tsx`

- [ ] **Step 1: 基本 UI**

Props:
```ts
type Props = MysqlDataTabPayload
```

UI:
- 顶部：Tag(connName/connId、db、table)、InputNumber(limit)、Refresh Button
- 内容：调用 `/api/v1/mysql/{connId}/query`（SQL=`SELECT * FROM db.table LIMIT N`）
- 展示：复用 Query Tab 的 Table 展示设置（分页、滚动、点击单元格弹窗）

---

## Task 3：Workspace 联动与渲染

**Files:**
- Modify: `webui/src/workspace/Workspace.tsx`

- [ ] **Step 1: 点击 mysql_table 时同时 open mysql_data**

构造 tabKey：
```ts
const tabKey = `mysql_data::${connId}::${db}::${table}`;
```

- [ ] **Step 2: renderTabContent 增加 mysql_data 分支**

```tsx
if (tab.kind === "mysql_data") return <MysqlDataTab {...tab.payload} />
```

---

## Task 4：手动验证

- [ ] 点击表节点：出现 Query Tab + Data Tab
- [ ] Data Tab 显示 200 行（默认）并可调整 limit 后 refresh
- [ ] 单元格点击弹窗、分页、滚动都正常

