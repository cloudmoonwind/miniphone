# Miniphone (ICS) 项目结构与实现说明

> 最后更新：2026-03-17
> 覆盖：文件组织 / 前后端架构 / 功能数据流 / 已实现与未实现状态 / 已知断裂与空白

---

## 一、宏观架构

```
┌─────────────────────────────────────────────────────────┐
│               Browser (React SPA)                        │
│   App.jsx → APP_ROUTES → 各 App 组件 → fetch /api/*     │
└──────────────────────────────┬──────────────────────────┘
                               │ HTTP (JSON / SSE stream)
┌──────────────────────────────▼──────────────────────────┐
│               Express Server (port 3000)                 │
│   routes/ → services/ → storage/ → data/*.json          │
└─────────────────────────────────────────────────────────┘
```

- **前端**：React 18 + Vite + Tailwind CSS + framer-motion，单页应用，模拟手机壳 UI
- **后端**：Node.js + Express (ESM)，RESTful API，无数据库，所有数据存储在 `server/data/*.json`
- **通信**：`fetch /api/*`（普通请求）+ SSE 流式输出（聊天）
- **无状态管理库**：前端主要用 React useState/useEffect，无 Zustand/Redux

---

## 二、文件结构

```
miniphone/
├── client/
│   ├── src/
│   │   ├── App.jsx                  ← 主入口，HomeScreen + APP_ROUTES 路由表
│   │   ├── apps/                    ← 各功能 App（每个 App 是独立自治组件）
│   │   │   ├── ChatApp.jsx          ← 核心聊天
│   │   │   ├── ContactsApp.jsx      ← 角色管理（结缘）
│   │   │   ├── SettingsApp.jsx      ← API 设置 / 功能预设
│   │   │   ├── FilesApp.jsx         ← 文件管理：上下文流水线（真正控制消息组装顺序）
│   │   │   ├── MemoryApp.jsx        ← 记忆查看（⚠️ 仅本地存储，未连后端）
│   │   │   ├── MapApp.jsx           ← 地图编辑器（⚠️ 仅本地存储，未连后端）
│   │   │   ├── DreamApp.jsx         ← 梦境记录（星空可视化）
│   │   │   ├── WorldbookApp.jsx     ← 世界书管理（书 + 条目 CRUD）
│   │   │   ├── CharLifeApp.jsx      ← 角色生活生成（AI 生成 + 日志查看）
│   │   │   ├── DaoshuApp.jsx        ← 道枢数值仪表盘（可视化 + 快捷调节）
│   │   │   ├── MinggeApp.jsx        ← 命格用户马甲管理
│   │   │   ├── DiaryApp.jsx         ← 日记/随笔（月历 + 沉浸写作）
│   │   │   ├── BeautifyApp.jsx      ← 壁纸美化（localStorage）
│   │   │   └── AIConsoleApp.jsx     ← AI 终端（原始 API payload 查看）
│   │   ├── components/
│   │   │   ├── StatusBar.jsx        ← 顶部状态栏
│   │   │   ├── PlaceholderApp.jsx   ← 未实现 App 的品牌化占位页
│   │   │   └── ErrorBoundary.jsx    ← React 错误边界
│   │   └── services/
│   │       ├── settings.js          ← SettingsApp API 调用封装
│   │       ├── characters.js        ← 角色 CRUD 封装
│   │       ├── chat.js              ← 聊天消息 API 封装
│   │       └── dreams.js            ← 梦境 API 封装
│
├── server/
│   ├── index.js                     ← Express 启动，注册所有路由
│   ├── routes/                      ← HTTP 接口层（Controller）
│   │   ├── chat.js                  ← 聊天核心（发消息 / AI 回复 / 消息 CRUD）
│   │   ├── characters.js            ← 角色 CRUD
│   │   ├── memories.js              ← 记忆 CRUD
│   │   ├── summaries.js             ← 对话摘要（生成 + 管理）
│   │   ├── dreams.js                ← 梦境 CRUD
│   │   ├── maps.js                  ← 地图数据 CRUD
│   │   ├── settings.js              ← API 预设 / 功能预设 / 时间戳设置
│   │   ├── prompts.js               ← 律令(FilesApp) 预设 + 条目 CRUD
│   │   ├── worldbook.js             ← 世界书（书 + 条目）CRUD + active-entries
│   │   ├── charstats.js             ← 角色数值快照 + 属性定义 CRUD + delta
│   │   ├── personas.js              ← 用户马甲 CRUD + 激活/取消
│   │   ├── life.js                  ← 角色生活日志 + AI 生成
│   │   ├── diary.js                 ← 用户日记 CRUD
│   │   └── debug.js                 ← AI 调用日志（内存，不持久化）
│   ├── services/                    ← 业务逻辑层（Service）
│   │   ├── ai.js                    ← AI 模型调用封装 + 调用日志
│   │   ├── context.js               ← 上下文组装（预设驱动，slot 顺序决定消息数组）
│   │   ├── worldbook.js             ← 世界书条目解析（getActiveNonEventEntries）
│   │   └── charstats.js             ← 属性定义合并（getMergedStatDefs / getCharStats）
│   └── storage/
│       ├── FileStore.js             ← 通用 JSON 文件 CRUD（getAll/create/update/delete）
│       ├── index.js                 ← 所有 Store 实例导出
│       └── data/                    ← 实际数据文件（见下方清单）
│
└── PROJECT_STRUCTURE.md

```

