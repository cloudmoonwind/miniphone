/**
 * eventEngine.ts — 事件触发引擎（阶段二核心）
 *
 * 入口：
 *   checkAndFireEvents(charId, trigger, context?) → 检查并触发满足条件的事件
 *   fireValueRules(charId, triggerOn) → 执行数值规则
 *   parseOutcomeFromAIResponse(text) → 从 AI 回复中提取 [EVENT:id:outcome] 标签
 *   tickCooldowns(charId, mode) → 每轮/每天减少冷却计数
 *
 * trigger 枚举：
 *   'chat_end'           — 每轮对话结束
 *   'value_change'       — 数值发生变化（context.changedVariable 是变量名）
 *   'time_pass_hourly'   — 每现实小时（cron）
 *   'time_pass_daily'    — 每现实天（cron）
 *   'time_pass_life'     — 生活模拟触发（/life/generate）
 *   'keyword'            — 关键词检测（context.keyword / context.chatContent）
 *   'receive_gift'       — 收到礼物
 *   'event_complete'     — 某事件完成（context.completedEventId）
 */

import { eq, and, inArray, or } from 'drizzle-orm';
import { getDrizzle, getDb } from '../db/database.js';
import {
  events, eventConnections, conditionSubscriptions, pendingInjections, worldState,
} from '../db/schema.js';
import type { Event } from './events.js';
import {
  getEventById, updateEvent, unlockEvent, completeEvent,
  registerSubscriptions, clearSubscriptions, createInjection,
  findSubscribers,
} from './events.js';
import { getValuesByCharacter, adjustValue, getValueByVariable, executeRules } from './values.js';

// ── 类型 ──────────────────────────────────────────────────────────────────

export interface TriggerContext {
  /** 触发类型：详见文件顶部注释 */
  trigger: string;
  /** value_change 时：变化的变量名 */
  changedVariable?: string;
  /** value_change 时：变化后的新值 */
  newValue?: number;
  /** keyword 时：检测到的关键词 */
  keyword?: string;
  /** keyword / chat_end 时：完整对话文本（用于关键词检测） */
  chatContent?: string;
  /** event_complete 时：完成的事件 ID */
  completedEventId?: string;
}

export interface FireResult {
  /** 本次触发的事件列表 */
  fired: string[];
  /** 本次解锁的事件列表（locked → pending） */
  unlocked: string[];
}

// ── 主入口 ────────────────────────────────────────────────────────────────

/**
 * 检查并触发满足条件的事件。
 * 1. 检查所有 locked 事件的解锁条件 → 满足则转为 pending
 * 2. 通过条件订阅索引找到相关 pending 事件
 * 3. 评估 triggerConditions → 检查概率 → 执行 effects
 */
export function checkAndFireEvents(charId: string, ctx: TriggerContext): FireResult {
  const result: FireResult = { fired: [], unlocked: [] };

  try {
    // 获取快照（避免重复查询）
    const snapshot = buildSnapshot(charId);

    // 1. 检查解锁条件
    const unlocked = checkUnlockConditions(charId, snapshot);
    result.unlocked.push(...unlocked);

    // 2. 找相关 pending 事件
    const candidates = findCandidates(charId, ctx, snapshot);

    // 3. 逐一评估并触发
    for (const evt of candidates) {
      if (!canFire(evt, ctx, snapshot)) continue;
      const fired = fireEvent(charId, evt, ctx, snapshot);
      if (fired) result.fired.push(evt.id);
    }
  } catch (e) {
    console.error('[eventEngine] checkAndFireEvents error:', e);
  }

  return result;
}

// ── 数值快照 ──────────────────────────────────────────────────────────────

interface Snapshot {
  values: Record<string, number>;   // variableName → currentValue
  worldState: Record<string, string>; // key → value
  eventStatuses: Record<string, string>; // eventId → status
  eventOutcomes: Record<string, string | null>; // eventId → outcome
  currentHour: number;
  currentPeriod: 'morning' | 'afternoon' | 'evening' | 'night';
  currentDayType: 'weekday' | 'weekend';
  currentDate: string; // ISO date string
}

