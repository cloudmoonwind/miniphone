# ICS 近期开发计划 v1

**日期**：2026-05-01
**起草**：CC 克
**承接**：[ICS_核心系统_设计共识_v1.md](ICS_核心系统_设计共识_v1.md) 第四部分（4.3-4.6）与第六点五部分
**用途**：把共识文档里"待开发的核心方向"落到具体的阶段、文件、验收标准

---

## 一、设计原则（贯穿全程）

1. **不迁就现有代码命名**。`promptStore` 占用了"preset"这个词，不是命名空间设计要避开它的理由——是 promptStore 后续应改名（建议 `apiProfileStore`，不在本计划范围）。同理，现有 `{{v:...}}` 短名要让位于更清晰的 `{{val:...}}`，**不留兼容期**。
2. **不留兼容包袱**。当前数据库里没有真实用户数据，全是测试编的——所有需要"兼容旧格式/旧命名"的代码一律不写，要改就一刀切。
3. **"准抽出"优先于"真抽出"**。Trigger/Effect 当前唯一消费者是事件系统，立刻抽离独立模块只会把事件系统拆开再装回去。先把 switch 改注册表，接口不变、结构能拆，等到第二个消费者出现时再正式分层。
4. **每个阶段必须有"反阳奉阴违"工具**。共识文档强调过的"变量目录页"扩展为"系统能力清单页"——一个页面下可以查命名空间、变量、trigger 类型、effect 类型、当前激活规则。任何"我已接入 X"声明都能秒验。

---

## 二、命名空间最终方案（冻结）

不迁就现有命名。下表是新写代码、新写文档、新写预设条目时的唯一标准。已存在的 `{{v:...}}` 在阶段一直接改为 `{{val:...}}`，无兼容期。

| 命名空间 | 子系统 | 示例 | 备注 |
|---------|--------|------|------|
| `char:` | 角色系统 | `{{char:name}}` `{{char:core}}` `{{char:persona}}` | |
| `user:` | 用户/马甲系统 | `{{user:name}}` `{{user:persona}}` | 当前激活马甲 |
| `val:` | 数值系统 | `{{val:affection}}` `{{val:affection:stage}}` `{{val:affection:desc}}` | 替代 `{{v:...}}`，不留兼容 |
| `world:` | 世界状态 | `{{world:time}}` `{{world:weather}}` `{{world:location}}` | 来自 world_state 表 |
| `mode:` | 对话场景预设 | `{{mode:name}}` | 见阶段三 |
| `wb:` | 世界书 | `{{wb:active}}` | 行业惯例两字母 |
| `mem:` | 记忆系统（未来） | `{{mem:retrieved}}` | 阶段六之后启用 |
| `evt:` | 事件系统（可选） | `{{evt:active_injections}}` | |
| `preset:` | 预设包参数化（4.6） | `{{preset:yandere_intensity}}` | 与 promptStore 命名相撞，promptStore 应改名，本命名空间不让 |
| `time:` | 时间工具 | `{{time:now}}` `{{time:weekday}}` | |
| `util:` | 工具函数 | `{{util:random:a,b,c}}` `{{util:roll:1d6}}` | |

**强制约定**：
- 必须带命名空间，禁止裸名 `{{user}}`
- 三段式语法：`{{namespace:identifier:modifier}}`
- 只读不写，不允许有副作用的占位符

**说明**：当前能落地的只有 `char` / `user` / `val` / `world` / `wb` / `time` 六个；其他为后续阶段占位。表是开放的，子系统启动时自己注册。如果未来功能改动需要新命名空间或调整现有划分，全文替换即可（没有真实用户数据要兼容）。

---

## 三、阶段划分

```
阶段 1  变量管道底座 + 占位符全链路审计 + 能力清单页   ← 主战场
阶段 2  AI 输出协议（统一 XML 块格式）                ← 与阶段 1 并行可
阶段 3  ConversationMode 条目式实现                   ← 修现存 bug
阶段 4  Trigger/Effect 准抽出                        ← 注册表化
阶段 5  预设参数化(preset:)                           ← 接入变量管道
阶段 6  后续：真正抽离 Trigger/Effect → 记忆系统启动   ← 长期
```

**前置已完成**：事实清单见 [CC克自检结果.md](CC克自检结果.md)；上下文组装可跑通；终端日志已重做。变量系统、事件系统的代码已存在但未验收——阶段 1 起重构。

---

## 阶段 1：变量管道底座 + 占位符全链路审计 + 能力清单页

**目标**：所有"作者可写文本"经过同一个解析器；命名空间通过注册机制管理；目录页可查询任意命名空间的当前求值。

### 1.1 通用解析器入口

新建 `server/services/placeholders.ts`：