---

## 三、后端架构详解

### 3.1 路由层（routes/）

| 路由文件 | 挂载路径 | 主要端点 |
|---------|---------|---------|
| `chat.js` | `/api/chat`, `/api` | POST `/api/chat/message`（存用户消息）<br>POST `/api/chat/respond`（AI 流式回复）<br>GET `/api/characters/:id/messages`<br>PUT/DELETE `/api/messages/:id` |
| `characters.js` | `/api/characters` | 角色 CRUD |
| `memories.js` | `/api/characters/:charId/memories` | 记忆 CRUD |
| `summaries.js` | `/api/characters/:charId/summaries` | 摘要 CRUD + AI 生成 + 按日期查询 |
| `dreams.js` | `/api/characters/:charId/dreams` | 梦境 CRUD |
| `maps.js` | `/api/maps` | 地图 CRUD + 激活地图管理 |
| `settings.js` | `/api/settings` | API 预设 CRUD + 功能预设分配 + 时间戳/摘要设置 |
| `prompts.js` | `/api/prompt` | 律令预设（preset + entry）CRUD + GET/PUT `/active` |
| `worldbook.js` | `/api/worldbook` | 书/条目 CRUD + GET `/active-entries?charId=` |
| `charstats.js` | `/api/charstats` | 数值快照 CRUD + delta + 属性定义 CRUD（`/defs` 在 `/:charId` 之前注册）|
| `personas.js` | `/api/personas` | 马甲 CRUD + activate/deactivate |
| `life.js` | `/api/characters/:charId/life` | 生活日志 CRUD + POST `/generate` |
| `diary.js` | `/api/diary` | 日记 CRUD（?month= 过滤）|
| `debug.js` | `/api/debug` | GET `/ai-log`（内存中最近 30 次 AI 调用）|

### 3.2 服务层（services/）

| 服务 | 职责 |
|-----|-----|
| `ai.js` | 封装 OpenAI 兼容 SDK；`getClient(preset)` / `chatCompletion()` / `chatCompletionStream()`；维护内存 AI 调用日志 |
| `context.js` | **核心上下文组装**：读取激活的预设（contextItems），按条目顺序构建 messages[]。每个系统槽（sys-*）对应一个 blockType，history 槽展开为多条 user/assistant 消息。自定义条目直接注入。支持 role 覆盖、historyCount 参数 |
| `worldbook.js` | `getActiveNonEventEntries(charId)`：返回 always/keyword 模式的世界书条目<br>`getEventPoolEntries(charId)`：返回 event-random/event-conditional 条目 |
| `charstats.js` | `getMergedStatDefs(charId)`：合并默认属性定义与自定义定义<br>`getCharStats(charId)`：获取角色当前数值 |

