# 批量增强（Redis + MySQL DDL）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一次性完成：Redis 最近 pattern 管理、Keys 高亮增强、list JSON 弹窗，以及 MySQL Schema Tab 的 SHOW CREATE TABLE（DDL）展示与复制。

**Architecture:** Redis 侧继续复用现有 KeysTab/KeyTab，并扩展 `redisRecentPatterns` 的数据结构（支持 pinned/删除/清空）。MySQL 侧在 `MysqlSchemaTab` 增加 DDL 子 Tab，通过现有 `/mysql/{connId}/query` 执行 `SHOW CREATE TABLE`，无需新增后端接口。

**Tech Stack:** React + TypeScript + Ant Design。

---

## Task 1：Redis 最近 pattern 管理

**Files:**
- Modify: `webui/src/storage/redisRecentPatterns.ts`
- Modify: `webui/src/workspace/tabs/RedisKeysTab.tsx`

- [ ] **Step 1: storage 支持 pinned/删除/清空**
- [ ] **Step 2: UI 增加清空/删除/置顶收藏**

---

## Task 2：Keys 高亮增强（多处匹配）

**Files:**
- Modify: `webui/src/workspace/tabs/RedisKeysTab.tsx`

- [ ] **Step 1: 高亮函数支持多处命中**

---

## Task 3：list 也支持 JSON 弹窗（复用现有弹窗）

**Files:**
- Modify: `webui/src/workspace/tabs/RedisKeyTab.tsx`

- [ ] **Step 1: list value 点击打开 valueModal**

---

## Task 4：MySQL Schema Tab 增加 DDL 子 Tab

**Files:**
- Modify: `webui/src/workspace/tabs/MysqlSchemaTab.tsx`

- [ ] **Step 1: DDL 状态与加载逻辑（SHOW CREATE TABLE）**
- [ ] **Step 2: DDL 展示 + 复制 + 刷新**

---

## 验证

- [ ] Redis Keys：最近 pattern 可 pin/删除/清空
- [ ] Redis Keys：高亮多处命中
- [ ] Redis list：value 点击弹窗，JSON 可格式化/复制
- [ ] MySQL Schema：DDL 子 Tab 能看到 SHOW CREATE TABLE，并可复制

