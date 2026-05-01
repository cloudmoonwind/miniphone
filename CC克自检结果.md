CC 克自检清单 · 2026-04-30
[1] 数据库
状态：已实现完整

相关文件：

server/db/database.ts
server/storage/index.ts
关键代码：


// from server/db/database.ts:22
export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH); // DB_PATH = server/data/ics.db
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    runMigrations(_db);
  }
  return _db;
}
实际行为：
使用 SQLite（better-sqlite3，WAL 模式）。数据库文件路径 server/data/ics.db，服务器启动时自动运行 drizzle migrations。

与设计文档的偏离：

设计文档中提到 PostgreSQL（记忆系统 Schema 和需求文档第二版），实际使用 SQLite。选型是我做的，理由是本地 demo 不需要 PG 的复杂度。未与 Agnes 明确确认这个偏离。
已知问题：无

该项备注：存储层有两套机制并存——Drizzle 管的列式表（character_values、events、worldbooks 等 14 张），和 SqliteStore（blob-json 模式，存 characters、messages 等其余所有表）。两者都写同一个 ics.db 文件。

[2] 数据库表结构
状态：已实现完整

相关文件：

server/db/schema.ts
server/db/migrations/0000_baseline.sql
server/storage/index.ts
关键代码（数据库实际存在的所有表，来自 sqlite3 .tables 输出）：


__drizzle_migrations     active                   calendar_events
char_stats               character_values         characters
condition_subscriptions  dafu_game                diary
dreams                   event_books              event_connections
event_tags               events                   items
life                     maps                     memories
messages                 pending_injections       personas
presets                  prompt_presets           relations
sessions                 skills                   stat_defs
suixiang_cards           suixiang_entries         summaries
timeline                 value_rules              value_stages
world_state              worldbook_entries        worldbook_event_entries
worldbooks
Drizzle 管理的表（schema.ts 定义，所有列已贴出见 schema.ts:1-230）：
character_values、value_stages、value_rules、event_books、events、event_tags、event_connections、condition_subscriptions、pending_injections、worldbooks、worldbook_entries、worldbook_event_entries、world_state

SqliteStore blob 管理的表（自动建表，结构为 id TEXT PK, data TEXT(JSON), updated_at TEXT）：
active（singleton）、characters、messages、summaries、char_stats、stat_defs、life、items、timeline、skills、relations、memories、dreams、presets、prompt_presets、personas、maps、calendar_events、dafu_game、diary、suixiang_cards、suixiang_entries

实际行为（sqlite3 验证）：


character_values: 27 行（多角色）
events: 24 行
value_rules: 56 行
pending_injections: 4 行
worldbooks: 6 行
characters: 4 行
messages: 8 行（仅 sqlite 层计数，实际消息通过 SqliteStore 存储）
与设计文档的偏离：

SqliteStore 的表结构是 {id, data(JSON blob), updated_at} 格式，不是文档里设想的列式表，查询不支持 SQL 过滤，只能全表扫再在 JS 里过滤。
已知问题：

SqliteStore 全表读取在消息量大时有性能隐患（目前消息量小未出问题）
character_values 建表时缺少 UNIQUE(character_id, variable_name) 约束，重复变量只能在服务层防止
该项备注：无

[3] 版本号与迁移机制
状态：已实现完整（Drizzle 管的表），SqliteStore 表无版本管理

相关文件：

server/db/migrations/meta/_journal.json
server/db/migrations/0000_baseline.sql
server/db/migrations/0001_value_fields.sql
server/db/migrations/0002_rule_text.sql
server/db/database.ts:40
关键代码：


// from server/db/database.ts:40
function runMigrations(db: Database.Database): void {
  const orm = drizzle(db, { schema });
  migrate(orm, { migrationsFolder: MIGRATIONS_PATH });
  console.log('[db] migrations applied');
}
实际行为：

版本记录在 __drizzle_migrations 表（Drizzle 自动维护）
迁移脚本在 server/db/migrations/，共 3 个：
0000_baseline.sql：建全量基线表
0001_value_fields.sql：character_values 加 value_type/sort_order/group_name 列，value_rules 加 description 列
0002_rule_text.sql（最新）：将 value_rules 从自动化引擎模式（trigger_on/operation/amount/conditions）重构为纯自然语言 ruleText 字段，通过建新表→迁移数据→删旧表→重命名完成
SqliteStore 表自动建表（第一次访问时 CREATE TABLE IF NOT EXISTS），无版本控制，结构变化时无迁移机制
与设计文档的偏离：

无
已知问题：

SqliteStore 的表结构如果需要变更（如加列），目前没有自动迁移能力，只能手写 SQL
该项备注：无

[4] 对话循环完整调用链
状态：已实现完整

相关文件：

client/src/apps/chat/useChatState.js（前端状态机，未读全但从 ChatMain 导入确认存在）
server/routes/chat.ts
server/services/context.ts:124
server/services/ai.ts
server/services/values.ts
server/services/eventEngine.ts
关键代码：


// from server/routes/chat.ts:158（主路径 POST /api/chat/respond）
// 1. 取 active preset
const { messages } = await assembleMessages(characterId, personaId, null, { contextMode });
// 2. 流式发送
const { stream } = await chatCompletionStream(client, messages, { model, max_tokens: 3000 });
// 3. 逐 chunk SSE
for await (const chunk of stream) {
  fullContent += delta;
  res.write(`data: ${JSON.stringify({ delta })}\n\n`);
}
// 4. 提取 <var> 块
const { cleanContent, varBlock } = extractVarBlock(fullContent);
// 5. 保存 AI 消息
const aiMsg = await messageStore.create({ sender: 'character', content: cleanContent, ... });
// 6. 应用变量更新
parseAndApplyVarBlock(characterId, varBlock);
// 7. 写日志
logStreamCompletion({ model, messages, fullContent: streamClean, t0, usage });
// 8. 后续异步：摘要、事件引擎
checkAndFireEvents(characterId, { trigger: 'chat_end', chatContent: streamClean });
tickCooldowns(characterId, 'turns');
consumeInjectionTurns(characterId);
实际行为：
完整链路顺序：

