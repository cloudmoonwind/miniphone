# 终端日志修复方案

## 方案 1：AI 通信全量记录

埋点位置下移：从现在的 ai.ts 包装层下沉到 server/providers/openai-compat.ts 的 provider 层。任何用 provider 的代码（包括 settings.ts 的测试连接、未来任何绕过 wrapper 的代码）自动被记下。也包括 listModels。

存哪里：建议用专门文件夹而不是数据库。理由——

这是调试数据，不是用户数据；进 SQLite 会污染 backup 流程
JSONL 文件能直接 cat / grep / 拷给我或 codex 看，零工具门槛
写文件不会跟 better-sqlite3 同步写抢锁
具体形式：


server/data/logs/ai/
  2026-05-01.jsonl    # 每行一条记录
  2026-04-30.jsonl
  ...
记录字段（在现有的基础上扩）：


id, timestamp, traceId,           // traceId 关联到方案2的链路
provider, baseURL, model,
endpoint,                          // 'chat' | 'chatStream' | 'listModels' | 'testConnection'
durationMs, inputMessages, output, usage,
streamChunks?,                     // 流式：分片数 + 是否中途断
error?, status?, errorPhase?       // 'before-stream' | 'mid-stream' | 'after-stream'
保留策略：默认保留 3 天，超过自动删（可调）。配置走环境变量。

终端 UI：AIConsoleApp.tsx 改成读取按日期保存的 jsonl，默认最近一个有日志的日期，上限取消（不再 30 条封顶）。提供当前日期日志导出/删除，也提供单条日志导出/删除。

.gitignore：加 server/data/logs/。

## 方案 2：内部触发链路（你说的 B）

模型：每次用户触发的"轮"（最常见是 POST /api/chat/respond）开一个 TurnTrace，整个轮次内所有子系统的关键事件都写到这个 trace。轮结束时持久化。同一轮的 AI 调用日志通过 traceId 反查能对到。

实现机制：用 Node 的 AsyncLocalStorage——子系统不需要把 trace 一路传参，只要 getCurrentTrace()?.log(...) 就行。没 trace 时静默忽略（zero-cost on hot paths that don't run inside a turn）。

记录哪些环节（按重要度）：

上下文组装：每个 item 的 token 数、有没有被 maxTokens 截断、世界书激活的 entry id 列表（含被互斥组淘汰的、被级联激活的、被 probability 刷掉的）
变量解析：sys-variables 槽位注入了哪几条 ruleText、解析到的 promptSnippet
AI 调用：链接到方案 1 的日志 id
<var> 块解析：每行的处理结果（成功/原值校验失败/不认识的变量名）
事件引擎：每次 checkAndFireEvents 的 trigger 类型、候选事件 id、每个候选的判定结果（fire/cooldown/probability/conditions-fail）
effects 执行：每个 effect 的类型、目标、是否成功
pending_injections：本轮消费了哪几条、剩余轮次
存哪里：跟方案 1 同根目录，分文件：


server/data/logs/trace/
  2026-05-01.jsonl
每行一个完整 trace（一个 turn）。

终端 UI 扩展：现有 AIConsoleApp 加一个 tab 切换 "AI" / "Trace"，trace 视图按 turn 折叠，能展开看内部事件流。或者保留一个视图，按 traceId 把 AI 调用和 trace 事件交错显示。

## 落地顺序建议

我建议按 方案1 → 方案2 顺序做，因为：

方案1 改动小（主要是 provider + 写文件 + 改终端读取源），1 次提交内能完
方案2 需要在 4–5 个 service 里埋点，量大、容易出错；先把方案1 的 traceId 字段铺好，方案2 接进来时就能直接 link


# Phase 1 实施计划：AI 通信全量记录

## 一、目录与存储

位置：server/data/logs/ai/
格式：按本地日期分文件 2026-05-01.jsonl，每行一条 JSON 记录
保留：3 天，超出自动删
清理时机：服务启动时扫一遍 + 每次写入时顺手判断（轻量，不开 cron）
.gitignore：加 server/data/logs/

## 二、记录条目字段