### 3.3 存储层（storage/）

FileStore 封装：所有数据以 JSON 数组存储。active.json 使用单对象模式。

| Store 实例 | 数据文件 | 用途 |
|-----------|---------|-----|
| `characterStore` | `characters.json` | 角色定义 |
| `messageStore` | `messages.json` | 聊天消息 |
| `summaryStore` | `summaries.json` | 对话摘要 |
| `memoryStore` | `memories.json` | 手动记忆 |
| `dreamStore` | `dreams.json` | 梦境记录 |
| `mapStore` | `maps.json` | 地图数据 |
| `presetStore` | `presets.json` | API 预设（key/model/params）|
| `lifeStore` | `life.json` | 角色生活日志 |
| `promptStore` | `prompt_presets.json` | 律令预设 + 自定义条目 |
| `wbBookStore` | `wb_books.json` | 世界书（容器）|
| `wbEntryStore` | `wb_entries.json` | 世界书条目 |
| `statDefStore` | `stat_defs.json` | 自定义属性定义 |
| `charStatStore` | `char_stats.json` | 角色当前数值快照 |
| `personaStore` | `personas.json` | 用户马甲 |
| `diaryStore` | `diary.json` | 用户日记 |
| `activeStore` | `active.json` | 全局单例配置（primaryPresetId / activePromptPresetId / featurePresets / summarySettings / timestampSettings / summaryPrompts / activePersonaId / activeMapId）|

---

## 四、前端架构详解

### 4.1 App 路由系统（App.jsx）

桌面分 3 页，点击图标调用 `onOpenApp(id)` → 查找 `APP_ROUTES[id]` → 渲染对应组件（或 `PlaceholderApp` 兜底）。

```
HomeScreen
├── Page 1：结缘 / 道枢 / 律令/ 命格 / 地图 / 世界书 / 群聊 / 角色系统 / 社区 / 忆海
├── Page 2：美化 / 日历 / 随笔 / 记账 / 日记 / 物品库 / 创作 / 异世界之旅 / npc管理 / 珍藏
└── Page 3：梦境 / 无限流 / 大富翁 / 时光邮局 / 养宠 / 约会 / ta的秘密 / AI终端
Dock：联系人（PlaceholderApp） / [空] / 文件管理（FilesApp） / 设置（SettingsApp）
```

### 4.2 各 App 实现状态

| App | 路由 Key | 实现状态 | 备注 |
|-----|---------|---------|-----|
| ChatApp | `chat` | ✅ 完整 | 双阶段发送（存消息+AI回复分离）；SSE 流式；消息合并；模式切换；自动摘要触发 |
| ContactsApp | `结缘` | ✅ 完整 | 角色 CRUD；长按选择；标签/分组过滤；链接到 chat |
| SettingsApp | `settings` | ✅ 完整 | API 预设管理；功能预设分配（summaries/life/dafu）；模型测试 |
| FilesApp  | `files` | ✅ 重构完成 | **上下文流水线**：条目顺序 = 实际消息组装顺序；系统槽（角色人设/世界书/记忆等）+ 自定义条目；role 参数；token 估算；historyCount 深度控制 |
| DreamApp | `梦境` | ✅ 完整 | 梦境类型（情感/征兆/记忆/欲望）；星空可视化；解读字段 |
| WorldbookApp | `世界书` | ✅ 完整 | 书/条目 3 层级；4 种激活模式；4 种插入位置；事件条件编辑器 |
| CharLifeApp | `角色系统` | ✅ 完整 | AI 生活生成；道枢数值面板；时段选择；prompt payload 可视 |
| DaoshuApp | `道枢` | ✅ 完整 | 心情渐变背景；SVG 圆环；数值条 + ±5 调节；事件池实时预览 |
| MinggeApp | `命格` | ✅ 完整 | 马甲卡片网格；颜色/emoji 选择；长按编辑/删除；当前激活显示 |
| DiaryApp | `日记`/`随笔` | ✅ 完整 | 月历有记录标点；全屏写作模式；心情 emoji 选择 |
| AIConsoleApp | `终端` | ✅ 完整 | 原始 API payload 输出；grep 过滤；自动刷新 |
| BeautifyApp | `美化` | ⚠️ 最小 | 仅壁纸上传，localStorage 存储 |
| MemoryApp | `忆海` | ❌ 断裂 | **只读 localStorage，从未调用后端 `/api/memories/*`**；后端已完整实现 |
| MapApp | `地图` | ❌ 断裂 | **只用 localStorage，从未调用后端 `/api/maps/*`**；后端已完整实现 |