function buildSnapshot(charId: string): Snapshot {
  const db = getDrizzle();

  // 数值快照
  const charValues = getValuesByCharacter(charId);
  const values: Record<string, number> = {};
  for (const v of charValues) values[v.variableName] = v.currentValue;

  // 世界状态
  const wsRows = db.select().from(worldState).all();
  const wsMap: Record<string, string> = {};
  for (const row of wsRows) wsMap[row.key] = row.value;

  // 事件状态快照（该角色相关）
  const rawDb = getDb();
  const evtRows = rawDb.prepare(`
    SELECT id, status, outcome FROM events WHERE character_id = ?
  `).all(charId) as Array<{ id: string; status: string; outcome: string | null }>;
  const eventStatuses: Record<string, string> = {};
  const eventOutcomes: Record<string, string | null> = {};
  for (const row of evtRows) {
    eventStatuses[row.id] = row.status;
    eventOutcomes[row.id] = row.outcome;
  }

  // 时间信息
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sunday,6=Saturday
  let period: Snapshot['currentPeriod'] = 'morning';
  if (hour < 6) period = 'night';
  else if (hour < 12) period = 'morning';
  else if (hour < 18) period = 'afternoon';
  else if (hour < 22) period = 'evening';
  else period = 'night';

  return {
    values,
    worldState: wsMap,
    eventStatuses,
    eventOutcomes,
    currentHour: hour,
    currentPeriod: period,
    currentDayType: (day === 0 || day === 6) ? 'weekend' : 'weekday',
    currentDate: now.toISOString().slice(0, 10),
  };
}

// ── 解锁条件检查 ──────────────────────────────────────────────────────────

function checkUnlockConditions(charId: string, snapshot: Snapshot): string[] {
  const rawDb = getDb();
  // 找所有 locked 事件（该角色相关，包括 global 书）
  const locked = rawDb.prepare(`
    SELECT e.* FROM events e
    LEFT JOIN event_books eb ON e.book_id = eb.id
    WHERE e.status = 'locked'
      AND (e.character_id = ? OR (eb.scope = 'global' AND eb.enabled = 1))
  `).all(charId) as Event[];

  const unlockedIds: string[] = [];

  for (const evt of locked) {
    if (!evt.unlockConditions) {
      // 无解锁条件 → 直接解锁（初始状态 pending）
      continue; // 作者应手动控制或在创建时直接设为 pending
    }
    try {
      const conds = JSON.parse(evt.unlockConditions);
      if (evaluateConditions(conds, snapshot)) {
        unlockEvent(evt.id);
        unlockedIds.push(evt.id);
      }
    } catch { /* JSON 解析失败，跳过 */ }
  }

  return unlockedIds;
}

// ── 候选事件查找 ──────────────────────────────────────────────────────────

function findCandidates(charId: string, ctx: TriggerContext, snapshot: Snapshot): Event[] {
  const db = getDrizzle();
  const rawDb = getDb();

  // 根据 trigger 类型，决定用订阅索引还是全量查
  if (ctx.trigger === 'value_change' && ctx.changedVariable) {
    // 用订阅索引：只找订阅了该变量的事件
    const subs = findSubscribers('value', ctx.changedVariable);
    const ids = subs.map(s => s.eventId);
    if (!ids.length) return [];
    return db.select().from(events)
      .where(and(eq(events.status, 'pending'), inArray(events.id, ids)))
      .all();
  }

  if (ctx.trigger === 'keyword' && ctx.keyword) {
    const subs = findSubscribers('keyword', ctx.keyword);
    const ids = subs.map(s => s.eventId);
    if (!ids.length) return [];
    return db.select().from(events)
      .where(and(eq(events.status, 'pending'), inArray(events.id, ids)))
      .all();
  }

  if (ctx.trigger === 'event_complete' && ctx.completedEventId) {
    const subs = findSubscribers('event', ctx.completedEventId);
    const ids = subs.map(s => s.eventId);
    if (!ids.length) return [];
    return db.select().from(events)
      .where(and(eq(events.status, 'pending'), inArray(events.id, ids)))
      .all();
  }

  // chat_end / time_pass_* / receive_gift → 全量查该角色 pending 事件
  const rows = rawDb.prepare(`
    SELECT e.* FROM events e
    LEFT JOIN event_books eb ON e.book_id = eb.id
    WHERE e.status = 'pending'
      AND (e.character_id = ? OR (eb.scope = 'global' AND eb.enabled = 1))
    ORDER BY e.priority DESC
  `).all(charId) as Event[];

  return rows;
}

