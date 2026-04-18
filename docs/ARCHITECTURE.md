# ICS 架构决策记录

> 最后更新：2026-04-18  
> 说明：记录关键架构决策及其设计理由，供后续迭代参考。

---

## 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 前端框架 | React 18 + Vite + TypeScript | 生态成熟，组件模型契合多 App 并列的手机 UI |
| 状态管理 | React Context（AppContext） | 全局状态量少（activeChar / activePreset / wallpaper / navigate），无需 Zustand；组件内状态用 useState/useReducer |
| 后端框架 | Express（ESM）+ TypeScript | 轻量，全项目统一 ESM，避免 CJS/ESM 混用问题 |
| 数据库 | SQLite (WAL) | 单机部署，零配置，WAL 模式下并发读性能足够 |
| ORM | Drizzle ORM + drizzle-kit | 类型安全，migration 文件可审查，schema 是唯一真相来源 |
| AI 通信 | OpenAI 兼容 SDK | 兼容所有主流 provider（OpenAI / Anthropic / Z.AI / Ollama）无需多套 SDK |

---

## 存储双轨：列式表 vs Blob 表

ICS 同时存在两种存储形式：

**列式表（Drizzle 管理）**  
用于需要精确查询、跨行聚合、或未来做外键约束的数据：
- sessions, character_values, value_rules, event_books, events, event_injections, event_cooldowns, worldstate, charstats, personas, diary_entries, items, timeline_events, character_skills, character_relations

**Blob 表（SqliteStore 管理）**  
格式 `id, char_id, data TEXT`，存 JSON，用于结构频繁变更、无需 SQL 查询的数据：
- memories, summaries, dreams, maps, calendar, settings, worldbook, prompts 等

**决策理由**：系统核心逻辑（事件触发、数值计算）依赖列式查询；其余内容型数据（记忆、世界书）格式自由，blob 更便于迭代。两者不混用——如果后续某个 blob 表需要 SQL 查询，走 migration 迁移为列式表。

---

## Schema 管理：drizzle-kit migrations

- `server/db/schema.ts` 是所有列式表的唯一定义来源
- 修改表结构 → `npm run db:generate` → 产出 `db/migrations/XXXX_*.sql` → 服务器启动时自动 apply
- 禁止在 `database.ts` 或路由中用 `db.exec("CREATE TABLE ...")` 手动建表
- 禁止 `try { db.exec(sql); } catch {}` 模式（静默吞异常，掩盖真实错误）
- 首次部署时 baseline migration 使用 `CREATE TABLE IF NOT EXISTS` 确保幂等

---

## 前端架构：手机 UI 多 App 模型

```
client/src/
├── apps/           # 各功能 App（聊天/日记/世界书/…）
├── components/     # 跨 App 共享组件（AppGrid, AppIcon, StatusBar…）
├── core/           # AppContext, eventBus, apiBase
└── services/       # 按领域的 API 调用层（chatService, characterService…）
```

- 每个 App 是独立的 React 子树，通过 AppContext 的 `navigate()` 切换
- App 间通信优先用 AppContext 共享状态；复杂事件用 `eventBus.ts` pub/sub
- 样式：纸墨风，无大厂卡片阴影，SVG 图标（无外部图标库），下划线风格输入框

---

## 后端架构：路由按领域拆分

- 每个领域一个 `routes/*.ts`，在 `index.ts` 统一挂载
- 字符级子资源挂在 `/api/characters/:charId/…`（memories / sessions / items / skills…）
- 全局资源挂在 `/api/…`（settings / worldbook / events / values…）
- 事件引擎（`services/eventEngine.ts`）是纯函数集，由路由层调用，不持有状态

---

## AI 通信模型

- **双端点设计**：`POST /api/chat/send`（保存用户消息）与 `POST /api/chat/respond`（触发 AI 回复）解耦，互不阻塞
- **流式 SSE**：`respond` 支持 `stream=true`，前端通过 EventSource 实时渲染
- **多 Provider**：`settings` 存 provider + baseUrl + apiKey + model，per-provider 的 temperatureMax 上限
- **AI 回复后处理链**（异步，不阻塞响应返回）：  
  `triggerExtraction` → `parseOutcomeFromAIResponse` → `checkAndFireEvents('chat_end')` → `tickCooldowns('turns')` → `fireValueRules('chat_end')`

---

## 事件与数值系统

**数值（character_values + value_rules）**  
- 每个角色有一组 key-value 数值（如 hunger, mood）
- value_rules 定义：触发条件（trigger）→ 运算表达式（expr）→ clamp 范围
- 触发时机：`chat_end` / `time_pass_hourly` / `time_pass_daily`

**事件（event_books + events + event_injections + event_cooldowns）**  
- event_books 是事件集合容器，events 是具体触发规则
- 触发条件基于 character_values，满足则 fire（注入上下文或修改数值）
- cooldown 系统：turns / hours / days 三种粒度，防止事件过密触发

**定时器**：`index.ts` 启动后挂 setInterval，每小时触发 `time_pass_hourly`，每 24 小时触发 `time_pass_daily`

---

## 上下文注入优先级

聊天时传给 AI 的 system prompt 按以下顺序组装：  
1. 当前预设（Prompt 条目，按 position 排序）
2. 角色卡（charStats / persona）
3. 世界书词条（worldbook，按关键词匹配）
4. 活跃事件注入（event_injections，已触发 + 冷却内）
5. 历史消息（按 historyCount 截取，带时间戳分级）
6. 摘要（summaries，超出 historyCount 的压缩层）

---

## 已知架构遗留问题

| # | 问题 | 状态 |
|---|------|------|
| 10 | `/api/dreams` 全局路由内联在 `index.ts`，未拆出独立 router | 待修 |
| 11 | `PORT = 3000` 硬编码，未走环境变量 | 待修 |
| — | `personaId` 传入聊天未实现（马甲记忆隔离的前提） | 规划中 |