{
  id:           string,            // log_<ts>_<rand>
  traceId:      string | null,     // 方案2 接入后填，本期保留 null
  timestamp:    string,            // ISO
  endpoint:     'chat' | 'chatStream' | 'listModels' | 'testConnection',
  source:       string | null,     // 业务来源：chat.respond / dream.generate / settings.testConnection 等
  provider:     string,            // 'openai-compat' 等
  baseURL:      string,
  model:        string,
  durationMs:   number,
  inputMessages: any[] | null,     // listModels/testConnection 可能为 null
  output:       string | any | null,
  usage:        { prompt_tokens, completion_tokens, ... } | null,
  // 流式特有
  streamChunks: number | null,     // 收到的 chunk 数
  streamAborted: boolean | null,   // 是否中途断
  streamCompleted: boolean | null, // 是否完整消费到上游结束
  streamAbortType:
    | 'none'
    | 'before-call-error'
    | 'upstream-error'
    | 'client-disconnect'
    | 'server-cancel'
    | 'consumer-break'
    | null,
  // 错误
  error:        string | null,
  status:       number | null,
  errorPhase:   'before-call' | 'mid-stream' | 'after-stream' | null,
}

## 三、埋点位置（关键变更）

下沉到 provider 层——server/providers/openai-compat.ts 的 chatCompletion / chatCompletionStream / listModels 各包一层日志。这样：

✅ 设置页测试连接（之前漏的）自动入日志
✅ 流式中途断（之前漏的）自动入日志（用 async generator 包装 stream，无论怎么结束都触发 finalize）
✅ listModels 入日志
✅ 任何未来绕过 ai.ts wrapper 的代码都被覆盖
ai.ts 同步简化：删掉内存 ringbuffer 与 pushLog，删掉 logStreamCompletion()（路由不再需要手动调）。getClient/chatCompletion/chatCompletionStream 这三个对外 API 名字保留，内部不再做日志。

chat.ts 简化：删掉 logStreamCompletion(...) 的调用点（流式 error 分支也不再需要单独处理）。

## 四、新增模块

server/services/aiLogStore.ts：

appendEntry(entry) — 异步追加到当天文件，目录不存在自动建
listDates() — 返回有日志的日期数组（倒序，新→旧）
readByDate(date) — 返回某天的全部 entry 数组
purgeOlderThan(days = 3) — 删过期文件，可通过 AI_LOG_RETENTION_DAYS 调整
启动时调用 purgeOlderThan() 一次

## 五、HTTP 接口变更

接口	变化
GET /api/debug/ai-log	行为变更：增加 ?date=YYYY-MM-DD 参数，不传默认今天；返回该日全部条目
GET /api/debug/ai-log/dates	新增：返回有日志的日期列表，给日期选择器用
DELETE /api/debug/ai-log	保留：清空当前查看日期的文件；带 ?date= 删指定日
DELETE /api/debug/ai-log/:id	新增：删除指定日期内的一条日志；带 ?date= 定位日期

## 六、前端改造（AIConsoleApp.tsx）

顶栏加日期选择器：


[2026-05-01 ▼]    12 calls   [grep__] [▶] [↻] [🗑]
下拉显示有日志的日期（从 /dates 接口取）
只允许选择实际存在日志的日期，不显示空日期
默认最近一个有日志的日期；没有任何日志时显示 today 空态
主区域改为可折叠列表：

每条 collapsed 时一行：

▸ #01 [STREAM] 14:23:05  gpt-4o-mini  2.34s  in=1234 out=89  OK
▸ #02 [SYNC]   14:23:42  gpt-4o-mini  0.81s  in=520  out=120 ERR 402
点击展开 → 显示完整 REQUEST + RESPONSE（用现在 renderRaw() 的格式）
顶栏多两个按钮：「全展开」「全折叠」
grep 时：命中的条目自动展开，未命中的隐藏（不只是高亮）
保留：自动刷新（仅当查看的是"今天"时有效）、当前日期导出/清空、单条导出/删除、token 统计

## 七、改动文件清单

新增：

server/services/aiLogStore.ts
修改：

server/providers/openai-compat.ts — 加日志包装
server/providers/index.ts — 如果需要往 provider 传 baseURL 等元信息（看实际类型）
server/services/ai.ts — 删内存日志 + pushLog + logStreamCompletion
server/routes/chat.ts — 删 logStreamCompletion 两处调用
server/routes/debug.ts — 改 /ai-log 接口、加 /ai-log/dates
server/index.ts — 启动时调 purgeOlderThan(14)
client/src/apps/AIConsoleApp.tsx — 日期切换器 + 可折叠列表
.gitignore — 加 server/data/logs/

## 八、验证步骤（写完跑一遍）

