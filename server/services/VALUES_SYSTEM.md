# 变量系统设计文档

## 核心概念

变量是**角色的属性**（不是用户的），描述角色当前的状态，如好感度、心情、精力。
所有变量由 AI 在每轮对话后自主决策更新，服务端负责解析和持久化。

---

## 机制一：动态提示词替换（占位符）

**用途：** 让角色设定、世界书条目随变量值动态变化，实现"角色在不同状态下行为不同"。

**用法：** 在角色设定（char.core / char.persona）或世界书条目里写占位符：

```
{{val:affection}}           → 替换为当前数值（如 65）
{{val:affection:stage}}     → 替换为当前阶段名（如 朋友）
{{val:affection:desc}}      → 替换为当前阶段描述（如 态度温和，愿意分享）
{{val:affection:prompt}}    → 替换为当前阶段的提示词片段（完整行为描述）
{{val:affection:name}}      → 显示名（如 好感度）
{{val:affection:min}}       → 最小值
{{val:affection:max}}       → 最大值
```

**示例：** 世界书条目写：
```
{{char:name}}对{{user:name}}的好感度处于{{val:affection:stage}}阶段。
{{val:affection:prompt}}
```
组装上下文时自动替换为当前阶段的具体文本。

**实现位置：** `valResolver` / `valList` 已挂入通用变量管道（`server/services/placeholders.ts`）。
组装时由 `context.ts` 统一对所有作者可写槽位调用 `resolvePlaceholders(content, ctx)` 完成解析。
sys-variables 槽自身的指令文本不解析（含给 AI 看的格式说明）。

---

## 机制二：规则文本注入（告诉 AI 如何更新变量）

**用途：** 在每轮对话的系统提示中，附上各变量当前范围适用的规则文本，
让 AI 知道"这次对话结束后，该变量应该怎么变化"。

**规则的本质：** 自然语言文本，不是服务端执行的代码。
例如好感度在 0-20 区间的规则文本：
```
过于亲密接触减3-8，冷淡减1-2，感觉对方自由自主进退有礼加1-3
```

**设计：** 每条规则有：
- `rangeMin` / `rangeMax`（可选）：该规则在哪个值范围内生效
- `ruleText`（必填）：自然语言描述，注入给 AI 的文本
- `enabled`：是否启用

**注入时机：** 在 `sys-variables` 槽组装时，找出当前值所在范围匹配的规则，附在变量状态后面。

**目前状态：** ❌ 规则表结构错误（存的是 triggerOn/operation/amount，服务端自动执行逻辑），
需要改造为以 ruleText 为主的结构。

---

## 机制三：AI 自主更新（<sys> 协议块）

**用途：** AI 在每轮回复末尾输出变量变化（与事件结果），服务端解析后写入数据库。

**AI 输出格式（由 sys-variables 槽指令要求）：**
```
<sys>
  <var>
  affection: 65→68
  affection: 65→68 | 原因: 用户主动分享了童年回忆
  情绪: 温柔 45% | 期待 30% | 平静 25%
  </var>
  <event>
  evt_confession: success
  </event>
</sys>
```

完整协议规范见 [ICS_AI输出协议_v1.md](../../ICS_AI输出协议_v1.md)。

**解析与应用分层：**
- **解析层**（`server/services/aiProtocol.ts`）：`parseAIOutput(content)` 把字符串拆为 `{ cleanContent, varUpdates, emotion, events, diagnostics }` 结构化结果
- **应用层**（`server/services/values.ts`）：`applyVarBlock(charId, varUpdates, emotion?)` 校验旧值（±1 容忍）、clamp、写库、生成 changedVariables
- **事件应用层**（`server/services/eventEngine.ts`）：`applyEventOutcomes(parsed)` 写 outcome 字段、按 branch 连接的 requiredOutcome 触发后续事件

[chat.ts](../routes/chat.ts) 流式与非流式两路均使用此链路（已接入 ✅）。

---

## 机制四：情绪底色三轴

**用途：** 三个特殊变量，范围 -100~100，描述角色的情绪底层状态。
- `sanity`（理智）：负=混乱崩溃，正=清醒冷静
- `stability`（稳定）：负=剧烈波动，正=平静稳定
- `intensity`（强度）：负=麻木压抑，正=强烈激越

**自动创建：** `seedDefaultVariables()` 在首次组装变量上下文时自动为角色创建（幂等）。

**快照存储：** AI 输出的 `情绪: 词 X% | 词 Y%` 作为字符串存入消息的 variableSnapshot.emotion_state。

---

## 待完成的工作

### 1. 占位符替换接入 context.ts
在 assembleMessages() 中，对以下内容块调用 resolveValuePlaceholders(text, charId)：
- `char-core`（char.core）
- `char-desc`（char.persona）
- `wb-pre`、`wb-post`（世界书条目 content）
- 其他可编辑槽（sys-pre、sys-post、scene）

### 2. 规则表改造
数据库 `value_rules` 表：
- 废弃：`trigger_on`、`operation`、`amount`（这是服务端自动执行逻辑，不是给 AI 的）
- 新增：`rule_text TEXT`（自然语言，AI 看的规则描述，必填）
- 保留：`range_min`、`range_max`（决定哪个值段该规则生效）、`enabled`

### 3. sys-variables 补全规则注入
在组装 variables 块时，额外附上：
```
【变量更新规则】
affection（好感度，当前65，朋友阶段）：
  过于亲密接触减3-8，冷淡减1-2，进退有礼加1-3
```
只注入当前值所在范围匹配的规则，避免信息过载。

### 4. 废弃服务端规则执行引擎
`executeRules()` / `fireValueRules()` 是错误方向的实现，应移除或禁用。
AI 自主决策更新才是正确机制。

---

## 文件索引

| 文件 | 职责 |
|------|------|
| `server/db/schema.ts` | 数据库表定义 |
| `server/services/values.ts` | 变量 CRUD、占位符替换、<var>解析 |
| `server/services/context.ts` | 上下文组装，sys-variables 槽 |
| `server/routes/values.ts` | REST API |
| `client/src/apps/meta/` | 前端变量编辑器 |
