# 事件系统实施计划

> 给下一轮对话里的 Claude 看的工作文档。记录设计决策、当前进度、三个阶段的实施内容。
> 每阶段完成后更新"当前进度"一节。

---

## 背景与设计决策

### 世界书 vs 事件系统的分工

**世界书（Worldbook）** = 被动上下文注入工具
- 关键词触发 / 常驻
- 无状态（只有启用/禁用）
- 效果：把文本塞进 prompt 特定位置
- 也用于存储静态信息（如大富翁棋盘内容）

**事件系统（Events）** = 主动剧情引擎
- 有状态机：locked → pending → active → completed
- 两层条件：解锁条件（静态前置）+ 触发条件（动态：数值/时间/关键词等）
- 效果多样：注入文本、改数值、设标记、触发/解锁/锁定其他事件
- 事件链：通过 event_connections 表连接
- 冷却机制：时间/轮次维度

两者不重叠，世界书做简单的，事件系统做复杂的高级功能。

### 事件书（Event Book）

作者用"事件书"作为组织容器，可以：
- 把一套剧情线写一本书
- 把一套随机事件写一本书
- 按任意主题组织

Scope：
- `global` — 通用书，不绑定角色，所有角色都能用（适合随机事件池）
- `character` — 角色专属书，绑定单个角色（适合剧情线）

### worldbook_event_entries 的去向

`worldbook_event_entries` 是上一轮的过渡实现（挂在世界书下的事件池），
应迁移到正式事件系统的 `events` 表：
- `eventType: 'random'` → `repeatable=1, triggerConditions=null`
- `eventType: 'conditional'` → `repeatable=1, triggerConditions=JSON({conditionStat/Op/Value})`
- `weight` 字段迁移到 `events.weight`（新增字段）
- 迁移后删除 `worldbook_event_entries` 表和相关代码

### events 表补充 weight 字段

原设计文档没有 weight，但生活模拟需要加权随机选取：
- `probability`：条件满足后的触发概率（0-100）
- `weight`：加权随机时的权重（生活模拟池选取用）

两者共存，语义不同。

---

## 目标表结构

### event_books（新增）

```
id           TEXT PK           如 "book_mainline_1"
name         TEXT NOT NULL     书名，如"主线剧情一"
description  TEXT              描述
scope        TEXT NOT NULL     'global' | 'character'
characterId  TEXT              scope='character' 时必填，绑定的角色 id
enabled      INTEGER DEFAULT 1
priority     INTEGER DEFAULT 0 同优先级时，高 priority 的书先被检查
createdAt    TEXT NOT NULL
updatedAt    TEXT
```

### events（修改：加 bookId + weight，characterId 改为可空）

在现有 events 表基础上：
- 新增 `bookId TEXT REFERENCES event_books(id)`（CASCADE DELETE）
- 新增 `weight INTEGER DEFAULT 100`（加权随机用）
- `characterId` 改为可空（global 书里的事件 characterId 可为 null）

其余字段不变（见 server/db/schema.ts 现有定义）。

### 其他表不变

`event_tags`, `event_connections`, `condition_subscriptions`, `pending_injections`
均已实现，结构不需要改动。

---

## 三个实施阶段

### 阶段一：数据层（当前待做）

**目标：** 建表、迁移、CRUD 接口更新。不涉及触发引擎。

任务：
1. `server/db/schema.ts`
   - 新增 `eventBooks` 表定义
   - `events` 表加 `bookId`, `weight`，`characterId` 改可空

2. `server/db/database.ts`
   - 在 `initDrizzleTables()` 中加 `event_books` 表的 CREATE IF NOT EXISTS
   - 加 `ALTER TABLE events ADD COLUMN book_id` / `weight` 的兼容 SQL（如果列不存在则 ADD）

3. `server/db/migrate.ts`
   - 新增 `migrateWorldbookEventEntries(db)` 函数
   - 把 `worldbook_event_entries` 的数据迁入 `events`
     - 每个来源 worldbook 创建对应的 event_book（scope 继承 worldbook 的 scope/boundId）
     - random → `repeatable=1, triggerConditions=null, weight=entry.weight`
     - conditional → `repeatable=1, triggerConditions=JSON, weight=entry.weight`
   - 迁移完成后不删表（保留旧表，等稳定后再删）

