# TypeScript 迁移计划

> 开始时间：2026-04-11  
> 目标：将 client（React/JSX）和 server（Node/ESM）全量迁移至 TypeScript  
> 策略：**渐进式** — `allowJs: true` + `strict: false` 起步，逐 phase 收紧

---

## 代码量基线

| 端     | 文件数  | 总行数  |
|--------|--------|--------|
| client | ~67 个 | 22,576 |
| server | ~38 个 |  5,749 |
| 合计   | ~105个 | ~28,325 |

---

## 模块边界 & 架构速览

### Client 分层

```
client/src/
├── main.jsx                     # React 挂载点
├── App.jsx                      # 根组件：AppProvider + APP_ROUTES 字典路由
├── core/
│   ├── AppContext.jsx            # 全局状态：activeChar / activePreset / wallpaper / recentChat / navigate
│   ├── eventBus.js              # 轻量 pub/sub（char:updated / preset:changed / recentChat:update 等）
│   └── hooks/
│       ├── useActiveChar.js     # 从 AppContext 取 activeChar
│       ├── useNavigation.js     # navigate helper
│       └── usePreset.js         # 从 AppContext 取 activePreset
├── services/                    # 薄层 fetch 封装，全部调用 /api/*
│   ├── api.js                   # 基础 request() wrapper（GET/POST/PUT/DELETE）
│   ├── characters.js            # /api/characters CRUD
│   ├── settings.js              # /api/settings + active preset
│   ├── chat.js                  # /api/chat（send/stream/messages）
│   ├── charSystem.js            # /api/characters/:id/items|timeline|skills|relations
│   ├── worldbook.js             # /api/worldbook/books + entries
│   ├── calendar.js              # /api/calendar
│   ├── dafu.js                  # /api/dafu
│   ├── diary.js                 # /api/diary
│   ├── dreams.js                # /api/characters/:id/dreams
│   ├── memories.js              # /api/characters/:id/memories
│   ├── personas.js              # /api/personas
│   ├── summaries.js             # /api/characters/:id/summaries
│   └── suixiang.js              # /api/suixiang
├── components/                  # 通用 UI 组件
│   ├── AppShell.jsx             # 标准页面壳（顶栏 + 内容区）
│   ├── Modal.jsx                # 全屏模态层
│   ├── Avatar.jsx               # 角色头像（图片 or emoji fallback）
│   ├── AvatarUpload.jsx         # 头像上传（file input）
│   ├── EmptyState.jsx           # 空状态占位
│   ├── LoadingSpinner.jsx       # loading 动画
│   ├── ErrorBoundary.jsx        # React 错误边界
│   ├── PlaceholderApp.jsx       # 未实现 App 占位页
│   └── StatusBar.jsx            # 顶部状态栏（时间 + 信号）
├── home/                        # 主屏
│   ├── HomeScreen.jsx           # 主屏（壁纸 + AppGrid + Dock + widgets）
│   ├── AppGrid.jsx              # 应用图标网格
│   ├── Dock.jsx                 # 底部 Dock（4格）
│   └── widgets/
│       ├── ChatPreviewWidget.jsx # 最近聊天 widget
│       └── CalendarWidget.jsx   # 日历 widget（当前日期）
└── apps/                        # 各功能 App（每个独立页面）
    ├── chat/
    │   ├── ChatApp.jsx          # 聊天入口（薄壳，含 useChatState）
    │   ├── ChatMain.jsx         # 聊天主体（消息列表 + 输入框 + SSE 流）
    │   ├── useChatState.js      # 聊天全部状态逻辑（472行）
    │   ├── MessageBubble.jsx    # 气泡（长按菜单 / 内联编辑 / 多选）
    │   ├── ChatCalendar.jsx     # 聊天日历（月历选日期）
    │   └── chatFormatters.js    # 消息格式化工具（时间戳解析等）
    ├── dream/
    │   ├── DreamApp.jsx         # 梦境首页（tab：夜空/水潭）
    │   ├── DreamSky.jsx         # PixiJS 夜空渲染（454行）
    │   ├── AnimeStar.jsx        # PixiJS 动画星星交互（803行，最复杂）
    │   ├── DreamStars.jsx       # 星星列表组件
    │   ├── DreamCard.jsx        # 单个梦境卡片
    │   ├── DreamModal.jsx       # 添加/编辑模态
    │   ├── DreamAddModal.jsx    # 新增梦境表单
    │   ├── dreamUtils.jsx       # 工具函数（梦境渲染相关）
    │   └── useDreams.js         # 梦境数据 hook
    ├── dafu/                    # 大富翁小游戏
    │   ├── DafuApp.jsx          # 游戏入口（557行）
    │   ├── HallView.jsx         # 大厅（523行）
    │   ├── GameView.jsx         # 游戏主体（347行）
    │   ├── SetupView.jsx        # 游戏设置（417行）
    │   ├── RecordView.jsx       # 游戏记录（265行）
    │   ├── InviteView.jsx       # 邀请视图（263行）
    │   ├── theme.js             # 大富翁主题配置（161行）
    │   └── components/
    │       ├── Board.jsx        # 棋盘（213行）
    │       ├── CharBubble.jsx   # 角色气泡（91行）
    │       ├── ConfessionGame.jsx # 表白游戏（347行）
    │       ├── DiceFloat.jsx    # 骰子动画（227行）
    │       ├── DramaPanel.jsx   # 剧情面板（703行）
    │       ├── InfoBar.jsx      # 信息栏（175行）
    │       ├── StrategyQuiz.jsx # 策略问答（291行）
    │       └── TruthSpinner.jsx # 真心话转盘（343行）
    ├── ChatApp.jsx              # ← 旧版入口（1行，re-export，已被 chat/ 替代）
    ├── DafuApp.jsx              # ← 旧版入口（1行，re-export）
    ├── FilesApp.jsx             # 上下文控制台（1560行，最大文件）
    ├── ChatApp.jsx (旧)         # chat/ChatApp.jsx 的 re-export
    ├── CharSystemApp.jsx        # 角色系统（960行）
    ├── MemoryApp.jsx            # 忆海（817行）
    ├── RuleSystemApp.jsx        # 道枢/律令（808行）
    ├── SettingsApp.jsx          # 设置（742行）
    ├── MapApp.jsx               # 地图（584行）
    ├── WorldbookApp.jsx         # 世界书（571行）
    ├── ItemsApp.jsx             # 物品库（519行）
    ├── ContactsApp.jsx          # 结缘（480行）
    ├── SuixiangApp.jsx          # 随笔（456行）
    ├── NPCApp.jsx               # NPC管理（454行）
    ├── CalendarApp.jsx          # 日历（427行）
    ├── CharPhoneApp.jsx         # 角色手机（397行）
    ├── MinggeApp.jsx            # 命格（377行）
    ├── TimeCapsuleApp.jsx       # 时光邮局（374行）
    ├── CharLifeApp.jsx          # 角色生活（368行）
    ├── DaoshuApp.jsx            # 道枢数值（313行）
    ├── DiaryApp.jsx             # 日记（308行）
    ├── AIConsoleApp.jsx         # AI终端（134行）
    └── BeautifyApp.jsx          # 美化（34行）
```