tsc --noEmit 通过
启动后端 → 检查 server/data/logs/ai/ 自动建出来
触发一次聊天 → 检查当天 jsonl 多一行
触发设置页"测试连接" → 检查多一条 endpoint=testConnection
故意填错 baseURL 触发流式失败 → 检查多一条带 errorPhase=before-call 或 mid-stream
终端 UI：日期切换器能拉到日期列表、折叠/展开正常工作
改系统时间到 15 天后启动 → 检查老文件被删（这步可选，太麻烦可以跳过）

## 九、不在本期范围（明确）

❌ traceId 内容（保留字段，方案 2 接入后填）
❌ 触发链路（事件 / 世界书 / 变量等）
❌ 按角色/会话过滤（终端目前是全局视角，方案 2 上来后可以加）
如果这个计划没问题我就开始动手。有几处特别想确认：

流式失败的"errorPhase"分类够用吗？（before-call / mid-stream / after-stream）
结论：我会在流式 wrapper 里累积 partial output，无论怎么结束都写进 output 字段。

删除策略是想要"我手动 DELETE 才删"还是"老文件自动消失"？我默认理解是后者（3 天硬清）。
结论：自动删除

## 改后复检

改动落点
新增

server/services/aiLogStore.ts —— 按日期分文件的 JSONL 存储 + 3 天清理
修改

server/providers/openai-compat.ts —— chatCompletion/chatCompletionStream/listModels 都包了日志层；流式用 async generator 包装 + try/catch/finally 保证任何结束方式（成功/中途失败/消费方提前断）都写入；流式失败保留已收到的 partial output
server/providers/index.ts —— getProvider 把 providerKey 传进 provider 实例
server/services/ai.ts —— 删掉内存 ringbuffer、pushLog、logStreamCompletion，瘦身成纯 facade
server/routes/chat.ts —— 删掉 logStreamCompletion 两处调用与 lastUsage/usedModel/t0 等不再需要的变量
server/routes/debug.ts —— GET /ai-log?date= + 新增 GET /ai-log/dates + DELETE /ai-log?date= + DELETE /ai-log/:id?date=
server/index.ts —— 启动时调 purgeAiLogs()
.gitignore —— 加 server/data/logs/
client/src/apps/AIConsoleApp.tsx —— 重写：有日志日期下拉、可折叠条目、grep 自动展开命中项、自动刷新仅"今天"生效、状态栏显示保留期

## Phase 1 二次复修（Codex 复核后）

修正 1：非流式返回契约

provider 层仍然读取完整 OpenAI 响应，并把 content + usage 写进日志；但返回给业务代码的值恢复为原始回复文本。也就是说：日志需要的 token/usage 留在日志里，聊天、梦境、生活日志、总结、角色系统提取、大富翁等业务入口继续拿字符串，避免把 `{ content, usage }` 这种内部对象包传给旧业务流程。

修正 2：日志分类拆成 endpoint + source

endpoint 保留技术类型：chat / chatStream / listModels / testConnection。

source 新增业务来源：chat.respond、chat.legacy、settings.testConnection、settings.models、dream.generate、life.generate、summaries.generate、summaries.generateDaily、summary.auto、charSystem.extraction、charSystem.timelineEval、charSystem.lifeExtract、dafu.hostNarrative、dafu.charReply、dafu.openingNarrative、dafu.inviteReply。

这样可以区分"这是一次 chat completion"和"它来自哪个功能"，避免梦境、生活日志、总结等都混成普通聊天。

修正 3：流式中断记录更明确

保留 partial output：已经收到的 AI 文本仍写入 output。

新增 streamCompleted 和 streamAbortType：

- none：完整结束
- before-call-error：请求建立前失败
- upstream-error：AI 服务商/网络在流式过程中报错
- client-disconnect：浏览器或 SSE 连接断开
- server-cancel：服务器主动取消（预留）
- consumer-break：内部消费方提前停止读取，但原因不明

目前 chat.respond 的 SSE 路径会监听客户端连接关闭，并把这类情况标为 client-disconnect。没有中断标记时，不再把 partial output 伪装成完整回复。

修正 4：日期 UI 简化

去掉左右箭头，不做日历。终端只提供"有日志日期"下拉列表，默认选最近一个有日志的日期。3 天保留期下，下拉比日历更简单，也不会点到一串空白日期。


# Phase 2 实施建议（修正版）

## 一、核心原则：完整记录，分层阅读

