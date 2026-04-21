# UI 美化（混搭暗色）+ 连接编辑（不改密码）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Navicat 风格工作区引入更专业的暗色观感（混搭：工作区暗色、管理 Drawer 浅色），并在连接管理中增加“编辑连接”（密码留空不修改）。

**Architecture:** 前端以 AntD v5 `ConfigProvider` 分区主题 + 少量全局 CSS 实现暗色工作区；连接编辑复用现有 Connections 表单组件。后端仅在 `PUT /api/v1/connections/{id}` 的更新逻辑里补齐“空密码不覆盖”的合并规则。

**Tech Stack:** WebUI：React + TS + Ant Design v5；后端：Go + chi。

---

## Task 1：工作区暗色主题（混搭）

**Files:**
- Create: `webui/src/styles/theme.css`
- Modify: `webui/src/main.tsx`
- Modify: `webui/src/App.tsx`
- Modify: `webui/src/workspace/Workspace.tsx`

- [ ] **Step 1: 新增 theme.css（只改观感）**

创建 `webui/src/styles/theme.css`（示例内容，后续可细调）：
```css
html, body { height: 100%; }
body { margin: 0; background: #0b1220; }

/* 仅做轻量“工具感”：滚动条、选中态、等宽区背景等 */
::-webkit-scrollbar { height: 10px; width: 10px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 999px; }
::-webkit-scrollbar-track { background: rgba(255,255,255,.06); }
```

- [ ] **Step 2: main.tsx 引入全局 CSS**

```ts
import "./styles/theme.css";
```

- [ ] **Step 3: Workspace 区域套暗色 ConfigProvider**

在 `Workspace.tsx` 外层包：
```tsx
<ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
  ...现有 Layout/Sider/Tabs...
</ConfigProvider>
```

- [ ] **Step 4: App 里让 Drawer 保持浅色**

在 Drawer 内容再包一层：
```tsx
<ConfigProvider theme={{ algorithm: theme.defaultAlgorithm }}>
  <Connections />
</ConfigProvider>
```

- [ ] **Step 5: 手动验证**

`npm run dev` 后确认：
- 工作区暗色
- Drawer/Modal 表单浅色

---

## Task 2：Connections 支持“编辑连接”

**Files:**
- Modify: `webui/src/pages/Connections.tsx`
- Modify (如缺失): `webui/src/api/client.ts`（补 `apiPut`）

- [ ] **Step 1: 增加 apiPut（如当前缺失）**

```ts
export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}
```

- [ ] **Step 2: 表格每行增加“编辑”按钮**

在操作列添加：
- 编辑（打开 modal）
- 删除（保持现状）

- [ ] **Step 3: 编辑 Modal + 回填**

新增 state：
- `editOpen/editingConn`

打开时：
- `form.setFieldsValue(...)` 回填（密码字段不回填，保持空）

提交时：
- 组装 body（mysql/redis 结构）
- 调用：
```ts
await apiPut(`/api/v1/connections/${id}`, body);
```

---

## Task 3：后端 PUT 更新“空密码不覆盖”

**Files:**
- Modify: `internal/httpapi/handlers_connections.go`

- [ ] **Step 1: 找到待更新连接**

在 `handleUpdateConnection` 内，在覆盖前记录原连接：
```go
old := conns[i]
```

- [ ] **Step 2: 当 body.MySQL != nil 时合并密码**

```go
if body.MySQL != nil {
  if body.MySQL.Password == "" && old.MySQL != nil {
    body.MySQL.Password = old.MySQL.Password
  }
}
if body.Redis != nil {
  if body.Redis.Password == "" && old.Redis != nil {
    body.Redis.Password = old.Redis.Password
  }
}
```

然后再按现有逻辑覆盖 `conns[i].MySQL/Redis`。

- [ ] **Step 3: 手动验证**

1. 创建一个带密码的连接
2. 编辑连接，密码留空保存
3. 确认连接仍可用于 MySQL/Redis 访问（密码未被清空）

---

## 交付验收清单
- [ ] 工作区暗色更有层次（不再单调）
- [ ] Drawer 仍为浅色表单（混搭）
- [ ] Connections 支持编辑并保存
- [ ] 密码留空不覆盖（后端合并逻辑生效）

