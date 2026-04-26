// ============================================================
// server/db/schema.ts
// Drizzle ORM schema — 所有列式表的单一真相来源
// schema 变更通过 drizzle-kit generate 生成 migration，不要直接改数据库
// ============================================================

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ── 会话表 ────────────────────────────────────────────────────

export const sessions = sqliteTable('sessions', {
  id:        text('id').primaryKey(),
  charId:    text('char_id').notNull(),
  type:      text('type').notNull(),
  name:      text('name'),
  isActive:  integer('is_active').default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
});

// ── 数值系统 ──────────────────────────────────────────────────

/** 角色数值表：存储数值定义 + 当前值 */
export const characterValues = sqliteTable('character_values', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  characterId:   text('character_id').notNull(),
  category:      text('category').notNull(),  // 'attribute' | 'status' | 'emotion' | 'relation' | 'social'
  name:          text('name').notNull(),       // 显示名，如"好感度"
  variableName:  text('variable_name').notNull(), // 变量名，如"affection"
  valueType:     text('value_type').notNull().default('continuous'), // 'continuous' | 'discrete'
  currentValue:  real('current_value').notNull().default(0),
  minValue:      real('min_value').notNull().default(0),
  maxValue:      real('max_value').notNull().default(100),
  sortOrder:     integer('sort_order').notNull().default(0),
  groupName:     text('group_name'),
  createdAt:     text('created_at').notNull(),
  updatedAt:     text('updated_at'),
});

/** 数值阶段表：不同数值范围的阶段名称、描述、提示词 */
export const valueStages = sqliteTable('value_stages', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  valueId:       integer('value_id').notNull().references(() => characterValues.id, { onDelete: 'cascade' }),
  rangeMin:      real('range_min').notNull(),
  rangeMax:      real('range_max').notNull(),
  stageName:     text('stage_name').notNull(),    // 如"陌生"
  description:   text('description'),              // 如"对user保持距离，态度冷淡"
  promptSnippet: text('prompt_snippet'),            // 注入的提示词片段
});

/** 数值规则表：不同范围的变化规则 */
export const valueRules = sqliteTable('value_rules', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  valueId:     integer('value_id').notNull().references(() => characterValues.id, { onDelete: 'cascade' }),
  rangeMin:    real('range_min'),    // null = 全范围生效
  rangeMax:    real('range_max'),
  triggerOn:   text('trigger_on').notNull(),  // 'chat_end' | 'time_pass' | 'receive_gift' | 'event_complete' | 'value_change'
  conditions:  text('conditions'),   // JSON，额外条件
  operation:   text('operation').notNull(),   // 'set' | 'add' | 'multiply'
  amount:      real('amount').notNull(),
  description: text('description'),   // 文字说明，如"亲密接触时减少3-8"
  enabled:     integer('enabled').notNull().default(1), // 0/1
  createdAt:   text('created_at'),
});

// ── 事件系统 ──────────────────────────────────────────────────

/** 事件书（容器）：作者按剧情线/主题组织事件 */
export const eventBooks = sqliteTable('event_books', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  description: text('description'),
  scope:       text('scope').notNull().default('global'),   // 'global' | 'character'
  characterId: text('character_id'),                         // scope='character' 时必填
  enabled:     integer('enabled').notNull().default(1),
  priority:    integer('priority').notNull().default(0),
  createdAt:   text('created_at').notNull(),
  updatedAt:   text('updated_at'),
});

/** 事件主表 */
export const events = sqliteTable('events', {
  id:                        text('id').primaryKey(),  // 如 "evt_confession"
  bookId:                    text('book_id').references(() => eventBooks.id, { onDelete: 'set null' }),
  characterId:               text('character_id'),     // 可空：global 书里的通用事件可不绑角色
  name:                      text('name').notNull(),
  description:               text('description'),
  status:                    text('status').notNull().default('locked'), // 'locked' | 'pending' | 'active' | 'completed'
  priority:                  integer('priority').notNull().default(0),
  probability:               integer('probability').notNull().default(100), // 0-100，条件满足后的触发概率
  weight:                    integer('weight').notNull().default(100),       // 加权随机池用（生活模拟）
  repeatable:                integer('repeatable').notNull().default(0),    // 0/1
  maxTriggers:               integer('max_triggers'),    // null = 无限
  triggerCount:              integer('trigger_count').notNull().default(0),
  unlockConditions:          text('unlock_conditions'),  // JSON
  triggerConditions:         text('trigger_conditions'), // JSON
  effects:                   text('effects'),            // JSON
  cooldownType:              text('cooldown_type').default('none'), // 'none' | 'time' | 'turns'
  cooldownValue:             integer('cooldown_value').default(0),
  cooldownRemaining:         integer('cooldown_remaining').default(0),
  conditionCooldown:         integer('condition_cooldown').default(0),
  conditionCooldownRemaining: integer('condition_cooldown_remaining').default(0),
  steps:                     text('steps'),              // JSON，多步骤事件
  currentStep:               text('current_step'),
  outcome:                   text('outcome'),             // 事件结果：'success' | 'fail' | 自定义分支名
  createdAt:                 text('created_at').notNull(),
  lastTriggeredAt:           text('last_triggered_at'),
});

/** 事件标签表 */
export const eventTags = sqliteTable('event_tags', {
  id:       integer('id').primaryKey({ autoIncrement: true }),
  eventId:  text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  tagType:  text('tag_type').notNull(),  // 'line' | 'category' | 'chapter'
  tagValue: text('tag_value').notNull(), // 如"主线1"、"日常"
});

