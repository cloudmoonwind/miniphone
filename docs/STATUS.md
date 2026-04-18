# ICS 功能状态总览

> 最后更新：2026-04-18  
> 说明：✅ 完整 · 🔧 部分/有已知问题 · ⬜ 仅规划/未实现

---

## 核心基础设施

| 层 | 实现 | 状态 |
|----|------|------|
| 数据库 | SQLite (WAL) + Drizzle ORM (列式) + SqliteStore (blob) | ✅ |
| Schema 管理 | drizzle-kit migration，`npm run db:generate` 生成，启动自动 apply | ✅ |
| 全局状态 | `core/AppContext.tsx`：activeChar/activePreset/wallpaper/recentChat/navigate | ✅ |
| 跨 App 通信 | `core/eventBus.ts` 轻量 pub/sub | ✅ |
| AI 通信 | OpenAI 兼容 SDK，流式 SSE + 非流式，AbortController 中止 | ✅ |
| 多 Provider | OpenAI / Anthropic / Z.AI / Ollama 等，per-provider temperatureMax | ✅ |

---

## 聊天系统

**前端**：`apps/chat/`（6 文件）  
`ChatApp.tsx`（入口）→ `ChatMain.tsx`（布局）→ `useChatState.ts`（状态+逻辑）→ `MessageBubble.tsx` / `ChatCalendar.tsx` / `chatFormatters.ts`

**后端**：`routes/chat.ts`  
- `POST /api/chat/send`：仅存用户消息  
- `POST /api/chat/respond`：触发 AI 回复（支持 stream 参数走 SSE）  
- `GET /api/characters/:charId/messages`  

**逻辑要点**：
- Send（→）和 Bot（🤖）两个独立端点，解耦保存与生成
- 5 分钟内同 sender + 同 mode 自动合并消息（MSG_SEP 分隔，前端按分隔符渲染为一组）
- 时间戳分级注入上下文：今天之前每自然日一次，超 1 小时每 2 小时，最近热区（最近 user/char 各 3 层）逐条
- 线下模式时间只精确到小时（`14:xx`），保护叙事氛围
- AI 回复后异步触发（不阻塞响应）：`triggerExtraction` → `parseOutcomeFromAIResponse` → `checkAndFireEvents('chat_end')` → `tickCooldowns('turns')` → `fireValueRules('chat_end')`

**集成状态**：✅ 与事件引擎、数值系统、摘要系统、角色系统全部接通

**已知问题**：personaId 传入聊天尚未实现（马甲记忆隔离的前提条件）

---

## 上下文系统（FilesApp）

**前端**：`apps/FilesApp.tsx`  
- 上下文预设 CRUD，条目有：role / position / maxTokens / historyCount
- 拖拽排序，实时保存后端

**后端**：`routes/prompts.ts`  
- `/api/prompt/presets` / `entries` / `active`

**逻辑**：
- `context.ts` 读取激活预设，按 position 顺序组装 messages[]
- maxTokens 截断已实现（中英混合粗估 `length / 3`）
- pending_injections 注入到对应位置：before_char / after_char / status_section / before_history / depth

**集成状态**：🔧 token 统计动态槽（char/worldbook/history）当前显示 0，待实现

---

## 摘要系统

**前端**：集成在 ChatApp（顶栏日历图标→按日期查找 / 📄按钮→当天摘要 / 设置面板→自动摘要开关）

**后端**：`routes/summaries.ts`  
- `GET /by-date?date=` / `POST /generate-daily` / `GET|PUT /settings`
- AI 回复后异步触发 `triggerAutoSummaries`
- 生成后调 `evaluateSummaryForTimeline`：importance ≥ 6 自动写入时间线

**逻辑**：三种总结模式：segment（段落）/ daily（日）/ mode（切换模式）/ periodic（定期）；提示词可在 SettingsApp 「总结提示词」Tab 自定义

**集成状态**：🔧 历史曾失效，当前状态需通过 AI Console 日志验证

---

## 角色系统

### CharSystemApp

**前端**：`apps/CharSystemApp.tsx`（单文件，6 Tab）

| Tab | 内容 |
|-----|------|
| 状态 | 36 色心情调色盘（最多 3 色叠加）+ 地点/衣着/状态描述/心声 |
| 时间线 | 彩色节点竖向故事线，可折叠展开 |
| 物品 | 网格式物品库（emoji + 名称），点开看详情 |
| 关系 | SVG 关系网络图 + 点击详情 |
| 手机 | 入口 → CharPhoneApp |
| 技能 | 三类技能树，5 星等级 + 经验进度条 |