前端 useChatState.saveUserMessage() → POST /api/chat/message（chat.ts:116）保存用户消息，5分钟内可合并
前端 useChatState.triggerAI() → POST /api/chat/respond（chat.ts:158）
assembleMessages()（context.ts:124）组装完整 prompt
chatCompletionStream() 或 chatCompletion()（ai.ts:54）调用 AI
流式时：逐 chunk SSE，前端实时渲染
extractVarBlock()（values.ts:340）剥离 <var> 块
messageStore.create()（SqliteStore）持久化 AI 消息
parseAndApplyVarBlock()（values.ts:354）更新 character_values
logStreamCompletion()（ai.ts:72）写内存日志
parseOutcomeFromAIResponse() → checkAndFireEvents() → tickCooldowns() → consumeInjectionTurns()
与设计文档的偏离：无

已知问题：

旧接口 POST /api/chat/（chat.ts:302）是兼容旧流程的非流式入口，不走 extractVarBlock 和事件引擎
[5] AI 调用
状态：已实现完整

相关文件：

server/services/ai.ts
server/providers/index.js（未读全，从导入推断）
关键代码：


// from server/services/ai.ts:26
export function getClient(preset) {
  return getProvider(preset); // provider 抽象层
}
// 非流式
export async function chatCompletion(provider, messages, options = {}) {
  const { content, usage } = await provider.chatCompletion(messages, options);
  pushLog({ inputMessages: messages, output: content, ... }); // 记录完整 prompt+回复
  return content;
}
实际行为：

SDK：自定义 Provider 抽象层，内部使用 OpenAI-compatible HTTP 客户端（可切换不同服务商）
默认模型：代码 fallback 为 'gpt-3.5-turbo'，实际使用模型由 active preset 的 model 字段决定
prompt 模板：存储在 SQLite prompt_presets 表，通过 active.activePromptPresetId 激活，内容为 contextItems 数组（槽位顺序 + 是否启用 + maxTokens 等配置）
失败处理：
非流式：throw error，路由层返回 HTTP 500 + error.message
流式：stream error 写 { error: message } SSE 事件后 res.end()
无重试机制
用户看到的是前端 error toast（具体实现在 useChatState，未读全）
与设计文档的偏离：无

已知问题：

无重试逻辑，API 临时抖动会直接报错给用户
[6] 上下文组装详情
状态：已实现完整

相关文件：

server/services/context.ts
关键代码（默认上下文顺序，context.ts:82-96）：


const DEFAULT_CONTEXT_ITEMS = [
  'sys-syspre',    // 系统提示_前（可编辑）
  'sys-tools',     // 工具（默认 disabled）
  'sys-wbpre',     // 世界书前置（system-top）
  'sys-char-core', // char.name + char.core + 时间戳说明
  'sys-char-desc', // char.persona（支持 {{v:}} 占位符）
  'sys-char-sample', // char.sample（默认 disabled）
  'sys-user-desc', // 激活的命格马甲内容
  'sys-memories',  // importance>=7 的记忆
  'sys-wbpost',    // 世界书后置（before-chat + system-bottom + after-chat）
  'sys-scene',     // 场景（可编辑）
  'sys-life',      // 近期生活（最近3条）
  'sys-dreams',    // 近期梦境（最近3条）
  'sys-variables', // 变量状态 + 规则文本 + 更新格式指令
  'sys-summaries', // 最近5条摘要
  'sys-history',   // 聊天历史（最近20条，展开为多条消息）
  'sys-syspost',   // 系统提示_后（可编辑）
].map(id => ({ entryId: id, enabled: id !== 'sys-tools' && id !== 'sys-char-sample', ... }));
pending_injections 注入点（按 position 字段）：

before_char：在 char-core 之前（context.ts:329）
after_char：在 char-sample 或 char-desc 之后（context.ts:548）
before_history：在 history 之前（context.ts:335）
status_section：在 scene 或 life 之前（context.ts:341）
未匹配 position 的注入：追加到最末尾 system 块（context.ts:555）
实际行为：所有槽位来源均从 SQLite 读取，world book entries 通过 getActivatedEntries() 激活，变量通过 getValuesByCharacter() 获取。

与设计文档的偏离：

depth 位置注入（在历史消息中间按深度插入）：worldbook_entries.depth 字段存在，但 context.ts 中没有实现"按深度插入历史消息中间"的逻辑，所有世界书条目都归入 system-top/bottom/before-chat/after-chat 四个固定位置
已知问题：无

[7] 数值系统现状
状态：已实现完整（数值+阶段+规则 CRUD、占位符、规则文本注入）；trigger_on 自动化机制已废弃

相关文件：

server/db/schema.ts:22-60
server/services/values.ts
server/routes/values.ts
server/services/context.ts:442-504
关键代码（占位符解析，values.ts:285）：