**PlaceholderApp 兜底的 App（无后端）：**
日历 / 记账 / 物品库 / 创作 / 异世界之旅 / npc管理 / 珍藏 / 无限流 / 大富翁 / 时光邮局 / 养宠 / 约会 / ta的秘密 / 群聊 / 社区

---

## 五、关键功能数据流

### 5.1 文件管理（FilesApp）上下文组装流水线

```
 App（client）
  ├── contextItems[] = [
  │     { entryId: 'sys-persona',     enabled, roleOverride, maxTokens },
  │     { entryId: 'sys-wbtop',       enabled, ... },
  │     { entryId: 'sys-memories',    enabled, ... },
  │     { entryId: 'sys-summaries',   enabled, ... },
  │     { entryId: 'sys-userpersona', enabled, ... },
  │     { entryId: 'sys-wbbefore',    enabled, ... },
  │     { entryId: 'sys-history',     enabled, historyCount: 20 },  ← 展开为多条消息
  │     { entryId: 'sys-wbafter',     enabled, ... },
  │     { entryId: 'sys-wbbottom',    enabled, ... },
  │     { entryId: 'pent_xxx',        enabled, roleOverride: 'user', ... },  ← 自定义
  │   ]
  └── 存入 promptStore (prompt_presets.json)
           ↓
context.js (server)  ← 被 /api/chat/respond 调用
  ├── 读取 activePromptPresetId → 加载 contextItems
  ├── 并行加载：char / messages / summaries / memories / worldbook / persona
  └── 按 contextItems 顺序迭代：
        sys-persona     → {role:'system', content: 角色人设}
        sys-wbtop       → {role:'system', content: 世界书system-top条目}
        sys-memories    → {role:'system', content: 重要记忆}
        sys-summaries   → {role:'system', content: 近期摘要}
        sys-userpersona → {role:'system', content: 马甲内容}
        sys-wbbefore    → {role:'system', content: 世界书before-chat条目}
        sys-history     → 展开为 N 条 user/assistant 消息（含时间戳）
        sys-wbafter     → {role:'system', content: 世界书after-chat条目}
        sys-wbbottom    → {role:'system', content: 世界书system-bottom条目}
        自定义条目      → {role: entry.role, content: entry.content}
           ↓
        最终 messages[] → ai.chatCompletionStream()
```

### 5.2 发送聊天消息（双阶段）

```
用户点击发送
  → POST /api/chat/message { charId, content, personaId? }
      → messageStore.create()
      → 触发自动摘要检查（每 N 条）
      ← 返回 { message }

  → POST /api/chat/respond { charId, personaId?, stream:true }
      → context.assembleMessages(charId)  ← 律令流水线驱动
      → ai.chatCompletionStream()  ← SSE 流式输出
      → 前端 EventSource 接收 token → 更新气泡
      → 流结束后 messageStore.create()  ← 存 AI 消息
```

### 5.3 世界书注入

世界书条目按 `insertionPosition` 归类到 4 个位置：
- `system-top` → 由 `sys-wbtop` 槽注入
- `system-bottom` → 由 `sys-wbbottom` 槽注入
- `before-chat` → 由 `sys-wbbefore` 槽注入（对话历史之前）
- `after-chat` → 由 `sys-wbafter` 槽注入（对话历史之后）

