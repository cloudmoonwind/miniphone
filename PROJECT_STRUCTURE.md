# Miniphone (ICS) 项目结构与实现说明

> 最后更新：2026-04-11
> 原则：不省略、不糊弄。每个功能记录前端实现、后端实现、数据结构、与其他功能的联动、外部 AI 接口适配。

---

## 一、宏观架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    Browser (React 18 SPA, TypeScript)              │
│  App.tsx → APP_ROUTES → 各 App 组件                                │
│  services/*.ts → fetch('/api/*')                                   │
└────────────────────────────────┬─────────────────────────────────┘
                                  │ HTTP JSON  /  SSE stream
┌────────────────────────────────▼─────────────────────────────────┐
│                  Express Server (ESM, TypeScript, port 3000)       │
│  routes/ → services/ → SqliteStore / Drizzle → SQLite (ics.db)    │
└──────────────────────────────────────────────────────────────────┘
```

**技术栈：**
- 前端：React 18 + Vite 4 + Tailwind CSS 3 + framer-motion 11 + TypeScript，单页应用，模拟手机壳 UI
- 后端：Node.js + Express (ESM) + TypeScript（tsx 运行），RESTful JSON API
- 存储：SQLite（better-sqlite3，WAL 模式），blob 表走 SqliteStore<T>，列式表走 Drizzle ORM
- AI 通信：OpenAI 兼容 SDK 调用（`/v1/chat/completions`），支持流式 SSE 输出
- 全局状态：`core/AppContext.tsx`（React 原生 Context），提供 `activeChar / activePreset / wallpaper / recentChat / navigate`；跨 App 事件通信用 `core/eventBus.ts`（轻量 pub/sub）

---

## 二、完整文件结构

```
miniphone/
├── client/
│   ├── index.html
│   ├── vite.config.js               ← 代理 /api → localhost:3000
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── types/index.ts           ← 前端类型定义（Character/Message/ApiPreset 等）
│       ├── App.tsx                   ← 主入口：AppProvider + APP_ROUTES 路由表 + 手机壳 UI
│       ├── core/
│       │   ├── AppContext.tsx        ← 全局状态（activeChar/activePreset/wallpaper/recentChat/navigate）
│       │   ├── eventBus.ts          ← 跨 App 发布/订阅事件总线
│       │   └── hooks/
│       │       ├── useActiveChar.ts
│       │       ├── useNavigation.ts
│       │       └── usePreset.ts
│       ├── home/
│       │   ├── HomeScreen.tsx        ← 3页横滑首页
│       │   ├── AppGrid.tsx           ← 图标网格渲染
│       │   ├── Dock.tsx              ← 底部4图标 Dock
│       │   └── widgets/
│       │       ├── ClockWidget.tsx        ← 实时时钟
│       │       ├── ChatPreviewWidget.tsx  ← 最近聊天预览
│       │       └── CalendarWidget.tsx
│       ├── apps/
│       │   ├── chat/                 ← 聊天（6文件）
│       │   │   ├── ChatApp.tsx       ← 入口（无角色时引导屏）
│       │   │   ├── ChatMain.tsx      ← 纯布局层
│       │   │   ├── useChatState.ts   ← 全部状态 + 业务逻辑 Hook
│       │   │   ├── MessageBubble.tsx ← 消息气泡（含MSG_SEP多段渲染）
│       │   │   ├── ChatCalendar.tsx  ← 月历日期查找视图
│       │   │   └── chatFormatters.ts ← 工具函数/常量
│       │   ├── dafu/                 ← 大富翁（10文件）
│       │   │   ├── DafuApp.tsx       ← 游戏入口
│       │   │   ├── HallView.tsx / GameView.tsx / SetupView.tsx / ...
│       │   │   └── components/       ← Board / DiceFloat / DramaPanel / ...
│       │   ├── dream/                ← 梦境（8文件）
│       │   │   ├── DreamSky.tsx      ← PixiJS 夜空渲染
│       │   │   ├── AnimeStar.tsx     ← PixiJS 动画星星交互
│       │   │   └── DreamCard.tsx / DreamModal.tsx / ...
│       │   ├── ContactsApp.tsx       ← 结缘：角色管理 CRUD
│       │   ├── SettingsApp.tsx       ← 设置：API预设 + 功能配置
│       │   ├── FilesApp.tsx          ← 文件管理：上下文预设管理，contextItems 编排
│       │   ├── CharSystemApp.tsx     ← 角色系统主面板
│       │   ├── CharPhoneApp.tsx      ← 角色手机（独立全屏模拟手机 UI）
│       │   ├── RuleSystemApp.tsx     ← 道枢·规则系统（SVG 拓扑 + 触发面板）
│       │   ├── NPCApp.tsx            ← NPC关系管理 CRUD
│       │   ├── ItemsApp.tsx          ← 物品库管理
│       │   ├── WorldbookApp.tsx      ← 世界书：书/条目 CRUD + 事件条件编辑
│       │   ├── DreamApp.tsx          ← 梦境记录入口
│       │   ├── MinggeApp.tsx         ← 命格（用户马甲）管理
│       │   ├── DiaryApp.tsx          ← 日记：日历视图 + 结构化日记
│       │   ├── SuixiangApp.tsx       ← 随想：卡片式随笔
│       │   ├── CalendarApp.tsx       ← 日历：月历视图 + 事件/待办/提醒 CRUD
│       │   ├── DafuApp.tsx           ← 大富翁入口（re-export）
│       │   ├── TimeCapsuleApp.tsx    ← 时光邮局（localStorage）
│       │   ├── MemoryApp.tsx         ← 忆海（⚠ 仅 localStorage，后端已备未接入）
│       │   ├── MapApp.tsx            ← 地图编辑器（⚠ 仅 localStorage）
│       │   ├── BeautifyApp.tsx       ← 壁纸美化（⚠ 仅 localStorage）
│       │   ├── AIConsoleApp.tsx      ← AI 终端：查看 AI 调用日志
│       │   ├── CharLifeApp.tsx       ← 角色生活
│       │   ├── DaoshuApp.tsx         ← 道枢数值（待改造为新数值系统编辑器）
│       │   └── PlaceholderApp.tsx    ← 未实现功能占位
│       ├── components/
│       │   ├── StatusBar.tsx         ← 顶部状态栏（时间/电量）
│       │   ├── ErrorBoundary.tsx     ← React 错误边界
│       │   ├── AppShell.tsx          ← 标准 App 头部（返回+标题+右侧操作区）
│       │   ├── EmptyState.tsx        ← 空状态展示
│       │   ├── Modal.tsx             ← 底部抽屉弹层（framer-motion）
│       │   ├── Avatar.tsx / AvatarUpload.tsx
│       │   └── LoadingSpinner.tsx    ← 加载指示器
│       └── services/
│           ├── api.ts                ← 通用 fetch 封装（get/post/put/delete/stream）
│           ├── settings.ts           ← API预设 + 功能配置
│           ├── characters.ts         ← 角色 CRUD
│           ├── chat.ts              ← 聊天消息 API（含 SSE 流式、摘要）
│           ├── charSystem.ts        ← 角色系统（timeline/items/skills/relations/stats）
│           ├── worldbook.ts         ← 世界书 CRUD
│           ├── personas.ts / calendar.ts / diary.ts / suixiang.ts
│           ├── dafu.ts / dreams.ts / memories.ts / summaries.ts
│           └── ...
│
├── server/
│   ├── index.ts                      ← Express 启动，注册所有路由
│   ├── types.ts                      ← 后端类型定义（与 client 同步 + AI provider 接口）
│   ├── express-types.d.ts            ← Express 类型扩展
│   ├── tsconfig.json
│   ├── db/
│   │   ├── database.ts              ← SQLite 连接单例 + getDb() / getDrizzle() + 建表
│   │   ├── schema.ts                ← Drizzle schema（数值/事件/世界状态表定义）
│   │   ├── SqliteStore.ts           ← 通用 blob 存储（实现 IFileStore<T>）
│   │   └── migrate.ts               ← JSON → SQLite 一次性迁移
│   ├── routes/
│   │   ├── chat.ts                   ← 聊天核心（两段式发送 + SSE + 触发 extraction）
│   │   ├── characters.ts             ← 角色 CRUD
│   │   ├── sessions.ts              ← 角色存档管理（列式表，直接 SQL）
│   │   ├── items.ts / timeline.ts / skills.ts / relations.ts
│   │   ├── summaries.ts / charstats.ts / life.ts
│   │   ├── worldbook.ts / settings.ts / prompts.ts
│   │   ├── memories.ts / dreams.ts / maps.ts / personas.ts
│   │   ├── diary.ts / suixiang.ts / calendar.ts / dafu.ts
│   │   └── debug.ts                  ← AI调用日志 + 角色系统设置
│   ├── services/
│   │   ├── ai.ts                     ← AI 调用封装（多 provider，流式/非流式）
│   │   ├── context.ts                ← 上下文组装（按 contextItems 顺序构建 messages[]）
│   │   ├── worldbook.ts              ← 世界书条目过滤 + 事件池管理
│   │   ├── charstats.ts              ← 属性定义合并 + 当前数值获取
│   │   ├── charSystem.ts             ← 角色系统引擎（3条管道）
│   │   ├── extraction.ts             ← 聊天后异步数据提取
│   │   └── promptPresets.ts          ← 提示词预设管理
│   ├── storage/
│   │   ├── FileStore.ts              ← 旧文件存储（保留 genId 被引用）
│   │   └── index.ts                  ← 所有 SqliteStore 实例导出
│   ├── providers/
│   │   ├── index.ts                  ← AI provider 配置工厂
│   │   └── openai-compat.ts          ← OpenAI 兼容 provider
│   └── data/
│       ├── ics.db                    ← SQLite 数据库文件
│       └── *.json.bak               ← JSON 迁移备份
│
├── devlog.md                         ← 开发日志
├── project_structure.md              ← 本文件
├── ts-migration.md                   ← TypeScript 迁移记录
├── ICS_设计讨论记录_v2.md             ← 架构与功能设计讨论
└── ICS_动态系统_数据库设计.md          ← 数值系统/事件系统详细设计
```

---

## 三、存储层

### 3.1 存储架构

数据全部存在 SQLite（`server/data/ics.db`），两种存储模式并存：

**A. Blob 存储（SqliteStore<T>，24张表）**
继承 `IFileStore<T>` 接口，每张表结构为 `id TEXT, char_id TEXT, data TEXT(JSON), created_at TEXT`。所有路由通过该接口操作，无需写 SQL。

**B. 列式存储（Drizzle ORM，9张表）**
数值系统/事件系统/世界状态使用真正的列式表，支持列级查询和类型安全。Schema 定义在 `server/db/schema.ts`。

**核心方法（IFileStore<T>）：**
- `getAll(filterFn?)` — 读全部，可选过滤
- `getById(id)` — 按 id 查单条
- `create(obj)` — 插入（自动生成 id）
- `update(id, patch)` — 浅合并更新
- `delete(id)` / `deleteMany(filterFn)` — 删除
- `getObject()` / `setObject(obj)` — 单对象模式（activeStore 用）

### 3.2 Blob 表 Store 实例映射

| Store 实例 | SQLite 表 | 数据用途 |
|-----------|-----------|---------|
| `characterStore` | `characters` | 角色定义 |
| `messageStore` | `messages` | 聊天消息 |
| `summaryStore` | `summaries` | 对话摘要 |
| `memoryStore` | `memories` | 记忆条目 |
| `dreamStore` | `dreams` | 梦境记录 |
| `mapStore` | `maps` | 地图数据 |
| `presetStore` | `presets` | API 配置预设（含 apiKey） |
| `promptStore` | `prompt_presets` | 上下文/提示词预设 |
| `lifeStore` | `life` | 角色生活日志 |
| `wbBookStore` | `wb_books` | 世界书容器 |
| `wbEntryStore` | `wb_entries` | 世界书条目 |
| `statDefStore` | `stat_defs` | 旧属性定义（待废弃，被 character_values 替代）|
| `charStatStore` | `char_stats` | 旧角色数值（待废弃，被 character_values 替代）|
| `personaStore` | `personas` | 用户马甲 |
| `diaryStore` | `diary` | 日记 |
| `suixiangCardStore` | `suixiang_cards` | 随想卡片 |
| `suixiangEntryStore` | `suixiang_entries` | 随想条目 |
| `calendarStore` | `calendar_events` | 日历事件 |
| `dafuStore` | `dafu_game` | 大富翁游戏状态 |
| `itemStore` | `items` | 物品 |
| `timelineStore` | `timeline` | 时间线事件 |
| `skillStore` | `skills` | 技能 |
| `relationStore` | `relations` | 关系 |
| `activeStore` | `active` | 全局活跃配置（单对象 singleton） |

### 3.2b 列式表（Drizzle ORM）

| 表 | 用途 | 状态 |
|----|------|------|
| `sessions` | 角色存档管理（直接 SQL，非 Drizzle）| 已有路由 |
| `character_values` | 数值定义 + 当前值 | 表已建，路由待做 |
| `value_stages` | 数值分段描述 + prompt 片段 | 表已建，路由待做 |
| `value_rules` | 数值变化规则 | 表已建，路由待做 |
| `events` | 事件主表（状态/条件/效果/冷却）| 表已建，路由待做 |
| `event_tags` | 事件标签 | 表已建，路由待做 |
| `event_connections` | 事件间关系链 | 表已建，路由待做 |
| `condition_subscriptions` | 条件订阅索引 | 表已建，路由待做 |
| `pending_injections` | 待注入 prompt 内容 | 表已建，路由待做 |
| `world_state` | 世界环境键值对 | 表已建，路由待做 |

### 3.3 activeStore 全局配置字段

`active` 表存储所有全局配置（singleton 模式，单对象读写）：

```json
{
  "primaryPresetId": "preset_xxx",        // 主 API 预设 ID
  "activePresetId": "preset_xxx",          // 旧字段，与 primaryPresetId 保持一致
  "featurePresets": {                      // 各功能专用 API 预设 ID
    "summaries": null,
    "charSystem": null,
    "life": null,
    "dafu": null
  },
  "featurePromptPresets": {               // 各功能活跃提示词预设 ID
    "summaries": null,                    // null = 使用内置默认
    "life": null,
    "charSystem": null
  },
  "charSystemSettings": {                 // 角色系统引擎开关
    "extractionEnabled": false,
    "summaryToTimelineEnabled": true,
    "statEventsEnabled": true,
    "lifeToTimelineEnabled": true
  },
  "summarySettings": {                    // 自动摘要触发设置
    "periodicEnabled": false,
    "periodicInterval": 20,
    "modeSummaryEnabled": false,
    "dailyEnabled": false
  },
  "summaryPrompts": {                     // 旧版提示词覆盖（向后兼容保留）
    "segment": "",
    "daily": "",
    "mode": "",
    "periodic": ""
  },
  "timestampSettings": {                  // 时间戳注入设置
    "sendUserTimestamp": true,
    "sendCharTimestamp": false,
    "syncConfirmed": false,
    "timestampFormat": "bracket"
  },
  "activeMapId": null
}
```

---

## 四、AI 服务层

### 4.1 多 Provider 支持（`server/services/ai.ts` + `server/providers/index.ts`）

封装 OpenAI 兼容 SDK，支持多服务商：

| Provider key | 服务商 | API 端点 |
|-------------|-------|---------|
| `openai` | OpenAI | `https://api.openai.com/v1` |
| `zhipu` | 智谱 Z.AI | `https://open.bigmodel.cn/api/paas/v4` |
| `deepseek` | DeepSeek | `https://api.deepseek.com/v1` |
| `grok` | xAI Grok | `https://api.x.ai/v1` |
| `anthropic` | Claude | `https://api.anthropic.com`（适配器开发中）|
| `gemini` | Google | `https://generativelanguage.googleapis.com`（开发中）|

**核心函数：**
- `getClient(preset)` — 根据 preset 的 provider/baseURL/apiKey 创建客户端实例
- `chatCompletion(client, messages, options)` — 非流式调用，返回 string
- `chatCompletionStream(client, messages, options, onChunk)` — SSE 流式，逐 token 回调
- `getAICallLog()` / `clearAICallLog()` — 内存中的调用日志（供调试面板查看）

**外部适配：** 所有 provider 都通过 OpenAI SDK 的 `baseURL` 参数切换端点，统一接口。对于 temperatureMax 限制（如智谱 max=1），由前端控制滑块上限，不做后端截断。

### 4.2 AI 预设优先级解析

任何需要调用 AI 的服务，按以下优先级解析使用哪个 API 预设：

```
功能专用预设（featurePresets.xxx）
  → summaries 预设（charSystem 功能 fallback）
  → primaryPresetId
  → activePresetId（旧字段兼容）
  → null（无 AI 能力，跳过该功能）
```

### 4.3 提示词预设系统（`server/services/promptPresets.ts`）

独立于 API 预设的提示词管理层，覆盖 3 个功能：`summaries`、`life`、`charSystem`。

**内置预设（`BUILTIN_PROMPT_PRESETS`，只读，不存文件）：**

| 预设 ID | 功能 | 提示词 key |
|--------|-----|-----------|
| `builtin-summaries-default` | summaries | segment / daily / mode / periodic |
| `builtin-life-default` | life | systemExtension（空=不附加）|
| `builtin-charsystem-default` | charSystem | extraction / timelineEval / lifeExtract |

**用户自定义预设：** 存储在 `promptStore`（`prompt_presets.json`），结构：
```json
{
  "id": "pp_xxx",
  "name": "我的总结预设",
  "feature": "summaries",
  "description": "...",
  "builtin": false,
  "prompts": { "segment": "...", "daily": "...", "mode": "...", "periodic": "..." }
}
```

**解析函数：**
- `getActivePromptPreset(feature)` — 读 `activeStore.featurePromptPresets[feature]` → 查 promptStore → 查 BUILTIN → 回退该功能内置默认
- `getPrompt(feature, key)` — 获取活跃预设中指定 key 的提示词（空字符串/null 时返回 null，由调用方决定 fallback）

**后端 API（`/api/settings`）：**

| 方法 | 路径 | 说明 |
|-----|-----|-----|
| GET | `/prompt-presets?feature=xxx` | 列出 BUILTIN + 用户预设（按 feature 过滤）|
| POST | `/prompt-presets` | 创建用户预设（`promptStore.create`）|
| PUT | `/prompt-presets/:id` | 更新用户预设（builtin 返回 403）|
| DELETE | `/prompt-presets/:id` | 删除用户预设（builtin 返回 403）|
| GET | `/feature-prompt-presets` | 读取各功能活跃预设 ID |
| PUT | `/feature-prompt-presets` | 设置各功能活跃预设 ID |

**前端 service（`client/src/services/settings.ts`）：**
- `listPromptPresets(feature?)` / `createPromptPreset(data)` / `updatePromptPreset(id, data)` / `deletePromptPreset(id)`
- `getFeaturePromptPresets()` / `setFeaturePromptPresets(data)`

---

## 五、功能实现详解

### 5.1 聊天系统（ChatApp）

**前端：** `client/src/apps/chat/`（6文件，入口 `ChatApp.tsx`，逻辑 `useChatState.ts`，布局 `ChatMain.tsx`）
**后端：** `server/routes/chat.ts`，`server/services/context.ts`

**数据流：**
```
用户输入 → POST /api/chat/message      → messageStore.create({ role:'user', charId, content, mode })
         → POST /api/chat/respond      → context.assembleMessages(charId, promptPresetId)
                                       → AI chatCompletionStream()
                                       → SSE 推送 token 到前端
                                       → 流结束 → messageStore.create({ role:'assistant' })
                                       → triggerExtraction(charId)  ← 异步，不阻塞响应
```

**上下文组装（`context.ts`）：**
读取活跃上下文预设的 `contextItems` 数组，按顺序构建 `messages[]`：
- `sys-persona` → 角色人设 system 消息
- `sys-wbtop` → 世界书 system-top 内容
- `sys-memories` → 手动记忆汇总
- `sys-summaries` → 近期对话摘要
- `sys-userpersona` → 用户马甲 system 消息
- `sys-wbbefore` → 世界书 before-chat 内容
- `sys-history` → 展开为 N 条历史 user/assistant 消息（带时间戳注入）
- `sys-wbafter` → 世界书 after-chat
- `sys-wbbottom` → 世界书 system-bottom
- 自定义条目 → 直接插入（role + content）

**时间戳注入：** 由 `active.timestampSettings` 控制：
- `sendUserTimestamp: true` → 在每条 user 消息 content 前注入 `[2026-03-22 14:30]` 格式前缀
- `timestampFormat: 'bracket'` → 嵌入 content 字符串（通用）
- `timestampFormat: 'metadata'` → Anthropic 专用格式（预留）

**与其他功能的联动：**
- 聊天结束 → `triggerExtraction(charId)`（见 §5.3）
- 聊天产生摘要 → `evaluateSummaryForTimeline(charId, summary)`（见 §5.4）
- 世界书条目作为上下文注入（always/keyword 激活类型）
- 事件类世界书条目通过 `getEventPoolEntries` 选取后注入（event-random/event-conditional）

---

### 5.2 API 设置与功能配置（SettingsApp）

**前端：** `client/src/apps/SettingsApp.tsx`（3 个 Tab）
**后端：** `server/routes/settings.ts`

**Tab 1 — 配置管理（API 预设 CRUD）：**

操作 `presetStore`（`presets.json`），每个预设含：`name`, `apiKey`, `baseURL`, `model`, `provider`, `params.temperature`, `contextMode`, `stream`。

保存后自动激活（写 `activeStore.primaryPresetId`）。支持从各 provider 自动获取模型列表（`POST /api/settings/models`），支持测试连接（`POST /api/settings/test-connection`）。

**Tab 2 — 功能配置（API 分配 + 提示词预设）：**

每个功能卡片显示两个下拉：
- **API 配置**：从 `presetStore` 中选，写入 `activeStore.featurePresets.xxx`
- **提示词预设**：从 `promptStore` + 内置预设中选，写入 `activeStore.featurePromptPresets.xxx`
- 内置预设旁有「复制新建」按钮，用户预设旁有「编辑/删除」

功能列表：

| 功能 key | 显示名 | API 分配 | 提示词预设 |
|---------|-------|---------|---------|
| `summaries` | 聊天总结 | ✅ | ✅（segment/daily/mode/periodic）|
| `charSystem` | 角色系统 | ✅ | ✅（extraction/timelineEval/lifeExtract）|
| `life` | 角色生活生成 | ✅ | ✅（systemExtension）|
| `dafu` | 大富翁主持 | ✅ | — |

**提示词预设编辑器（底部抽屉）：**
- 选中预设后点"编辑"打开
- 内置预设：只读展示，有"复制为新预设"按钮
- 用户预设：可编辑所有 prompts key，保存写 `PUT /api/settings/prompt-presets/:id`

---

### 5.3 聊天后自动提取（extraction.ts）

**后端：** `server/services/extraction.ts`
**触发点：** `server/routes/chat.ts` 的 AI 回复完成后（异步，不阻塞聊天响应）

**控制开关：** `activeStore.charSystemSettings.extractionEnabled`（默认 false，需手动开启）

**数据流：**
```
triggerExtraction(charId)
  → messageStore.getAll(m => m.charId === charId).slice(-6)  // 最近 6 条
  → AI 调用（使用 charSystem 功能预设）
  → prompt: getPrompt('charSystem', 'extraction')  // 从提示词预设读取
  → 解析 JSON 响应：
      status{}      → charStatStore.update（状态/位置/心情颜色/内心独白）
      items[]       → itemStore.create（extractedSource: 'ai-extract'）
      timeline[]    → timelineStore.create（extractedSource: 'ai-extract'）
      relations[]   → 查找 relationStore 中现有记录 → update closeness
      skills[]      → 查找 skillStore 中现有记录 → update experience
```

**与其他功能的联动：**
- 读取 `messageStore`（聊天）→ 写入 `charStatStore/itemStore/timelineStore/relationStore/skillStore`（角色系统）
- 使用 `featurePresets.charSystem` 的 AI 配置
- 所有写入数据标记 `extractedSource: 'ai-extract'`，用户可以在 CharSystemApp 中查看和编辑

---

### 5.4 角色系统引擎（charSystem.ts）

**后端：** `server/services/charSystem.ts`
**设计理念：** 角色系统是主体，聊天是数据来源之一。角色有独立生活、状态、关系，不依赖用户持续互动。

#### 管道 1：总结 → 时间线

**触发点：** `server/routes/summaries.ts` 生成摘要后调用

```
evaluateSummaryForTimeline(charId, summary)
  → 检查 charSystemSettings.summaryToTimelineEnabled
  → AI 调用：prompt = getPrompt('charSystem', 'timelineEval')
  → 响应 JSON: { "record": true/false, "title": "..." }
  → record=true → timelineStore.create({
      type: 'chat',
      title: AI生成的标题,
      content: summary.content,
      linkedSummaryId: summary.id,
      linkedMessageIds: summary.messageIds,
      extractedSource: 'summary-eval'
    })
```

#### 管道 2：数值 → 事件

**触发点：** `server/routes/charstats.ts` 数值变化后调用（同步，在 delta 请求内执行）

```
checkStatThresholds(charId, prevStats, newStats)
  → 检查 charSystemSettings.statEventsEnabled
  → 遍历世界书 event-conditional 条目（wbEntryStore, type='event-conditional'）：
      满足条件：prevStats 不满足 AND newStats 满足（新触发）
      → timelineStore.create({ extractedSource: 'stat-threshold', linkedEventId: entry.id })
  → 检查内置里程碑：
      relationship > 80 → '关系里程碑：亲密度超过80'
      trust > 70        → '信任里程碑：信任度超过70'
      mood > 90         → '情绪巅峰'
      mood < 20         → '情绪低谷'
      stress > 80       → '压力预警'
      → timelineStore.create({ extractedSource: 'milestone' })
```

#### 管道 3：生活 → 时间线/物品/技能

**触发点：** `server/routes/life.ts` 生活日志生成后调用（异步）

```
processLifeLog(charId, lifeLog)
  → 检查 charSystemSettings.lifeToTimelineEnabled
  → AI 调用：prompt = getPrompt('charSystem', 'lifeExtract')
  → 解析 JSON：
      timeline[] → timelineStore.create（extractedSource: 'life-extract'）
      items[]    → itemStore.create（extractedSource: 'life-extract'）
      skills[]   → skillStore.create 或 update experience（extractedSource: 'life-extract'）
```

**`extractedSource` 字段值：**
- `'ai-extract'` — 聊天后自动提取
- `'summary-eval'` — 总结评估写入时间线
- `'stat-threshold'` — 数值阈值触发
- `'milestone'` — 内置里程碑
- `'life-extract'` — 生活日志提取
- `'seed'` — 调试种子数据

---

### 5.5 角色系统主面板（CharSystemApp）

**前端：** `client/src/apps/CharSystemApp.tsx`
**所需接口：**

| 接口 | 用途 |
|-----|-----|
| `GET /api/characters` | 角色列表（顶部选择器）|
| `GET /api/charstats/:charId` | 当前数值 + statusInfo |
| `GET /api/characters/:charId/timeline?limit=N` | 时间线条目 |
| `GET /api/characters/:charId/items?status=active` | 物品 |
| `GET /api/characters/:charId/relations` | 关系网络 |
| `GET /api/characters/:charId/skills` | 技能列表 |
| `GET /api/characters/:charId/life?limit=3` | 最近生活日志 |
| `GET /api/debug/char-system-settings` | 管道开关 |
| `PUT /api/debug/char-system-settings` | 更新开关 |
| `POST /api/debug/seed/:charId` | 注入种子数据 |
| `POST /api/characters/:charId/life/generate` | 生成生活日志 |

**UI 模块：**

- **状态肖像**：心情色调渐变背景、位置、衣着、状态描述、内心独白（来自 charStatStore.statusInfo）
- **数值速览**：mood/trust/relationship 三项（来自 charStatStore.stats）
- **时间线**：默认显示 6 条，「查看全部」展开，每条可点击展开全文，按 timestamp 倒序
- **物品区**：最近 5 个 active 状态物品，显示 emoji + name + emotionalValue
- **关系星座**：SVG 网络图（中心节点 + 关系节点圆形布局），点击节点展开关系详情
- **技能树**：按 category 分组（工作/生活/情感），每个技能显示名称 + level + 经验进度条（experience / level*2），可点击展开描述
- **生活日志**：最近 3 条，每条可展开全文，「生成」快捷按钮
- **手机入口**：点击跳转到 CharPhoneApp（全屏独立页面）
- **设置面板**（底部抽屉）：
  - AI 预设选择（调用 `GET /api/debug/char-system-settings` 中的 charSystemPresetId）
  - 4 个管道开关（extractionEnabled/summaryToTimelineEnabled/statEventsEnabled/lifeToTimelineEnabled）
  - 生活生成控制：事件数（0-5）/ 时段选择 / 「立即生成」按钮 / 结果预览
  - 种子数据注入按钮

**与其他功能的联动：**
- 读取 charSystem 引擎写入的所有 Store 数据（timeline/items/skills/relations）
- 生活日志生成触发 processLifeLog → 异步写回 timeline/items/skills
- 数值更新（通过 CharSystemApp 的设置面板）→ checkStatThresholds → 写 timeline

---

### 5.6 角色手机（CharPhoneApp）

**前端：** `client/src/apps/CharPhoneApp.tsx`
**路由：** 从 App.tsx 的 `角色手机` 入口进入（独立全屏，非手机壳内嵌）

**UI 结构：**
- 模拟手机主屏幕（图标网格）：消息 / 联系人 / 朋友圈 / 相册 / 备忘录 / 收藏
- **消息页**：读取 `messageStore`（`GET /api/characters/:charId/messages`），联系人列表 → 进入聊天界面，角色消息在右侧，用户消息在左侧（与主聊天 App 方向相反，表现角色视角）
- **朋友圈**：读取 `lifeStore`（`GET /api/characters/:charId/life`），将生活日志渲染为社交动态卡片（时间/文字内容/事件标签）

**与其他功能的联动：**
- 消息数据来自主聊天（ChatApp 写入的 messageStore）
- 朋友圈数据来自生活日志（life.ts 生成的 lifeStore）

---

### 5.7 道枢·规则系统（RuleSystemApp）

**前端：** `client/src/apps/RuleSystemApp.tsx`
**路由：** `道枢` → RuleSystemApp（已替代旧 DaoshuApp）
**核心理念：** 规则系统不编辑事件内容（内容在世界书里），只编辑和可视化事件的**触发逻辑**：何时触发、互斥关系、依赖关系。

**所需接口：**

| 接口 | 用途 |
|-----|-----|
| `GET /api/charstats/:charId` | 当前数值（触发面板实时计算）|
| `GET /api/charstats/defs?charId=` | 属性定义（数值条范围/颜色）|
| `GET /api/worldbook/books?charId=` | 世界书列表（规则所属书）|
| `GET /api/worldbook/entries?bookId=` | 事件条目（eventConfig 含触发规则）|
| `POST /api/charstats/:charId/delta` | ±5 调节数值 → 实时看触发变化 |
| `PUT /api/worldbook/entries/:id` | 保存规则编辑（触发逻辑字段）|

**UI 模块 1 — 触发面板：**
- 每个数值属性显示为进度条
- 进度条上标注**阈值标记**（▽ 三角形，标注 event-conditional 条目的触发阈值点）
- 鼠标悬停阈值标记显示对应规则名称
- ±5 按钮实时调节数值 → `evalCond(condition, stats)` 前端实时计算 → 所有规则触发状态同步更新
- 规则按触发状态分组：✅ 已激活 / 🟡 部分满足 / ⬜ 未触发

**UI 模块 2 — 规则拓扑（SVG 网络图）：**
- `computeLayout(events)` — 圆形布局算法：互斥组成员相邻分布，其次依赖链，最后独立规则
- `buildEdges(events)` — 生成两种边：
  - **互斥边**（红色虚线 + ⊗ 中点符号）：同 `exclusionGroup` 的节点两两连线
  - **依赖边**（蓝色实线 + → 箭头）：`requires[]` 中的前置 ID → 当前节点
- **节点视觉状态**：黄色光晕 = 已触发，灰色 = 依赖未满足（锁定），白色 = 未触发
- **节点类型标记**：琥珀色小点 = 条件触发型，蓝色小点 = 随机触发型
- **互斥组背景椭圆**：半透明色块标识同组节点范围
- 点击节点 → 显示详情面板（条件/触发状态/关系说明）

**UI 模块 3 — 规则触发逻辑编辑器（底部抽屉）：**
编辑的字段（全部在 `eventConfig` 中）：
- `activationMode`: 'conditional' | 'random'
- `condition`: `{ stat: '数值key', op: '>'|'<'|'>='|'<='|'==', value: number }`
- `weight`: number（随机权重）
- `exclusionGroup`: string（互斥组名，输入新组名或选已有组）
- `requires`: string[]（前置事件 ID 列表）
- **不编辑**：事件名称、内容、世界书文本（这些在世界书 App 中管理）

**eventConfig 完整字段说明：**

| 字段 | 类型 | 说明 |
|-----|-----|-----|
| `condition` | `{stat, op, value}` | 主触发条件（数值阈值）|
| `weight` | number | 随机事件权重（越高越容易被选中）|
| `exclusionGroup` | string | 互斥组名（同组同时段只触发一个）|
| `requires` | string[] | 前置依赖事件 ID（所有前置必须已发生）|
| `multiConditions` | array | 多条件组合（stat/event/location 类型，AND 逻辑）|

**已知局限：** `exclusionGroup`、`requires`、`multiConditions` 目前仅前端读取和展示，后端 `pickEvents()` 暂未实现互斥排除和依赖检查（只用 condition + weight）。

---

### 5.8 生活日志生成（life.ts）

**后端：** `server/routes/life.ts`
**触发方式：** 前端手动（CharSystemApp 的「生成」按钮）或定时（未实现自动）

**数据流：**
```
POST /api/characters/:charId/life/generate { period, eventCount, extraSystem }
  → getCharStats(charId)          ← 当前数值
  → getEventPoolEntries(charId)   ← 世界书事件池
  → pickEvents(entries, stats, eventCount)  ← 按数值+权重加权选取
  → buildLifePrompt({ char, stats, statDefs, selectedEvents, recentLogs, recentMsgs, period, extraSystem })
      sysLines = [角色定义, 选中事件描述, ...]
      systemExtension = getPrompt('life', 'systemExtension')  ← 提示词预设附加指令
      sysLines.push(systemExtension) if non-empty
  → AI 调用（使用 featurePresets.life 预设）
  → lifeStore.create({ charId, period, content, eventIds })
  → processLifeLog(charId, lifeLog)  ← 异步管道 3
```

**与其他功能的联动：**
- 读取 `charStatStore`（数值影响事件选取和描述语气）
- 读取 `wbEntryStore`（event-random/event-conditional 作为事件池）
- 读取 `messageStore`（最近聊天历史作为生活背景）
- 读取 `lifeStore`（最近生活日志避免重复）
- 异步写入 `timelineStore/itemStore/skillStore`（通过 processLifeLog）
- CharPhoneApp 的朋友圈读取 `lifeStore` 展示

---

### 5.9 对话摘要系统（summaries.ts）

**后端：** `server/routes/summaries.ts`

**getSummaryPrompt(type) 解析顺序：**
```
getPrompt('summaries', type)  ← 提示词预设系统
  → 活跃 summaries 预设的 prompts[type]
  → builtin-summaries-default 的 prompts[type]
  → (向后兼容) active.summaryPrompts[type]  ← 旧字段
```

**摘要类型：**
- `segment` — 手动折叠聊天段落时生成
- `daily` — 按日期分组的日摘要
- `mode` — 切换线上/线下模式时生成
- `periodic` — 按条数自动触发

**与角色系统的联动：**
摘要生成后调用 `evaluateSummaryForTimeline(charId, summary)` → 管道 1（总结→时间线）

**AI 预设解析：** `featurePresets.summaries` → `primaryPresetId`

---

### 5.10 角色数值系统（charstats.ts 路由 + 服务）

**后端：** `server/routes/charstats.ts`，`server/services/charstats.ts`

**数据结构（charStatStore 条目）：**
```json
{
  "id": "cs_xxx",
  "charId": "char_xxx",
  "stats": { "mood": 45, "energy": 60, "stress": 55, "trust": 30, "relationship": 38 },
  "statusInfo": {
    "moodColors": ["#hex1", "#hex2"],
    "location": "位置",
    "outfit": "衣着",
    "statusDesc": "一句话描述",
    "innerThoughts": "内心独白",
    "lastUpdated": "ISO时间"
  }
}
```

**属性定义合并逻辑（getMergedStatDefs）：**
系统内置默认属性（mood/energy/relationship/trust/stress，各有 name/min/max/color）+ `statDefStore` 中用户自定义属性 → 合并，用户自定义覆盖同 key 的内置默认。

**delta 接口（POST `/api/charstats/:charId/delta`）：**
接收 `{ key, delta }` → 计算新值（clamp 到 min/max）→ 更新 charStatStore → 调用 `checkStatThresholds`。

---

### 5.11 NPC 关系管理（NPCApp）

**前端：** `client/src/apps/NPCApp.tsx`
**后端：** `server/routes/relations.ts`（挂载在 `characters.ts` 子路由）

**接口：**
- `GET /api/characters/:charId/relations` — 列表
- `POST /api/characters/:charId/relations` — 创建
- `PUT /api/characters/:charId/relations/:id` — 更新
- `DELETE /api/characters/:charId/relations/:id` — 删除

**数据字段：** `charId, targetName, targetEmoji, type, closeness(0-100), notes`

**关系类型（6种）：** friend / family / romantic / colleague / rival / other

**UI 功能：**
- 顶部角色选择器（加载所有角色）
- 关系列表：卡片式，按类型颜色标记（friend=蓝/family=绿/romantic=粉/colleague=灰/rival=橙）
- 点击卡片 → 底部抽屉详情：emoji 选择 + 名称 + 类型 + 亲密度滑块 + 备注
- FAB 按钮新建 NPC
- 滑动删除（或抽屉内删除按钮）

**与角色系统的联动：**
- `charSystem.ts` 的 extraction 管道会更新 `relationStore.closeness`
- CharSystemApp 的关系星座 SVG 图读取相同数据

---

### 5.12 世界书系统（WorldbookApp）

**前端：** `client/src/apps/WorldbookApp.tsx`
**后端：** `server/routes/worldbook.ts`，`server/services/worldbook.ts`

**双层数据结构：**
- `wbBookStore`（wb_books.json）— 书容器（name, description, charId, isActive）
- `wbEntryStore`（wb_entries.json）— 条目（bookId, type, mode, content, keyword, eventConfig）

**条目类型（`type` 字段）：**
- `background` — 始终插入上下文的背景描述
- `event-random` — 加权随机事件（生活日志生成时按 weight 随机选取）
- `event-conditional` — 条件触发事件（数值满足 condition 时触发；RuleSystemApp 的核心数据源）

**条目激活模式（`mode` 字段）：**
- `always` — 总是激活（注入上下文）
- `keyword` — 消息中含 keyword 时激活
- `manual` — 手动激活

**active-entries 接口（`GET /api/worldbook/active-entries?charId=xxx&query=yyy`）：**
返回该角色所有活跃的 background 条目（always 类型 + keyword 匹配）。供 `context.ts` 在上下文组装时调用。

**事件池接口（`getEventPoolEntries(charId)`）：**
返回该角色所有 event-random 和 event-conditional 条目。供 `life.ts` 的 `pickEvents()` 调用。

---

### 5.13 上下文管理（FilesApp / 文件管理）

**前端：** `client/src/apps/FilesApp.tsx`（从 Dock「文件管理」入口进入）
**后端：** `server/routes/prompts.ts`，`server/services/context.ts`

FilesApp 是**上下文预设管理器**，不是「律令」。「律令」是 Home Screen 上的另一个图标，对应一个尚未实现的独立 App（当前为 PlaceholderApp）。

每个**上下文预设**（存储在 `promptStore` / `prompt_presets.json`，注意与提示词预设共用存储但字段不同）是一个 `contextItems[]` 数组，每个 item 定义一个上下文槽位，控制哪些内容按什么顺序注入 AI 消息列表。

**FilesApp 功能：**
- 上下文预设 CRUD（命名/保存/切换/删除）
- contextItems 编排：系统槽位（角色人设/世界书/记忆/摘要/历史/马甲）+ 自定义内容
- 每个条目展开预览实际注入内容 + 预估 token 数
- 最大上下文 Token 滑块（500-32000，存 `activeStore.contextBudget`）
- Token 预算进度条（当前预估总量 / 最大值，绿/黄/红）

**与聊天的联动：** ChatApp 选择上下文预设 → 发送到 `/api/chat/respond` → `context.assembleMessages()` 按 contextItems 顺序构建最终的 messages[]。

**「律令」App（未实现）：** Home Screen 图标，点击当前为 PlaceholderApp，具体功能待设计。

---

## 六、前端路由表（App.tsx）

```
APP_ROUTES:
  chat           → ChatApp          (初始化时传入 initialChar)
  结缘           → ContactsApp
  道枢           → RuleSystemApp    (传入 initialChar)
  律令           → PlaceholderApp    (❌ 未实现，独立于文件管理)
  命格           → MinggeApp
  地图           → MapApp
  世界书         → WorldbookApp
  群聊           → PlaceholderApp
  角色系统       → CharSystemApp    (传入 initialChar)
  社区           → PlaceholderApp
  忆海           → MemoryApp
  美化           → BeautifyApp
  日历           → PlaceholderApp
  随笔           → DiaryApp
  记账           → PlaceholderApp
  日记           → DiaryApp
  物品库         → PlaceholderApp   (⚠ ItemsApp 已建但未挂载到路由)
  创作           → PlaceholderApp
  异世界之旅     → PlaceholderApp
  npc管理        → NPCApp           (传入 initialChar)
  珍藏           → PlaceholderApp
  梦境           → DreamApp
  无限流         → PlaceholderApp
  大富翁         → PlaceholderApp
  时光邮局       → PlaceholderApp
  养宠           → PlaceholderApp
  约会           → PlaceholderApp
  ta的秘密       → PlaceholderApp
  终端           → AIConsoleApp

Dock:
  通讯录         → ContactsApp
  终端           → AIConsoleApp
  文件管理       → FilesApp
  设置           → SettingsApp

独立全屏（覆盖手机壳）:
  角色手机       → CharPhoneApp
```

---

## 七、完整数据流图

### 7.1 聊天 → 角色系统（全链路）

```
用户发消息
 │
 ├─► POST /api/chat/message → messageStore.create({ role:'user' })
 │
 └─► POST /api/chat/respond
       │
       ├─► context.assembleMessages(charId, promptPresetId)
       │     ├─ 上下文预设 contextItems → messages[]
       │     ├─ 世界书 always/keyword 条目注入
       │     └─ 历史消息注入（带时间戳）
       │
       ├─► AI chatCompletionStream → SSE → 前端
       │
       ├─► messageStore.create({ role:'assistant' })
       │
       └─► triggerExtraction(charId)  [异步，不阻塞]
             │
             ├─ getPrompt('charSystem', 'extraction') ← 提示词预设系统
             ├─ messageStore 最近6条
             ├─► AI → 解析JSON
             └─► charStatStore | itemStore | timelineStore
                 relationStore | skillStore
```

### 7.2 生活生成 → 角色数据（全链路）

```
POST /api/characters/:charId/life/generate
 │
 ├─► getCharStats(charId) ← charStatStore
 ├─► getEventPoolEntries(charId) ← wbEntryStore（event类型）
 ├─► pickEvents(entries, stats, eventCount)
 │     ├─ event-random: 按 weight 加权随机
 │     └─ event-conditional: 检查 condition 是否满足（未考虑 exclusionGroup/requires）
 │
 ├─► buildLifePrompt()
 │     ├─ 角色定义 + 选中事件 + 近期日志 + 近期聊天
 │     └─ getPrompt('life', 'systemExtension') → 附加指令（来自提示词预设）
 │
 ├─► AI → lifeStore.create
 │
 └─► processLifeLog(charId, log)  [异步]
       ├─ getPrompt('charSystem', 'lifeExtract')
       ├─► AI → 解析JSON
       └─► timelineStore | itemStore | skillStore
```

### 7.3 摘要 → 时间线（全链路）

```
POST /api/characters/:charId/summaries/generate
 │
 ├─► getSummaryPrompt(type)
 │     └─ getPrompt('summaries', type) ← 提示词预设 → 内置默认
 │
 ├─► AI → summaryStore.create
 │
 └─► evaluateSummaryForTimeline(charId, summary)  [异步]
       ├─ getPrompt('charSystem', 'timelineEval')
       ├─► AI → { "record": true, "title": "..." }
       └─► timelineStore.create({ extractedSource: 'summary-eval' })
```

### 7.4 数值变化 → 事件触发

```
POST /api/charstats/:charId/delta { key, delta }
 │
 ├─► clamp(prevValue + delta, min, max) → charStatStore.update
 │
 └─► checkStatThresholds(charId, prevStats, newStats)  [同步]
       ├─ 遍历 wbEntryStore（event-conditional）
       │   prev 不满足 AND new 满足 → 新触发
       │   → timelineStore.create({ extractedSource: 'stat-threshold' })
       │
       └─ 内置里程碑检查（5种）
           → timelineStore.create({ extractedSource: 'milestone' })
```

---

## 八、测试种子数据（郁疏澜）

角色 ID：`char_1773377502265_2f2r`

| 数据文件 | 条目数 | 内容 |
|---------|------|-----|
| `timeline.json` | 8 条 | 午夜的屋顶(milestone) / 旧书店偶遇(event) / 第一次主动发消息(chat) / 雨中的沉默(event) / 难得的笑容(milestone) / 深夜坦白(chat) / 做了一个梦(event) / 学会了做咖啡(milestone) |
| `items.json` | 5 个 | 黑色耳机(active) / 绝版推理小说(active) / 透明雨伞(stored) / 手冲咖啡壶(active) / 旧手链(stored) |
| `skills.json` | 7 个 | 洞察力 lv4 / 冷场制造 lv3 / 编程 lv4 / 推理 lv3 / 厨艺 lv2 / 咖啡 lv1 / 伪装 lv5 |
| `relations.json` | 4 条 | 你(friend,58) / char_1(colleague,42) / 陈默(friend,70) / 方晴(rival,35) |
| `life.tson` | 3 条 | 2026-03-20 上午/下午/傍晚 |
| `char_stats.json` | +1条 | mood:45, energy:60, stress:55, trust:30, relationship:38，含 statusInfo |
| `wb_books.json` | +1本 | 郁疏澜的世界（wb_ysl_life）|
| `wb_entries.json` | +9条 | 2 background(always+keyword) / 3 event-random(墨的撒娇/深夜灵感/意外关心) / 4 event-conditional(stress≥70/mood≥75/mood≤25/trust≥65) |

timeline 条目 `linkedItemIds` 与 items 的 `linkedTimelineIds` 双向引用，实现跨 Store 关联。

---

## 九、已知问题与局限

### 9.1 规则系统后端未实现互斥/依赖
`pickEvents()` 在 `life.ts` 中只按 condition + weight 选取事件，未考虑：
- `exclusionGroup`：同组只选一个
- `requires[]`：前置依赖事件是否已发生
- `multiConditions`：多条件 AND 逻辑（只有 stat 类型做了实现）

### 9.2 activePreset 字段冗余
`active.json` 同时存在 `activePresetId`（旧）和 `primaryPresetId`（新），两者始终保持同值写入。读取时优先 `primaryPresetId`。

### 9.3 extraction 默认关闭
`charSystemSettings.extractionEnabled` 默认 `false`。需要在 CharSystemApp 设置面板中手动开启，否则聊天后不会自动提取数据。

### 9.4 contextItem.maxTokens 未实现
上下文预设中各 item 的 `maxTokens` 字段已存储，但 `context.ts` 中尚未按该字段对内容做截断。

### 9.5 MemoryApp / MapApp 数据孤岛
两个 App 的数据存在 localStorage，后端路由（`/api/characters/:charId/memories`、`/api/maps`）已完整实现但未接入。

### 9.6 personaId 未传入聊天
ChatApp 在 POST `/api/chat/respond` 时未传 personaId，context.ts 的 `sys-userpersona` 槽位无数据可用。

### 9.7 自动摘要条件触发
`summarySettings.periodicEnabled`、`modeSummaryEnabled`、`dailyEnabled` 均已在后端支持，但前端 ChatApp 的摘要触发逻辑只检查部分条件，与后端设置未完全对齐。

---

---

## 十、2026-04-11 更新

### 10.1 TypeScript 迁移完成

全量迁移至 TypeScript（client + server），旧 .js/.jsx 文件已全部删除。

- `client/src/types/index.ts`：前端类型定义
- `server/types.ts`：后端类型定义（与 client 保持语义一致）
- tsconfig：`strict: false`，Phase 8（开启 strict）待做
- 文件后缀：server 全部 .ts，client 全部 .ts/.tsx

### 10.2 数据库迁移：JSON → SQLite

所有数据存储从 `server/data/*.json` 迁移至 SQLite（`server/data/ics.db`）。

**技术栈：**
- 驱动：better-sqlite3（同步接口，WAL 模式）
- 通用存储：`SqliteStore<T>`（实现 `IFileStore<T>` 接口，blob 存储，JSON in data 列）
- 列式存储：Drizzle ORM（数值系统/事件系统/世界状态，9 张新表）
- 迁移：`server/db/migrate.ts`，启动时自动检测 JSON 文件并迁入 SQLite

**存储架构：**
```
server/
├── db/
│   ├── database.ts     ← 连接单例 + getDb() / getDrizzle() + 建表
│   ├── schema.ts       ← Drizzle schema（数值/事件/世界状态表定义）
│   ├── SqliteStore.ts  ← 通用 blob 存储（实现 IFileStore<T>）
│   └── migrate.ts      ← JSON → SQLite 迁移脚本
├── storage/
│   ├── FileStore.ts    ← 旧文件存储（保留兼容，genId 仍被引用）
│   └── index.ts        ← 所有 store 实例导出（全部是 SqliteStore）
└── data/
    ├── ics.db          ← SQLite 数据库文件
    └── *.json.bak      ← 迁移后的 JSON 备份
```

**表清单（34 张）：**

| 类别 | 表名 | 存储方式 |
|------|------|---------|
| 聊天 | messages, summaries | blob (SqliteStore) |
| 角色 | characters, char_stats, stat_defs, life | blob |
| 角色附属 | items, timeline, skills, relations, memories, dreams | blob |
| 系统配置 | presets, prompt_presets, active(singleton) | blob |
| 世界书 | wb_books, wb_entries | blob |
| 用户数据 | personas, maps | blob |
| App数据 | calendar_events, dafu_game, diary, suixiang_cards, suixiang_entries | blob |
| 存档管理 | sessions | 列式 (直接 SQL) |
| 数值系统 | character_values, value_stages, value_rules | 列式 (Drizzle) |
| 事件系统 | events, event_tags, event_connections, condition_subscriptions, pending_injections | 列式 (Drizzle) |
| 世界状态 | world_state | 列式 (Drizzle) |

### 10.3 已知待做

- Phase 8：tsconfig 开启 `strict: true`
- 数值系统 CRUD 路由 + 道枢前端编辑器改造
- 提示词占位符替换引擎（`{{v:affection:desc}}`）
- 事件系统路由 + 前端可视化编辑器
- char_stats/stat_defs 数据迁移至 character_values（旧表待废弃）

*(文档更新：2026-04-11)*
