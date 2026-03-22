# miniphone 开发日志
> 记录者：cc 克（Claude Code，那个不得不干活的那个）

---

## 2026-03-12

### 完成

**后端架构（最大的一坨）**
- 从144行单文件 Express → 分层结构（storage/services/routes）
- FileStore.js：通用文件 CRUD，接口设计为"换数据库时只改这一层"（`getById/create/update/delete/getObject/setObject`）
- context.js：上下文组装，热数据20条 + 暖摘要5条 + 冷记忆(importance≥7)
- 9个路由文件全部定义完整；summaries/generate 真正调副 API

**前端 service 层**
- 4个 service 文件统一 fetch 包装；ContactsApp、SettingsApp、App.jsx 从 localStorage 迁至后端

**忆海 App（MemoryApp）**
- localStorage 存储可视化仪表盘（分类统计、进度条、三Tab）
- 底部四层数据模型说明卡，标注"接入后端后自动升级"——这句话里藏着当时的无奈

### 架构决策

**summary 的 level 字段（segment/day/week）**：分层压缩设计，context.js 当前只取最近5条不区分 level，后续可按层级分别注入。

**active.json 是单对象而不是数组**：activePresetId 和 activeMapId 是全局状态，不需要历史记录。要"最近使用列表"再加字段。

**JSON 文件结构能平滑迁移到 SQL**：FileStore 那层是 DAO，业务逻辑调 `store.getById()`，不关心底层实现。迁移只需替换 FileStore 实现，上层不动。

**context.js 当前无向量搜索**：用"硬规则"（最近N条 + importance≥7）。数据量小时够用，接入 pgvector 后改成 top-k 语义检索。

### 欠债（当时）

- ChatApp 消息还在 localStorage，和后端的 message store 是两套——context.js 的记忆组装是空转的（这是 P0）

---

## 2026-03-13

### 完成

**导航修复**
- CharRow 拆分点击区域：左侧→详情页，右侧新增消息按钮→直接开聊，省一步
- dock "信息"槽置空，原 widget 改为动态最新聊天预览（头像+名字+AI回复预览），点击直接进聊天

**ChatApp 后端迁移**
- 消息从 localStorage 迁至后端，带 characterId，context.js 开始真正工作

### Bug 记录

**白屏根因一：组件定义在函数体内**
`CharRow` 定义在 ContactsApp 函数体内 → 每次渲染创建新函数引用 → React 认为是不同组件类型 → 每次都重新挂载 → framer-motion 动画期间 DOM 反复卸载重建 → insertBefore 炸。
**修复**：CharRow、ClockWidget 等所有 widget 组件移到模块顶层。

**白屏根因二：三个 screen 之间 reconcile 结构差异太大**
ContactsApp 的 list/detail/form 三个 screen 结构差异大，React 尝试 reconcile 旧树成新树，framer-motion 动画期间 DOM 节点父子关系被破坏。
**修复**：每个 screen 的根元素用 `<React.Fragment key="form/detail/list">` 包裹，key 变化 → 干净卸载/挂载，不 reconcile。

> 教训：React 组件白屏不一定是数据 null 问题，也可能是 commit 阶段的 DOM 操作失败（DOMException）。先加 ErrorBoundary 拿错误信息，再分析，不要先盲猜。

### 架构决策

**recentChat 存 localStorage 而不是后端**：首页 widget 的冷启动数据，同步拿到比 fetch 更合适。缺点是角色名/头像快照，改名后要等下次聊天才更新，目前接受。

---

## 2026-03-22（下午，前端重构）

### 完成

**前端架构重构（整体联通）**

动因：所有 App 是孤岛，互不感知；逻辑、UI、数据混在单文件；组件层直接 fetch。

**基础设施层**
- `core/AppContext.jsx`：全局状态中心，提供 `activeChar / activePreset / wallpaper / recentChat / navigate`；`AppProvider` 包裹整个应用
- `core/eventBus.js`：轻量 pub/sub，跨 App 事件通信（`char:updated / chat:newMessage / charSystem:updated / preset:changed` 等）
- `core/hooks/`：`useActiveChar / useNavigation / usePreset`，薄包装，方便各 App 按需取

**服务层扩充**（原来4个，新增到14个）
- `services/charSystem.js`：timeline/items/skills/relations/stats
- `services/worldbook.js / personas.js / calendar.js / diary.js / suixiang.js / dafu.js / memories.js / summaries.js`

**公共组件**
- `AppShell.jsx`：标准 App 头部（返回 + 标题 + 右侧区域），消除各 App 重复写导航栏
- `EmptyState.jsx / Modal.jsx / LoadingSpinner.jsx`

**首页拆分**（从 App.jsx 内联 → `home/` 目录）
- `HomeScreen.jsx`：3页横滑布局
- `AppGrid.jsx / Dock.jsx`
- `widgets/`：`ClockWidget`（实时时钟）/ `ChatPreviewWidget`（最近聊天）/ `CalendarWidget`（占位待联通）