这套项目的规模不能按"普通轻量聊天"估算。你实际会常驻多本世界书，每本多个条目；同时还有事件书、变量系统、记忆、摘要、生活日志、pending injections 等注入源。因此 Phase 2 不应追求"一轮只有 30 条左右"，而应追求：

存储层：尽量保存完整证据，方便事后复盘和交给 AI/开发者分析。

显示层：默认只看摘要层，按模块逐层展开到 detail/debug，避免一打开就是几百行。

记录原则仍然是"决策点优先，不记机械操作"：

✓ 该记	✗ 不该记
世界书扫描 5 本 41 条，命中 8 条，最终注入 5 条	查询了 worldbook_entries 表
互斥组 g1 留 wb_a，淘汰 wb_b	遍历数组第几项
evt_confession 候选但冷却剩 3 轮	取角色全部 events
<var> 行"好感度: 50→52"原值校验失败（当前=48）	解析了 5 行字符串
sys-history 因 maxTokens 截掉 3 条最旧消息	拼接了 prompt 字符串
pending_injection inject_42 消费一轮，剩 2 轮	查询 pending_injections 表

默认视图看 summary/detail 里的关键决策；完整 JSON 里可以保留更多 detail/debug 证据。

## 二、"一轮"的定义

"一轮"不等于"一次 AI API 调用"。

"一轮" = 一次用户或系统触发的业务生命周期。它可能包含 AI 调用，也可能完全不涉及 AI。

常见有 AI 的轮：

- `chat.respond`：用户发消息，角色回复
- `life.generate`：生成生活日志
- `dream.generate`：生成梦境
- `summaries.generate` / `summaries.generateDaily`：生成总结
- `dafu.hostNarrative` / `dafu.charReply`：大富翁叙事或角色回应

常见无 AI 的内部轮：

- `values.adjust`：手动调整变量
- `event.fireManual`：手动触发事件
- `timePass.hourly` / `timePass.daily`：定时器推进
- `pending.consume`：只消费注入轮次
- 未来规则引擎自动推进的内部任务

trace 需要有 `source/kind` 字段，例如 `chat.respond`、`values.adjust`、`life.generate`。AI 日志通过 `traceId` 反向关联到同一轮；没有 AI 的轮也应有 trace，只是 `aiCallCount=0`。

## 三、事件结构：summary / detail / debug

每条 trace event 建议包含：

```ts
{
  id: string,
  parentId: string | null,
  ts: string,
  offsetMs: number,
  module: 'context' | 'worldbook' | 'variables' | 'memory' | 'eventEngine' | 'pending' | 'ai' | 'route',
  type: string,        // worldbook.summary / worldbook.match / event.skip 等
  level: 'summary' | 'detail' | 'debug',
  message: string,     // 给人看的短句
  data: object | null, // 给机器和展开详情看的结构化字段
}
```

层级含义：

- `summary`：默认展示，一眼看懂这轮发生了什么。
- `detail`：点开某个 summary 后展示，例如每个命中的世界书条目、每个候选事件的跳过原因。
- `debug`：默认隐藏，只在需要深查时展示，例如未命中的大量条目的原因分布或原始片段。

示例：

```text
summary  worldbook.summary  5 books / 41 entries / 8 matched / 5 injected / 3 dropped
detail   worldbook.match    wb_intro_001 constant injected
detail   worldbook.match    wb_angry_a keyword="生气" injected
detail   worldbook.drop     wb_angry_b dropped: same group, wb_angry_a wins
detail   worldbook.drop     wb_secret_01 dropped: probability roll failed
```

## 四、存储：一轮一行，但不是一坨字符串

存储仍建议：

```text
server/data/logs/trace/2026-05-01.jsonl
```

一行 = 一个完整 trace 对象，不是一条事件。

这样一轮的证据是原子的，复制给 AI 或开发者时不会丢上下文。trace 对象内部包含 metadata、events、aiCallIds、summaryStats 等字段。

示意：

```ts
{
  id: 'trace_xxx',
  source: 'chat.respond',
  startedAt: '...',
  durationMs: 2850,
  characterId: 'char_xxx',
  aiCallIds: ['log_abc123'],
  eventCount: 143,
  summaryStats: {
    aiCallCount: 1,
    worldbookMatched: 8,
    worldbookInjected: 5,
    variablesApplied: 3,
    eventsFired: 2,
  },
  events: [...]
}
```

UI 展示时不是把这一行 JSON 原样丢出来，而是把 events 渲染成可展开表格/时间线。

## 五、显示：从单行逐层展开

第一层：轮次列表。

