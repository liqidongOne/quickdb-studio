# 迭代 1：查询体验 + 连接/安全体验（Spec）

**日期：** 2026-04-21  
**项目：** solo-db-client（Navicat 风格工作区）  
**范围：** 仅实现迭代 1（查询体验 + 连接/安全），Redis 继续只读，导出支持 CSV + JSON

---

## 1. 目标（Goals）

### 1.1 查询体验（MySQL Query Tab）
1) **查询历史**：按 `connId + db` 维度记录最近 N 条 SQL（默认 50）。  
2) **收藏 SQL**：可将 SQL 保存为收藏（带 name/备注，可一键回填）。  
3) **导出结果**：支持导出 **CSV** 与 **JSON**（当前页 / 全部）。  
4) **复制增强**：复制单元格文本、复制整行 JSON（可选）、复制表头（可选）。  

### 1.2 连接/安全体验
5) **测试连接**：在 Connections 管理中提供“测试连接”（MySQL ping / Redis ping）。  
6) **Token 体验**：401/403 时友好引导（已做基础），补齐：在 Query 执行失败时也显示“可能 token 失效”的指示与“去设置 Token”。  
7) **连接标签/分组（可选）**：如时间允许，在连接模型上增加 `tags: string[]`，左侧树按 tag 分组展示。

---

## 2. 非目标（Non-goals）

- Redis 写操作（delete/ttl 修改等）——保持只读  
- Monaco 编辑器/智能提示  
- 服务端分页（第一版先做前端分页 + 导出）

---

## 3. 数据存储（前端本地）

### 3.1 查询历史 localStorage
Key：`solo_query_history_v1`

结构：
```ts
type QueryHistoryItem = {
  id: string;           // stable id
  connId: string;
  db: string;
  sql: string;
  createdAt: number;    // ms
};
```

规则：
- 同 connId+db 下重复 SQL（trim 后相同）则“置顶更新时间”（去重）
- 最大 50 条（超出截断）

### 3.2 收藏 localStorage
Key：`solo_query_favorites_v1`

结构：
```ts
type FavoriteItem = {
  id: string;
  name: string;
  connId?: string;  // 可选：绑定到连接/库，也可全局
  db?: string;
  sql: string;
  note?: string;
  createdAt: number;
};
```

---

## 4. API 设计（后端新增）

### 4.1 测试连接
#### MySQL
`POST /api/v1/mysql/{connId}/test`

响应：
```json
{ "ok": true, "latencyMs": 12 }
```

#### Redis
`POST /api/v1/redis/{connId}/test`

响应同上。

> 说明：测试应包含鉴权（Bearer Token）与超时（例如 5s）。

---

## 5. UI/交互

### 5.1 MySQL Query Tab 右侧/上方工具区
- 历史：Button 打开 Drawer（或 Popover）显示列表，点击回填
- 收藏：Button 打开收藏列表；当前 SQL 可“一键收藏”（弹窗输入 name/note）
- 导出：下拉菜单（CSV/JSON + 当前页/全部）

### 5.2 Connections 管理
表格每行新增：
- 测试（loading 状态 + 成功/失败提示）
- 编辑（已做）
- 删除（已做）

---

## 6. 验收标准（DoD）

- [ ] MySQL Query Tab：执行查询后可导出 CSV/JSON（当前页/全部）
- [ ] MySQL Query Tab：历史与收藏可用（可回填）
- [ ] Connections：MySQL/Redis 测试连接可用，失败有明确错误
- [ ] Token 失效时：不会出现吓人的错误栈；有友好提示与引导