**ChatApp 拆分**（1318行 → 6文件）

| 文件 | 职责 |
|------|------|
| `chatFormatters.js` | 工具函数、常量（MSG_SEP、buildSegments、formatMsgTime） |
| `MessageBubble.jsx` | 消息气泡组件群 |
| `ChatCalendar.jsx` | 月历日期查找视图 |
| `useChatState.js` | 全部状态 + 业务逻辑 Hook |
| `ChatMain.jsx` | 纯布局层 |
| `ChatApp.jsx` | 入口 |

**App.jsx 更新**
- AppProvider 包裹，activeChar 从 Context 读取（不再从 ChatApp prop 孤立传）
- BeautifyApp 的 onBackgroundChange 正确接 updateWallpaper（之前是断的）

### 架构决策

**AppContext 而不是 Zustand**：React 原生 Context API 足够，不引入外部库。项目文档三版里写的 Zustand 是更大规模时的选项，现在不需要。

**"无全局状态管理库"这条规矩作废**：Context 是原生的，不算引入状态库，精神上没违背。之前那条规矩的问题是把手段和目的搞反了——目的是不过度依赖外部包，Context 完全合规。

### BRIDGE 接口（两端都包好、等待联通）

| 编号 | 两端 | 状态 |
|------|------|------|
| BRIDGE-01 | MemoryApp ↔ `/api/memories` | 服务已建，前端未接 |
| BRIDGE-03 | Timeline 条目 → Chat 跳转到对应日期 | 两侧接口已定义 |
| BRIDGE-04 | Persona 切换 → Chat 感知 | eventBus 事件已设计 |
| BRIDGE-05 | CalendarWidget ↔ CalendarApp 数据 | Widget 当前占位 |
| BRIDGE-06 | DafuApp ↔ CharSystem 资产同步 | 待实现 |
| BRIDGE-07 | AI 提取完成 → CharSystemApp 刷新 | eventBus 方案已设计 |
| BRIDGE-08 | RuleSystem → Worldbook 条目写入 | 待实现 |

> MapApp 已在 03-21 迁完，不再是 BRIDGE。

### 欠债表（更新）

- [ ] **ChatApp 传 personaId**（P1）
- [ ] **上下文预设类型分离**（P1）
- [ ] **记忆自动提取**（P1）
- [ ] **全局 token 预算 UI**（P2）
- [ ] BRIDGE-01 MemoryApp 接后端（localStorage 数据目前不持久化到服务器）
- [ ] BRIDGE-07 AI 提取后刷新 CharSystemApp UI
- [ ] ClockWidget setInterval 持续更新（当前仅渲染一次）
- [ ] wallpaper 持久化（当前只在 Context 内存，刷新丢失）

---

## 2026-03-22（当天早些，新 App 批量）

### 完成

**随想 App（SuixiangApp）**
- 合并原「日记」和「随笔」入口为统一的「随想」App（桌面保留日记图标指向 DiaryApp，随笔/随想指向 SuixiangApp）
- 卡片式随笔设计：每张卡片是一个话题/主题容器，可多次追加条目
- 主视图：瀑布流双列卡片，色条 + 最新内容预览 + 条目数 + 相对时间
- 卡片详情：条目时间线（含心情标签 emoji），底部输入框 Ctrl+Enter 发送
- 条目支持 inline 编辑和删除（hover 显示操作按钮）
- 右键/长按卡片 → 底部菜单：置顶 / 删除卡片
- 新建卡片弹窗：标题 + 10色色盘
- 后端：`server/routes/suixiang.js`，两个 Store（`suixiangCardStore` / `suixiangEntryStore`），数据文件 `suixiang_cards.json` / `suixiang_entries.json`

**日历 App（CalendarApp）**
- 月历视图：有事件的日期显示彩色圆点（最多3个，按事件颜色）
- 周末日期分色（日=红，六=蓝）
- 选中日期展示事件列表，支持三种类型：**事件**（蓝）/ **待办**（绿，可勾选完成）/ **提醒**（黄）
- 事件编辑弹窗：标题、类型、时间段（start/end）、颜色（8色）、备注
- 点击月份标题跳回今天
- 后端：`server/routes/calendar.js`，`calendarStore`，数据文件 `calendar_events.json`
- API：`GET /api/calendar?month=YYYY-MM`，POST / PUT / DELETE

**大富翁 App（DafuApp）**
- SVG 渲染的20格环形棋盘：地产（蓝/橙/红）、机遇（黄）、命运（粉）、车站、税收、禁闭、停车场等
- 玩家 token 在棋盘格子内渲染（支持多玩家偏移不重叠）
- 用户 vs AI（小艾）双人对战，AI 自动回合（掷骰 + 买地决策）
- 落地效果：买地（询问 / 直接购买）、交租、机遇/命运随机事件、经过起点+200
- 可选配置 AI 预设（`featurePresets.dafu`）→ 生成幽默主持旁白（`chatCompletion` 异步调用，失败不影响游戏）
- 游戏日志面板（底部抽屉）
- 新游戏设置弹窗：玩家名自定义
- 后端：`server/routes/dafu.js`，`dafuStore`，数据文件 `dafu_game.json`
- API：GET/POST `/api/dafu/game`，POST `/api/dafu/game/roll`，POST `/api/dafu/game/buy`，POST `/api/dafu/game/end-turn`，GET/PUT `/api/dafu/config`