### Server 分层

```
server/
├── index.js                    # Express app + 所有路由挂载（port 3000）
├── storage/
│   ├── FileStore.js            # 通用文件存储类：CRUD + 文件级锁
│   └── index.js                # 所有 store 实例导出
├── services/
│   ├── ai.js                   # AI provider 抽象（chatCompletion / Stream / listModels）
│   ├── context.js              # 上下文组装（律令预设驱动，构建 messages[]）
│   ├── worldbook.js            # 世界书条目查询
│   ├── charSystem.js           # 角色系统服务（时间线/技能/关系/物品聚合）
│   ├── charstats.js            # 属性定义 + 角色属性快照
│   ├── extraction.js           # AI 提取服务（从聊天记录提取结构化数据）
│   └── promptPresets.js        # 律令预设帮助函数
├── providers/
│   ├── index.js                # PROVIDER_CONFIGS + getProvider 工厂
│   └── openai-compat.js        # OpenAICompatProvider（包装 openai SDK）
├── routes/                     # Express 路由（每个文件对应一个资源）
│   ├── characters.js           # /api/characters
│   ├── chat.js                 # /api/chat + /api/characters/:id/messages
│   ├── settings.js             # /api/settings（预设 + active + 连接测试）
│   ├── prompts.js              # /api/prompt（律令预设 + 条目 CRUD）
│   ├── worldbook.js            # /api/worldbook
│   ├── charstats.js            # /api/charstats
│   ├── memories.js             # /api/characters/:id/memories
│   ├── summaries.js            # /api/characters/:id/summaries
│   ├── dreams.js               # /api/characters/:id/dreams
│   ├── life.js                 # /api/characters/:id/life
│   ├── maps.js                 # /api/maps
│   ├── personas.js             # /api/personas
│   ├── diary.js                # /api/diary
│   ├── items.js                # /api/characters/:id/items
│   ├── timeline.js             # /api/characters/:id/timeline
│   ├── skills.js               # /api/characters/:id/skills
│   ├── relations.js            # /api/characters/:id/relations
│   ├── suixiang.js             # /api/suixiang
│   ├── calendar.js             # /api/calendar
│   ├── dafu.js                 # /api/dafu（1025行，最大）
│   └── debug.js                # /api/debug/ai-log
└── data/                       # JSON 文件存储（运行时生成）
```