```text
trace_abc  chat.respond   14:23:05  2.8s  143 events  1 ai-call
trace_def  values.adjust  14:25:11  0.1s   18 events  0 ai-call
```

第二层：点开某一轮，默认只显示 summary 时间线。

```text
+0ms    chat.start          online mode
+20ms   context.summary     12 slots, 4180 tokens, 2 slots truncated
+35ms   worldbook.summary   5 books, 41 entries, 8 matched, 5 injected
+50ms   memory.summary      6 memories injected, 820 tokens
+65ms   variables.summary   4 rules injected, 12 placeholders resolved
+80ms   ai.call             log_xxx
+3100ms ai.return           ok, 1234 in / 220 out
+3120ms var.summary         3 applied, 1 failed
+3140ms event.summary       12 candidates, 2 fired, 5 skipped, 5 failed conditions
+3160ms pending.summary     1 consumed, 2 remaining
```

第三层：点开某个 summary，展示它的 detail。

```text
worldbook.summary
  主世界书：12 条，命中 3，注入 2
  角色关系书：8 条，命中 1，注入 1
  当前场景书：10 条，命中 4，注入 2

  wb_intro_001     constant        injected
  wb_angry_a       keyword=生气     injected
  wb_angry_b       keyword=生气     dropped, same group as wb_angry_a
  wb_secret_01     probability     dropped, roll failed
```

支持过滤：

- 按 `source`：只看 chat.respond / values.adjust / life.generate
- 按 `module`：只看 worldbook / eventEngine / variables
- 按 `level`：只看 summary，或显示 detail/debug
- 按 `traceId` 在 AI 日志与 trace 之间跳转
- grep 变量名、事件 id、世界书 id、关键词

## 六、量级估算（修正版）

原先"普通聊天 30 条"只适合小系统。按本项目规模，估计应改成：

- 简单聊天：50-100 条 events，其中默认 summary 约 15-30 行
- 普通聊天：100-250 条 events，其中默认 summary 约 20-50 行
- 重配置聊天：300+ 条 events，例如多本世界书、多候选事件、多变量更新同轮发生
- 无 AI 内部轮：5-50 条 events，取决于变量/事件链路复杂度

存储上仍可接受，因为一轮一 JSON 行，且只保留 3 天。UI 必须默认折叠 detail/debug，否则不可读。

默认上限建议：

- 每个 trace 最多 1000 条 events。
- 单个 event 的 `data` 序列化后最多 8KB。
- 单个 trace 序列化后最多 2MB。
- 上限可通过环境变量调整：`TRACE_MAX_EVENTS_PER_TURN`、`TRACE_MAX_EVENT_BYTES`、`TRACE_MAX_TRACE_BYTES`。

这些值适合作为第一版防护栏：普通轮不会碰到，重配置轮也大多能保留完整证据；真正爆量时避免日志无限膨胀。后续如果发现常规使用频繁触顶，再按真实样本调大。

一旦发生丢弃/截断，必须显式标记"不完整"：

- trace 顶层写 `incomplete: true`。
- trace 顶层写 `truncationReason`，例如 `max-events` / `max-event-bytes` / `max-trace-bytes`。
- trace 顶层写 `droppedEventCount`、`truncatedEventCount`。
- events 末尾追加一条 `trace.truncated` summary 事件，message 里说明丢弃了多少内容。
- 单个 event 的 data 被截断时，该 event 写 `truncated: true`，并保留 `originalBytes` / `keptBytes`。

这样即使日志不完整，UI 和 AI 分析也会知道"这份证据被截过"，不会把缺失误判成没有发生。

## 七、分阶段实施（每阶段都可独立停手）

Phase 2a · trace 基础设施

- 新增 `server/services/trace.ts`：AsyncLocalStorage + `runWithTrace()` + `trace.event()`。
- 新增 `server/services/traceStore.ts`：按日期写 `server/data/logs/trace/YYYY-MM-DD.jsonl`，同样 3 天保留。
- trace event 支持 `level`、`module`、`type`、`parentId`、`data`。
- provider 层自动读取当前 traceId，写入 AI log 的 `traceId`。
- 路由先包 `chat.respond`、`values.adjust`、`life.generate`，后续再扩。

Phase 2b · 最小主链路埋点