/** 事件连接表：事件之间的关系（链、分支、触发、解锁） */
export const eventConnections = sqliteTable('event_connections', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  fromEventId:  text('from_event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  toEventId:    text('to_event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull(), // 'next' | 'branch' | 'trigger' | 'unlock'
});

/** 条件订阅表：pending 事件订阅的条件变化 */
export const conditionSubscriptions = sqliteTable('condition_subscriptions', {
  id:              integer('id').primaryKey({ autoIncrement: true }),
  eventId:         text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  conditionType:   text('condition_type').notNull(), // 'value' | 'flag' | 'time' | 'date' | 'weather' | 'location' | 'keyword' | 'event'
  conditionTarget: text('condition_target').notNull(), // 如"affection"、"evening"
});

/** 待注入表：事件触发后要插入 prompt 的内容 */
export const pendingInjections = sqliteTable('pending_injections', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  characterId:   text('character_id').notNull(),
  sourceEventId: text('source_event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  content:       text('content').notNull(),
  position:      text('position').notNull(), // 'before_char' | 'after_char' | 'status_section' | 'before_history' | 'depth'
  depthValue:    integer('depth_value'),
  durationType:  text('duration_type').notNull(), // 'once' | 'turns' | 'until_event' | 'permanent'
  durationValue: text('duration_value'),   // 轮数或事件ID
  remainingTurns: integer('remaining_turns'),
  createdAt:     text('created_at').notNull(),
});

// ── 世界书 ──────────────────────────────────────────────────

/** 世界书（容器） */
export const worldbooks = sqliteTable('worldbooks', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  enabled:     integer('enabled').notNull().default(1),
  priority:    integer('priority').notNull().default(0),
  scope:       text('scope').notNull().default('global'),   // 'global' | 'character' | 'persona' | 'chat'
  boundId:     text('bound_id'),                             // 绑定的角色/马甲/对话 id
  scanDepth:   integer('scan_depth').notNull().default(20),
  description: text('description'),
  createdAt:   text('created_at').notNull(),
  updatedAt:   text('updated_at'),
});

/** 世界书普通条目（constant / keyword 策略） */
export const worldbookEntries = sqliteTable('worldbook_entries', {
  id:                text('id').primaryKey(),
  worldbookId:       text('worldbook_id').notNull().references(() => worldbooks.id, { onDelete: 'cascade' }),
  memo:              text('memo'),                                    // 标题/备注
  content:           text('content').notNull().default(''),
  enabled:           integer('enabled').notNull().default(1),
  // ── 触发控制 ──
  strategy:          text('strategy').notNull().default('constant'),   // 'constant' | 'keyword'
  probability:       integer('probability').notNull().default(100),    // 0-100
  // ── 关键词 ──
  keywords:          text('keywords'),                                 // JSON array
  filterKeywords:    text('filter_keywords'),                          // JSON array（二级关键词）
  filterLogic:       text('filter_logic').default('AND_ANY'),          // AND_ANY | AND_ALL | NOT_ANY | NOT_ALL
  scanDepth:         integer('scan_depth'),                            // null = 用书的
  caseSensitive:     integer('case_sensitive').notNull().default(0),
  matchWholeWord:    integer('match_whole_word').notNull().default(0),
  // ── 插入控制 ──
  position:          text('position').notNull().default('system-bottom'),
  depth:             integer('depth').notNull().default(0),            // position=depth 时生效
  orderNum:          integer('order_num').notNull().default(0),        // 排序优先级（越小越靠前）
  // ── 递归 ──
  noRecurse:         integer('no_recurse').notNull().default(0),
  noFurtherRecurse:  integer('no_further_recurse').notNull().default(0),
  // ── 互斥/分组 ──
  inclusionGroup:    text('inclusion_group'),                          // 互斥组名
  groupWeight:       integer('group_weight').notNull().default(100),   // 组内权重
  // ── 定时效果 ──
  sticky:            integer('sticky').notNull().default(0),           // 激活后保持 N 条消息
  cooldown:          integer('cooldown').notNull().default(0),         // 冷却 N 条消息
  delay:             integer('delay').notNull().default(0),            // 至少 N 条消息后才能激活
  // ── 过滤 ──
  characterFilter:   text('character_filter'),                         // JSON array
  filterMode:        text('filter_mode').default('include'),           // include | exclude
  //
  createdAt:         text('created_at').notNull(),
  updatedAt:         text('updated_at'),
});

/** 世界书事件条目（random / conditional） */
export const worldbookEventEntries = sqliteTable('worldbook_event_entries', {
  id:              text('id').primaryKey(),
  worldbookId:     text('worldbook_id').notNull().references(() => worldbooks.id, { onDelete: 'cascade' }),
  memo:            text('memo'),
  content:         text('content').notNull().default(''),
  enabled:         integer('enabled').notNull().default(1),
  // ── 事件控制 ──
  eventType:       text('event_type').notNull().default('random'),     // 'random' | 'conditional'
  probability:     integer('probability').notNull().default(100),      // 0-100
  weight:          integer('weight').notNull().default(1),             // 加权随机
  // ── 条件（conditional 时） ──
  conditionStat:   text('condition_stat'),
  conditionOp:     text('condition_op'),
  conditionValue:  real('condition_value'),
  // ── 排序/标签 ──
  tags:            text('tags'),                                       // JSON array
  orderNum:        integer('order_num').notNull().default(0),
  //
  createdAt:       text('created_at').notNull(),
  updatedAt:       text('updated_at'),
});

// ── 世界状态 ──────────────────────────────────────────────────

/** 世界状态键值对表 */
export const worldState = sqliteTable('world_state', {
  key:       text('key').primaryKey(),
  value:     text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