激活条件：`always` 无条件；`keyword` 检查近 20 条消息是否含关键词

### 5.4 角色生活生成

```
POST /api/characters/:charId/life/generate { period, eventCount, save }
  → getCharStats(charId)          ← 当前数值
  → getMergedStatDefs(charId)     ← 属性定义
  → getEventPoolEntries(charId)   ← event-random + event-conditional 条目
  → pickEvents(pool, stats, count)
      → event-conditional: 按 condition{stat, op, value} 过滤
      → event-random: 按 weight 加权随机
  → buildLifePrompt({...})
  → ai.chatCompletion()
  → lifeStore.create() if save
  ← { log, debug: { eventsSelected, statsUsed, messagesPayload } }
```

### 5.5 道枢数值快速调节

```
DaoshuApp 点击 ±5
  → POST /api/charstats/:charId/delta { key, delta }
      → getMergedStatDefs(charId)
      → Math.max(min, Math.min(max, prev + delta))
      → charStatStore.update() / create()
      ← { stats, changed }
  → 前端更新 → 渐变色、圆环、进度条动效
```

---

## 六、功能完整性速览

### ✅ 已完整实现（前后端贯通）

- 聊天系统（ChatApp ↔ /api/chat）
- 角色管理（ContactsApp ↔ /api/characters）
- API 设置 / 功能预设分配（SettingsApp ↔ /api/settings）
- **(FilesApp) 上下文流水线**（FilesApp ↔ /api/prompt → context.js 驱动）
- 梦境记录（DreamApp ↔ /api/dreams）
- 世界书（WorldbookApp ↔ /api/worldbook）
- 角色生活生成（CharLifeApp ↔ /api/life）
- 道枢数值面板（DaoshuApp ↔ /api/charstats）
- 命格马甲管理（MinggeApp ↔ /api/personas）
- 日记/随笔（DiaryApp ↔ /api/diary）
- 对话摘要（ChatApp 内联 ↔ /api/summaries）
- AI 终端调试（AIConsoleApp ↔ /api/debug）

### ❌ 断裂：后端实现但前端未连接

| 功能 | 后端路由 | 前端现状 | 症状 |
|-----|---------|---------|-----|
| **记忆（忆海）** | `/api/memories` 完整 | MemoryApp 只读 localStorage | 数据不持久，不跨设备 |
| **地图** | `/api/maps` 完整 | MapApp 只用 localStorage | 地图数据丢失风险高 |
| **大富翁 AI 预设** | `featurePresets.dafu` 存储支持 | SettingsApp 显示但无 App 消费它 | 可以设置但无功能 |

### ⚠️ 未完善：后端实现但前端 UI 未暴露

| 功能 | 后端支持 | 前端缺失 |
|-----|---------|---------|
| 摘要 token 上限生效 |  contextItem.maxTokens 字段已存储 | context.js 未实现 maxTokens 截断逻辑 |
| 时间戳格式切换（bracket vs metadata）| ✅ active.timestampSettings.timestampFormat | SettingsApp 无此选项 |
| Context 模式（flexible vs strict）| ✅ /api/chat/respond 支持 contextMode | 无任何 UI 入口 |
| 自定义属性定义（statDefs CRUD）| ✅ /api/charstats/defs | 无前端编辑界面 |
| 按日期查询摘要 | ✅ GET /api/summaries/by-date | 无前端利用此接口 |
| 摘要手动触发（日总结/段落总结）| ✅ POST /api/summaries/generate-daily | ChatApp 仅有自动触发 |
| 记忆重要性自动推断 | 字段已有 | 需 AI 抽取关键事实写入 memoryStore |

### 🚧 完全未实现