**后端引擎**：`services/charSystem.ts`（四条数据管道）
1. 摘要 → 时间线（`evaluateSummaryForTimeline`）
2. 数值 → 事件检查（`checkStatThresholds`）
3. 生活 → 时间线/物品/技能（`processLifeLog`）
4. 聊天后提取（`triggerExtraction`）：取最近 6 条 → AI 提取状态/物品/关系/技能/事件

**数据存储**：char_stats / items / timeline / skills / relations（均为 blob 表）

**集成状态**：✅ 四条管道实现；extraction 默认 disabled，需在设置中手动开启

### CharPhoneApp

**前端**：`apps/CharPhoneApp.tsx`  
- 独立全屏模拟手机 UI：主屏图标网格 → 消息页（角色消息右）/ 朋友圈页
- 长按壁纸区 700ms 返回

**集成状态**：🔧 朋友圈当前读 lifeStore 展示，非真实社交动态生成

---

## 记忆系统

**前端**：`apps/MemoryApp.tsx`（4 Tab）  
- 自动管理 / 手动清理 / 归档 / 角色记忆（接后端）

**后端**：`routes/memories.ts`  
- `/api/characters/:charId/memories` CRUD

**逻辑**：importance ≥ 7 的记忆注入 AI 上下文；自动提取由 extraction.ts 实现

**集成状态**：🔧 自动提取逻辑存在但需手动开启，提取质量未充分测试

---

## 梦境系统

**前端**：`apps/dream/`（8 文件）

| 文件 | 职责 |
|------|------|
| `DreamApp.tsx` | 主入口，模式切换 |
| `useDreams.ts` | 数据 Hook（CRUD + AI 生成） |
| `dreamUtils.tsx` | 常量/工具/AnimeStar SVG |
| `DreamSky.tsx` | PixiJS v8 夜空渲染层 |
| `DreamStars.tsx` | 渲染所有未解读星星 |
| `AnimeStar.tsx` | 单颗星星状态机（8 个 phase） |
| `DreamCard.tsx` | 星星展开的梦境卡片弹窗 |
| `DreamModal.tsx` | 详情模态 |
| `DreamAddModal.tsx` | 手动添加梦境 |

**后端**：`routes/dreams.ts`  
- `/api/characters/:charId/dreams` CRUD
- `GET /api/dreams`（全局聚合，最近 100 条）

**逻辑**：四种梦境类型（情绪/预示/回忆/欲望）；PixiJS v8 夜空：背景星、bloom、流星、水面 RenderTexture 倒影

**集成状态**：🔧 PixiJS 渲染架构已搭，视觉需素材方向确定后打磨；功能层 CRUD 完整

**已知问题**（PixiJS 踩坑，已修）：skyRT 反馈循环、每帧重复 BlurFilter 打爆 watchdog、StrictMode destroy 崩溃、removeChild 父子错误。详见 DEVLOG.md。

---

## 数值系统

**前端**：`apps/daoshu/ValueEditor.tsx`（via `DaoshuApp.tsx` 元系统 - 数值 Tab）  
- 左侧变量列表（彩色圆点 + minimap 范围条）  
- 右侧 RangeBar：阶段按 rangeMin/rangeMax 渲染彩色分段，白色竖线标当前值  
- 弹层模态：新建/编辑变量和阶段

**后端**：`routes/values.ts`  
- `/api/values` / `/api/values/:charId/list`  
- `/item/:id/adjust` → 调整后触发事件引擎 `checkAndFireEvents('value_change')`

**数据存储**：`character_values` / `value_stages` / `value_rules`（Drizzle 列式表）

**逻辑**：
- 变量：variableName（英文标识）+ 分类（attribute/status/emotion/relation/social）+ min/max/初始值
- 阶段（value_stages）：range + stageName + description + promptSnippet → promptSnippet 自动注入 AI 上下文
- 规则（value_rules）：triggerOn + operation(add/set/multiply) + amount + 生效范围
- 提示词占位符：`{{v:varname}}` / `{{v:varname:stage}}` / `{{v:varname:desc}}` / `{{v:varname:prompt}}`

**集成状态**：✅ 数值调整接入事件引擎；promptSnippet 通过 context.ts 注入

---

## 事件系统

**前端**：`apps/daoshu/EventEditor.tsx`（via 元系统 - 规则系统 Tab）+ `apps/worldbook/EventBooksTab.tsx`  
- EventEditor：BookSelector 水平 Tab + 事件列表 + 事件书/事件 CRUD  
- EventBooksTab：事件书相关编辑（知识库 App 内）