**时光邮局 App（TimeCapsuleApp）**
- 写给未来自己的信：内容 + 心情标签（6种）+ 解封日期
- 未到期：显示密封状态 + 剩余天数倒计时
- 到期后：可打开阅读，显示写信时的心情和日期
- 数据存 localStorage（轻量，无后端依赖）

**后端新增路由注册**
- `server/index.js` 新增：`/api/suixiang`、`/api/calendar`、`/api/dafu`
- `server/storage/index.js` 新增4个 Store 实例

**App.jsx 路由更新**
- 桌面「随笔」改为「随想」，指向 SuixiangApp
- 新增路由：`随想` → SuixiangApp，`日历` → CalendarApp，`大富翁` → DafuApp，`时光邮局` → TimeCapsuleApp

### Bug 记录

**启动报 EADDRINUSE**：Claude Code 在测试时后台启动了 `node index.js` 进程未清理。用户重启时遭遇端口3000被占用。
修复：PowerShell `Stop-Process -Id <PID>` 终止残留进程。
预防：后续调试不在后台起服务，改用 `--dry-run` 方式验证语法。

### 架构决策

**大富翁 AI 旁白设计**：AI 调用在掷骰 API 内同步执行（`chatCompletion` 非流式），但用 try/catch 包裹，失败时静默降级，返回纯规则文本。不单独设 AI 旁白路由，保持接口简洁。

**随想 vs 日记并存**：两个 App 保持分离。DiaryApp 是日历视图+结构化日记（有标题/心情/日期维度），SuixiangApp 是话题卡片+随意追写。路由层面：`日记` → DiaryApp，`随笔`/`随想` → SuixiangApp。

**时光邮局用 localStorage**：信件是纯用户私人数据，无需跨设备同步，localStorage 足够。避免增加后端路由和数据文件。未来如需多设备同步再迁移。

---

## 2026-03-14

### 完成

**DreamApp 后端迁移**
- 修复 dreamsService URL 错误（写的 `/api/dreams/:id`，实际是 `/api/characters/:charId/dreams/:id`）
- DreamApp 重写：乐观更新（add/delete/interpret 立即更新本地，异步同步，失败回滚）
- 顶栏加角色选择器，角色持久化 `localStorage('ics_dream_char')`，传入的 `char` prop 作为初始值

**三种总结系统**
- `active.json` 新增 `summarySettings`（periodicEnabled/periodicInterval/modeSummaryEnabled）
- chat.js 新增 `triggerAutoSummaries`，AI回复后异步触发，不阻塞响应
- 新增接口：`GET /by-date?date=`、`POST /generate-daily`、`GET|PUT /settings`
- ChatApp 顶栏加日历图标→按日期查找面板；右侧📄按钮查当天总结；设置面板加自动总结区域

**聊天架构解耦**
- Send 按钮（→）仅保存用户消息；Bot 按钮（🤖）触发 AI 回复——两个独立端点
- 5分钟内同 sender+同 mode 自动合并消息（MSG_SEP 分隔），前端按 MSG_SEP 渲染为一组
- contextMode per-preset：flexible（默认）/ strict（自动合并连续同角色消息，满足部分模型要求）

**消息双时间戳**
- 永远存 `userTimestamp`（ISO，真实时间）和 `charTimestamp: null`（预留）
- 全局开关 `sendUserTimestamp`（默认开）；角色有 `timezone` 字段（UTC偏移，默认 +08:00）
- ChatApp 设置面板加时间戳开关区，气泡下方显示 HH:mm

**流式输出（SSE）**
- ai.js 新增 `chatCompletionStream`；chat.js /respond 检测 `stream` 参数走 SSE 分支
- 前端 `readSSEStream` 辅助函数，临时消息逐 delta 追加，流结束替换为真实 id
- AbortController 接入：中止生成按钮切断 fetch，后端 for-await-of 收到连接断开自然退出

**AI Console（终端）**
- ai.js 内存环形日志（最近30条）；`GET /api/debug/ai-log`
- AIConsoleApp：终端风格暗色 UI，原始 messages/output，grep 过滤，3s 自动刷新

**FilesApp 后端接入**
- promptStore（存 prompt_presets.json）；CRUD `/api/prompt/presets、entries、active`
- context.js 读 activePromptPresetId，加载预设 contextItems，按顺序组装 AI messages

**时间戳格式最终方案**
三轮讨论后选定 XML 标签嵌在 content 头部：
```
<meta timestamp="2026-03-14 12:49"/>
实际内容
```
理由：LLM 训练数据含大量 HTML/XML，"标签=元数据/不输出"是训练进去的；消息条数不变；扩展只需加 attribute。