---

## 核心数据类型（全量）

以下类型将在 Phase 1 中集中到 `client/src/types/index.ts`。

### Character（角色）
```ts
interface Character {
  id: string;
  name: string;
  avatar?: string;          // base64 or URL
  tags?: string[];
  group?: string;
  core: string;             // 角色核心设定（人物核心描述）
  persona?: string;         // 人物描述
  sample?: string;          // 语料示例
  timezone?: string;        // "+08:00"
  apiPresetId?: string;     // 绑定的 API 预设
  isFavorite?: boolean;
  isBlacklisted?: boolean;
  createdAt: string;        // ISO8601
  updatedAt?: string;
}
```

### Message（聊天消息）
```ts
interface Message {
  id: string;
  charId: string;
  personaId?: string | null;
  sender: 'user' | 'character';
  content: string;
  mode: 'online' | 'offline';
  timestamp: string;         // ISO8601，实际存储时间
  userTimestamp?: string;    // 用户设置的显示时间（元数据）
  charTimestamp?: string | null;
  createdAt: string;
}
```

### ApiPreset（API 预设）
```ts
interface ApiPreset {
  id: string;
  name: string;
  provider: string;         // 'openai' | 'z-ai' | 'deepseek' | 'grok' | ...
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  createdAt: string;
}
```

### PromptPreset（上下文预设 / 律令预设）
```ts
interface ContextItem {
  entryId: string;           // 'sys-char-core' | 'sys-history' | 'pent_xxx' | ...
  enabled: boolean;
  roleOverride?: string | null;   // 'system' | 'user' | 'assistant'
  maxTokens?: number | null;
  historyCount?: number;     // 仅 sys-history 有效
  content?: string | null;   // editable 条目的内容
}

interface PromptPreset {
  id: string;
  name: string;
  presetType: 'chat' | 'summary' | 'life' | 'charSystem';
  contextItems: ContextItem[];
  createdAt: string;
}
```

