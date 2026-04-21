# UI 美化（混搭暗色）+ 连接编辑（不改密码）设计文档

**日期：** 2026-04-21  
**项目：** solo-db-client（Navicat 风格工作区已完成）  
**范围：** WebUI 样式升级 + Connections 管理增强（编辑连接）

---

## 1. 目标

1) **风格更像专业桌面工具（Navicat-ish）**，解决“单调、像后台管理”的观感问题。  
2) **混搭主题**：主工作区暗色（树、Tabs、SQL、结果表），连接管理 Drawer/Modal 保持浅色，提升表单可读性。  
3) **连接管理支持编辑**：在 Connections 列表中支持“编辑连接”并保存。  
4) **编辑密码策略**：**密码输入框留空 = 不修改密码**（不会把密码清空为 `""`）。

---

## 2. 非目标

- 不做“测试连接/导入导出/批量管理”（可后续迭代）
- 不做 Monaco 编辑器、复杂主题系统

---

## 3. UI 设计（混搭暗色）

### 3.1 工作区暗色范围
- `Workspace`（Sider Tree + Tabs + 各 Tab 内容）使用暗色主题
- 顶部 Toolbar 更紧凑、偏暗（工具栏风格）

### 3.2 Connections Drawer/Modal 浅色范围
- 仅 `Drawer` 内部使用浅色主题（AntD light algorithm）
- Drawer 以表单为主，浅色更易读、更符合用户预期

### 3.3 技术实现方式
- 全局保留一个 `ConfigProvider`
- `Workspace` 外围再套一层 `ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: ... }}` 使工作区暗色化
- `Drawer` 内容再套一层 `ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}` 强制浅色
- 增加 `webui/src/styles/theme.css`：对 body 背景、滚动条、卡片阴影、monospace editor、tree selection 做细化（避免仅靠 AntD token 不够“工具感”）

---

## 4. 功能设计：编辑连接

### 4.1 UI 交互
- Connections 表格每行增加 **编辑** 按钮
- 点击编辑：弹出 Modal（复用现有 Form，区分 mysql/redis）
- 提交：调用 `PUT /api/v1/connections/{id}`

### 4.2 密码字段策略（关键）
- 编辑时密码框默认显示空
- 若用户不填写密码（空字符串），后端应 **保留原密码**，不把密码覆盖为 `""`

### 4.3 后端兼容修改（必要）
当前后端更新逻辑为整体覆盖（允许 `body.MySQL != nil || body.Redis != nil` 时直接覆盖），会导致“密码留空=清空密码”。因此需在后端 update handler 中加入规则：
- 如果更新 mysql 且 `body.MySQL.Password == ""`，则保留原连接的 `MySQL.Password`
- 如果更新 redis 且 `body.Redis.Password == ""`，则保留原连接的 `Redis.Password`

> 注：此策略不改变存储格式（仍为 MVP 明文），仅避免误清空。

---

## 5. 验收标准（Definition of Done）

- [ ] 工作区整体呈暗色、选中/hover/分割线/背景层次更明显
- [ ] Drawer 内表单保持浅色（不受工作区暗色影响）
- [ ] Connections 列表可编辑 mysql/redis 连接并保存成功
- [ ] 编辑时密码留空不会清空密码（保存后仍能正常连接）