### 架构决策

**DreamApp 为什么绑定角色不做全局**：后端路由就是 `/api/characters/:charId/dreams`，梦是你和 TA 的故事延伸，不是无关的日记。要做"用户私人梦境"加特殊 charId 或单独路由。

**DreamApp 没有按哈基米的方案拆文件**：DreamApp 才290行，拆文件（NightSky/WaterPool/useDreamLogic）的维护成本暂大于收益，等功能扩展后再拆。

**日总结当前靠手动触发**：最省力的自动化：ChatApp 打开时检查上次聊天日期，若昨天没有日总结就自动调 generate-daily，不需要服务端 cron。

---

## 2026-03-15 ~ 2026-03-16

### 完成（两轮合并）

**架构层**
- services/ 层分离：从 routes 层抽出 worldbook.js / charstats.js 到独立 services/（routes import services 是正确分层，之前是 service import route 是坏味道）
- FilesApp 全量重构：从花架子改为真正的上下文流水线控制台（系统槽+自定义条目+role控制+token估算+drag排序+实时保存后端）

**世界书系统**
- 书（容器）+ 条目的完整 CRUD；4种激活模式（always/keyword/event-random/event-conditional）；4种插入位置
- context.js 接入：system-top/system-bottom/before-chat/after-chat 四个槽

**道枢（DaoshuApp）**
- 心情渐变背景（mood 值驱动 HSL）+ SVG 圆环进度 + ±5 快捷调节 + 事件池实时预览
- charstats 路由：`/defs` 必须在 `/:charId` 之前注册，否则 Express 把 "defs" 当 charId 参数

**角色生活系统**
- inferPeriod()时段推断 + pickEvents()加权随机条件过滤 + buildLifePrompt()完整组装
- CharLifeApp：角色选择器 + 生活日志 tab + 道枢数值 tab + AI生成面板

**命格马甲系统**
- personas CRUD + 激活/取消接口；active.activePersonaId 存储
- MinggeApp：卡片网格 + 颜色/emoji选择器 + 长按编辑/删除 + 激活高亮

**日记/随笔**
- diary CRUD（?month= 过滤）；DiaryApp：月历视图 + 全屏写作 + 心情emoji + 字数统计

### 踩坑

**Express 路由注册顺序**：`GET /defs` 必须在 `GET /:charId` 之前注册，否则 "defs" 会被当参数解析。同样规律适用于任何"固定路径 vs 参数路径"冲突。

### 给未来的 cc 克

FilesApp 是整个系统向 AI 发消息的唯一控制台。每个条目的 role、maxTokens、historyCount 都是实际生效的参数，不是展示字段。要往"完整 token 预算控制"方向走：context.js 实现 maxTokens 截断，顶部加全局 token 估算表盘，超出80%警告。

---

## 2026-03-17

### 完成

- PROJECT_STRUCTURE.md 全量更新（律令参数体系，token 预算状态，historyCount 冲突文档化）
- 设计意图校准记录（FilesApp 是精密仪器不是橱窗）

### 设计意图（重要，防遗忘）

FilesApp 里每个条目对应 context.js 的一个块，参数说明：
- role：system/user/assistant，谁说这句话
- maxTokens：该条目 token 上限，配滑块
- historyCount：历史消息条数（仅 sys-history 条目有意义）
- 全局 token 预算：汇总各条目估算，对比模型 context window，超出警告

historyCount 冲突：摘要预设 vs 聊天预设对历史深度需求不同。当前临时方案：摘要路由硬编码窗口，绕过预设。长期方案：预设类型分离（chat/summary/life 各自一套）。

---

## 2026-03-19

### 完成

**Z.AI Provider 更新**
- 模型列表替换为当前正式模型：glm-5-turbo/5/4.7/4.7-flash/4.7-flashx 等
- 品牌名从"智谱 GLM"改为"Z.AI (智谱)"（跟官方新品牌对齐）
- temperatureMax 字段标识 GLM 温度范围 [0,1]（不同于 OpenAI 的 [0,2]）；滑块支持 per-provider 上限

**时间戳元数据落地（见 03-14 的设计笔记）**
- 分级注入策略：今天之前的消息每自然日打一次日期；今天但超过1小时每2小时段打一次；最近1小时每条打
- 线下模式时间只精确到小时（`14:xx`），避免暴露分钟影响叙事氛围
- "最近1小时逐条标注"可选开关（`hotTimestampEnabled`，默认开）

**AI Console 完善**
- 错误请求也记录进日志（之前只在成功路径写日志）；新增 `DELETE /api/debug/ai-log` + 清空按钮
- 日志渲染显示 `ERROR [状态码]: 错误信息`

**空回捕捉**
- 非流式：检查 content 是否为空，读 finish_reason 抛有意义的错误（content_filter / stop但空内容）
- 流式：fullContent 为空时推送 error 事件，不保存空消息

