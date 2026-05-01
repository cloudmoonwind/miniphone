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
保留策略：默认保留 14 天，超过自动删（可调）。配置走环境变量。

终端 UI：AIConsoleApp.tsx 改成读取按日期保存的 jsonl，默认最近一个有日志的日期，上限取消（不再 30 条封顶）。可选：加个"导出"按钮把当天日志打包下载。

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
保留：14 天，超出自动删
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
purgeOlderThan(days = 14) — 删过期文件
启动时调用 purgeOlderThan(14) 一次

## 五、HTTP 接口变更

接口	变化
GET /api/debug/ai-log	行为变更：增加 ?date=YYYY-MM-DD 参数，不传默认今天；返回该日全部条目
GET /api/debug/ai-log/dates	新增：返回有日志的日期列表，给日期选择器用
DELETE /api/debug/ai-log	保留：清空当前查看日期的文件；带 ?date= 删指定日

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
保留：自动刷新（仅当查看的是"今天"时有效）、清空、token 统计

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
❌ 导出/打包下载日志按钮
❌ 按角色/会话过滤（终端目前是全局视角，方案 2 上来后可以加）
如果这个计划没问题我就开始动手。有几处特别想确认：

流式失败的"errorPhase"分类够用吗？（before-call / mid-stream / after-stream）
结论：我会在流式 wrapper 里累积 partial output，无论怎么结束都写进 output 字段。

删除策略是想要"我手动 DELETE 才删"还是"老文件自动消失"？我默认理解是后者（14 天硬清）。
结论：自动删除

## 改后复检

改动落点
新增

server/services/aiLogStore.ts —— 按日期分文件的 JSONL 存储 + 14 天清理
修改

server/providers/openai-compat.ts —— chatCompletion/chatCompletionStream/listModels 都包了日志层；流式用 async generator 包装 + try/catch/finally 保证任何结束方式（成功/中途失败/消费方提前断）都写入；流式失败保留已收到的 partial output
server/providers/index.ts —— getProvider 把 providerKey 传进 provider 实例
server/services/ai.ts —— 删掉内存 ringbuffer、pushLog、logStreamCompletion，瘦身成纯 facade
server/routes/chat.ts —— 删掉 logStreamCompletion 两处调用与 lastUsage/usedModel/t0 等不再需要的变量
server/routes/debug.ts —— GET /ai-log?date= + 新增 GET /ai-log/dates + DELETE /ai-log?date=
server/index.ts —— 启动时调 purgeAiLogs(14)
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

去掉左右箭头，不做日历。终端只提供"有日志日期"下拉列表，默认选最近一个有日志的日期。14 天保留期下，下拉比日历更简单，也不会点到一串空白日期。


# Phase 2 实施建议

## 一、核心原则：只记"决策点"，不记"操作步骤"

每个子系统都有两类代码：

决策点：分支判断、过滤、淘汰、覆盖、截断、跳过——"为什么走这条路"
操作步骤：取数据、格式化、序列化、循环——"按部就班执行"
只记决策点，故事就清晰；记操作步骤就成了噪音。

举例对比：

✓ 该记	✗ 不该记
世界书条目 wb_a 与 wb_b 都激活，互斥组 g1 留 wb_a（权重高）	查询了 worldbook_entries 表
evt_confession 候选但被冷却 3 轮跳过	取角色全部 events
<var> 行"好感度: 50→52"原值校验失败（当前=48）	解析了 5 行
context 槽 sys-history 因 maxTokens=2000 截掉 3 条最旧消息	拼接了字符串
pending_injection inject_42 消费一轮，剩 2 轮	查询 pending_injections 表
每一轮 30~100 条这种粒度，是有用的故事；500 条 SQL 调用是垃圾。

## 二、架构：每"轮"一个 trace

"轮"的定义：一次用户触发的请求生命周期。最常见的 3 个入口：

POST /api/chat/respond（聊天主入口）
POST /api/values/item/:id/adjust（手动调数值）
POST /api/characters/:id/life/generate（生成生活日志）
机制：Node AsyncLocalStorage

路由进入时 runWithTrace(traceId, () => ...) 包裹整个 handler
整个调用栈里任意子系统调 trace.event(...)，不需要传参，不需要 import 复杂的东西
没有活跃 trace 时（比如 cron、健康检查、setInterval 跑的代码）静默跳过——零侵入
API 极简化：


trace.event('worldbook.activated', `entry=${id} ${selected ? '✓' : 'dropped'}`, {
  entryId, strategy, group, weight, selected,
});
三个参数：

type：点分命名（用于前端折叠/过滤），如 worldbook.activated、event.skip、var.parse
message：一句人话（学习者直接读这一列就懂）
data：结构化字段（点开看细节、AI 调试时方便提取）
存储：跟 AI 日志同模式


server/data/logs/trace/2026-05-01.jsonl
一行 = 一轮（不是一条事件）。一轮内的所有事件作为数组嵌在 trace 对象里。这样每一轮的故事完整在一行里，肉眼直接 cat | grep 都能用。