export function resolveValuePlaceholders(template: string, characterId: string): string {
  return template.replace(/\{\{v:(\w+)(?::(\w+))?\}\}/g, (_match, varName, field) => {
    const val = getValueByVariable(characterId, varName);
    if (!field) return String(val.currentValue);
    const stage = getCurrentStage(val.id);
    switch (field) {
      case 'stage':  return stage?.stageName ?? '未定义';
      case 'desc':   return stage?.description ?? '';
      case 'prompt': return stage?.promptSnippet ?? '';
    }
  });
}
关键代码（sys-variables 槽位，context.ts:442）：


case 'variables': {
  // 情绪底色三轴 sanity/stability/intensity
  // 其余变量：variableName(name)：currentValue（stageName）
  // 当前范围内的 ruleText 全部注入
  const activeRules = getActiveRuleTexts(charId);
  for (const r of activeRules) {
    lines.push(`${r.variableName}（${r.name}，当前${r.currentValue}）：${r.ruleText}`);
  }
  // 格式指令：每轮末尾附加 <var> 块
}
实际行为：

三张表：均已建立，数据库有真实数据（character_values: 27行，value_rules: 56行）
增删改查接口：全部实现（12个接口，见 routes/values.ts）
占位符 {{v:affection:desc}} 等：已实现，用于 char.core 和 char.persona 字段，以及世界书条目 content
prompt_snippet 注入状态：promptSnippet 字段存储在 value_stages 表中，可通过 {{v:varname:prompt}} 在 char.core/persona 里显式调用；但 sys-variables 槽位不自动注入 promptSnippet，只显示阶段名。如果 char.core 里没有 {{v:affection:prompt}} 占位符，promptSnippet 的内容不会出现在 prompt 里
trigger_on 机制：已彻底废弃（migration 0002_rule_text.sql 删除了 trigger_on/operation/amount/conditions 字段）。现在 value_rules 是纯自然语言文本，由 sys-variables 槽位注入给 AI 作为更新参考
与设计文档的偏离：

设计文档里的 trigger_on（chat_end / time_pass / receive_gift / event_complete / value_change）服务端自动执行机制：已废弃，不是偏离而是有意重设计（变量系统设计原理 memory 里有记录）
promptSnippet 不在 sys-variables 里自动注入，需要作者在角色设定里显式写占位符才生效
已知问题：

数值变化后不自动通过 value_change trigger 通知事件引擎（除了 /api/values/item/:id/adjust 接口会触发；但 AI 通过 <var> 块更新变量时的 parseAndApplyVarBlock 没有触发 checkAndFireEvents）
[8] 事件系统现状
状态：部分实现（核心状态机、条件评估、effects 执行、冷却已实现；steps 多步骤机制未实现；事件成功/失败判断使用 AI 自判方案）

相关文件：

server/db/schema.ts:63-142
server/services/eventEngine.ts
server/services/events.ts（未读全，从导入推断）
关键代码（checkAndFireEvents，eventEngine.ts:65）：


export function checkAndFireEvents(charId: string, ctx: TriggerContext): FireResult {
  // 1. 检查所有 locked 事件的解锁条件 → 满足则转为 pending
  const unlocked = checkUnlockConditions(charId, snapshot);
  // 2. 根据 trigger 类型找候选 pending 事件（用订阅索引或全量查）
  const candidates = findCandidates(charId, ctx, snapshot);
  // 3. 评估 triggerConditions + 冷却 + 概率 → 执行 effects
  for (const evt of candidates) {
    if (!canFire(evt, ctx, snapshot)) continue;
    fireEvent(charId, evt, ctx, snapshot);
  }
}
实际行为：

events 主表所有字段：全部已建
四张辅助表：event_tags ✓（seed 写入），event_connections ✓（引擎使用），condition_subscriptions ✓（findSubscribers 在 value_change/keyword/event_complete 时使用），pending_injections ✓（createInjection、consumeInjectionTurns）
状态机：locked → pending（checkUnlockConditions）→ completed/pending-repeat（fireEvent）。注意：active 状态从未被设置，fireEvent 直接从 pending 转 completed 或保留 pending（重复事件）
解锁条件 vs 触发条件：确实分两层（checkUnlockConditions + canFire 中分别评估）
三种冷却：
按轮次互斥（cooldown_type='turns'）：tickCooldowns(charId, 'turns') 在每次 chat_end 后执行 ✓
按时间（cooldown_type='time'）：tickCooldowns(charId, 'days') 在每日定时器中执行 ✓
按条件次数叠加（conditionCooldown）：canFire() 中实现 ✓
condition_subscriptions 真在用：value_change/keyword/event_complete trigger 时通过 findSubscribers 只查订阅了的事件；chat_end/time_pass_*/receive_gift trigger 时退化为全量查该角色 pending 事件
事件成功/失败判断方案：AI 自判方案（parseOutcomeFromAIResponse 解析 [EVENT:id:outcome] 标签）已实现 (eventEngine.ts:596)
steps 多步骤机制：字段（steps/current_step）存在于表结构，但 eventEngine.ts 中无 steps 处理逻辑，未实现
与设计文档的偏离：

active 状态实际上从不被使用，事件直接从 pending 转 completed
已知问题：

steps 多步骤机制未实现（字段有，逻辑无）
AI 变量更新（parseAndApplyVarBlock）不触发 value_change 事件检查（见第 7 项已知问题）
[9] 双模式切换现状
状态：部分实现

相关文件：

server/routes/chat.ts:117（mode 字段存储）
server/services/context.ts:248-276（时间戳逻辑）
关键代码（context.ts:248 时间戳差异）：