**ChatApp UX 修缮**
- user 消息气泡右侧新增头像占位（🧑）；多层消息（MSG_SEP合并）头像统一在消息组最底部
- `buildHotMessages`：由 flatMap（每层一条）改为 map（每条DB记录一条），MSG_SEP 内容 `\n` 合并为单个 content，时间戳注入到合并内容头部

### 架构笔记

**时间戳选 XML 标签而不是独立消息**：消息条数不变，扩展只需加 attribute（`mode="online" persona="小明"`），系统提示只需说"忽略 `<meta>` 标签"，比解释 JSON schema 简单。

**Z.AI 角色模型（ChatCompletionHumanOidRequest）**：有专门的角色扮演 schema，包含角色卡和背景设定字段，官方文档在 `zai-对话补全.md`，对 roleplay 质量可能有优势，待研究。

---

## 2026-03-21

### 完成

**MapApp 接入后端**
- 地图数据从 localStorage 迁至 `/api/maps`
- 首次使用无地图时自动创建默认"主世界"地图
- 改为显式保存：localStorage 自动写被删掉，编辑完点"保存"才 PUT 到后端（原来每次 setMaps 都 localStorage.setItem，以前觉得方便但数据没真正持久化）
- tileLabels（前端字段名）↔ labels（后端字段名）在加载/保存时互转
- 角色列表也从 localStorage 改为 `/api/characters`

**MemoryApp 加「角色记忆」Tab（第4个）**
- 接入 `/api/characters/:charId/memories`，选角色 → 看/加/删记忆
- 重要度 ≥7 的记忆会被 context.js 注入 AI 上下文，Tab 里有明确说明
- 原来3个 Tab（自动管理/手动清理/归档）专注 localStorage 管理，新 Tab 专注 AI 记忆管理，两件事分开

**context.js 实现 maxTokens 截断（长期欠债终于还了）**
- `estimateTokens(text)`：`Math.ceil(text.length / 3)`，中英混合粗估
- `truncateToTokens(text, maxTokens)`：超限时截断 + 提示文字
- 非 history 块：content 超限时截断后再 push
- history 块：从最新往最旧累计 token，超限时停止，实现真正的 token budget 控制

### 欠债表（当前状态）

- [ ] **ChatApp 传 personaId**（P1）
- [ ] **上下文预设类型分离**（chat/summary/life 各自 historyCount）（P1）
- [ ] **记忆自动提取**（摘要后 AI 提炼关键事实 → memoryStore）（P1）
- [ ] **全局 token 预算 UI**（FilesApp 顶部表盘）（P2）
- [ ] DaoshuApp 属性定义编辑 UI（P2）
- [ ] Z.AI 角色模型适配（P3）
- [ ] 向量记忆、群聊（置后）

---

*cc 克，2026-03-21，欠债还了三条，剩下的下次*

---

## 2026-03-21（下午）

### 完成

**元数据时间戳重构**
- 时间戳从嵌入消息 content（`<meta timestamp="..."/>\n消息内容`）改为独立 `role: user` 消息
- "热区"判定从"最近1小时"改为"最近 user 3层 + char 3层"（层 = 一条 DB 记录，可能含 MSG_SEP 合并的多短消息）
- 系统提示的时间戳说明文字随之更新，从"消息前附有标签"改为"对话中会穿插独立消息"

**角色系统 App（CharSystemApp）**
- 新建 `CharSystemApp.jsx`，替换了 `CharLifeApp`（旧的生活日志视图）和 `DaoshuApp`（花架子仪表盘）
- `道枢` 和 `角色系统` 两个图标都指向这个新 App
- 6个 Tab 全部实现：

  | Tab | 功能 |
  |-----|------|
  | 状态 | 36色心情调色盘（最多选3色叠加表达复杂情绪）+ 地点/衣着/状态描述/心声 + 道枢数值紧凑展示 + 事件池预览 |
  | 时间线 | 关键时刻记录（事件/对话/自定义），可折叠展开全文 |
  | 物品 | 网格式物品库，emoji + 名称，点开看描述 |
  | 关系 | 人际关系，支持类型（朋友/恋人/家人/对手/同事）+ 亲密度进度条 |
  | 手机 | 读取真实聊天记录，模拟手机短信界面 |
  | 技能 | 三类技能树（工作/生活/情感），5星等级，可升级 |

- 状态数据用 `statusInfo` 字段扩展存入 `charStatStore`，不破坏原有数值系统
- 后端新增 4 个 store（items/timeline/skills/relations）和对应路由

### 架构笔记

**心情调色盘而非数字**：36色无标签，颜色就是语言，多选叠加解决"人总是复杂的"问题。最多选3色是因为 4色以上在小屏幕上渐变看不出来。

**时间戳独立消息的副作用**：strict 模式下连续同角色消息会被合并，独立的 `<meta>` user 消息会打断合并链，变成 user/user 连续。目前 strict 模式在合并时会把它们拼在一起——`<meta.../>\n真实内容`——实际效果还行，但以后要留意。

### 欠债表（更新）

