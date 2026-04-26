# 上下文组装文档（context.ts）

## 概述

`assembleMessages(charId, personaId, newUserContent, options)` 按照预设的 contextItems 顺序，
把各数据源组装成发给 AI 的 messages 数组。

---

## 槽位顺序（默认）

```
sys-syspre      系统提示_前（可编辑）
sys-tools       工具描述（可编辑）
sys-wbpre       世界书前置（system-top 位置的条目）
sys-char-core   角色核心（char.core，含时间戳说明）
sys-char-desc   角色描述（char.persona）
sys-char-sample 角色语料（char.sample）
sys-user-desc   用户马甲描述（激活的命格内容）
sys-memories    对用户的重要记忆（importance >= 7）
sys-wbpost      世界书后置（before-chat + system-bottom + after-chat）
sys-scene       场景描述（可编辑）
sys-life        近期生活（最近3条）
sys-dreams      近期梦境（最近3条）
sys-variables   ★ 变量系统状态（见下）
sys-summaries   对话摘要（最近5条）
sys-history     历史消息（展开为多条 user/assistant）
sys-syspost     系统提示_后（可编辑）
```

---

## sys-variables 槽详细说明

当前实现输出格式：
```
【当前变量状态】
情绪底色：sanity(理智) 50 | stability(稳定) 30 | intensity(强度) 20
当前情绪：温柔 45% | 期待 30% | 平静 25%   ← 来自上轮快照，可能无
affection(好感度)：65（朋友）
mood(心情)：70

【情绪底色轴说明】三轴范围均为 -100~100：
sanity（理智）：...
...

【变量更新】每轮回复末尾必须附加此块，只写本轮有变化的项：
<var>
variableName: 原值→新值
情绪: 情绪词 X% | 情绪词 Y%
</var>
```

**待补充（TODO）：** 在变量状态后附上当前范围匹配的规则文本：
```
【变量更新规则】
affection（好感度，当前65，朋友阶段，范围50-80）：
  [此处插入该范围的 ruleText]
```

---

## 占位符替换（TODO - 尚未接入）

`resolveValuePlaceholders(text, charId)` 已实现，但未在 context.ts 中调用。

**需要在以下位置接入：**

```typescript
// char-core 块
content = resolveValuePlaceholders(parts.join('\n'), charId);

// char-desc 块  
content = resolveValuePlaceholders(char.persona || '', charId);

// wb-pre / wb-post 块
// 在 wbText() 生成文本后调用
content = resolveValuePlaceholders(wbText(entries), charId);

// sys-pre / sys-post / scene 等可编辑槽
content = resolveValuePlaceholders(item.content || '', charId);
```

占位符格式：
```
{{v:affection}}          → 当前值数字
{{v:affection:stage}}    → 当前阶段名
{{v:affection:desc}}     → 当前阶段描述
{{v:affection:prompt}}   → 当前阶段提示词片段（最重要）
```

---

## 注入点（pending_injections）

事件系统触发的内容注入，按 position 分组：
- `before_char`：在 char-core 之前
- `after_char`：在 char-sample/char-desc 之后
- `before_history`：在 history 之前
- `status_section`：在 scene/life 之前（状态区）

---

## 历史消息时间戳策略

- 热区（最近3条 user + 最近3条 char）：逐条打精确时间
- 今天非热区：每2小时段打一次
- 今天之前：每个自然日打一次
- 线下消息（mode=offline）：只打日期，不打时间

---

## AI 回复解析（chat.ts 中）

AI 回复完成后：
1. `extractVarBlock()` 提取并移除 `<var>...</var>` 块
2. 干净内容存入消息表
3. `parseAndApplyVarBlock()` 解析变量变化并更新数据库
4. 将快照 `{ variableName: currentValue, emotion_state: '...' }` 写回消息记录
