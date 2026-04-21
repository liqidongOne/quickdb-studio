# 迭代2（第一部分）：表数据预览 Data Tab（Spec）

**日期：** 2026-04-21  
**范围：** 仅实现“表数据预览 Data Tab”，不包含 schema 详情与右键菜单（后续迭代2继续）

---

## 1. 目标

当用户在左侧树点击 `mysql_table` 节点时：
1) 自动打开一个新的 Tab：**Data**（表数据预览）
2) 默认 SQL：`SELECT * FROM <db>.<table> LIMIT 200;`
3) 支持手动刷新（重新执行同一 SQL）
4) 复用现有 MySQL Query 结果表格展示能力（分页、滚动、单元格查看全文等）

---

## 2. 非目标

- 不做后端分页（仍使用现有 `/mysql/{connId}/query`）
- 不做写操作（insert/update/delete）
- 不在 Data Tab 中开放 SQL 编辑（第一版只读预览）

---

## 3. UI/交互

### 3.1 Data Tab 标题
建议：`<connName>/<db>/<table> (Data)`

### 3.2 Data Tab 内容
- 顶部工具条：`Refresh` 按钮、`LIMIT` 输入（默认 200，范围 1~5000）
- 下方：结果表格（同 Query Tab 体验）

---

## 4. Workspace 联动

点击树上的表节点时：
- 仍打开/聚焦 MySQL Query Tab（保持当前行为）
- **同时**打开/聚焦 Data Tab（新行为）
  - Data Tab 唯一键：`mysql_data::{connId}::{db}::{table}`
  - 如果该表 Data Tab 已存在：聚焦并刷新 payload（例如 limit 变更）

---

## 5. 验收标准

- [ ] 点击表节点会出现 Data Tab
- [ ] Data Tab 默认展示 200 行（或更少，取决于表数据）
- [ ] Refresh 能重新拉取数据
- [ ] 结果表格交互与 Query Tab 一致（分页/滚动/查看全文）

