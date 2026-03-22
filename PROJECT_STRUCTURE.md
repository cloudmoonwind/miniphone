# Miniphone (ICS) 项目结构与实现说明

> 最后更新：2026-03-22（下午，前端重构后）
> 原则：不省略、不糊弄。每个功能记录前端实现、后端实现、数据结构、与其他功能的联动、外部 AI 接口适配。

---

## 一、宏观架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    Browser (React 18 SPA)                         │
│  App.jsx → APP_ROUTES → 各 App 组件                               │
│  services/*.js → fetch('/api/*')                                  │
└────────────────────────────────┬─────────────────────────────────┘
                                  │ HTTP JSON  /  SSE stream
┌────────────────────────────────▼─────────────────────────────────┐
│                  Express Server (ESM, port 3000)                   │
│  routes/ → services/ → storage/FileStore → data/*.json            │
└──────────────────────────────────────────────────────────────────┘
```

**技术栈：**
- 前端：React 18 + Vite 4 + Tailwind CSS 3 + framer-motion 11，单页应用，模拟手机壳 UI
- 后端：Node.js + Express (ESM `import/export`)，RESTful JSON API，无独立数据库
- 存储：所有数据持久化在 `server/data/*.json`，通过 `FileStore` 类读写
- AI 通信：OpenAI 兼容 SDK 调用（`/v1/chat/completions`），支持流式 SSE 输出
- 全局状态：`core/AppContext.jsx`（React 原生 Context，不引外部库），提供 `activeChar / activePreset / wallpaper / recentChat / navigate`；跨 App 事件通信用 `core/eventBus.js`（轻量 pub/sub）

---

## 二、完整文件结构

```
miniphone/
├── client/
│   ├── index.html
│   ├── vite.config.js               ← 代理 /api → localhost:3000
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx                  ← 主入口：AppProvider + APP_ROUTES 路由表 + 手机壳 UI
│       ├── core/
│       │   ├── AppContext.jsx       ← 全局状态（activeChar/activePreset/wallpaper/recentChat/navigate）
│       │   ├── eventBus.js          ← 跨 App 发布/订阅事件总线
│       │   └── hooks/
│       │       ├── useActiveChar.js
│       │       ├── useNavigation.js
│       │       └── usePreset.js
│       ├── home/
│       │   ├── HomeScreen.jsx       ← 3页横滑首页（从 App.jsx 拆出）
│       │   ├── AppGrid.jsx          ← 图标网格渲染
│       │   ├── Dock.jsx             ← 底部4图标 Dock
│       │   └── widgets/
│       │       ├── ClockWidget.jsx       ← 实时时钟
│       │       ├── ChatPreviewWidget.jsx ← 最近聊天预览
│       │       └── CalendarWidget.jsx    ← 占位（待接 CalendarApp 数据）
│       ├── apps/
│       │   ├── chat/                ← 聊天（原1318行ChatApp.jsx → 6文件）
│       │   │   ├── ChatApp.jsx      ← 入口（无角色时引导屏）
│       │   │   ├── ChatMain.jsx     ← 纯布局层
│       │   │   ├── useChatState.js  ← 全部状态 + 业务逻辑 Hook
│       │   │   ├── MessageBubble.jsx← 消息气泡组件群（含MSG_SEP多段渲染）
│       │   │   ├── ChatCalendar.jsx ← 月历日期查找视图
│       │   │   └── chatFormatters.js← 工具函数/常量（MSG_SEP/buildSegments/formatMsgTime）
│       │   ├── ContactsApp.jsx      ← 结缘：角色管理 CRUD
│       │   ├── SettingsApp.jsx      ← 设置：API预设 + 功能配置（API分配+提示词预设）
│       │   ├── FilesApp.jsx         ← 文件管理（dock）：上下文预设管理，contextItems 编排，token 预算
│       │   ├── CharSystemApp.jsx    ← 角色系统主面板（核心）
│       │   ├── CharPhoneApp.jsx     ← 角色手机（独立全屏模拟手机 UI）
│       │   ├── RuleSystemApp.jsx    ← 道枢·规则系统（SVG 拓扑 + 触发面板）
│       │   ├── NPCApp.jsx           ← NPC关系管理 CRUD
│       │   ├── ItemsApp.jsx         ← 物品库管理
│       │   ├── WorldbookApp.jsx     ← 世界书：书/条目 CRUD + 事件条件编辑
│       │   ├── DreamApp.jsx         ← 梦境记录
│       │   ├── MinggeApp.jsx        ← 命格（用户马甲）管理
│       │   ├── DiaryApp.jsx         ← 日记：日历视图 + 结构化日记（date/title/mood）
│       │   ├── SuixiangApp.jsx      ← 随想：卡片式随笔（话题卡片 + 多次追写条目时间线）
│       │   ├── CalendarApp.jsx      ← 日历：月历视图 + 事件/待办/提醒 CRUD + 彩色标注
│       │   ├── DafuApp.jsx          ← 大富翁：SVG棋盘 + 用户vsAI + AI主持旁白（featurePresets.dafu）
│       │   ├── TimeCapsuleApp.jsx   ← 时光邮局：写给未来的信（localStorage，到期解封）
│       │   ├── MemoryApp.jsx        ← 忆海（⚠ 仅 localStorage，后端路由已备但未接入）
│       │   ├── MapApp.jsx           ← 地图编辑器（⚠ 仅 localStorage）
│       │   ├── BeautifyApp.jsx      ← 壁纸美化（⚠ 仅 localStorage）
│       │   ├── AIConsoleApp.jsx     ← AI 终端：查看 payload / AI 调用日志
│       │   ├── DaoshuApp.jsx        ← 旧数值仪表盘（已被 RuleSystemApp 替代，路由已切换）
│       │   └── PlaceholderApp.jsx   ← 未实现功能占位
│       ├── components/
│       │   ├── StatusBar.jsx        ← 顶部状态栏（时间/电量）
│       │   ├── ErrorBoundary.jsx    ← React 错误边界，防止子组件崩溃白屏
│       │   ├── AppShell.jsx         ← 标准 App 头部（返回+标题+右侧操作区）
│       │   ├── EmptyState.jsx       ← 空状态展示（图标+标题+描述+可选按钮）
│       │   ├── Modal.jsx            ← 底部抽屉弹层（framer-motion）
│       │   └── LoadingSpinner.jsx   ← 加载指示器（sm/md/lg）
│       └── services/
│           ├── api.js               ← 通用 fetch 封装（get/post/put/delete/stream）
│           ├── settings.js          ← API预设 + 功能配置所有方法
│           ├── characters.js        ← 角色 CRUD
│           ├── chat.js              ← 聊天消息 API（含 SSE 流式、摘要、设置）
│           ├── dreams.js            ← 梦境 API
│           ├── charSystem.js        ← 角色系统（timeline/items/skills/relations/stats）
│           ├── worldbook.js         ← 世界书 CRUD + activeEntries
│           ├── personas.js          ← 马甲 CRUD + activate
│           ├── calendar.js          ← 日历事件 CRUD
│           ├── diary.js             ← 日记 CRUD + byDate
│           ├── suixiang.js          ← 随想卡片 + 条目 CRUD
│           ├── dafu.js              ← 大富翁游戏状态 + 操作
│           ├── memories.js          ← 记忆 CRUD
│           └── summaries.js         ← 摘要 CRUD + generate
│
├── server/
│   ├── index.js                     ← Express 启动，注册所有路由，静态文件服务
│   ├── routes/
│   │   ├── chat.js                  ← 聊天核心（两段式发送 + SSE + 触发 extraction）
│   │   ├── characters.js            ← 角色 CRUD + 挂载子资源路由
│   │   ├── items.js                 ← 物品 CRUD
│   │   ├── timeline.js              ← 时间线 CRUD
│   │   ├── skills.js                ← 技能 CRUD
│   │   ├── relations.js             ← 关系 CRUD
│   │   ├── summaries.js             ← 摘要生成 + 触发时间线评估
│   │   ├── charstats.js             ← 数值快照 + 属性定义 + delta + 触发事件
│   │   ├── life.js                  ← 生活日志 CRUD + AI 生成 + 触发提取
│   │   ├── worldbook.js             ← 世界书 CRUD + active-entries
│   │   ├── settings.js              ← API预设 + 功能预设 + 提示词预设 + 时间戳
│   │   ├── prompts.js               ← 上下文预设（contextItems）CRUD（供 FilesApp 使用）
│   │   ├── memories.js              ← 记忆 CRUD
│   │   ├── dreams.js                ← 梦境 CRUD
│   │   ├── maps.js                  ← 地图 CRUD
│   │   ├── personas.js              ← 马甲 CRUD + activate
│   │   ├── diary.js                 ← 日记 CRUD
│   │   ├── suixiang.js              ← 随想卡片 CRUD + 卡片条目 CRUD
│   │   ├── calendar.js              ← 日历事件 CRUD（事件/待办/提醒）
│   │   ├── dafu.js                  ← 大富翁游戏状态 + 掷骰 + 购买 + AI旁白
│   │   └── debug.js                 ← AI调用日志 + 种子数据 + 角色系统设置
│   ├── services/
│   │   ├── ai.js                    ← AI 调用封装（多 provider，流式/非流式）
│   │   ├── context.js               ← 上下文组装（按 contextItems 顺序构建 messages[]）
│   │   ├── worldbook.js             ← 世界书条目过滤 + 事件池管理
│   │   ├── charstats.js             ← 属性定义合并 + 当前数值获取
│   │   ├── charSystem.js            ← 角色系统引擎（3条管道）
│   │   ├── extraction.js            ← 聊天后异步数据提取
│   │   └── promptPresets.js         ← 提示词预设管理（内置+用户自定义）
│   ├── storage/
│   │   ├── FileStore.js             ← 通用 JSON 文件 CRUD 类（id生成、读写、过滤）
│   │   └── index.js                 ← 所有 Store 实例导出 + activeStore 默认值
│   └── providers/
│       └── index.js                 ← 各 AI provider 配置（OpenAI/ZhiPu/DeepSeek/Grok）
│
├── WORKLOG.md                       ← 开发工作日志
└── PROJECT_STRUCTURE.md             ← 本文件
```

---

## 三、存储层

### 3.1 FileStore 类（`server/storage/FileStore.js`）

所有数据存储的基础。每个 `FileStore` 实例管理一个 `server/data/*.json` 文件。

**核心方法：**
- `getAll(filterFn?)` — 读全部，可选过滤函数
- `getById(id)` — 按 id 查单条
- `create(obj)` — 插入（obj 必须含 id）
- `update(id, patch)` — 浅合并更新
- `delete(id)` — 删除
- `getObject()` / `setObject(obj)` — 单对象模式（activeStore 用）

**`genId(prefix)`：** 生成 `prefix_时间戳_随机4位` 格式 ID。

### 3.2 Store 实例与数据文件映射

| Store 实例 | 数据文件 | 数据用途 |
|-----------|---------|---------|
| `characterStore` | `characters.json` | 角色定义（name, avatar, group, bio, isActive 等）|
| `messageStore` | `messages.json` | 聊天消息（charId, role, content, mode, timestamp）|
| `summaryStore` | `summaries.json` | 对话摘要（charId, type, content, messageIds, timestamp）|
| `memoryStore` | `memories.json` | 手动记忆条目 |
| `dreamStore` | `dreams.json` | 梦境记录 |
| `mapStore` | `maps.json` | 地图数据 |
| `presetStore` | `presets.json` | **API 配置预设**（name, apiKey, baseURL, model, provider, params, stream）|
| `promptStore` | `prompt_presets.json` | **用户自定义提示词预设**（name, feature, prompts{}）|
| `lifeStore` | `life.json` | 角色生活日志（charId, period, content, timestamp, eventIds）|
| `wbBookStore` | `wb_books.json` | 世界书容器（name, charId, description）|
| `wbEntryStore` | `wb_entries.json` | 世界书条目（type/mode/eventConfig 等）|
| `statDefStore` | `stat_defs.json` | 自定义属性定义（key, name, min, max, default, color）|
| `charStatStore` | `char_stats.json` | 角色数值快照（charId, stats{}, statusInfo{}）|
| `personaStore` | `personas.json` | 用户马甲（name, avatar, description, color, isActive）|
| `diaryStore` | `diary.json` | 日记（date, title, content, type, mood）|
| `suixiangCardStore` | `suixiang_cards.json` | 随想卡片（title, color, pinned, createdAt, updatedAt）|
| `suixiangEntryStore` | `suixiang_entries.json` | 随想条目（cardId, content, mood, createdAt）|
| `calendarStore` | `calendar_events.json` | 日历事件（title, date, startTime, endTime, type, color, notes, completed）|
| `dafuStore` | `dafu_game.json` | 大富翁游戏状态（players[], cells[], currentPlayerIndex, round, log[], status）|
| `itemStore` | `items.json` | 物品（charId, name, emoji, category, source{}, emotionalValue, condition, status, linkedTimelineIds）|
| `timelineStore` | `timeline.json` | 时间线事件（charId, title, content, type, timestamp, linkedItemIds, extractedSource）|
| `skillStore` | `skills.json` | 技能（charId, name, category, level, experience, description）|
| `relationStore` | `relations.json` | 关系（charId, targetName, targetEmoji, type, closeness, notes）|
| `activeStore` | `active.json` | 全局活跃配置（单对象模式，见 §3.3）|

### 3.3 activeStore 全局配置字段

`active.json` 存储所有全局配置，单对象读写（`getObject/setObject`）：

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

### 4.1 多 Provider 支持（`server/services/ai.js` + `server/providers/index.js`）

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

### 4.3 提示词预设系统（`server/services/promptPresets.js`）

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

**前端 service（`client/src/services/settings.js`）：**
- `listPromptPresets(feature?)` / `createPromptPreset(data)` / `updatePromptPreset(id, data)` / `deletePromptPreset(id)`
- `getFeaturePromptPresets()` / `setFeaturePromptPresets(data)`

---

## 五、功能实现详解

### 5.1 聊天系统（ChatApp）

**前端：** `client/src/apps/chat/`（6文件，入口 `ChatApp.jsx`，逻辑 `useChatState.js`，布局 `ChatMain.jsx`）
**后端：** `server/routes/chat.js`，`server/services/context.js`

**数据流：**
```
用户输入 → POST /api/chat/message      → messageStore.create({ role:'user', charId, content, mode })
         → POST /api/chat/respond      → context.assembleMessages(charId, promptPresetId)
                                       → AI chatCompletionStream()
                                       → SSE 推送 token 到前端
                                       → 流结束 → messageStore.create({ role:'assistant' })
                                       → triggerExtraction(charId)  ← 异步，不阻塞响应
```

**上下文组装（`context.js`）：**
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

**前端：** `client/src/apps/SettingsApp.jsx`（3 个 Tab）
**后端：** `server/routes/settings.js`

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

### 5.3 聊天后自动提取（extraction.js）

**后端：** `server/services/extraction.js`
**触发点：** `server/routes/chat.js` 的 AI 回复完成后（异步，不阻塞聊天响应）

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

### 5.4 角色系统引擎（charSystem.js）

**后端：** `server/services/charSystem.js`
**设计理念：** 角色系统是主体，聊天是数据来源之一。角色有独立生活、状态、关系，不依赖用户持续互动。

#### 管道 1：总结 → 时间线

**触发点：** `server/routes/summaries.js` 生成摘要后调用

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

**触发点：** `server/routes/charstats.js` 数值变化后调用（同步，在 delta 请求内执行）

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

**触发点：** `server/routes/life.js` 生活日志生成后调用（异步）

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

**前端：** `client/src/apps/CharSystemApp.jsx`
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

**前端：** `client/src/apps/CharPhoneApp.jsx`
**路由：** 从 App.jsx 的 `角色手机` 入口进入（独立全屏，非手机壳内嵌）

**UI 结构：**
- 模拟手机主屏幕（图标网格）：消息 / 联系人 / 朋友圈 / 相册 / 备忘录 / 收藏
- **消息页**：读取 `messageStore`（`GET /api/characters/:charId/messages`），联系人列表 → 进入聊天界面，角色消息在右侧，用户消息在左侧（与主聊天 App 方向相反，表现角色视角）
- **朋友圈**：读取 `lifeStore`（`GET /api/characters/:charId/life`），将生活日志渲染为社交动态卡片（时间/文字内容/事件标签）

**与其他功能的联动：**
- 消息数据来自主聊天（ChatApp 写入的 messageStore）
- 朋友圈数据来自生活日志（life.js 生成的 lifeStore）

---

### 5.7 道枢·规则系统（RuleSystemApp）

**前端：** `client/src/apps/RuleSystemApp.jsx`
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

### 5.8 生活日志生成（life.js）

**后端：** `server/routes/life.js`
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

### 5.9 对话摘要系统（summaries.js）

**后端：** `server/routes/summaries.js`

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

### 5.10 角色数值系统（charstats.js 路由 + 服务）

**后端：** `server/routes/charstats.js`，`server/services/charstats.js`

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

**前端：** `client/src/apps/NPCApp.jsx`
**后端：** `server/routes/relations.js`（挂载在 `characters.js` 子路由）

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
- `charSystem.js` 的 extraction 管道会更新 `relationStore.closeness`
- CharSystemApp 的关系星座 SVG 图读取相同数据

---

### 5.12 世界书系统（WorldbookApp）

**前端：** `client/src/apps/WorldbookApp.jsx`
**后端：** `server/routes/worldbook.js`，`server/services/worldbook.js`

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
返回该角色所有活跃的 background 条目（always 类型 + keyword 匹配）。供 `context.js` 在上下文组装时调用。

**事件池接口（`getEventPoolEntries(charId)`）：**
返回该角色所有 event-random 和 event-conditional 条目。供 `life.js` 的 `pickEvents()` 调用。

---

### 5.13 上下文管理（FilesApp / 文件管理）

**前端：** `client/src/apps/FilesApp.jsx`（从 Dock「文件管理」入口进入）
**后端：** `server/routes/prompts.js`，`server/services/context.js`

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

## 六、前端路由表（App.jsx）

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
| `life.json` | 3 条 | 2026-03-20 上午/下午/傍晚 |
| `char_stats.json` | +1条 | mood:45, energy:60, stress:55, trust:30, relationship:38，含 statusInfo |
| `wb_books.json` | +1本 | 郁疏澜的世界（wb_ysl_life）|
| `wb_entries.json` | +9条 | 2 background(always+keyword) / 3 event-random(墨的撒娇/深夜灵感/意外关心) / 4 event-conditional(stress≥70/mood≥75/mood≤25/trust≥65) |

timeline 条目 `linkedItemIds` 与 items 的 `linkedTimelineIds` 双向引用，实现跨 Store 关联。

---

## 九、已知问题与局限

### 9.1 规则系统后端未实现互斥/依赖
`pickEvents()` 在 `life.js` 中只按 condition + weight 选取事件，未考虑：
- `exclusionGroup`：同组只选一个
- `requires[]`：前置依赖事件是否已发生
- `multiConditions`：多条件 AND 逻辑（只有 stat 类型做了实现）

### 9.2 activePreset 字段冗余
`active.json` 同时存在 `activePresetId`（旧）和 `primaryPresetId`（新），两者始终保持同值写入。读取时优先 `primaryPresetId`。

### 9.3 extraction 默认关闭
`charSystemSettings.extractionEnabled` 默认 `false`。需要在 CharSystemApp 设置面板中手动开启，否则聊天后不会自动提取数据。

### 9.4 contextItem.maxTokens 未实现
上下文预设中各 item 的 `maxTokens` 字段已存储，但 `context.js` 中尚未按该字段对内容做截断。

### 9.5 MemoryApp / MapApp 数据孤岛
两个 App 的数据存在 localStorage，后端路由（`/api/characters/:charId/memories`、`/api/maps`）已完整实现但未接入。

### 9.6 personaId 未传入聊天
ChatApp 在 POST `/api/chat/respond` 时未传 personaId，context.js 的 `sys-userpersona` 槽位无数据可用。

### 9.7 自动摘要条件触发
`summarySettings.periodicEnabled`、`modeSummaryEnabled`、`dailyEnabled` 均已在后端支持，但前端 ChatApp 的摘要触发逻辑只检查部分条件，与后端设置未完全对齐。

---

*(文档更新：2026-03-22)*