if (m.mode === 'offline') {
  // 线下消息：只按自然日打日期标记，不打精确时间
  if (dayKey !== lastMarkedDay) {
    metaTs = dayKey;
    lastMarkedDay = dayKey;
  }
} else if (isHot) {
  // 线上热区：每层打精确时间 HH:mm
  metaTs = formatTimestampForAI(ts, charTz, false);
}
实际行为：

切换 online/offline 对 prompt 的唯一影响：时间戳标记格式
offline：消息时间戳仅标注日期（YYYY-MM-DD），不带时分
online：热区（最近各3条 user/char 消息）打精确时间（YYYY-MM-DD HH:mm），今天非热区按2小时段，历史按自然日
角色设定、系统提示词、世界书注入内容、变量状态：不因 mode 变化而变化
前端按钮切换 mode 影响的是后续新消息的 mode 字段，不改变已存消息的 mode
与设计文档的偏离：

如果设计文档预期 offline 模式有独立的 prompt 内容（如不同的角色状态描述、场景切换），目前没有实现——切换的只是时间戳格式
已知问题：

输出截断 bug：不清楚这是指什么具体现象（没有在代码里看到明确的截断机制），未复现过。如果是流式响应中途断开，应与 max_tokens 上限（3000）或网络有关，未定位根因
[10] 世界书现状
状态：已实现完整（constant/keyword/级联/互斥组 已实现；depth 深度插入未实现；向量匹配未实现）

相关文件：

server/services/worldbook.ts:229-370
server/services/context.ts:162-172
server/db/schema.ts:144-220
关键代码（激活链路，worldbook.ts:229）：


export function getActivatedEntries(charId, messages) {
  // 1. 获取启用的书（global + 绑定该角色的）
  // 2. constant 条目无条件激活（受 probability 控制）
  // 3. keyword 条目：在最近 scanDepth 条消息里匹配 keywords
  //    支持：caseSensitive、matchWholeWord、filterKeywords（二级过滤）、filterLogic
  // 4. 级联：激活条目的 content 追加到 scanText，触发更多 keyword 条目
  // 5. 互斥组：同 inclusionGroup 只留一个（groupWeight 加权随机）
  // 6. 返回激活条目，包含 position 字段（用于 context.ts 分组）
}
实际行为：

触发策略已实现：constant、keyword（含二级过滤、互斥组、级联激活）
未实现：向量语义匹配（字段不存在于 schema）
注入位置：system-top（wb-pre 槽）、system-bottom（wb-post 槽）、before-chat（wb-post 槽）、after-chat（wb-post 槽）
未实现：depth 位置（条目的 depth 字段存在，但 context.ts 里没有把条目插入历史消息中间第 N 位的逻辑）
sticky/cooldown/delay 字段存在于 schema，但 getActivatedEntries 中没有实现这些效果
与设计文档的偏离：

depth 插入未实现
sticky/cooldown/delay 字段存在但无运行时逻辑
已知问题：

sticky/cooldown/delay 字段是空字段，写进去不生效
worldbook_event_entries 表（random/conditional 策略条目）：建了，也有 CRUD 接口，但 getActivatedEntries 只查 worldbook_entries，不处理 worldbook_event_entries
[11] 端到端测试
状态：未实现

相关文件：无

关键代码：无

实际行为：项目目录内无任何 .test.ts、.spec.ts、.test.tsx、.spec.tsx 文件。node_modules 里的测试文件不属于项目测试。

与设计文档的偏离：N/A（未实现，无法谈偏离）

已知问题：无

该项备注：无任何自动化测试。没有单元测试、集成测试、端到端测试。目前一切验证都依赖手动运行和观察日志。

[12] 日志与可观测性
状态：部分实现（原始 prompt + 回复已记录；触发链路未记录）

相关文件：

server/services/ai.ts:1-78
server/routes/debug.ts:13
关键代码（ai.ts:4-18）：


const AI_LOG_MAX = 30;
const aiCallLog  = [];

function pushLog(entry) {
  aiCallLog.push(entry);
  if (aiCallLog.length > AI_LOG_MAX) aiCallLog.shift();
}
// 每次 chatCompletion / chatCompletionStream 结束时写入：
// { id, timestamp, stream, model, durationMs, inputMessages, output, usage, error }
实际行为：

在内存中保存最近 30 次 AI 调用记录
每条记录包含：完整 inputMessages（即完整 prompt 数组）、output（AI 完整回复）、model、durationMs、usage、error
通过 GET /api/debug/ai-log 接口可以读取
触发链路不记录：世界书哪些条目被激活、pending_injections 哪些被消费、哪些变量规则触发、AI <var> 块解析结果——这些都不在日志里
服务器重启后日志清空（纯内存，不持久化）
与设计文档的偏离：

Agnes 要求的"触发链路监控"只有原始 prompt 和回复，没有链路细节
已知问题：

内存日志不持久化，重启丢失
最多 30 条，高频对话会被覆盖
[13] 各前端页面状态
状态：各页面状态不一，见下

相关文件：client/src/apps/

实际行为（逐页面）：

聊天（ChatApp / chat/ChatMain.tsx）

真实接后端：发消息、AI 流式回复、历史消息加载、删消息、编辑消息 ✓
数据来源：messageStore（SQLite）
还差什么：未验证流式中断重试
变量系统（MetaApp → ValueEditor）

真实接后端：变量 CRUD、阶段 CRUD、规则 CRUD，前端可以增删改查 ✓
数据来源：character_values / value_stages / value_rules（Drizzle/SQLite）
还差什么：前端没有变量值实时变化的监控面板（能看数值但不能看对话中的实时变化）
事件系统（MetaApp → EventEditor、EventBooksTab）

