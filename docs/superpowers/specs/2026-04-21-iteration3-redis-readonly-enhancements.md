# 迭代3：Redis 只读增强（Spec）

**日期：** 2026-04-21  
**范围：** Redis 只读增强（Keys 搜索体验 + Value JSON 自动格式化），不包含写操作

---

## 1. 目标

### 1.1 Keys 搜索体验（pattern）
1) 输入框支持回车搜索（走现有 `/api/v1/redis/{connId}/keys/search`）
2) 保存最近使用的 pattern（localStorage，去重置顶，最多 20 条）
3) 下拉快速选择最近 pattern
4) 结果列表对匹配部分做高亮（简单高亮：将 pattern 去掉 `*` 后作为关键字高亮）

### 1.2 Value 体验（JSON）
1) 自动识别 JSON（`JSON.parse` 成功即认为 JSON）
2) 自动 pretty（2 空格缩进）
3) 提供“展开/收起”切换（第一版用按钮控制显示 raw 或 pretty）
4) 复制：复制原文 / 复制格式化后 JSON

---

## 2. 非目标

- Redis 写操作（delete/expire/set 等）
- 复杂 JSON 树形折叠（后续可用专门组件）
- 服务端层面的索引/搜索优化（仍为 scan/pattern）

---

## 3. 数据存储（localStorage）

Key：`solo_redis_recent_patterns_v1`

```ts
type RecentPatternItem = { pattern: string; usedAt: number };
```

规则：
- pattern trim 后为空不记录
- 去重：相同 pattern 更新 usedAt 并置顶
- 最大 20 条

---

## 4. 验收标准

- [ ] Redis Keys 页面：回车搜索生效，最近 pattern 可见且可一键选择
- [ ] Keys 列表：高亮可用（至少对关键字部分高亮）
- [ ] Redis Key Value：JSON 自动格式化、可切换 raw/pretty、可复制 raw/pretty