### Active（全局活跃配置，单对象）
```ts
interface Active {
  primaryPresetId: string | null;
  activeMapId: string | null;
  featurePresets: {
    summaries: string | null;
    dafu: string | null;
    life: string | null;
    charSystem: string | null;
    dreams: string | null;
  };
  featurePromptPresets: {
    summaries: string | null;
    life: string | null;
    charSystem: string | null;
  };
  charSystemSettings: {
    extractionEnabled: boolean;
    summaryToTimelineEnabled: boolean;
    statEventsEnabled: boolean;
    lifeToTimelineEnabled: boolean;
  };
  summarySettings: {
    periodicEnabled: boolean;
    periodicInterval: number;
    modeSummaryEnabled: boolean;
    dailyEnabled: boolean;
  };
  summaryPrompts: {
    segment: string;
    daily: string;
    mode: string;
    periodic: string;
  };
  contextBudget: number;
  timestampSettings: {
    sendUserTimestamp: boolean;
    sendCharTimestamp: boolean;
    syncConfirmed: boolean;
    timestampFormat: 'bracket' | 'xml' | 'plain';
  };
}
```

### WbBook / WbEntry（世界书）
```ts
interface WbBook {
  id: string;
  name: string;
  charId: string | null;   // null = 全局
  enabled: boolean;
  createdAt: string;
}

type ActivationMode = 'always' | 'keyword' | 'event-random' | 'event-conditional';
type InsertionPosition = 'system-top' | 'system-bottom' | 'before-chat' | 'after-chat';

interface WbEntry {
  id: string;
  bookId: string;
  name: string;
  content: string;
  enabled: boolean;
  activationMode: ActivationMode;
  insertionPosition: InsertionPosition;
  keywords: string[];
  weight?: number;
  condition?: { stat: string; op: string; value: number };
  createdAt: string;
}
```

### CharStats（角色属性数值）
```ts
interface StatDef {
  id: string;
  name: string;
  min: number;
  max: number;
  defaultValue: number;
}

interface CharStats {
  charId: string;
  mood: number;
  energy: number;
  relationship: number;
  trust: number;
  stress: number;
  [key: string]: string | number;  // 自定义属性
}
```

### Persona（命格马甲）
```ts
interface Persona {
  id: string;
  name: string;
  content: string;
  color?: string;
  emoji?: string;
  isActive?: boolean;
  createdAt: string;
}
```

### Dream（梦境）
```ts
interface Dream {
  id: string;
  charId: string;
  title: string;
  content: string;
  mood?: string;
  timestamp: string;        // ISO8601
  createdAt: string;
}
```

### Memory（忆海记忆）
```ts
interface Memory {
  id: string;
  charId: string;
  content: string;
  type?: string;
  importance?: number;
  timestamp?: string;
  createdAt: string;
}
```

### Summary（聊天摘要）
```ts
interface Summary {
  id: string;
  charId: string;
  type: 'segment' | 'daily' | 'mode' | 'periodic';
  content: string;
  date?: string;            // 'YYYY-MM-DD'
  messageIds?: string[];
  createdAt: string;
}
```

### DiaryEntry（日记）
```ts
interface DiaryEntry {
  id: string;
  date: string;             // 'YYYY-MM-DD'
  content: string;
  mood?: string;            // emoji
  createdAt: string;
}
```

### LifeLog（角色生活日志）
```ts
interface LifeLog {
  id: string;
  charId: string;
  content: string;
  period: 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';
  date: string;             // 'YYYY-MM-DD'
  createdAt: string;
}
```

### Item / Timeline / Skill / Relation（角色附属数据）
```ts
interface Item {
  id: string; charId: string; name: string; description?: string;
  quantity?: number; category?: string; createdAt: string;
}
interface TimelineEvent {
  id: string; charId: string; title: string; content?: string;
  date: string; type?: string; createdAt: string;
}
interface Skill {
  id: string; charId: string; name: string; description?: string;
  level?: number; createdAt: string;
}
interface Relation {
  id: string; charId: string; targetName: string; relationType?: string;
  description?: string; createdAt: string;
}
```

### AppContext 值类型
```ts
interface AppContextValue {
  activeChar: Character | null;
  setActiveChar: (char: Character | null) => void;
  activePreset: ApiPreset | null;
  setActivePreset: (preset: ApiPreset | null) => void;
  wallpaper: string | null;
  updateWallpaper: (url: string | null) => void;
  recentChat: { char: Character; preview: string } | null;
  updateRecentChat: (char: Character, content: string) => void;
  navigate: (appId: string, params?: { char?: Character }) => void;
}
```