真实接后端：事件书 CRUD、事件 CRUD ✓
数据来源：events / event_books（Drizzle/SQLite）
还差什么：前端没有事件状态流转的可视化（看不到哪些事件是 pending/locked/completed）
世界书（worldbook/index.tsx、WorldbookTab、EventBooksTab）

真实接后端 ✓
数据来源：worldbooks / worldbook_entries / worldbook_event_entries（Drizzle/SQLite）
日历（CalendarApp）

真实接后端 /api/calendar ✓
数据来源：calendar_events（SqliteStore/SQLite）
还差什么：无，增删改查日历事件已接后端
大富翁（dafu/DafuApp.tsx）

接后端 /api/dafu，有大厅、设置、邀请、游戏、记录等页面
游戏记录从 /api/dafu/records 读取
AI 驱动的叙事/戏剧面板（DramaPanel、ConfessionGame 等）：不确定是否全部接后端，未逐页详读
还差什么：未验证完整游戏一局能跑通
随想溪流（suixiang/index.tsx）

接后端 /api/suixiang ✓
数据来源：suixiang_cards / suixiang_entries（SqliteStore/SQLite）
还差什么：溪流美化（WaterScene）是前端动画，已有骨架；完整的溪流交互效果（水流、浮动、粒子）未验证是否完整
梦境（DreamApp → dream/）

真实接后端 /api/characters/:charId/dreams ✓
数据来源：dreams（SqliteStore/SQLite）
生活（CharLifeApp）

真实接后端 /api/characters/:charId/life/generate ✓，AI 生成生活日志
数据来源：life（SqliteStore/SQLite）
与设计文档的偏离：无

已知问题：

大富翁完整游戏逻辑未逐一验证，状态不明确
实证素材
一、启动命令与运行日志
服务器当前未运行，以下为启动方式（未在此次盘点中实际执行）：


# 后端（server/）
cd server && npm run dev  # 或 ts-node / tsx server/index.ts
# 前端（client/）
cd client && npm run dev
# 服务端口：http://localhost:3000（后端），http://localhost:5173（前端，Vite）
服务器启动日志预期格式（基于 server/index.ts:100-110）：


[db] migrations applied
[seed] CharName: +5值 +20阶段 +10规则 +6事件 +10标签 +4连接 +5世界状态
[ICS server] listening on http://localhost:3000
无法提供实际运行截图/日志，因为此次盘点没有启动服务器。

二、数据库结构原样输出
通过 sqlite3 server/data/ics.db 执行得到：

所有表（已在第 2 项列出）

character_values 实际 CREATE TABLE（来自 sqlite3 .schema）：


CREATE TABLE `character_values` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `character_id` text NOT NULL,
  `category` text NOT NULL,
  `name` text NOT NULL,
  `variable_name` text NOT NULL,
  `current_value` real DEFAULT 0 NOT NULL,
  `min_value` real DEFAULT 0 NOT NULL,
  `max_value` real DEFAULT 100 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text,
  value_type TEXT NOT NULL DEFAULT 'continuous',
  sort_order INTEGER NOT NULL DEFAULT 0,
  group_name TEXT
);
（后三列是 migration 0001 用 ALTER TABLE ADD COLUMN 加的，SQLite 没有在原始 CREATE TABLE 里体现）

value_rules 实际 CREATE TABLE（migration 0002 重建后）：


CREATE TABLE "value_rules" (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `value_id` integer NOT NULL REFERENCES `character_values`(`id`) ON DELETE CASCADE,
  `range_min` real,
  `range_max` real,
  `rule_text` text NOT NULL DEFAULT '',
  `enabled` integer NOT NULL DEFAULT 1,
  `created_at` text
);
当前数据行数：


character_values: 27
events: 24
value_rules: 56
pending_injections: 4
worldbooks: 6
characters: 4
messages: 8
三、一次真实对话的完整原始 prompt
无法提供。

原因：AI 调用日志存储在服务器内存（aiCallLog 数组，server/services/ai.ts:5），服务器当前未运行，内存日志已清空。

要获取真实 prompt，需要：

启动服务器（npm run dev）
进行一次对话
请求 GET http://localhost:3000/api/debug/ai-log
取返回数组中第一条的 inputMessages 字段，即完整 prompt 数组
此接口已实现并可用，但此次盘点不启动服务器，无法提供这段实证。

清单输出日期：2026-04-30
执行者：CC 克（claude-sonnet-4-6）

---

## Codex 复核审查补充 · 2026-05-01

### 复核范围与结论

本次复核按照 `CC克自检指令_v1.md` 的 13 项要求，对当前项目文件、数据库结构和关键链路进行了重新核对。未修改业务代码，未启动前后端服务，未发起真实 AI 请求。

已执行的核验：

- 阅读 `CC克自检指令_v1.md` 与本文件原自检结果。
- 核对 `server/db/schema.ts`、`server/db/database.ts`、`server/db/SqliteStore.ts`、`server/storage/index.ts`。
- 核对聊天链路：`client/src/apps/chat/useChatState.ts`、`client/src/apps/chat/ChatMain.tsx`、`client/src/services/chat.ts`、`server/routes/chat.ts`、`server/services/context.ts`、`server/services/ai.ts`。
- 核对数值、事件、世界书、日志链路：`server/services/values.ts`、`server/routes/values.ts`、`server/services/eventEngine.ts`、`server/services/events.ts`、`server/services/worldbook.ts`。
- 使用 `sqlite3 -readonly server/data/ics.db ".tables"` 与 `.schema` 读取当前数据库结构。
- 使用 `rg --files -g "*.test.*" -g "*.spec.*" -g "!**/node_modules/**"` 检查项目测试文件。
- 执行类型检查：`client` 下 `npm exec tsc` 通过；`server` 下 `npm exec tsc -- --noEmit` 通过。

