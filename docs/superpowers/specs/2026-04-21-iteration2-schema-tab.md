# 迭代2（第二部分）：表结构详情 Schema Tab（Spec）

**日期：** 2026-04-21  
**范围：** MySQL 表结构详情（Columns + Indexes），不包含 DDL（SHOW CREATE TABLE）与复杂右键菜单（后续再做）

---

## 1. 目标

当用户在左侧树查看 MySQL 表时，能够打开一个专门的 **Schema Tab** 来查看并检索：
- **Columns**：列名、类型、是否可空、默认值、extra、comment 等
- **Indexes**：索引名、是否唯一、序号、列名、索引类型、comment 等

并支持：
1) 搜索过滤（Columns：name/comment/type；Indexes：name/column/type/comment）
2) 一键复制（复制列名 / 复制索引名 / 复制索引列名）

---

## 2. 入口与交互

### 2.1 入口
左侧树 `mysql_table` 节点展开后已有两个叶子：
- `Columns (N)`
- `Indexes (N)`

交互：
- **左键点击 Columns/Indexes 叶子节点** → 打开/聚焦 `Schema Tab`

### 2.2 Tab 行为
- `Schema Tab` 唯一键：`mysql_schema::{connId}::{db}::{table}`
- 如果该 Tab 已存在：直接聚焦并更新 payload（例如 connName 更新）
- 打开 Schema Tab 时默认选中：
  - 点击 Columns 叶子 → 默认切到 Columns 子 Tab
  - 点击 Indexes 叶子 → 默认切到 Indexes 子 Tab

---

## 3. 数据来源

复用后端已有接口：
`GET /api/v1/mysql/{connId}/table/meta?db=<db>&table=<table>`

### 3.1 复用 tree 缓存（可选优化）
TreePanel 在展开 table 时已获取 `tableMeta` 并挂在 node.meta 上：
- Schema Tab 打开时若 meta 内含 `tableMeta`：优先使用
- 否则再请求一次接口

---

## 4. UI 设计

### 4.1 页面结构
- 顶部：连接/db/table Tag + 搜索框 + 刷新按钮
- 主体：AntD Tabs（Columns / Indexes）

### 4.2 Columns 表格字段
- name（可复制）
- dataType
- columnType
- isNullable
- defaultValue
- extra
- columnKey
- ordinalPosition
- comment

### 4.3 Indexes 表格字段
- name（可复制）
- nonUnique（显示 Unique/Non-Unique）
- seqInIndex
- columnName（可复制）
- indexType
- comment

---

## 5. 验收标准（DoD）

- [ ] 点击 Columns/Indexes 叶子节点会打开 Schema Tab
- [ ] Schema Tab 可搜索过滤
- [ ] Columns/Indexes 表格可以复制关键字段
- [ ] 刷新可重新拉取元数据