**后端**：`routes/events.ts` + `services/eventEngine.ts`  
- `/api/event-books` / `/api/events` / `/api/injections`

**数据存储**：event_books / events / event_tags / event_connections / condition_subscriptions / pending_injections（Drizzle 列式表）

**引擎逻辑**（`eventEngine.ts`，~380 行）：
```
buildSnapshot → checkUnlockConditions → findCandidates → canFire → fireEvent
```
- 条件类型：value / event / time / date / weather / location / keyword / random
- 效果：注入（→ pending_injections）/ 改数值 / 设标记 / 触发事件 / 解锁-锁定事件 / 改位置
- 冷却：cooldownType(time/turns/none) + conditionCooldown（条件满足 N 次才触发）
- 触发点：chat_end / value_change / time_pass_life / time_pass_hourly(setInterval 1h) / time_pass_daily(setInterval 24h)
- outcome 解析：正则匹配 `[EVENT:id:result]`，供 branch 连接使用

**集成状态**：✅ 引擎完整；receive_gift 触发点暂未接入

---

## 世界书 / 知识库

**前端**：`apps/worldbook/`（7 文件）  
- `index.tsx`（入口）/ `WorldbookTab.tsx`（书列表 + 条目详情）/ `EventBooksTab.tsx` / `EntryCard.tsx` / `api.ts` / `constants.ts` / `ui.tsx`（视觉装饰：SpineStrip / PageStack / InnerShadow / EntryDivider 等）
- 纸墨书卷风格：左书脊 + 右页边 + 内阴影，条目间暖棕虚线 + 菱形分隔
- 条目：左滑操作（触控 + 鼠标拖拽）/ 行内可编辑 / 策略圆点（点击切换 constant/keyword）/ 下拉框 fixed 定位（绕过 stacking context）

**后端**：`routes/worldbook.ts`  
- `/api/worldbook/books` / `entries` / `event-entries` CRUD

**数据存储**：worldbooks / worldbook_entries / worldbook_event_entries（Drizzle 列式表）

**逻辑**：
- 策略：constant（始终激活）/ keyword（扫描最近 N 条对话）
- 级联激活：多轮扫描直到无新条目激活，noRecurse / noFurtherRecurse 防无限递归
- 插入位置：system-top / system-bottom / before-chat / after-chat / depth（指定历史深度）

**集成状态**：✅ 与上下文系统接通；🔧 事件书样式仍用白色背景，与知识库纸墨风格不统一

---

## 世界状态

**前端**：`apps/daoshu/WorldStateEditor.tsx`（元系统 - 世界状态 Tab）  
**后端**：`routes/worldstate.ts`  
**数据存储**：world_state 键值对表（Drizzle）  
**集成状态**：✅ 读写正常，作为事件条件使用（weather/location/time_period 等）

---

## 设置

**前端**：`apps/SettingsApp.tsx`（3 Tab）
- API 预设管理（CRUD + 测试连接）
- 功能分配：聊天 / 角色系统 / 生活 / 大富翁 各自指定预设
- 总结提示词编辑（4 种类型，onBlur 自动保存，可恢复默认）

**后端**：`routes/settings.ts`  
**集成状态**：✅

---

## 马甲 / 命格

**前端**：`apps/MinggeApp.tsx`  
- 卡片网格，颜色 + emoji 选择，长按编辑/删除，激活高亮  
- 用户本体（UserBaseCard）：可编辑名字/头像 emoji/简介

**后端**：`routes/personas.ts`  
- `/api/personas` CRUD + `GET|PUT /api/personas/user-profile`

**集成状态**：🔧 personaId 传入聊天未实现，马甲记忆隔离功能尚未落地

---

## 日历

**前端**：`apps/CalendarApp.tsx`  
- 月历视图，彩色圆点（最多 3 个），三类事件（事件/待办/提醒），编辑弹窗

**后端**：`routes/calendar.ts`  
- `GET /api/calendar?month=YYYY-MM` / POST / PUT / DELETE

**集成状态**：✅ 独立完整；⬜ CalendarWidget 首页占位，与日历数据未联通

---

## 日记

**前端**：`apps/DiaryApp.tsx`  
- 月历视图 + 全屏写作 + 心情 emoji + 字数统计

**后端**：`routes/diary.ts`（支持 `?month=` 过滤）  
**集成状态**：✅

---

## 随想

**前端**：`apps/SuixiangApp.tsx`  
- 瀑布流双列卡片，10 色色盘，卡片详情时间线
- 条目样式：分割线 + 右对齐署名，卡片背景点阵纹理
- inline 编辑，右键底部菜单（置顶/删除）