总判断：原自检大方向与代码现状主体吻合，但多处“已实现完整”的表述需要降级或补充约束。最大问题不在代码实现本身，而在自检结果没有完全满足自检指令的硬格式与实证要求：数据库结构没有列出所有表的所有列，真实启动日志和真实对话 prompt 没有提供，双模式切换也没有贴切换前后的 prompt 对比。

### 逐项复核判断

#### [1] 数据库

复核判断：原结论成立。当前实际数据库是 SQLite，入口为 `server/db/database.ts`，使用 `better-sqlite3`，数据库文件为 `server/data/ics.db`，启动时调用 Drizzle migrator。

补充修正：

- `SqliteStore` 表结构原文写成 `id TEXT PK, data TEXT(JSON), updated_at TEXT` 不准确。当前代码实际建表为 `id TEXT PRIMARY KEY, char_id TEXT, data TEXT NOT NULL, created_at TEXT`，并为每张 blob 表创建 `idx_<table>_char_id` 索引。见 `server/db/SqliteStore.ts`。
- “选型是谁做的、是否与 Agnes 确认”属于 CC 克自述，我无法从代码中独立验证。

#### [2] 数据库表结构

复核判断：原自检没有满足指令的“完整列出当前数据库里所有表，每张表的列名、类型、约束”。这一项应从“已实现完整”改为“部分满足盘点要求”。

补充修正：

- 当前 `.tables` 还包含 SQLite 自动表 `sqlite_sequence`，原文未列出。
- 原文只列出了全部表名和两张表的 schema，没有列出 `events`、`worldbook_entries`、`pending_injections`、所有 SqliteStore blob 表等的完整列结构。
- 当前数据库实测行数补充：
  - `character_values`: 27
  - `events`: 24
  - `value_rules`: 56
  - `pending_injections`: 4
  - `worldbooks`: 6
  - `worldbook_entries`: 98
  - `worldbook_event_entries`: 0
  - `condition_subscriptions`: 0
  - `characters`: 4
  - `messages`: 8

#### [3] 版本号与迁移机制

复核判断：原结论成立，但“版本号机制”需要更精确描述。

补充修正：

- Drizzle 的迁移记录在 `__drizzle_migrations`，当前有 3 条 hash/created_at 记录；不是业务表上的显式 `version` 字段。
- `server/db/migrations/meta/_journal.json` 记录了 `0000_baseline`、`0001_value_fields`、`0002_rule_text`。
- `SqliteStore` 的 blob 表只通过 `CREATE TABLE IF NOT EXISTS` 建表，没有版本号与自动迁移。

#### [4] 对话循环完整调用链

复核判断：主链路描述成立，但原文有文件路径错误与旧接口影响需要补充。

补充修正：

- 原文写 `client/src/apps/chat/useChatState.js`，当前实际源文件是 `client/src/apps/chat/useChatState.ts`。代码中 import 使用 `.js` 后缀是 Vite/TS 的 ESM 运行约定。
- 当前实际启用的是拆分后的 `client/src/apps/chat/ChatApp.tsx`，旧的 `client/src/apps/ChatApp.tsx` 仍在仓库中但未被 `client/src/App.tsx` 导入。
- 前端“中止生成”按钮只调用 `abortCtrlRef.current?.abort()`，但 `respondStream()` 没有把 `AbortController.signal` 传给 `fetch`。因此 UI 有中止按钮，实际流式请求未被接入 abort 信号。
- 旧接口 `POST /api/chat` 仍存在，确实不做 `<var>` 提取、变量快照写回和事件引擎触发。

#### [5] AI 调用

复核判断：原结论部分成立，需要修正默认模型描述。

补充修正：

- 实际 SDK 是官方 `openai` npm 包，封装在 `server/providers/openai-compat.ts`，不是手写 HTTP fetch。
- `server/services/ai.ts` 和 `server/providers/openai-compat.ts` 的内部默认模型是 `gpt-4o-mini`。
- 聊天路由 `server/routes/chat.ts` 在调用时传入的兜底模型是 `gpt-3.5-turbo`。所以“默认模型”不能只写一个：服务层默认为 `gpt-4o-mini`，聊天路由无 preset/model 时兜底为 `gpt-3.5-turbo`，实际运行优先使用 active preset 的 `model`。
- 无重试机制这一点成立。

#### [6] 上下文组装详情

复核判断：原结论成立，但“完整”需要受限说明。

补充修正：

- `context.ts` 中有 `truncateToTokens()`，如果单个 context item 设置了 `maxTokens`，内容会被截断并追加 `…（已按 maxTokens 截断）`。这可能与第 [9] 项提到的“输出/内容截断”混淆。
- pending injection 的 `position='depth'` 没有深度插入逻辑，会落入未消费注入，最后追加到末尾 system 消息。
- 世界书激活失败时被 `catch {}` 静默降级，日志不可见。

#### [7] 数值系统现状

复核判断：原实现描述成立，但“已实现完整”应限定为“CRUD + 占位符 + AI 规则文本注入已实现；自动规则执行已废弃/未实现”。

补充修正：