```ts
type Resolver = (identifier: string, modifier: string | null, ctx: ResolveContext) => string;
type ResolveContext = { characterId: string; personaId?: string | null; messageId?: string };

registerNamespace(name: string, resolver: Resolver): void;
resolvePlaceholders(template: string, ctx: ResolveContext): string;
listRegistered(): Array<{ namespace: string; identifiers: string[] }>;
```

设计要点：
- 单次正则扫描 `{{(\w+):(\w+)(?::(\w+))?}}`
- 未注册命名空间 → 输出 `[未知命名空间:xxx]` + trace 警告
- 未知字段 → 输出 `[未知字段:xxx]` + trace 警告
- 解析过程通过 traceDetail 记录每个占位符的命名空间/标识符/求值结果/状态

### 1.2 子系统注册

每个子系统在启动时（[server/index.ts](server/index.ts) 启动钩子）注册自己：

| 命名空间 | 注册位置 | 数据来源 |
|---------|---------|---------|
| `char:` | charSystem.ts | characterStore |
| `user:` | personas 模块 | personaStore（活跃马甲） |
| `val:` | values.ts | character_values + value_stages |
| `world:` | （新建 worldState.ts） | world_state 表 |
| `wb:` | worldbook.ts | 已激活条目 |
| `time:` | （内置 placeholders.ts） | Date.now() |
| `util:` | （内置 placeholders.ts） | 纯函数 |

`mode:` / `evt:` / `mem:` / `preset:` 在各自阶段实施时再注册。

### 1.3 v: → val: 一刀切