与 AI 日志互联：AI 日志已经预留了 traceId 字段——provider 层调用时如果 trace 活跃就把 traceId 写进去。前端能双向跳转。

## 三、显示：把"一轮"渲染成时间线

我觉得直接做个 trace tab，跟 AI 终端同结构（日期切换器 + 折叠条目），每个折叠条目展开后是这样的故事视图：


▾ trace_xxx  16:20:23  [chat.respond]  char_legacy_ally  2.45s  37 events  1 ai-call
  ───── timeline (relative ms) ─────
  +0     [chat.respond]      start (mode=online)
  +12    [context.assemble]  start (mode=flexible)
  +33    [context.slot]      sys-syspre        24 tokens
  +35    [context.slot]      sys-tools         skipped (disabled)
  +48    [worldbook.scan]    book=主世界 (depth=20, 6 entries)
  +50    [worldbook.match]   wb_intro_001 constant ✓
  +52    [worldbook.match]   wb_g1_a keyword="生气" group=g1 weight=100 selected
  +53    [worldbook.match]   wb_g1_b keyword="生气" group=g1 weight=80 dropped (g1_a wins)
  +60    [context.slot]      sys-variables     4 rules injected
  +62    [variables.resolve] {{v:affection:desc}} → "朋友"
  +75    [context.slot]      sys-history       12 msgs (3 truncated, maxTokens=2000)
  +80    [pendingInject.consume]  inject_42 → 2 turns left
  +82    [ai.call]           openai/gpt-4o-mini → log_abc123  (click)
  +2401  [ai.return]         in=1234 out=89  2.32s
  +2420  [var.parse]         "好感度：50→52" applied
  +2421  [var.parse]         "心情：50→55" applied
  +2430  [event.check]       trigger=value_change var=affection (2 subscribers)
  +2432  [event.skip]        evt_confession cooldown=3 left
  +2433  [event.fire]        evt_milestone_50 effects=[inject, set_outcome, record_history]
  +2441  [event.effect]      inject → pending_injections+1
  +2442  [event.effect]      set_outcome evt_milestone_50='success'
  +2443  [event.effect]      record_history → timeline+1
  +2452  [chat.respond]      done
学习者从上往下读，整个轮次里"什么触发了什么、谁覆盖了谁、谁被跳过"都清楚。点 [ai.call] log_abc123 跳到 AI 日志看完整 prompt。

支持的过滤：

按 type 折叠分组（只看 event.*、只看 worldbook.*）
按 traceId 跳来跳去
grep 关键词（变量名、事件 id 等）

## 四、量级估算

按上面的标准，每轮事件数：

简单聊天（无世界书命中、无事件触发）：~15 条
普通聊天：~30 条
重头戏（多个事件 fire + 多 effect + 世界书互斥）：~80 条
每条 JSON 大约 200-500 字节。一天 50 轮重对话 ≈ 1-3 MB jsonl。14 天 ≈ 30-50 MB。完全可接受。

## 五、分阶段实施（每阶段都可独立完成停手）

Phase 2a · trace 基础设施（1~2 小时）

新文件 server/services/trace.ts：AsyncLocalStorage + trace.event API
新文件 server/services/traceStore.ts：写 jsonl + 14 天清理（跟 aiLogStore 同结构，可以抽公共代码）
路由 chat.respond / values.../adjust / life.generate 入口处套 runWithTrace
provider 层把 traceId 自动写进 AI log 的 traceId 字段
此时没有任何业务子系统埋点，trace 是空的，但管道通了
Phase 2b · 主链路埋点（2~3 小时）

context.ts：assembleMessages 入口/出口、每个槽的状态、截断
worldbook.ts：扫描、匹配、互斥淘汰、级联激活
values.ts：占位符解析、<var> 块每行的处理
eventEngine.ts：checkAndFireEvents 每个候选的判定、effect 执行
此时已经能看到完整的故事，对调试和学习足够
Phase 2c · 前端 trace 查看器（1~2 小时）

把现有 AIConsoleApp 改成 tab 结构：AI Calls / Traces
Traces tab：日期切换器 + 折叠 + 时间线渲染
AI 日志条目里增加 → trace_xxx 跳转链接
Phase 2d · 扩展埋点（按需）

摘要、提取、dafu、life 生成等次要入口
这部分按你后续遇到具体调试需求再补

## 六、要你拍的几件事

每轮一行 vs 每事件一行：我建议每轮一行（人读友好、原子写入）。如果你想直接 tail -f trace.jsonl 看实时事件流，得改成每事件一行。
Phase 2c（前端）做不做：如果你只是想自己学习、并发给我们 jsonl 看，前端可以跳过；如果你希望在终端 UI 直接读，那要做。
从哪步开始：建议 2a + 2b 一起做（管道通了但没埋点 = 无意义），2c 看你需要。
trace 在 AsyncLocalStorage 里"找不到"时的行为：静默跳过（推荐）还是 console.warn？前者干净，后者能帮我们发现"哪些代码路径没被 wrap"。