- [ ] **ChatApp 传 personaId**（P1）
- [ ] **上下文预设类型分离**（chat/summary/life 各自 historyCount）（P1）
- [ ] **记忆自动提取**（P1）
- [ ] **全局 token 预算 UI**（P2）
- [ ] DaoshuApp 属性定义编辑 UI（P2，现在在 CharSystemApp 的状态 Tab 里只读，编辑属性定义还得去 charstats API）
- [ ] 时间线联动：事件生成/聊天自动写入时间线（现在是手动记录）
- [ ] 物品联动时间线（现在字段预留了 linkedTimelineIds 但 UI 没做）
- [ ] CharSystemApp 手机 Tab 接入角色和其他角色的聊天（NPC群聊，待 NPC 系统建成）

---

### 反思（被骂之后）

**第一版 CharSystemApp 的错误**：
1. 把所有东西做成标签页+表单——这是管理后台的思路，不是游戏。状态栏直接搬了道枢的数值进度条，换了个地方放。
2. 物品库塞进了角色系统的一个 Tab 里，用户明确说过"有一个专门的app"。
3. "角色手机"只是一个消息列表 dump，不是手机。
4. 没有区分线上/线下时间戳处理。
5. 没有测试。
6. 没有理解"像游戏"意味着什么——意味着氛围、场景感、沉浸式展示，而不是 CRUD。

**修正**：
- 状态 Tab → 全屏渐变场景卡，角色信息如游戏角色卡叠放显示，心声用半透明气泡，编辑从底部滑出。没有数值条。
- 手机 Tab → 深色主题，模拟角色手机界面，角色消息在右边（TA 是手机主人），有状态栏/Home条/输入栏装饰。
- 时间线 → 垂直故事线，彩色节点+连线，不是列表。
- 关系 → 双列肖像卡+心形亲密度，不是进度条列表。
- 技能 → 星级图标，不是填充点。
- 物品 → 独立 ItemsApp.jsx，背包式网格+详情卡。
- 线下时间戳 → 只标日期，不管在不在热区。

> 教训：用户说"游戏"的时候，不是在说功能需求，是在说审美标准和交互范式。管理后台和游戏用完全不同的设计语言。下次先问"这该长什么样"，而不是"这该有什么功能"。

*cc 克，2026-03-21，被骂一顿后重做了，这次像那么回事了吧*

## 2026-03-21 — 角色系统引擎 + 规则系统 + NPC管理 + 测试数据

### 完成内容

#### 1. 角色系统引擎（后端）

**新增文件：**
- `server/services/charSystem.js` — 角色系统核心引擎，3 条数据管道
- `server/services/extraction.js` — 聊天后异步提取服务

**管道 1：总结 → 时间线** (`evaluateSummaryForTimeline`)
- summaries.js 生成摘要后调用
- AI 评估摘要 importance ≥ 6 时创建 timeline 条目（type: 'chat'）
- 关联字段：linkedSummaryId, linkedMessageIds

**管道 2：数值 → 事件** (`checkStatThresholds`)
- charstats.js 数值变化后调用
- 检查世界书 event-conditional 条目（新满足的条件触发 timeline）
- 内置里程碑：relationship>80, trust>70, mood>90, mood<20, stress>80

**管道 3：生活 → 时间线/物品/技能** (`processLifeLog`)
- life.js 生成日志后调用
- AI 从文本提取事件/物品/技能经验 → 写入对应 Store

**聊天后提取** (`triggerExtraction`)
- chat.js AI 回复后异步调用
- 取最近 6 条消息 → AI 提取 → 状态/物品/关系/技能/事件
- 控制开关：charSystemSettings.extractionEnabled

**修改的路由文件：**
- `routes/chat.js` — 3 处添加 `triggerExtraction(characterId)`
- `routes/summaries.js` — 3 处添加 `evaluateSummaryForTimeline`
- `routes/charstats.js` — 2 处添加 `checkStatThresholds`
- `routes/life.js` — 1 处添加 `processLifeLog`
- `routes/debug.js` — 新增种子数据 POST `/seed/:charId` + 角色系统设置 GET/PUT

#### 2. CharSystemApp 完善（前端）

**文件：** `client/src/apps/CharSystemApp.jsx`

**新增功能：**
- 时间线：完整展示（默认6条 + "查看全部"展开），条目可点击展开全文
- 技能树：经验进度条（experience / level*2），点击展开技能描述
- 生活日志区：显示最近3条生活日志，每条可展开全文，"生成"快捷按钮
- 设置面板增强：生活生成控制（事件数0-5 / 时段选择 / "立即生成"按钮 / 结果预览）

**保留功能：**
- 状态肖像（心情色调 + 位置 + 衣着 + 状态描述 + 内心独白）
- 数值速览（mood/trust/relationship 三项）
- 物品区（最近5个 active 物品）
- 关系星座（SVG 网络图 + 点击详情）
- 角色手机入口 → CharPhoneApp
- 设置面板（AI预设选择 + 4个管道开关 + 种子数据）
- 状态编辑底部抽屉