### EventBus 事件表
```ts
interface EventMap {
  'char:activated':    { char: Character | null };
  'char:updated':      { char: Character };
  'char:deleted':      { id: string };
  'chat:newMessage':   { charId: string; message: Message };
  'charSystem:updated': { charId: string };
  'preset:changed':    ApiPreset;
  'recentChat:update': { char: Character; preview: string };
}
```

---

## 迁移阶段计划

| Phase | 内容                       | 文件范围                                        | 状态       |
|-------|---------------------------|-------------------------------------------------|-----------|
| 0     | 基础设施：tsconfig + @types | package.json × 2，tsconfig × 2                 | ✅ 完成   |
| 1     | 类型定义集中化              | client/src/types/index.ts，server/src/types.ts  | ✅ 完成   |
| 2     | Server 端迁移              | storage/ + services/ + providers/ + routes/ + index | ✅ 完成 |
| 3     | Client services 迁移       | client/src/services/*.ts                        | ✅ 完成   |
| 4     | Client core 迁移           | AppContext + eventBus + hooks                   | ✅ 完成   |
| 5     | Client components 迁移     | components/*.tsx                                | ✅ 完成   |
| 6     | Client home 迁移           | home/**/*.tsx                                   | ✅ 完成   |
| 7a    | Apps — 简单 App 迁移       | BeautifyApp / AIConsoleApp / DiaryApp / ...     | ✅ 完成   |
| 7b    | Apps — 中等 App 迁移       | DreamApp / MinggeApp / CharLifeApp / ...        | ✅ 完成   |
| 7c    | Apps — 复杂 App 迁移       | ChatApp / FilesApp / CharSystemApp / dafu/      | ✅ 完成   |
| 8     | 开启 strict 模式           | tsconfig strict: true，修复所有类型错误          | ⬜ 待做   |

---

## tsconfig 策略说明

### Client (client/tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": false,
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