4. `server/services/events.ts`
   - 新增 `eventBooks` CRUD（getAllBooks, getBookById, createBook, updateBook, deleteBook）
   - `createEvent` / `updateEvent` 加 `bookId`, `weight` 参数
   - `getEventsByCharacter` 改为支持：按 charId 找所有相关事件（直属 + 所属 global 书）
   - 新增 `getEventPool(charId)` — 查 repeatable 事件池（供生活模拟用，替换 getEventPoolEntries）

5. `server/routes/events.ts`
   - 新增 event_books 的 CRUD 路由（`/api/event-books/*`）
   - `GET /api/events/:charId` 逻辑更新（加 bookId 过滤参数可选）
   - 新增 `GET /api/events/pool/:charId`（事件池，供生活模拟）

6. `server/routes/life.ts` + `server/services/charSystem.ts`
   - 把 `getEventPoolEntries(charId)` 替换为 `getEventPool(charId)`
   - 字段名适配：`e.memo` → `e.name`，flat condition → JSON triggerConditions

7. `server/storage/index.ts`（可选）
   - worldbook_event_entries 相关导出加 `@deprecated` 注释

---

### 阶段二：触发引擎（阶段一完成后做）

**目标：** 实现条件检查 + 效果执行。事件系统"活"起来。

任务：
1. `server/services/eventEngine.ts`（新文件）
   - `checkAndFireEvents(charId, trigger, context)` — 主入口
     - `trigger`: 'chat_end' | 'value_change' | 'time_pass' | 'keyword'
     - context: 数值快照、关键词、时间等
   - 内部：查条件订阅 → 找相关 pending 事件 → 逐一评估条件 → 触发满足的事件
   - 触发流程：检查概率 → 检查冷却 → 执行 effects → 更新 status/triggerCount/cooldown
   - effects 执行：注入（写 pending_injections）、改数值（调 characterValues）、设标记、触发/解锁/锁定事件

2. 在各触发点调用 `checkAndFireEvents`：
   - `server/routes/chat.ts` 的 chat_end 处
   - `server/services/charSystem.ts` 的 value_change 处
   - 时间推进处（如果有）

3. `server/services/context.ts`
   - 在组装 prompt 时消耗 `pending_injections`（已有部分逻辑，补全）

---

### 阶段三：前端编辑器（阶段一完成后可并行）

**目标：** 更新 DaoshuApp/EventEditor，支持事件书管理 + bookId 关联。

任务：
1. `client/src/apps/DaoshuApp.tsx`
   - 事件标签页改为：先选事件书，再看书内事件

2. `client/src/apps/daoshu/EventEditor.tsx`
   - 加事件书 CRUD（列表 + 新建 + 编辑 + 删除）
   - 事件列表加 bookId 筛选
   - 新建事件时必须选一个事件书（或默认书）
   - 调 API 路径适配新的 event-books 路由

---

## 当前进度

- [x] 基础事件系统实现（events + 4张辅助表 + CRUD + routes/services）
- [x] DaoshuApp + EventEditor（前端事件编辑器，调 /api/events/*）
- [x] worldbook 重构（两张独立表 + 完整 CRUD）
- [x] RuleSystemApp 删除，律令入口移除
- [x] **阶段一：event_books 表 + events 表补字段 + 迁移 + API 更新**
- [x] **阶段三：前端编辑器适配**（WorldbookApp → 知识库 + 事件书 Tab；DaoshuApp → 元系统；ValueEditor 侧边栏+范围长条；EventEditor 事件书筛选器）
- [x] **阶段二：触发引擎**（eventEngine.ts：条件评估 + effect执行 + AI标签解析 + 冷却计时；集成到 chat.ts / values.ts / life.ts / index.ts；pending_injections 注入 context.ts；time_pass 定时器）

---

## 关键文件速查

| 文件 | 说明 |
|------|------|
| `server/db/schema.ts` | Drizzle 表定义 |
| `server/db/database.ts` | initDrizzleTables()，建表 SQL |
| `server/db/migrate.ts` | 数据迁移，每次启动幂等执行 |
| `server/services/events.ts` | 事件 CRUD + 状态流转 |
| `server/services/eventEngine.ts` | （阶段二新建）触发引擎 |
| `server/routes/events.ts` | 事件路由 |
| `server/routes/life.ts` | 生活模拟，调事件池 |
| `server/services/charSystem.ts` | 角色系统，调事件池 |
| `client/src/apps/DaoshuApp.tsx` | 道枢 App 入口 |
| `client/src/apps/daoshu/EventEditor.tsx` | 事件编辑器 |
| `ICS_动态系统_数据库设计.md` | 原始设计文档（权威参考） |