- `promptSnippet` 不会自动出现在 `sys-variables`。只有作者在 `char.core`、`char.persona` 或世界书内容中显式写 `{{v:变量名:prompt}}`，才会通过 `resolveValuePlaceholders()` 替换进 prompt。
- 原自检指令要求“贴一段实际 prompt 证明 prompt_snippet 注入”，原结果没有提供。因此该项的实证不满足。
- `parseAndApplyVarBlock()` 更新变量后没有触发 `value_change` 事件检查；只有 `/api/values/item/:id/adjust` 会触发 `checkAndFireEvents(... value_change ...)`。
- 当前 `character_values` 没有数据库级唯一约束，`routes/values.ts` 里虽然捕获 UNIQUE 错误，但 schema 实际没有 `UNIQUE(character_id, variable_name)`。

#### [8] 事件系统现状

复核判断：原“部分实现”判断成立，但还有两个需要写清的风险。

补充修正：

- `event_connections.relation_type` schema 只有一个文本字段。`parseOutcomeFromAIResponse()` 查询 `relationType === 'branch'` 后又尝试解析 `branch:success` 后缀，这两种写法互相冲突；如果实际存 `branch:success`，当前查询不会命中。如果实际存 `branch`，后缀判断永远没有 required outcome。
- `condition_subscriptions` 当前数据库行数为 0。代码支持订阅机制，但当前数据状态下没有真实订阅记录可供触发。
- `record_history` effect 只 `console.log`，没有写入历史/时间线系统。
- `active` 状态未被事件引擎使用这一点成立。
- `steps/current_step` 只有字段，没有多步骤推进逻辑这一点成立。

#### [9] 双模式切换现状

复核判断：原“部分实现”判断成立，但原结果没有满足指令中的 prompt 对比要求。

补充修正：

- UI 切换确实改变 `mode` 状态；保存用户消息时 `mode` 被写入 message；AI 回复时也带当前 mode。
- 发给 AI 的 prompt 差异主要来自 `context.ts` 的历史消息时间戳策略：`offline` 只按自然日打日期，`online` 对热区消息打精确分钟时间。
- 原自检指令要求贴“切换前 prompt”和“切换后 prompt”，原结果没有提供，因此实证不足。
- “输出截断 bug 未复现”可以保留，但代码里存在两类相关机制：AI `max_tokens` 可能导致模型回复截断；context item 的 `maxTokens` 会截断上下文内容。

#### [10] 世界书现状

复核判断：原结论需要降级。应写为“普通世界书条目的 constant/keyword/级联/互斥组已实现；depth/sticky/cooldown/delay/向量匹配未实现；事件世界书条目不参与聊天上下文激活”。

补充修正：

- `worldbook_event_entries` 当前行数为 0。虽然有 CRUD 与 `getEventPoolEntries()`，但聊天上下文 `getActivatedEntries()` 只处理 `worldbook_entries`。
- `characterFilter/filterMode` 字段存在，但 `getActivatedEntries()` 中没有使用。
- 书级 `scanDepth` 被取最大值用于扫描，条目级 `scanDepth` 字段没有被逐条使用。
- `sticky/cooldown/delay` 字段存在，但运行时没有效果。
- `depth` 字段存在，但没有插入历史消息中间的逻辑。

#### [11] 端到端测试

复核判断：原结论成立。

补充修正：

- `rg --files -g "*.test.*" -g "*.spec.*" -g "!**/node_modules/**"` 未发现项目测试文件。
- 本次额外执行 TypeScript 静态检查：client `npm exec tsc` 通过；server `npm exec tsc -- --noEmit` 通过。
- 静态检查通过不等于功能测试通过；没有单元、集成、端到端测试覆盖。

#### [12] 日志与可观测性

复核判断：原“部分实现”判断成立。

补充修正：

- AI 日志只保存在进程内存，最近 30 条，重启即丢失。
- 流式调用只有在路由层结束后调用 `logStreamCompletion()` 才写完整日志；如果流式中途异常，路由只向 SSE 写 error 并结束，没有记录这次 stream error 到 `aiCallLog`。
- 不记录世界书激活明细、pending injections 消费明细、变量解析结果、事件候选/触发链路，这一点成立。

#### [13] 各前端页面状态

复核判断：原描述方向成立，但覆盖不完整，且部分页面状态需要补充。

补充修正：

- 聊天：当前启用的是 `client/src/apps/chat/*`；旧 `client/src/apps/ChatApp.tsx` 是未被主入口使用的遗留大文件。
- 大富翁：当前启用 `client/src/apps/dafu/*` 与 `/api/dafu/game*` 路由。`client/src/services/dafu.ts` 仍保留旧接口封装（如 `/api/dafu/reset`、`/api/dafu/roll`），当前未被引用。后端 `server/routes/dafu.ts` 里 `end-turn` 的胜者判定有 TODO，占位返回 `winner: null`；真正归档胜者在 `/game/end` 中按分数计算。
- 主屏小组件存在占位：`CalendarWidget.tsx` 注释说明目前只是占位；`ClockWidget.tsx` 注释写真实时间/天气仍是 TODO。
- 联系人页面中世界书绑定区域存在“占位”注释。
- 日历、梦境、随想、世界书、元系统页面均有实际 API 调用，但本次没有启动浏览器逐页交互验证，不能声明“完整跑通”。

### 对原实证素材的复核

原实证素材不足，原因如下：

1. 启动命令与运行日志：原文提供的是预期启动方式和预期日志，不是本次真实启动日志；未满足“从空状态启动应用到看到角色第一句回复”的要求。
2. 数据库结构原样输出：原文只列出全部表名和两张表的 schema，不是 `.schema` 完整输出；遗漏 `sqlite_sequence`，也遗漏大多数表的列与索引。
3. 一次真实对话完整原始 prompt：原文明确“无法提供”。这是真实说明，但不满足自检指令的实证要求。