- [values.ts:286-324](server/services/values.ts#L286-L324) 的 `resolveValuePlaceholders` 删除，改为对外暴露 `valResolver(identifier, modifier, ctx)` 给 placeholders.ts 注册
- 数据库内已存的预设条目、worldbook content 里的 `{{v:...}}` 全部直接重写或推倒重建——没有真实用户数据，不需要迁移脚本
- 新协议落地后，`{{v:...}}` 直接报"未知命名空间"，不做兼容

### 1.4 占位符全链路审计

[context.ts](server/services/context.ts) 当前只在 4 个槽位调用解析（char-core / char-desc / wb-pre / wb-post）。审计并补全所有作者可写文本槽位：

| 槽位 | 当前是否解析 | 计划 |
|------|------------|------|
| sys-pre / sys-post / tools / scene | ❌ | ✅ 必须解析 |
| char-core / char-desc | ✅ | 保持 |
| char-sample | ❌ | ✅ 必须解析 |
| wb-pre / wb-post | ✅ | 保持 |
| user-desc | ❌ | ✅ 必须解析 |
| memories | ❌ | ✅ 必须解析（记忆 content 可能含变量） |
| life / dreams | ❌ | ✅ 必须解析 |
| summaries | ❌ | ✅ 必须解析 |
| variables | ❌（自身就是变量块） | 不解析 |
| pendingInjections.content | ❌ | ✅ 必须解析（事件注入也可能含变量） |

实施方式：在 [context.ts](server/services/context.ts) 的 `messages.push({...})` 之前**统一过一道** `resolvePlaceholders(content, ctx)`。改一处统一函数，不在每个 case 里散调。

### 1.5 能力清单页

新建前端 [client/src/apps/console/CapabilitiesPanel.tsx](client/src/apps/console/CapabilitiesPanel.tsx)（或合入现有 console），分 Tab：

- **变量目录**：按命名空间分组列出所有当前注册的标识符；每个变量显示：名字、说明、用当前角色 + 马甲实时求值的当前值、复制按钮
- **测试器**：作者输入混合文本，实时看变量替换后的输出
- **Trigger 类型库**：列出所有已注册的 trigger（阶段四后才有内容）
- **Effect 类型库**：同上

后端新增 `GET /api/capabilities`：返回 `{ namespaces, triggerTypes, effectTypes }` 的 JSON 描述。

### 1.6 验收标准

- [ ] 任意一个槽位在文本里写 `{{val:affection:stage}}` `{{char:name}}` `{{user:name}}` `{{world:time}}` 都能正确替换
- [ ] 写一个未注册的 `{{xxx:yyy}}`，输出明确的"未知命名空间"标记，且 trace 有记录
- [ ] 能力清单页打开后能看到 6 个命名空间下的所有变量及实时值
- [ ] `{{v:...}}` 旧写法直接报"未知命名空间"，不再被解析

---

## 阶段 2：AI 输出协议统一

**目标**：把 `<var>...</var>` 和 `[EVENT:id:outcome]` 收编为同一份协议，避免再加新机制时格式发散。

### 2.1 统一格式（块结构）

采用 XML 块，每个子标签内部都用行式键值。一条与多条统一处理。

```xml
<sys>
  <var>
    affection: 30→35
    sanity: 50→48
    情绪: 喜悦 60% | 紧张 40%
  </var>
  <event>
    evt_confession: success
    evt_first_meet: fail
  </event>
</sys>
```

设计要点：
- `<sys>` 顶层块包裹所有结构化输出
- 每个子标签语义独立，添加新子标签不影响旧解析器
- 子标签内统一"按换行分隔 → 按冒号分隔"
- 解析失败的子标签静默跳过 + trace 警告，不污染回复正文
- 未来扩展位：`<wb>`（自动建档世界书条目）、`<mem_draft>`（记忆草稿）等

### 2.2 实施位置

新建 `server/services/aiProtocol.ts`：

```ts
parseAIOutput(content: string): {
  cleanContent: string;
  varBlock: string | null;
  events: Array<{ id: string; outcome: string }>;
};
```

[chat.ts](server/routes/chat.ts) 的两处（流式 / 非流式）改为单点调用此函数，不再分别调 `extractVarBlock` 和 `parseOutcomeFromAIResponse`。

### 2.3 旧格式直接下线

- 顶层 `<var>...</var>`、内联 `[EVENT:id:outcome]` 解析器**直接删除**，不留兼容
- [context.ts:554-559](server/services/context.ts#L554-L559) 给 AI 的"变量更新引导文本"改为统一 `<sys>` 包裹的格式
- 提示词模板里告知 AI 输出格式的部分（grep `<var>` 与 `EVENT:` 找全）一并改为新格式

### 2.4 验收标准

- [ ] AI 输出 `<sys><var>...</var><event>...</event></sys>` 能正确解析并执行
- [ ] AI 输出旧格式被忽略，trace 记录"未识别格式"
- [ ] 流式与非流式两条路径走同一份解析逻辑

---

## 阶段 3：ConversationMode 条目式实现

**目标**：修复"切换 mode 不切 prompt"的现存 bug；不引入新表，复用现有 contextItems 架构。

### 3.1 不建表的设计

`message.mode` 字段保持现状（字符串 'online'/'offline'/可选自定义名），不做任何迁移。模式提示词模板**存在 contextItem 的 content 里**，按映射结构：

```json
{
  "online": "（聊天气泡场景，短消息为主，口语化）",
  "offline": "（长文叙事场景，每段 200-800 字）",
  "dream": "..."
}
```

### 3.2 新增系统槽

| 槽位 | blockType | 说明 |
|------|-----------|------|
| `sys-mode` | `mode` | 模式提示词条目，content 存模式→模板映射（JSON） |

[context.ts](server/services/context.ts) 的 `SLOT_DEFS` 加一行；`assembleMessages` 接收 `mode` 参数，组装到 sys-mode 槽时按 mode 取对应模板，过 `resolvePlaceholders` 后作为 system 消息插入。当前 mode 在映射里没匹配到就跳过（不报错）。

`DEFAULT_CONTEXT_ITEMS` 把 sys-mode 加在 sys-syspre 之后。作者可以拖到任意位置（决定 prompt 里的注入点）。

### 3.3 chat.ts 修复

当前 [chat.ts:198](server/routes/chat.ts#L198) 调用 `assembleMessages` 时**没把 mode 传过去**——这是现存 bug。修复：

```ts
const { messages } = await assembleMessages(
  characterId, personaId, null,
  { contextMode: aiContextMode, mode },
);
```

### 3.4 注册 `mode:` 命名空间

`{{mode:name}}` 求值为当前 mode 字符串。本阶段就这一个 identifier，未来要扩 `{{mode:style_hint}}` 之类再加。

### 3.5 前端

ChatApp 的 mode 切换按钮改为从 sys-mode 条目的 content keys 读 mode 列表（默认仍含 online/offline）。[chat.ts:90-115](server/routes/chat.ts#L90-L115) 的 `modeSummaryEnabled` 自动摘要逻辑保持不动，与本改动正交。

### 3.6 验收标准

- [ ] 切换 online/offline 时，组装出的 prompt 里能看到对应模板的内容
- [ ] sys-mode 条目里加一个 `dream` 键后，前端 mode 选择器出现"梦境"选项；选中后聊天 prompt 含对应模板
- [ ] [chat.ts:90-115](server/routes/chat.ts#L90-L115) 的 `modeSummaryEnabled` 自动摘要逻辑不被破坏

---

## 阶段 4：Trigger/Effect 准抽出

**目标**：把 [eventEngine.ts](server/services/eventEngine.ts) 内部 switch 结构改为注册表，接口不变，为下一个消费者出现时的真正抽离做准备。

### 4.1 改造点

**effect 注册表**（替换 [eventEngine.ts:492-638](server/services/eventEngine.ts#L492-L638) 的 switch）：

```ts
type EffectHandler = (charId: string, eventId: string, effect: any, snapshot: Snapshot, traceParentId?: string | null) => void;

const effectRegistry: Map<string, EffectHandler> = new Map();
registerEffect(type: string, handler: EffectHandler): void;

// 启动时注册所有内置 effect：注入 / 改数值 / 记录结果 / 触发事件 / 解锁事件 / 锁定事件 / 改位置 / 记录历史
```

**trigger 总线**（替换 [chat.ts:275-287](server/routes/chat.ts#L275-L287) 的散调）：

```ts
// server/services/triggerBus.ts
type TriggerListener = (ctx: TriggerContext) => void;

registerTriggerListener(listener: TriggerListener): void;
dispatchTrigger(ctx: TriggerContext): void;
```

eventEngine 启动时把自己注册成监听器；chat.ts 改成单点调用 `dispatchTrigger({ trigger: 'value_change', ... })`。

### 4.2 不做的事（边界）

- 不抽出独立的"基础设施层"模块——effect 注册表暂时仍住在 eventEngine 内
- 不改外部 API——events.effects JSON 字段格式保持
- 不改条件订阅表 `condition_subscriptions` 的结构

### 4.3 价值

- 添加新 effect 类型时不再需要改 switch
- 第二个 trigger 消费者出现时（如 ConversationMode 的"模式切换"effect、后处理规则系统），可直接 `registerTriggerListener` 接入
- 能力清单页可以从注册表导出"当前支持的 effect/trigger 类型库"

### 4.4 验收标准

- [ ] 现有事件触发链路不变（回归测试通过）
- [ ] 能力清单页能查到当前注册的所有 trigger 类型 + effect 类型
- [ ] 在 server 任意位置 `registerEffect('test_effect', handler)` 后，作者在事件 effects JSON 里写 `{ type: 'test_effect' }` 能跑通

---

## 阶段 5：预设参数化（preset:）

**目标**：替代 ST 的 `{{setvar}}/{{getvar}}` 模式，把"预设作者声明可调参数 + 用户填值"从提示词副作用升级为声明式机制。

### 5.1 数据表

```sql
preset_param_decls
  id, package_id, name, display_name, type, default_value, range_or_options, description, sort_order

preset_param_values
  package_id, param_name, value
```

`package_id` 指 promptStore 里的预设包 id（这里用 promptStore 的现有 id，与"preset 命名空间"无关）。

**作用域**：参数值绑定到预设包，多预设各自有自己的命名空间。切换激活预设包时，`{{preset:...}}` 求值跟着切换。

### 5.2 接入变量管道

注册 `preset:` 命名空间，`{{preset:yandere_intensity}}` 求值时：
- 找到当前激活的预设包
- 从 `preset_param_values` 读取（缺失则取 `preset_param_decls.default_value`）

### 5.3 前端

- 预设包编辑器增加"参数声明区"
- 启用预设时弹出"预设参数面板"
- 类型校验、说明提示、默认值

### 5.4 验收标准

- [ ] 预设作者声明 `yandere_intensity` 参数（数字 0-100，默认 50）
- [ ] 预设条目里写 `{{preset:yandere_intensity}}` 能正确替换
- [ ] 用户在面板把值改成 80，整个会话生效
- [ ] 切换到另一个预设包后，`{{preset:...}}` 不会读到上一个包的参数

---

## 阶段 6：后续

不在本计划详细排期，但要给后面留好接口：

- **Trigger/Effect 真正抽离**：阶段四的注册表已经准备好，等到第二个消费者出现自然推进
- **后处理规则系统**：作者侧 UI 能定义"AI 输出匹配 X 时执行 Y"，这是阶段四注册表的第一个外部消费者
- **记忆系统启动**：依赖数值系统（情绪强度）和事件系统（巩固/激活）稳定，前面五阶段完成后再启动
- **promptStore 改名**：`apiProfileStore` 或 `aiPresetStore`，为 `preset:` 命名空间彻底让出名字空间

---

## 四、阶段间的并行性

```
阶段 1（占位符全链路） ─┐
                       ├─→ 阶段 3（ConversationMode）─┐
阶段 2（协议统一）    ─┘                              ├─→ 阶段 5（preset:）
                          阶段 4（注册表化）         ─┘
                                                       ↓
                                                     阶段 6
```

阶段 1 与阶段 2 互不依赖可并行。阶段 3 依赖阶段 1（要注册 mode: 命名空间）。阶段 5 依赖阶段 1 + 阶段 4。

---

## 五、验收原则

每个阶段必须：
1. 有具体可点击/可复现的验收清单（不接受"代码已写完"）
2. 能力清单页能反映新增的命名空间/trigger/effect
3. trace 系统能看到关键决策路径
4. 旧测试不退化（如已有事件触发链路）

---

*命名空间表已冻结。先做阶段 1，从通用解析器入口起。*