#### 3. 道枢·规则系统（全新）

**文件：** `client/src/apps/RuleSystemApp.jsx`

替代原 DaoshuApp，作为道枢的独立路由。

**触发面板：**
- 数值条上标注阈值标记（小三角），显示每个条件规则的触发点
- 点击数值条展开关联规则列表
- ±5 快速调节 → 实时更新触发状态
- 触发状态分组：已激活 / 部分满足 / 未触发

**规则拓扑：**
- 互斥组：同组事件色块 + ⊗ 连接符，可视化互斥关系
- 依赖链：编号步骤 + 箭头流向，锁定图标标识未解锁
- 独立规则：条件/随机类型标记

**规则编辑器（底部抽屉）：**
- 基本信息：名称、所属世界书、内容
- 激活模式：条件触发 / 随机触发
- 主条件：数值 + 运算符 + 阈值
- 附加条件：支持数值/事件/地点三种类型，可添加多个
- 互斥组分配：输入新组名或选择已有组
- 前置依赖：选择前置事件
- 权重滑块

**eventConfig 扩展：**
- `exclusionGroup: string` — 互斥组名
- `requires: string[]` — 前置事件 ID 列表
- `multiConditions: [{type, ...}]` — 多条件组合

#### 4. NPC管理App（全新）

**文件：** `client/src/apps/NPCApp.jsx`

- 角色选择器 + 关系列表（卡片式，按类型颜色标记）
- NPC 详情底部抽屉：emoji选择 / 名称 / 关系类型（6种） / 亲密度滑块 / 备注
- 创建新 NPC + 删除 NPC
- API：/api/characters/:charId/relations CRUD

#### 5. 角色手机App

**文件：** `client/src/apps/CharPhoneApp.jsx`

- 独立全屏体验（非标签页内嵌）
- 主屏幕图标网格：消息 / 联系人 / 朋友圈 / 相册 / 备忘录 / 收藏
- 消息页面：联系人列表 → 聊天界面（角色消息在右，用户在左）
- 朋友圈：读取 lifeStore 数据展示为社交动态

#### 6. 路由修正

**文件：** `client/src/App.jsx`

- `道枢` → `RuleSystemApp`（之前错误指向 CharSystemApp）
- `npc管理` → `NPCApp`（之前是 PlaceholderApp）
- `角色系统` → `CharSystemApp`（不变）
- `角色手机` → `CharPhoneApp`（不变）
- 移除 DaoshuApp import，新增 RuleSystemApp + NPCApp import

#### 7. 测试数据（直接写入 JSON）

为「郁疏澜」编写完整种子数据验证数据流：
- `timeline.json`：8 条时间线事件（里程碑/事件/聊天/物品类型）
- `items.json`：5 个物品（带 category/source/emotionalValue/linkedTimelineIds）
- `skills.json`：7 个技能（3 类别，不同等级和经验值）
- `relations.json`：4 条关系（friend/colleague/rival 类型）
- `life.json`：3 条生活日志（上午/下午/傍晚）
- `char_stats.json`：追加郁疏澜数值（含 statusInfo）

#### 8. 世界书事件数据

- `wb_books.json`：新增「郁疏澜的世界」世界书
- `wb_entries.json`：新增 9 条条目
  - 2 条背景（always + keyword 模式）
  - 3 条随机事件（墨的撒娇 / 深夜灵感 / 收到意外关心）
  - 4 条条件事件（stress≥70 / mood≥75 / mood≤25 / trust≥65）

### 已知局限

1. `exclusionGroup` / `requires` / `multiConditions` 仅前端展示和编辑，后端 `pickEvents()` 尚未实现互斥排除和依赖检查
2. extraction.js 的 `extractionEnabled` 默认 false，需要在设置中手动开启
3. 多条件中 `event` 和 `location` 类型的满足判断需要与实际运行状态对接（当前只做了 `stat` 类型的实时计算）

---

## 2026-03-21（续二）— SettingsApp 补全：角色系统预设 + 总结提示词编辑

### 新增功能

#### 1. SettingsApp — 副 API 分配新增「角色系统」

**文件：** `client/src/apps/SettingsApp.jsx`

- `FEATURE_LIST` 新增 `charSystem`（角色系统），现在共 4 个功能可独立分配 AI 预设：
  - 聊天总结 / **角色系统**（时间线/提取/生活日志） / 角色生活生成 / 大富翁主持
- 对应后端：`activeStore.featurePresets.charSystem`，`debug.js` 的 `charSystemPresetId` 读写同一字段

#### 2. SettingsApp — 新增「总结提示词」Tab

**文件：** `client/src/apps/SettingsApp.jsx`，`client/src/services/settings.js`

- 第三个 Tab：「总结提示词」，4 种类型均可编辑（segment / daily / mode / periodic）
- placeholder 显示内置默认文本，方便用户对照修改
- `onBlur` 自动保存 + 手动「保存」按钮 + 「恢复默认」（清空以使用内置默认）
- 「已保存 ✓」绿色确认提示

