# 数据库策略

当前本地/开发阶段，**SQLite 是唯一的真相数据库**。
设计文档里出现的 PostgreSQL 是云端/多用户阶段的预案，不在当前运行链路上。

## Schema 边界

核心数据走列式表：

- `characters`
- `messages`
- `summaries`
- `memories`

这几张表会被其他系统查询、过滤、校验、关联，所以重要字段必须以真实的列存在。
保留一个 `metadata` TEXT 列用于迁移期兜底（旧字段还没列化时落在这里），
但它不是表的主要形态。

已经是列式的领域表继续保持列式：

- 数值系统：`character_values`、`value_stages`、`value_rules`
- 事件系统：`event_books`、`events`、`event_tags`、`event_connections`、
  `condition_subscriptions`、`pending_injections`
- 世界书 / 状态：`worldbooks`、`worldbook_entries`、`worldbook_event_entries`、
  `world_state`
- 会话：`sessions`

低频或仅本功能使用的数据，暂时保留 JSON-in-TEXT 形式：

- `active`
- `presets`、`prompt_presets`
- `char_stats`、`stat_defs`
- `life`、`items`、`timeline`、`skills`、`relations`、`dreams`
- `personas`、`maps`
- `calendar_events`、`dafu_game`、`diary`
- `suixiang_cards`、`suixiang_entries`

注意这里**不是 SQLite 的 `BLOB` 类型**，统一行结构是：

```sql
id TEXT PRIMARY KEY,
char_id TEXT,
data TEXT NOT NULL, -- JSON 对象
created_at TEXT
```

适用条件：应用很少需要按 JSON 内部字段过滤、shape 仍在频繁变动、或数据是
"功能本地"（只有这一个 app 用）。一旦某张 blob 表开始参与 prompt 拼装、
跨表引用、检索、排序或完整性校验，就要升级成列式表（写一个 migration）。

JSON-in-TEXT 不是业务数据的最佳默认形态。它只是配置类与隔离功能状态的临时
合身——好处是 shape 改起来便宜、产品还在动；代价是 SQLite 没法在 `data`
内部强制业务规则、没法给嵌套字段建有用的索引、也没法用外键保护引用。

当前 blob 表分四类：

- **`active`**：单例的运行时设置。整对象读写、嵌套设置经常变，blob 合适。
- **`presets`、`prompt_presets`**：prompt / provider 配置，含嵌套数组与映射。
  短期可用 blob。如果开始按 provider/model/type/name 频繁搜索、排序或去重，
  就把这些字段拔出来列化。
- **`personas`、`maps`**：低频用户配置。在它们成为关联目标或可搜索实体之前，
  blob 可接受。
- **`calendar_events`、`diary`、`dafu_game`、`suixiang_cards`、
  `suixiang_entries`**：功能本地数据。每个 app 自己管自己的 shape、操作多
  为整对象读写时，blob 可接受。
- **`char_stats`、`stat_defs`**：旧/自定义数值的兼容层。仅在列式数值系统才是
  真正的数值系统时保留为 blob；如果它们成为权威数据源，就升级或合并。
- **`life`、`items`、`timeline`、`skills`、`relations`、`dreams`**：仅作为
  "二期迁移候选"接受。这些是角色记忆面，一旦用于检索、prompt 拼装、跨表
  关联或完整性校验，就要列化。

简而言之：blob 适合易变配置和孤立功能状态；不适合核心领域记录、查询密集
数据，或任何需要约束的数据。

## 可重复的开发流程

在 `server/` 目录下使用：

```bash
npm run db:backup       # 备份当前数据库
npm run db:reset:dev    # 备份→重建→迁数据→seed→生成健康报告
npm run db:health       # 仅生成健康报告
```

`db:reset:dev` 会先备份当前 `server/data/ics.db`，重建空库，跑全部
migration，从备份里把测试数据迁回，跑 seed，最后把健康报告写到
`server/data/health-latest.md`。