// ── 触发前检查 ────────────────────────────────────────────────────────────

function canFire(evt: Event, ctx: TriggerContext, snapshot: Snapshot): boolean {
  // 1. 检查冷却
  if ((evt.cooldownRemaining ?? 0) > 0) return false;
  if ((evt.conditionCooldownRemaining ?? 0) > 0) return false;

  // 2. 检查最大触发次数
  if (evt.maxTriggers != null && evt.triggerCount >= evt.maxTriggers) return false;

  // 3. 评估触发条件
  if (evt.triggerConditions) {
    try {
      const conds = JSON.parse(evt.triggerConditions);
      if (!evaluateConditions(conds, snapshot)) return false;
    } catch { return false; }
  }

  // 4. 条件冷却计数更新（条件满足N次才触发）
  if ((evt.conditionCooldown ?? 0) > 0) {
    const remaining = (evt.conditionCooldownRemaining ?? evt.conditionCooldown ?? 0) - 1;
    updateEvent(evt.id, { conditionCooldownRemaining: remaining });
    if (remaining > 0) return false;
  }

  // 5. 概率检查
  const prob = evt.probability ?? 100;
  if (prob < 100 && Math.random() * 100 >= prob) return false;

  return true;
}

// ── 条件评估 ──────────────────────────────────────────────────────────────

/**
 * 评估条件 JSON（支持设计文档两种格式：中文组格式 + 英文 groups 格式）
 */
function evaluateConditions(conds: any, snapshot: Snapshot): boolean {
  if (!conds) return true;

  // 中文格式：{ 组间逻辑: '或'|'且', 条件组: [{ 组内逻辑: '且'|'或', 条件: [...] }] }
  if (conds.条件组) {
    const groupLogic = conds.组间逻辑 === '或' ? 'or' : 'and';
    const groups: any[] = conds.条件组;
    const groupResults = groups.map(g => evaluateGroup(g.条件 ?? [], g.组内逻辑 === '或' ? 'or' : 'and', snapshot));
    return groupLogic === 'or' ? groupResults.some(Boolean) : groupResults.every(Boolean);
  }

  // 英文格式：{ logic: 'or'|'and', groups: [{ logic, conditions: [...] }] }
  if (conds.groups) {
    const groupLogic = conds.logic === 'or' ? 'or' : 'and';
    const groups: any[] = conds.groups;
    const groupResults = groups.map(g => evaluateGroup(g.conditions ?? [], g.logic === 'or' ? 'or' : 'and', snapshot));
    return groupLogic === 'or' ? groupResults.some(Boolean) : groupResults.every(Boolean);
  }

  // 单个条件数组（简化格式）
  if (Array.isArray(conds)) {
    return evaluateGroup(conds, 'and', snapshot);
  }

  // 单个条件对象
  return evaluateSingleCondition(conds, snapshot);
}

function evaluateGroup(conditions: any[], logic: 'and' | 'or', snapshot: Snapshot): boolean {
  if (!conditions.length) return true;
  const results = conditions.map(c => evaluateSingleCondition(c, snapshot));
  return logic === 'or' ? results.some(Boolean) : results.every(Boolean);
}