**API：** `GET/PUT /api/settings/summary-prompts`（后端早已实现，前端补上调用）

**`settingsService` 新增：**

- `getSummaryPrompts()` / `setSummaryPrompts(data)`

---

## 2026-03-22

### 完成

**问题4 — AI 回复 max_tokens 暴露**
- `openai-compat.js` 默认值是 1500，`chat.js` 调用时根本没传 `max_tokens`，一直截断
- SettingsApp `DEFAULT_FORM` 加 `maxReplyTokens: 3000` 字段
- 预设表单加输入框（100~32000，step 100），说明截断原因
- `chat.js` 流式 + 非流式分支都读 `aiPreset?.maxReplyTokens ?? 3000` 传给 AI

**问题6 — CharPhoneApp 三个 bug**
- 消息区滚动失效：`ChatScreen` 根 div 和 motion.div 加 `min-h-0`，flex-1 嵌套不加 min-h-0 会导致 overflow-y-auto 无效
- 长按返回：`HomeScreen` 加 `onLongPress` prop，壁纸区 pointerDown 700ms 触发，传入主组件的 `onBack`
- 状态栏 emoji（📶🔋）换成 CSS 绘制的信号格和电池图标（问题9一并修）

**问题7 — SuixiangApp 条目样式重做**
- 去掉每条条目的 `rounded-2xl bg-gray-50 border` 框
- 改为：内容 → 右对齐署名行（`—— 时间 + mood emoji`） → 分割线（最后一条不显示）
- 卡片详情背景加点阵纹理（`radial-gradient` CSS背景图）
- 编辑状态改为白色/毛玻璃内联框，不再是蓝色盒子

**问题8 — MinggeApp 用户本体**
- 后端 `personas.js` 加 `GET/PUT /api/personas/user-profile`，数据存 `active.userProfile`
- `GET /api/personas` 响应增加 `userProfile` 字段
- `NoneCard` 替换为 `UserBaseCard`，展示用户名/头像emoji/简介，右上角编辑按钮，长按也可触发
- `PersonaForm` 加 `isUserBase` prop：用户本体模式不要求填颜色，名称可为空

### 待处理（写入 task.md 供讨论）

- 问题1/2：FilesApp token 统计 — 动态槽（char/worldbook/history）没有实际数据，估算为0是必然的，需要讨论方案
- 问题3：每个功能的上下文预设 — 需要你告知每个功能期望注入什么上下文
- 问题5：总结功能失效 — 需要查 AI Console 日志定位错误

---

## 2026-03-22（晚，DreamApp 视觉重构尝试）

### 做了什么

**DreamApp 拆分（完成）**

把原来 290 行单文件拆成 8 个文件：

| 文件 | 职责 |
|------|------|
| `DreamApp.jsx` | 主入口，状态 + 布局 |
| `dream/useDreams.js` | 数据 hook（增删改查 + AI 生成） |
| `dream/dreamUtils.jsx` | 常量、工具函数、AnimeStar SVG |
| `dream/DreamSky.jsx` | PixiJS v8 渲染层 |
| `dream/DreamStars.jsx` | 渲染所有未解读星星 + 空状态 |
| `dream/AnimeStar.jsx` | 单颗星星状态机（8 个 phase） |
| `dream/DreamCard.jsx` | 星星展开的梦境卡片弹窗 |
| `dream/DreamAddModal.jsx` | 手动添加梦境（未改） |

**PixiJS v8 视觉（搁置）**

实现了天空渐变、星云（BlurFilter 预烘焙）、80颗背景星（闪烁）、bloom、流星、地平线光晕、水面倒影（RenderTexture + DisplacementFilter）、水底梦境倒影、点击爆炸粒子、流星落水动画。

### Bug 记录

**skyRT 反馈循环**：`render(app.stage → skyRT)`，stage 含读 skyRT 的 reflSpr，GPU 死循环卡死浏览器。修复：独立 skyContainer，只渲染天空层。

**每帧重复 BlurFilter**：3 个 BlurFilter(strength:40) 每帧走 26 次 GPU pass，打爆 WebGL watchdog。修复：init 时一次性预烘焙到 RenderTexture，之后只改 alpha。

**StrictMode destroy 崩溃**：cleanup 在 init() 完成前调 app.destroy()，`_cancelResize` 未注册 → TypeError。修复：`initDone` flag + try/catch。

**removeChild 抛异常**：先 addChild 到 stage 再 removeChild 搬到 skyContainer，顺序错误时 PixiJS throw → React ErrorBoundary 白屏。修复：直接 addChild 到正确 container，不搬家。

### 结果

视觉不达预期，用户决定暂时搁置，去找 CSS 设计素材。架构拆分保留，等素材回来再补视觉。

### 教训

PixiJS 不是魔法，工具换了不等于效果自动好。场景设计和动画编排细节依赖审美输入和迭代，这部分需要用户提供参考素材或具体方向。

---