**后端**：`routes/suixiang.ts`（CardStore + EntryStore）  
**集成状态**：✅

---

## 结缘（角色管理）

**前端**：`apps/ContactsApp.tsx`  
- 三视图：列表 / 详情 / 表单（`key` 切换避免 reconcile 白屏）
- CharRow 点击区域分离：左侧→详情，右侧新增消息按钮→直开聊天

**后端**：`routes/characters.ts`  
**集成状态**：✅

---

## NPC 管理

**前端**：`apps/NPCApp.tsx`  
- 角色选择器 + 关系列表（卡片式，按类型颜色）
- 详情底部抽屉：emoji / 名称 / 类型（6 种）/ 亲密度滑块 / 备注

**后端**：`/api/characters/:charId/relations` CRUD  
**集成状态**：✅；🔧 CharSystemApp 的关系 SVG 与 NPCApp 数据未双向联通

---

## 地图

**前端**：`apps/MapApp.tsx`  
**后端**：`routes/maps.ts`  
**集成状态**：✅ 数据从后端加载（首次无地图自动创建"主世界"），已弃用 localStorage

---

## 物品库

**前端**：`apps/ItemsApp.tsx`（背包式网格 + 详情卡）  
**后端**：`/api/characters/:charId/items` CRUD  
**集成状态**：✅；🔧 `linkedTimelineIds` 字段预留但 UI 未实现物品↔时间线联动

---

## 大富翁

**前端**：`apps/dafu/`（10 文件）  
- `DafuApp.tsx` / `HallView.tsx` / `GameView.tsx` / `SetupView.tsx` / `InviteView.tsx` / `RecordView.tsx`
- components：`Board.tsx` / `DiceFloat.tsx` / `DramaPanel.tsx` / `CharBubble.tsx` / `InfoBar.tsx` / `StrategyQuiz.tsx` / `TruthSpinner.tsx` / `ConfessionGame.tsx`

**后端**：`routes/dafu.ts`  
- 游戏 CRUD + `/roll` + `/buy` + `/end-turn` + `/config`
- 双 AI：`callHostAI`（主持人，独立 history）+ `callCharAI`（角色，独立 history）

**逻辑**：
- 25 格图结构棋盘，格 8 分叉（内路 9-13 / 外路 14-18），格 19 汇合
- 三模式：益智 / 恋爱 / 十八禁，线上 / 线下
- 世界书烘焙：创建时 `embedWbContent` 匹配格子名→wbContent，游戏中只发当前格子内容给主持人
- 阶段状态机：roll → moving → narrative → choice/special → chat → turn_end → roll
- 主持人 AI：格子文字 + 模式风格定义，不接角色人设
- 角色 AI：人设 + 世界书激活条目 + 生活日志 + 游戏背景

**集成状态**：🔧 核心逻辑可运行；大量 UI 待做（3D 骰子 / Q版棋子 / 告白小游戏 / 真心话转盘 / 游戏大厅立体盒子等）

---

## AI Console

**前端**：`apps/AIConsoleApp.tsx`（终端风格，grep 过滤，3s 自动刷新）  
**后端**：`routes/debug.ts`  
- `GET /api/debug/ai-log`（内存环形日志，最近 30 条）
- `DELETE /api/debug/ai-log`
- `POST /api/debug/seed/:charId`（种子数据注入）

**集成状态**：✅

---

## 时光邮局

**前端**：`apps/TimeCapsuleApp.tsx`（写给未来的信，密封/到期打开）  
**数据存储**：localStorage（纯用户私人数据）  
**集成状态**：✅ 独立完整

---

## 角色生活系统

**前端**：集成在 CharSystemApp（设置面板：事件数/时段选择/立即生成）  
**后端**：`routes/life.ts`  
- `/life/generate`：生成后 → `checkAndFireEvents('time_pass_life')` → `fireValueRules`
- `server/index.ts` 定时器：hourly/daily `setInterval` 覆盖所有有数值的角色

**逻辑**：`inferPeriod()` 时段推断 + `pickEvents()` 加权随机 + `buildLifePrompt()` 组装  
**集成状态**：✅ 与事件引擎接通

---

## 美化

**前端**：`apps/BeautifyApp.tsx`  
- 背景图设置，桌面遮罩透明度（CSS 变量 `--desktop-overlay`，localStorage）
- 自定义字体导入（FontFace API，base64 存 localStorage 跨会话保留）

**集成状态**：✅