| App/功能 | 说明 |
|---------|-----|
| 群聊 | 多角色同时参与对话 |
| 大富翁 | 棋盘游戏，需 AI 主持路由 |
| 无限流 | 穿越世界故事，需场景管理 |
| 时光邮局 | 定时信件，需 cron/时间锁 |
| 养宠 / 约会 | 关系深化机制 |
| ta的秘密 | 解锁机制 |
| 社区 | 内容分享，可能需远程服务 |
| 日历 | 现实 + 角色时间轴并排 |
| 记账 | 资产记录 |
| 物品库 | 礼物/道具系统 |
| 创作 | 协作写作 |
| 异世界之旅 | 探索系统，依赖地图 + 世界书联动 |
| npc管理 | 群像关系网 |
| 珍藏 | 收藏夹 |

---

## 七、已知 Bug / 设计问题

### 7.1  maxTokens 未生效
`contextItem.maxTokens` 字段已存储，但 `context.js` 尚未实现按 token 上限截断内容的逻辑。存入时仅记录，无实际效果。

### 7.2 MemoryApp / MapApp 数据孤岛
这两个 App 的数据存在 `localStorage`，用户改浏览器或换设备就会丢失。后端路由均已完整，只需将前端 API 调用替换为 fetch 即可。

### 7.3 keyword 激活完整性
世界书 keyword 激活模式只匹配消息内容，不匹配角色名/时间/摘要，低流量对话容易错过触发窗口。

### 7.4 角色马甲（personaId）在聊天中未完整实现
`context.js` 接受并尝试读取 `active.activePersonaId`，但 `ChatApp` 的发送逻辑不传 personaId 参数。

### 7.5 debug 日志不持久化
`/api/debug/ai-log` 只保存内存中最近 30 次调用，服务重启后清空。`AIConsoleApp` 无法查看历史 AI 交互。

### 7.6 activePreset 字段混乱
`active.json` 同时存在 `activePresetId`（旧）和 `primaryPresetId`（新），两者含义相近但使用场所不同（`activePresetId` 在 chat 路由里用于 API 预设，`activePromptPresetId` 用于上下文预设）。需在 SettingsApp 中统一。

---

## 八、数据文件清单（server/data/）

| 文件 | 存在 | 内容 |
|-----|-----|-----|
| `active.json` | ✅ | 单对象：primaryPresetId / activePromptPresetId / featurePresets / summarySettings / timestampSettings / summaryPrompts / activeMapId / activePersonaId |
| `characters.json` | ✅ | 角色列表（含艾莉测试角色）|
| `messages.json` | ✅ | 聊天记录 |
| `summaries.json` | ✅ | 对话摘要条目 |
| `presets.json` | ✅ | API 预设（key/model/params）|
| `prompt_presets.json` | ✅ | 律令预设（含完整 9 个系统槽默认预设）|
| `wb_books.json` | ✅ | 世界书容器（现代都市通用 + 艾莉专属）|
| `wb_entries.json` | ✅ | 世界书条目（13 条：always/keyword/event 类型均有）|
| `char_stats.json` | ✅ | 艾莉初始数值（mood/energy/relationship/trust/stress）|
| `stat_defs.json` | ✅ | 空数组（使用 DEFAULT_STAT_DEFS 内置默认值）|
| `memories.json` | ✅ | 空数组（MemoryApp 未连后端）|
| `dreams.json` | 按需创建 | 梦境记录 |
| `life.json` | 按需创建 | 角色生活日志 |
| `personas.json` | 按需创建 | 用户马甲 |
| `diary.json` | 按需创建 | 日记条目 |
| `maps.json` | 按需创建 | MapApp 未连后端，可能为空 |

---

## 九、律令（FilesApp）设计意图与参数体系

### 9.0 核心定位

律令**不是**展示面板，是整个系统向 AI 发送消息的**唯一编排入口**。

- 律令里有多少条目，AI 收到的 messages[] 里就有多少块内容（disabled 除外）
- 条目顺序 = 消息数组顺序，顺序直接影响模型对信息的优先级
- 系统槽（`sys-*`）的内容来自其他 App，律令里展示"去 XXX 修改"说明，不可在此编辑
- 自定义条目（`pent_*`）的内容在律令里直接写、直接改
- `role` 参数控制该块在 messages[] 里的 role（system/user/assistant），直接影响模型处理方式