function evaluateSingleCondition(c: any, snapshot: Snapshot): boolean {
  const type = c.类型 || c.type;

  switch (type) {
    case '数值':
    case 'value': {
      const varName = c.目标 || c.target;
      const op = c.比较 || c.operator;
      const threshold = c.值 ?? c.value;
      const cur = snapshot.values[varName];
      if (cur == null) return false;
      return compareNumber(cur, op, threshold);
    }

    case '事件':
    case 'event': {
      const evtId = c.目标 || c.target;
      const requiredStatus = c.状态 || c.status;
      const requiredOutcome = c.结果 || c.outcome;
      const actualStatus = snapshot.eventStatuses[evtId];
      if (actualStatus !== requiredStatus) return false;
      if (requiredOutcome) {
        return snapshot.eventOutcomes[evtId] === requiredOutcome;
      }
      return true;
    }

    case '时间':
    case 'time': {
      const val = c.值 || c.value;
      return snapshot.currentPeriod === val;
    }

    case '日期':
    case 'date': {
      const val = c.值 || c.value;
      if (val === 'weekday' || val === 'weekend') {
        return snapshot.currentDayType === val;
      }
      // 具体节日/日期
      return snapshot.currentDate === val || snapshot.worldState['date'] === val;
    }

    case '天气':
    case 'weather': {
      const val = c.值 || c.value;
      return snapshot.worldState['weather'] === val;
    }

    case '地点':
    case 'location': {
      const target = c.目标 || c.target;
      return snapshot.worldState['location'] === target;
    }

    case '关键词':
    case 'keyword': {
      // 关键词类条件只有在 keyword trigger 时才有意义，这里始终返回 true
      // 实际关键词匹配在 findCandidates 阶段已通过订阅索引过滤
      return true;
    }

    case '随机':
    case 'random': {
      const prob = c.概率 ?? c.probability ?? 50;
      return Math.random() * 100 < prob;
    }

    default:
      return true; // 未知类型放行
  }
}

function compareNumber(cur: number, op: string, threshold: number): boolean {
  switch (op) {
    case '>=': case 'gte': return cur >= threshold;
    case '<=': case 'lte': return cur <= threshold;
    case '>':  case 'gt':  return cur > threshold;
    case '<':  case 'lt':  return cur < threshold;
    case '==': case '=':  case 'eq': return cur === threshold;
    case '!=': case 'neq': return cur !== threshold;
    default: return false;
  }
}

// ── 事件触发执行 ──────────────────────────────────────────────────────────

function fireEvent(charId: string, evt: Event, ctx: TriggerContext, snapshot: Snapshot): boolean {
  try {
    // 执行 effects
    if (evt.effects) {
      try {
        const effectList = JSON.parse(evt.effects);
        if (Array.isArray(effectList)) {
          for (const effect of effectList) {
            executeEffect(charId, evt.id, effect, snapshot);
          }
        }
      } catch (e) {
        console.error(`[eventEngine] effects parse error for ${evt.id}:`, e);
      }
    }

    // 更新事件状态
    const now = new Date().toISOString();
    const newCount = evt.triggerCount + 1;
    const cooldownRemaining = evt.cooldownValue ?? 0;
    const condCooldownRemaining = evt.conditionCooldown ?? 0;

    if (evt.repeatable === 1 && (evt.maxTriggers == null || newCount < evt.maxTriggers)) {
      // 可重复：重置为 pending，重新注册订阅
      updateEvent(evt.id, {
        status: 'pending',
        triggerCount: newCount,
        lastTriggeredAt: now,
        cooldownRemaining,
        conditionCooldownRemaining: condCooldownRemaining,
      });
      // 重新注册订阅（如有冷却则冷却期间不会被选中，因为 canFire 会过滤）
      if (evt.triggerConditions) {
        try {
          const conds = JSON.parse(evt.triggerConditions);
          const subs = extractSubscriptions(conds);
          if (subs.length) registerSubscriptions(evt.id, subs);
        } catch { /* 忽略 */ }
      }
    } else {
      // 不可重复或达到最大次数：完成
      updateEvent(evt.id, {
        status: 'completed',
        triggerCount: newCount,
        lastTriggeredAt: now,
        cooldownRemaining,
        conditionCooldownRemaining: condCooldownRemaining,
      });
      clearSubscriptions(evt.id);

      // 处理后续事件连接（trigger / unlock 类型的）
      processEventConnections(evt.id, snapshot);
    }

    console.log(`[eventEngine] 事件触发: ${evt.id} (${evt.name})`);
    return true;
  } catch (e) {
    console.error(`[eventEngine] fireEvent error for ${evt.id}:`, e);
    return false;
  }
}

// ── Effect 执行 ───────────────────────────────────────────────────────────