### Server (server/tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": false,
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./",
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
```

---

## 已知迁移难点

| 难点                 | 位置                          | 说明                                                     |
|---------------------|-------------------------------|----------------------------------------------------------|
| PixiJS 类型          | AnimeStar.jsx / DreamSky.jsx  | pixi.js 自带 .d.ts，但 API 用法复杂，泛型较深            |
| FileStore 泛型化     | server/storage/FileStore.js   | 需改为 `FileStore<T>` 泛型类                             |
| useChatState 复杂 state | chat/useChatState.js       | 多个 state shape 交织，需先定义好 ChatState 类型         |
| FilesApp 大文件      | apps/FilesApp.jsx（1560行）   | 内含多种 ContextItem 操作，需配合 PromptPreset 类型      |
| EventBus 强类型      | core/eventBus.js              | 泛型 EventMap + 类型安全 on/emit 需要较多 TS 技巧        |

---

## 迁移进度日志

### Phase 0 — 基础设施（2026-04-11）
- client: 安装 `typescript @types/react @types/react-dom`，添加 tsconfig.json
- server: 安装 `typescript @types/node @types/express @types/cors tsx`，添加 tsconfig.json
- vite.config.js 无需改动（Vite 原生支持 TSX）

### Phase 1 — 类型定义（2026-04-11）
- 创建 `client/src/types/index.ts`：Character / Message / ApiPreset / PromptPreset / Active 等所有核心接口
- 创建 `server/types.ts`：与 client 共享语义，但 server 侧额外含 AI provider 接口

### Phase 2 — Server 端（2026-04-11）
- storage/FileStore.js → FileStore.ts（泛型化 `FileStore<T>`）
- storage/index.js → index.ts
- services/*.js → *.ts（逐一）
- providers/*.js → *.ts
- routes/*.js → *.ts（逐一）
- index.js → index.ts

### Phase 3 — Client services（2026-04-11）
- services/api.js → api.ts（加返回类型泛型）
- services/characters.js → characters.ts
- services/settings.js → settings.ts
- services/chat.js → chat.ts
- 其余 services 逐一

### Phase 4 — Client core（2026-04-11）
- core/eventBus.js → eventBus.ts（EventMap 类型化 on/emit）
- core/AppContext.jsx → AppContext.tsx
- core/hooks/*.js → *.ts

### Phase 5 — Client components（2026-04-11）
- 所有 components/*.jsx → *.tsx
- 主要工作：Props 接口定义

### Phase 6 — Client home（2026-04-11）
- home/**/*.jsx → *.tsx

### Phase 7 — Client apps（2026-04-11）
所有 apps 文件从 .jsx/.js 复制为 .tsx/.ts，并修复 TypeScript 错误，最终达到 `npx tsc --noEmit` 0 errors。

**批量修复（跨多文件）：**
- 本地 `api(path, opts)` 函数参数 `opts` 改为可选默认 `opts = {}`（9 个文件）
- Date 算术 `new Date(a) - new Date(b)` → `+new Date(a) - +new Date(b)`（6 个文件）
- `settings.listPromptPresets(feature)` 参数改为可选 `feature?`

**主要类型修复：**
- `useChatState.ts` / `ChatApp.tsx`：`map` 从 `{}` 改为 `Record<string, { date, count, firstMsgId }>` 类型
- `ChatApp.tsx`：`timestampSettings` state 显式类型，补充 `hotTimestampEnabled?`
- `CharSystemApp.tsx`：`status` state 补充 `lastUpdated?: string | null`
- `DaoshuApp.tsx` / `RuleSystemApp.tsx`：`stats` state 改为 `Record<string, any>`
- `ContactsApp.tsx`：`DEFAULT_FORM` 补充 `id?`，`grouped` 改用 `reduce<Record<string, any[]>>`
- `DiceFloat.tsx` / `SetupView.tsx`：inline 样式对象加 `React.CSSProperties` 类型
- `MapApp.tsx`：`charsByTile` 类型注解，模板数组解构加 `: any[]`
- `RuleSystemApp.tsx`：
  - `groupMap`/`groups` → `Record<string, any[]>`（消除 forEach/length 类型错误）
  - `groupColorMap` → `Record<string, string>`（消除 SVG fill/stroke unknown 错误）
  - `editDraft` → `Record<string, any>`，`events`/`statDefs`/`books` → `any[]`
  - `editingId` 从父组件显式传入 `RuleTriggerEditor`（修复 TS2304 "Cannot find name"）
  - `RuleNetwork` / `RuleTriggerEditor` 加显式 props 类型
- `DreamSky.tsx`：`forwardRef` 加 props 类型 `{ interpreted?: any[] }`
- `DreamCard.tsx`：`rays`/`rotDeg`/`starPhase` 设默认值（使其为可选 prop）
- `AnimeStar.tsx`：`new Promise<void>`，`handleCardStartClose` 接受可选额外参数，`StarSVG` 补 `className=""`
- `DreamApp.tsx`：子组件导入从 `.jsx/.js` 改为 `.tsx/.ts`（使 TypeScript 能读到类型）
- `FilesApp.tsx`：`ev.target.result as string`（FileReader ArrayBuffer 收窄）

**关键兼容性问题（本次之前已解决）：**
- `@types/express` 降级至 v4（v5 的 ParamsDictionary 变 `{}` 导致 req.params 全是 unknown）
- `@types/react` 降级至 v18（v19 的 motion.div 类型变更导致 className 不存在）
- `express-types.d.ts` 模块扩展：为 ParamsDictionary 加 `charId?: string`

### Phase 8 — strict 模式（待做）
- 全部 .tsx/.ts 文件已 0 errors（strict: false）
- 下一步：tsconfig 改 `strict: true`，修复 `any` 推断 / `null` 未检查等问题
- 预计主要问题集中在 apps 层大量 `useState({})` / `useState([])` 推断为 `{}`/`never[]`