- `context.ts`：组装开始/结束、槽位 summary、token 估算、截断、记忆/摘要/生活日志注入数量。
- `worldbook.ts`：扫描 summary、命中 detail、互斥淘汰、概率失败、级联激活；大量未命中默认只做统计。
- `values.ts`：变量规则注入 summary、占位符解析 summary/detail、`<var>` 每行应用/失败原因。
- `eventEngine.ts`：候选数量 summary、fire/skip/fail detail、effect 执行结果。
- `events.ts`：pending injection 消费、剩余轮次、删除/保留原因。

Phase 2c · Trace UI

- AIConsoleApp 增加 `AI Calls / Traces` tab。
- Traces tab 使用"有日志日期"下拉，列表一行一个 trace。
- 展开 trace 后默认只显示 summary 时间线。
- summary 行可展开 detail；debug 默认隐藏。
- `ai.call` 行可跳到对应 AI log；AI log 也可跳回 trace。
- AI Calls 和 Traces 都支持导出/删除当前日期日志，也支持导出/删除单条日志。

Phase 2d · 扩展入口

- dream.generate、summaries.generate、summaries.generateDaily、charSystem.extraction、charSystem.timelineEval、charSystem.lifeExtract、dafu.*。
- 定时器类轮次：timePass.hourly / timePass.daily。这里要决定是否静默记录，避免后台日志太多。

## 八、待确认点

- trace 找不到时：默认静默跳过，避免污染普通路径。
- debug level 是否默认写入：建议先写入但 UI 隐藏；如果文件膨胀明显，再加环境变量控制。
- 定时器轮次是否记录：建议先只记录有实际 fired/changed 的轮次。
- 第一版是否只做 `chat.respond + values.adjust + life.generate`：建议是，等主链路稳定后再扩展 dream/summary/dafu。

## Phase 2 实施落地记录（Codex）

新增：

- `server/services/trace.ts`：AsyncLocalStorage、`runWithTrace()`、`traceSummary()`、`traceDetail()`、`traceDebug()`、超限截断与 incomplete 标记。
- `server/services/traceStore.ts`：按日期写 `server/data/logs/trace/YYYY-MM-DD.jsonl`，3 天保留，支持按日期/单条读取删除。

已接入入口：

- `POST /api/chat/respond` → `source=chat.respond`
- `POST /api/values/item/:id/adjust` → `source=values.adjust`
- `POST /api/characters/:charId/life/generate` → `source=life.generate`

已接入模块埋点：

- `openai-compat.ts`：AI 调用自动读取当前 traceId，AI 日志写入 traceId；trace 中记录 `ai.call`、`ai.return`、`ai.error`。
- `chat.ts` / `ChatApp.tsx` / `useChatState.ts` / `summaries.ts`：聊天、重新生成、段落总结会把当前 preset 的 `provider` 一起传到后端；旧聊天入口也保留 provider 兜底，避免 DeepSeek baseURL/model 被日志误标成默认 `openai`。
- `context.ts`：上下文开始/结束、数据源数量、世界书激活分布、pending injection 插入、槽位 token 估算/截断、变量规则注入。
- `worldbook.ts`：扫描 summary、命中 detail、概率淘汰、互斥组淘汰、最终注入数量。
- `values.ts`：变量占位符解析、`<var>` 块解析、变量应用/失败/未变化原因；聊天回复没有 `<var>` 块时也会写一条 summary，方便区分“确实没有变量块”和“变量解析链路没跑”。
- `eventEngine.ts`：候选事件数量、跳过原因、触发事件、effect 执行结果。
- `events.ts`：pending injection 消费、删除、剩余轮次、保留原因。

新增接口：

- `GET /api/debug/traces?date=YYYY-MM-DD`
- `GET /api/debug/traces/dates`
- `DELETE /api/debug/traces?date=YYYY-MM-DD`
- `DELETE /api/debug/traces/:id?date=YYYY-MM-DD`

终端 UI：

- `AIConsoleApp.tsx` 增加 `AI / Trace` tab。
- AI 和 Trace 都支持有日志日期下拉、当前日期导出/删除、单条导出/删除。
- Trace 展开后默认展示 summary 时间线；summary 行可展开 detail；debug 默认隐藏，由 `DBG` 开关显示。
- AI 日志行显示 traceId；Trace 行显示 aiCallIds。

当前暂未接入但接口/source 已适合后续扩展：

- `dream.generate`
- `summaries.generate` / `summaries.generateDaily`
- `charSystem.extraction` / `charSystem.timelineEval` / `charSystem.lifeExtract`
- `dafu.*`
- `timePass.hourly` / `timePass.daily`