function executeEffect(charId: string, eventId: string, effect: any, snapshot: Snapshot): void {
  const type = effect.类型 || effect.type;

  switch (type) {
    case '注入':
    case 'inject': {
      const content = effect.内容 || effect.content || '';
      const position = effect.位置 || effect.position || 'after_char';
      const durationType = effect.持续 || effect.durationType || 'once';
      const durationValue = String(effect.持续值 ?? effect.durationValue ?? '');
      const remainingTurns = durationType === 'turns' ? (parseInt(durationValue) || 1) : undefined;

      createInjection({
        characterId: charId,
        sourceEventId: eventId,
        content,
        position,
        durationType,
        durationValue: durationValue || undefined,
        remainingTurns,
      });
      break;
    }

    case '改数值':
    case 'modify_value': {
      const varName = effect.目标 || effect.target;
      const op = effect.操作 || effect.operation || 'add';
      const amount = effect.值 ?? effect.value ?? 0;

      const val = getValueByVariable(charId, varName);
      if (!val) break;

      switch (op) {
        case 'add':
          adjustValue(val.id, amount);
          break;
        case 'set':
          adjustValue(val.id, amount - val.currentValue); // set = add (target - current)
          break;
        case 'multiply':
          adjustValue(val.id, val.currentValue * amount - val.currentValue);
          break;
      }
      break;
    }

    case '记录结果':
    case 'set_outcome': {
      const targetEvtId = effect.目标 || effect.target || eventId;
      const outcomeVal = effect.值 || effect.value || '';
      updateEvent(targetEvtId, { outcome: outcomeVal } as any);
      // 更新快照（同次触发中后续效果可见）
      snapshot.eventOutcomes[targetEvtId] = outcomeVal;
      break;
    }

    case '触发事件':
    case 'trigger_event': {
      const targetId = effect.目标 || effect.target;
      const target = getEventById(targetId);
      if (target && target.status === 'pending') {
        // 直接触发（跳过概率检查，视为外部强制触发）
        fireEvent(charId, target, { trigger: 'event_complete', completedEventId: targetId }, snapshot);
      }
      break;
    }

    case '解锁事件':
    case 'unlock_event': {
      const targetId = effect.目标 || effect.target;
      unlockEvent(targetId);
      break;
    }

    case '锁定事件':
    case 'lock_event': {
      const targetId = effect.目标 || effect.target;
      const target = getEventById(targetId);
      if (target && target.status === 'pending') {
        updateEvent(targetId, { status: 'locked' });
        clearSubscriptions(targetId);
      }
      break;
    }

    case '改位置':
    case 'change_location': {
      const location = effect.目标 || effect.target || '';
      const rawDb = getDb();
      rawDb.prepare(`
        INSERT INTO world_state (key, value, updated_at) VALUES ('location', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(location, new Date().toISOString());
      snapshot.worldState['location'] = location;
      break;
    }

    case '记录历史':
    case 'record_history': {
      // 预留：写入历史记录系统（暂时只 console.log）
      const content = effect.内容 || effect.content || '';
      console.log(`[eventEngine] 历史记录: ${content}`);
      break;
    }

    default:
      console.warn(`[eventEngine] 未知效果类型: ${type}`);
  }
}

// ── 事件连接处理 ──────────────────────────────────────────────────────────

function processEventConnections(completedEventId: string, snapshot: Snapshot): void {
  const db = getDrizzle();
  const conns = db.select().from(eventConnections)
    .where(eq(eventConnections.fromEventId, completedEventId))
    .all();

  for (const conn of conns) {
    if (conn.relationType === 'unlock') {
      unlockEvent(conn.toEventId);
    } else if (conn.relationType === 'trigger') {
      const target = getEventById(conn.toEventId);
      if (target && target.status === 'pending') {
        // 异步触发不再递归检查条件，直接强制执行
        fireEvent('', target, { trigger: 'event_complete', completedEventId }, snapshot);
      }
    }
    // 'next' / 'branch' → 只是标记关系，不自动触发
  }
}

// ── AI 回复中提取 outcome 标签 ────────────────────────────────────────────

const OUTCOME_PATTERN = /\[EVENT:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\]/g;

/**
 * 解析 AI 回复中的事件结果标签并写入数据库。
 * 标签格式：[EVENT:事件ID:结果]  示例：[EVENT:evt_confession:success]
 *
 * @returns 解析到的 { eventId, outcome }[] 列表，供调用方继续处理（如触发后续事件链）
 */
export function parseOutcomeFromAIResponse(text: string): Array<{ eventId: string; outcome: string }> {
  const results: Array<{ eventId: string; outcome: string }> = [];
  let match: RegExpExecArray | null;

  OUTCOME_PATTERN.lastIndex = 0; // 重置全局匹配
  while ((match = OUTCOME_PATTERN.exec(text)) !== null) {
    const [, eventId, outcome] = match;
    const evt = getEventById(eventId);
    if (evt) {
      updateEvent(eventId, { outcome } as any);
      results.push({ eventId, outcome });
      console.log(`[eventEngine] AI 标记结果: ${eventId} → ${outcome}`);

      // 触发后续分支事件（根据 outcome 匹配 branch 连接）
      const db = getDrizzle();
      const branchConns = db.select().from(eventConnections)
        .where(and(
          eq(eventConnections.fromEventId, eventId),
          eq(eventConnections.relationType, 'branch'),
        ))
        .all();

      for (const conn of branchConns) {
        // 连接的 requiredOutcome 暂时存储在 relation_type 后缀中，约定格式：
        // relationType = 'branch:success' 或 'branch:fail' 等
        // 或者如果没有后缀，所有 branch 连接都走
        const parts = conn.relationType.split(':');
        const required = parts[1]; // 可能为 undefined
        if (!required || required === outcome) {
          unlockEvent(conn.toEventId);
        }
      }
    }
  }

  return results;
}

// ── 冷却计时 ──────────────────────────────────────────────────────────────

/**
 * 减少冷却计数。
 * mode='turns' → 每轮减一次（cooldown_type='turns'）
 * mode='days'  → 每天减一次（cooldown_type='time'）
 *
 * 冷却归零后，如果是可重复事件且状态为 pending，不做额外操作（已在 pending 中等待触发）。
 * 如果是可重复事件且状态为 completed，转回 pending 并重新注册订阅。
 */
export function tickCooldowns(charId: string, mode: 'turns' | 'days'): void {
  const rawDb = getDb();
  const rows = rawDb.prepare(`
    SELECT * FROM events
    WHERE character_id = ? AND cooldown_remaining > 0
    AND cooldown_type = ?
  `).all(charId, mode === 'turns' ? 'turns' : 'time') as Event[];

  for (const evt of rows) {
    const newRemaining = Math.max(0, (evt.cooldownRemaining ?? 1) - 1);
    updateEvent(evt.id, { cooldownRemaining: newRemaining });

    if (newRemaining === 0 && evt.repeatable === 1 && evt.status === 'completed') {
      // 转回 pending
      updateEvent(evt.id, { status: 'pending' });
      if (evt.triggerConditions) {
        try {
          const conds = JSON.parse(evt.triggerConditions);
          const subs = extractSubscriptions(conds);
          if (subs.length) registerSubscriptions(evt.id, subs);
        } catch { /* 忽略 */ }
      }
    }
  }
}

// ── 数值规则执行 ──────────────────────────────────────────────────────────

/**
 * 执行指定触发时机的数值规则，然后触发 value_change 事件检查。
 */
export function fireValueRules(
  charId: string,
  triggerOn: string,
): void {
  const changes = executeRules(charId, triggerOn);

  for (const change of changes) {
    // 每个变化的数值都触发 value_change 事件检查
    checkAndFireEvents(charId, {
      trigger: 'value_change',
      changedVariable: change.variableName,
      newValue: change.next,
    });
  }
}

// ── 辅助：提取条件中需要订阅的目标 ──────────────────────────────────────

function extractSubscriptions(conds: any): Array<{ conditionType: string; conditionTarget: string }> {
  const subs: Array<{ conditionType: string; conditionTarget: string }> = [];
  const condList: any[] = [];

  if (Array.isArray(conds)) {
    condList.push(...conds);
  } else if (conds.条件组) {
    for (const g of conds.条件组) {
      if (Array.isArray(g.条件)) condList.push(...g.条件);
    }
  } else if (conds.groups) {
    for (const g of conds.groups) {
      if (Array.isArray(g.conditions)) condList.push(...g.conditions);
    }
  }

  for (const c of condList) {
    const type = c.类型 || c.type;
    const target = c.目标 || c.target || c.值 || c.value;
    if (type && target) {
      subs.push({ conditionType: String(type), conditionTarget: String(target) });
    }
  }

  return subs;
}