### 9.1 条目完整参数表

| 参数 | 类型 | 说明 |
|-----|-----|-----|
| `enabled` | boolean | 禁用时完全跳过，不注入 |
| `roleOverride` | string/null | null 时用槽默认 role；自定义条目必须指定（system/user/assistant）|
| `maxTokens` | number | 该条目允许的最大 token 数；超出时截断（⚠️ context.js 截断逻辑未实现）|
| `historyCount` | number | 仅 `sys-history` 有效：展开多少条原始消息（默认 20）|
| `label` | string | 用户自定义条目名称 |
| `content` | string | 自定义条目内容；系统槽留空（context.js 自动填充）|

### 9.2 historyCount 与预设类型的冲突

摘要生成需要更多历史（全面），聊天回复需要适量历史（省 token），两者对 `historyCount` 需求相反，当前共用同一个 `sys-history` 条目。

**当前策略**：正常聊天用律令预设 `historyCount`；摘要生成在 `summaries.js` 路由里用独立窗口，不走律令预设。未来律令预设支持 `type` 字段（`chat`/`summary`/`life`），按请求类型加载不同预设。

### 9.3 Token 预算实现状态

| 功能 | 状态 |
|-----|------|
| 条目 token 估算显示 | ✅ |
| `maxTokens` 字段存储 | ✅ |
| 全局预算对比表盘 | ❌ 未实现 |
| context.js 实际按 maxTokens 截断 | ❌ 未实现 |
| 超出警告 UI | ❌ 未实现 |

### 9.4 系统槽一览（与 context.js SLOT_DEFS 保持同步）

| 槽 ID | 名称 | 默认 Role | 内容来源 | 修改位置 |
|-------|------|---------|---------|---------|
| `sys-persona` | 角色人设 | system | char.name/core/persona | 结缘 App |
| `sys-wbtop` | 世界书·上层 | system | 世界书 system-top 条目 | 世界书 App |
| `sys-memories` | 重要记忆 | system | memoryStore (importance≥7) | 忆海 App |
| `sys-summaries` | 对话摘要 | system | summaryStore (最近5条) | 聊天（自动生成）|
| `sys-userpersona` | 用户人设 | system | active.activePersonaId → personaStore | 命格 App |
| `sys-wbbefore` | 世界书·对话前 | system | 世界书 before-chat 条目 | 世界书 App |
| `sys-history` | 聊天历史 | 展开 | messageStore (近 historyCount 条) | 聊天（产生）|
| `sys-wbafter` | 世界书·对话后 | system | 世界书 after-chat 条目 | 世界书 App |
| `sys-wbbottom` | 世界书·下层 | system | 世界书 system-bottom 条目 | 世界书 App |

自定义条目（`pent_*`）：内容在律令 App 内直接编辑，role 可设置为 system/user/assistant。

---

## 十、下一步建议（优先级排序）

1. **P0 — 律令 maxTokens 截断**：context.js 按条目 maxTokens 截断，全局预算 UI 警告
2. **P0 — 修复 MemoryApp**：localStorage → `/api/memories` fetch
3. **P1 — ChatApp 传 personaId**：从 active.activePersonaId 获取并传入 /respond
4. **P1 — 律令预设类型分离**：chat/summary/life 预设分离，解决 historyCount 冲突
5. **P1 — 记忆自动提取**：对话摘要生成后 AI 提炼关键事实写入 memoryStore
6. **P2 — DaoshuApp 补充属性定义编辑**：调用 /api/charstats/defs
7. **P2 — 地图迁移到后端**：MapApp localStorage → `/api/maps`
8. **P3 — 群聊功能设计与实现**
9. **P3 — AI 调用日志持久化**

---

*(文档更新：2026-03-17)*
