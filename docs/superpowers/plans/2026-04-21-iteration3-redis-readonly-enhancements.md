# 迭代3：Redis 只读增强（Keys 搜索 + Value JSON）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升 Redis 只读体验：Keys 搜索支持最近 pattern 与高亮；Value 自动识别 JSON 并提供格式化/复制。

**Architecture:** 前端增加 `storage/redisRecentPatterns.ts` 封装 localStorage。`RedisKeysTab` 负责写入/展示最近 pattern，并在列表渲染时高亮关键字。`RedisKeyTab`（以及预览组件若存在）在展示 string/preview 时增加 JSON 检测与 pretty/raw 切换及复制按钮。

**Tech Stack:** React + TypeScript + Ant Design。

---

## 0) 文件结构

**Create**
- `webui/src/storage/redisRecentPatterns.ts`

**Modify**
- `webui/src/workspace/tabs/RedisKeysTab.tsx`
- `webui/src/workspace/tabs/RedisKeyTab.tsx`

---

## Task 1：最近 pattern 存储模块

**Files:**
- Create: `webui/src/storage/redisRecentPatterns.ts`

- [ ] **Step 1: 实现 list/push API**

```ts
export type RecentPatternItem = { pattern: string; usedAt: number };
export function listRecentPatterns(): RecentPatternItem[];
export function pushRecentPattern(pattern: string): RecentPatternItem[];
```

规则：trim、去重置顶、最多 20 条。

---

## Task 2：RedisKeysTab 增强（回车搜索 + 最近 pattern 下拉）

**Files:**
- Modify: `webui/src/workspace/tabs/RedisKeysTab.tsx`

- [ ] **Step 1: 接入最近 pattern**
- [ ] **Step 2: 输入框 Enter 触发搜索，并 pushRecentPattern**
- [ ] **Step 3: 增加 Dropdown/Select 展示最近 pattern，点击回填并立即搜索**

---

## Task 3：Keys 列表高亮

**Files:**
- Modify: `webui/src/workspace/tabs/RedisKeysTab.tsx`

- [ ] **Step 1: 关键字提取**

```ts
function keywordFromPattern(p: string): string {
  return p.replace(/\*/g, "").trim();
}
```

- [ ] **Step 2: 渲染高亮**

将 key 文本中包含 keyword 的部分用 `<mark>`（或 Typography.Text + style）高亮。

---

## Task 4：RedisKeyTab JSON 自动格式化 + 复制

**Files:**
- Modify: `webui/src/workspace/tabs/RedisKeyTab.tsx`

- [ ] **Step 1: JSON 检测与 pretty**

```ts
function tryPrettyJson(raw: string): { ok: boolean; pretty?: string } { ... }
```

- [ ] **Step 2: UI 增加 raw/pretty 切换与复制按钮**
- [ ] **Step 3: 非 JSON 保持原样展示**

---

## 手动验证

- [ ] Redis Keys：输入 `user:*` 回车 → 列表更新；最近 pattern 出现且可再次点选
- [ ] Keys 列表关键字高亮可见
- [ ] Redis Key：JSON value 自动 pretty；可复制 raw/pretty