本次复核同样未启动服务、未发起真实对话，因此没有补造 prompt。当前能确认的是：`GET /api/debug/ai-log` 存在，能返回进程内最近 AI 调用的 `inputMessages`；但只有服务运行且真实发生过 AI 调用时才有数据。

### 当前项目现状补充判断

- 当前工作区存在多处未提交/未跟踪变更，包括本自检文档、数据库 WAL/SHM 状态、schema、routes、services 等。复核没有回滚或覆盖这些变更。
- 当前数据库文件存在并可读，表结构与代码匹配度高，已发现的差异已在上文列出。
- client/server TypeScript 静态检查通过。
- 没有自动化测试，功能正确性仍依赖手动运行。
- 自检结果可作为“方向性盘点”使用，但不应作为“完整事实清单”直接归档；建议以后若要严格满足 `CC克自检指令_v1.md`，需要重新产出包含完整 `.schema`、真实启动日志、真实 prompt 的版本。

### Codex 真实链路试跑记录 · 2026-05-01 00:47-00:48 Asia/Shanghai

本次在用户确认可请求一次 API、可写入当前测试数据库后执行。执行后端启动、保存用户消息、触发 AI 回复、读取 debug 日志，并停止本次启动的后端进程。

执行结果：

- 后端本地接口可访问：`GET http://localhost:3000/api/characters` 返回 4 个角色。
- 跑前 `messages` 行数：8。
- 已清空内存 AI 调用日志：`DELETE /api/debug/ai-log` 返回 `{ ok: true }`。
- 写入测试用户消息成功：
  - message id: `msg_1777567670323_ct16`
  - characterId: `char_legacy_ally`
  - mode: `online`
  - content: `Codex self-check test: please reply with one short sentence.`
- 触发 AI 回复失败：`POST /api/chat/respond` 返回 `402 Insufficient Balance`。
- 跑后 `messages` 行数：9。只新增了用户消息，未新增 AI 消息。
- `/api/debug/ai-log?limit=5` 返回 1 条日志，包含本次失败请求的完整 `inputMessages`，`output: null`，`error: "402 Insufficient Balance"`。
- 本次启动的本地后端进程已停止。

本次试跑得到的完整原始 prompt 如下：

```json
[
  {
    "role": "system",
    "content": "你是艾莉 (Ally)。\n性格活泼，喜欢吐槽\n\n【消息时间标记说明】对话中会穿插 role=user 的独立 <meta timestamp=\"...\"/> 消息，这是系统注入的时间元数据，表示其后消息的发送时间。你应利用这些时间信息感知对话时间线，但不要在回复中输出或引用 <meta> 标签本身。"
  },
  {
    "role": "system",
    "content": "你的虚拟助手，性格活泼，喜欢吐槽。"
  },
  {
    "role": "system",
    "content": "角色注意到了你的存在，好奇地打量着你。一种微妙的感觉在空气中弥漫开来..."
  },
  {
    "role": "system",
    "content": "【近期梦境】\n2026-03-20《雨天的窗台》：雨声很大，我趴在窗台上看外面的街道。街上有个人撑着伞站着不动，我知道那是你，但我没有下去。窗玻璃冷冰冰的，呼出的气把它蒙上一层白雾。那把伞的颜色是暗红色，和血不一样，比较像枯叶的红。\n\n2026-03-21《考试前的迷宫》：我站在一个巨大的白色走廊里，走廊向两侧无限延伸，找不到尽头。手里攥着一张考卷，纸是湿的，墨迹开始晕染。周围突然涌来很多人，他们的脸模糊不清，却都在往前走，把我挤到角落。我想喊什么，喉咙里却什么声音都发不出来……然后灯突然全灭了。\n\n2026-03-22《镜子里不是我》：镜子里站着一个人，穿着我的衣服，用我的脸，但我知道那不是我。她在笑，我没有在笑。我试图离开，脚却粘在地板上动不了。镜子里的她慢慢举起手，朝我按下来……我就醒了。"
  },
  {
    "role": "system",
    "content": "【当前变量状态】\n情绪底色：sanity(理智) 50 | stability(稳定) 30 | intensity(强度) 20\naffection(好感度)：50（朋友）\nmood(心情)：50（平静）\nenergy(精力)：80（充沛）\nstress(压力)：20（放松）\ntrust(信任)：40（中立）\n区域(区域)：50\n\n【情绪底色轴说明】三轴范围均为 -100~100：\nsanity（理智）：负值=理性崩溃混乱，正值=冷静清醒\nstability（稳定）：负值=情绪剧烈波动，正值=情绪稳定平静\nintensity（强度）：负值=麻木压抑低迷，正值=情绪强烈激越\n\n【变量更新】每轮回复末尾必须附加此块，只写本轮有变化的项，不变的自动继承：\n<var>\nvariableName: 原值→新值\n情绪: 情绪词 X% | 情绪词 Y%（百分比之和=100，选2~5个主要情绪）\n</var>"
  },
  {
    "role": "system",
    "content": "【近期互动摘要（从旧到新）】\n\n\n\n\n"
  },
  {
    "role": "user",
    "content": "<meta timestamp=\"2026-05-01 00:47\"/>"
  },
  {
    "role": "user",
    "content": "Codex self-check test: please reply with one short sentence."
  }
]
```

本次试跑不能证明“AI 回复后的变量解析、AI 消息入库、事件 chat_end 触发、注入轮次消费”链路，因为模型服务商在生成前返回了 `402 Insufficient Balance`。本次能证明的范围是：服务启动、数据库读取、用户消息写入、prompt 组装、AI provider 调用、失败日志记录。
