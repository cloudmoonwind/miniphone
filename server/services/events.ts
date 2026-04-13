/**
 * 事件系统服务层
 *
 * 基于 Drizzle ORM 操作 events / event_tags / event_connections /
 * condition_subscriptions / pending_injections 五张表。
 *
 * 提供：CRUD、状态流转、条件订阅管理、事件触发检查、注入管理。
 */

import { eq, and, inArray, or, isNull } from 'drizzle-orm';
import { getDrizzle } from '../db/database.js';
import {
  eventBooks, events, eventTags, eventConnections,
  conditionSubscriptions, pendingInjections,
} from '../db/schema.js';

// ── 类型 ──────────────────────────────────────────────────────

export type EventBook            = typeof eventBooks.$inferSelect;
export type Event                = typeof events.$inferSelect;
export type EventTag             = typeof eventTags.$inferSelect;
export type EventConnection      = typeof eventConnections.$inferSelect;
export type ConditionSubscription = typeof conditionSubscriptions.$inferSelect;
export type PendingInjection     = typeof pendingInjections.$inferSelect;

// ── event_books CRUD ──────────────────────────────────────────

export function getAllBooks(characterId?: string | null): EventBook[] {
  const db = getDrizzle();
  if (characterId) {
    // 返回：全局书 + 该角色专属书
    return db.select().from(eventBooks)
      .where(or(
        eq(eventBooks.scope, 'global'),
        and(eq(eventBooks.scope, 'character'), eq(eventBooks.characterId, characterId)),
      ))
      .all();
  }
  return db.select().from(eventBooks).all();
}

export function getBookById(id: string): EventBook | undefined {
  const db = getDrizzle();
  return db.select().from(eventBooks).where(eq(eventBooks.id, id)).get();
}

export function createBook(data: {
  id?: string;
  name: string;
  description?: string;
  scope?: string;
  characterId?: string | null;
  enabled?: number;
  priority?: number;
}): EventBook {
  const db = getDrizzle();
  const id = data.id ?? `evtbook_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  return db.insert(eventBooks).values({
    id,
    name: data.name,
    description: data.description ?? null,
    scope: data.scope ?? 'global',
    characterId: data.characterId ?? null,
    enabled: data.enabled ?? 1,
    priority: data.priority ?? 0,
    createdAt: now,
    updatedAt: now,
  }).returning().get();
}

export function updateBook(id: string, patch: Partial<{
  name: string;
  description: string | null;
  scope: string;
  characterId: string | null;
  enabled: number;
  priority: number;
}>): EventBook | undefined {
  const db = getDrizzle();
  return db.update(eventBooks)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(eventBooks.id, id))
    .returning().get();
}

export function deleteBook(id: string): boolean {
  const db = getDrizzle();
  const result = db.delete(eventBooks).where(eq(eventBooks.id, id)).returning().get();
  return !!result;
}

// ── events CRUD ───────────────────────────────────────────────

/**
 * 获取角色相关的所有事件：
 * - 直接挂在该角色的事件（characterId 匹配）
 * - 所属事件书的角色匹配事件
 * - 如果传入 bookId，只查该书内的事件
 */
export function getEventsByCharacter(characterId: string, bookId?: string): Event[] {
  const db = getDrizzle();
  if (bookId) {
    return db.select().from(events)
      .where(eq(events.bookId, bookId))
      .all();
  }
  // 查角色直属事件 + 属于该角色专属事件书的事件
  const charBooks = db.select({ id: eventBooks.id }).from(eventBooks)
    .where(and(eq(eventBooks.scope, 'character'), eq(eventBooks.characterId, characterId)))
    .all();
  const bookIds = charBooks.map(b => b.id);

  if (!bookIds.length) {
    return db.select().from(events)
      .where(eq(events.characterId, characterId))
      .all();
  }
  return db.select().from(events)
    .where(or(
      eq(events.characterId, characterId),
      inArray(events.bookId, bookIds),
    ))
    .all();
}

/**
 * 获取可用于生活模拟的事件池（repeatable 事件）。
 * 包含：全局书的事件 + 该角色专属书的事件，过滤 enabled 书。
 */
/** 按事件书 ID 查询其下所有事件（知识库用，不需要 charId） */
export function getEventsByBook(bookId: string): Event[] {
  const db = getDrizzle();
  return db.select().from(events)
    .where(eq(events.bookId, bookId))
    .all();
}

export function getEventPool(characterId: string): Event[] {
  const db = getDrizzle();
  // 找所有 enabled 的相关书
  const books = db.select({ id: eventBooks.id }).from(eventBooks)
    .where(and(
      eq(eventBooks.enabled, 1),
      or(
        eq(eventBooks.scope, 'global'),
        and(eq(eventBooks.scope, 'character'), eq(eventBooks.characterId, characterId)),
      ),
    ))
    .all();
  const bookIds = books.map(b => b.id);
  if (!bookIds.length) return [];

  return db.select().from(events)
    .where(and(
      eq(events.repeatable, 1),
      inArray(events.bookId, bookIds),
    ))
    .all();
}

export function getEventById(id: string): Event | undefined {
  const db = getDrizzle();
  return db.select().from(events)
    .where(eq(events.id, id))
    .get();
}

export function createEvent(data: {
  id?: string;
  bookId?: string | null;
  characterId?: string | null;
  name: string;
  description?: string;
  status?: string;
  priority?: number;
  probability?: number;
  weight?: number;
  repeatable?: number;
  maxTriggers?: number;
  unlockConditions?: string;
  triggerConditions?: string;
  effects?: string;
  cooldownType?: string;
  cooldownValue?: number;
  conditionCooldown?: number;
  steps?: string;
}): Event {
  const db = getDrizzle();
  const id = data.id ?? `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return db.insert(events).values({
    ...data,
    id,
    status: data.status ?? 'locked',
    priority: data.priority ?? 0,
    probability: data.probability ?? 100,
    weight: data.weight ?? 100,
    repeatable: data.repeatable ?? 0,
    triggerCount: 0,
    cooldownRemaining: 0,
    conditionCooldownRemaining: 0,
    createdAt: new Date().toISOString(),
  }).returning().get();
}

export function updateEvent(id: string, patch: Partial<{
  bookId: string | null;
  characterId: string | null;
  name: string;
  description: string | null;
  status: string;
  priority: number;
  probability: number;
  weight: number;
  repeatable: number;
  maxTriggers: number | null;
  triggerCount: number;
  unlockConditions: string | null;
  triggerConditions: string | null;
  effects: string | null;
  cooldownType: string;
  cooldownValue: number;
  cooldownRemaining: number;
  conditionCooldown: number;
  conditionCooldownRemaining: number;
  steps: string | null;
  currentStep: string | null;
  lastTriggeredAt: string | null;
}>): Event | undefined {
  const db = getDrizzle();
  return db.update(events)
    .set(patch)
    .where(eq(events.id, id))
    .returning().get();
}

export function deleteEvent(id: string): boolean {
  const db = getDrizzle();
  const result = db.delete(events)
    .where(eq(events.id, id))
    .returning().get();
  return !!result;
}

// ── event_tags CRUD ───────────────────────────────────────────

export function getTagsByEvent(eventId: string): EventTag[] {
  const db = getDrizzle();
  return db.select().from(eventTags)
    .where(eq(eventTags.eventId, eventId))
    .all();
}

export function createTag(data: { eventId: string; tagType: string; tagValue: string }): EventTag {
  const db = getDrizzle();
  return db.insert(eventTags).values(data).returning().get();
}

export function deleteTag(id: number): boolean {
  const db = getDrizzle();
  const result = db.delete(eventTags)
    .where(eq(eventTags.id, id))
    .returning().get();
  return !!result;
}

/** 批量设置事件标签（先删后插） */
export function setTags(eventId: string, tags: Array<{ tagType: string; tagValue: string }>): EventTag[] {
  const db = getDrizzle();
  db.delete(eventTags).where(eq(eventTags.eventId, eventId)).run();
  if (!tags.length) return [];
  return db.insert(eventTags)
    .values(tags.map(t => ({ ...t, eventId })))
    .returning().all();
}

// ── event_connections CRUD ────────────────────────────────────

export function getConnectionsByEvent(eventId: string): {
  outgoing: EventConnection[];
  incoming: EventConnection[];
} {
  const db = getDrizzle();
  return {
    outgoing: db.select().from(eventConnections)
      .where(eq(eventConnections.fromEventId, eventId)).all(),
    incoming: db.select().from(eventConnections)
      .where(eq(eventConnections.toEventId, eventId)).all(),
  };
}

export function getAllConnections(characterId: string, bookId?: string): EventConnection[] {
  const db = getDrizzle();
  // 通过角色相关事件 ID 筛选连接
  const charEvts = getEventsByCharacter(characterId, bookId);
  const ids = charEvts.map(e => e.id);
  if (!ids.length) return [];
  return db.select().from(eventConnections)
    .where(inArray(eventConnections.fromEventId, ids))
    .all();
}

export function createConnection(data: {
  fromEventId: string;
  toEventId: string;
  relationType: string;
}): EventConnection {
  const db = getDrizzle();
  return db.insert(eventConnections).values(data).returning().get();
}

export function updateConnection(id: number, patch: Partial<{
  relationType: string;
}>): EventConnection | undefined {
  const db = getDrizzle();
  return db.update(eventConnections)
    .set(patch)
    .where(eq(eventConnections.id, id))
    .returning().get();
}

export function deleteConnection(id: number): boolean {
  const db = getDrizzle();
  const result = db.delete(eventConnections)
    .where(eq(eventConnections.id, id))
    .returning().get();
  return !!result;
}

// ── condition_subscriptions ───────────────────────────────────

export function getSubscriptionsByEvent(eventId: string): ConditionSubscription[] {
  const db = getDrizzle();
  return db.select().from(conditionSubscriptions)
    .where(eq(conditionSubscriptions.eventId, eventId))
    .all();
}

/** 按条件类型+目标查找订阅了该条件的事件 */
export function findSubscribers(conditionType: string, conditionTarget: string): ConditionSubscription[] {
  const db = getDrizzle();
  return db.select().from(conditionSubscriptions)
    .where(and(
      eq(conditionSubscriptions.conditionType, conditionType),
      eq(conditionSubscriptions.conditionTarget, conditionTarget),
    ))
    .all();
}

/** 为事件注册条件订阅（事件进入 pending 时调用） */
export function registerSubscriptions(eventId: string, subs: Array<{
  conditionType: string;
  conditionTarget: string;
}>): ConditionSubscription[] {
  const db = getDrizzle();
  // 先清旧订阅
  db.delete(conditionSubscriptions)
    .where(eq(conditionSubscriptions.eventId, eventId)).run();
  if (!subs.length) return [];
  return db.insert(conditionSubscriptions)
    .values(subs.map(s => ({ ...s, eventId })))
    .returning().all();
}

/** 清除事件的条件订阅（事件完成或回到 locked 时调用） */
export function clearSubscriptions(eventId: string): void {
  const db = getDrizzle();
  db.delete(conditionSubscriptions)
    .where(eq(conditionSubscriptions.eventId, eventId)).run();
}

// ── pending_injections ────────────────────────────────────────

export function getInjectionsByCharacter(characterId: string): PendingInjection[] {
  const db = getDrizzle();
  return db.select().from(pendingInjections)
    .where(eq(pendingInjections.characterId, characterId))
    .all();
}

export function createInjection(data: {
  characterId: string;
  sourceEventId: string;
  content: string;
  position: string;
  depthValue?: number;
  durationType: string;
  durationValue?: string;
  remainingTurns?: number;
}): PendingInjection {
  const db = getDrizzle();
  return db.insert(pendingInjections).values({
    ...data,
    createdAt: new Date().toISOString(),
  }).returning().get();
}

export function deleteInjection(id: number): boolean {
  const db = getDrizzle();
  const result = db.delete(pendingInjections)
    .where(eq(pendingInjections.id, id))
    .returning().get();
  return !!result;
}

/**
 * 每轮对话结束后调用：消耗注入轮次
 * - once 类型：直接删除
 * - turns 类型：remainingTurns - 1，归零后删除
 * - permanent / until_event：不变
 */
export function consumeInjectionTurns(characterId: string): void {
  const db = getDrizzle();
  const all = getInjectionsByCharacter(characterId);

  for (const inj of all) {
    if (inj.durationType === 'once') {
      db.delete(pendingInjections).where(eq(pendingInjections.id, inj.id)).run();
    } else if (inj.durationType === 'turns' && inj.remainingTurns != null) {
      const remaining = inj.remainingTurns - 1;
      if (remaining <= 0) {
        db.delete(pendingInjections).where(eq(pendingInjections.id, inj.id)).run();
      } else {
        db.update(pendingInjections)
          .set({ remainingTurns: remaining })
          .where(eq(pendingInjections.id, inj.id)).run();
      }
    }
  }
}

// ── 事件状态流转 ──────────────────────────────────────────────

/**
 * 将事件从 locked → pending，并根据 triggerConditions 自动注册订阅
 */
export function unlockEvent(id: string): Event | undefined {
  const evt = getEventById(id);
  if (!evt || evt.status !== 'locked') return undefined;

  const updated = updateEvent(id, { status: 'pending' });

  // 解析 triggerConditions，提取需要订阅的条件
  if (evt.triggerConditions) {
    try {
      const conditions = JSON.parse(evt.triggerConditions);
      const subs = extractSubscriptionsFromConditions(conditions);
      if (subs.length) registerSubscriptions(id, subs);
    } catch { /* JSON 解析失败忽略 */ }
  }

  return updated;
}

/**
 * 完成事件：status → completed，清理订阅，处理 effects
 */
export function completeEvent(id: string): Event | undefined {
  const evt = getEventById(id);
  if (!evt) return undefined;

  const now = new Date().toISOString();
  const updated = updateEvent(id, {
    status: 'completed',
    triggerCount: evt.triggerCount + 1,
    lastTriggeredAt: now,
    // 设置冷却
    cooldownRemaining: evt.cooldownValue ?? 0,
    conditionCooldownRemaining: evt.conditionCooldown ?? 0,
  });

  clearSubscriptions(id);
  return updated;
}

/**
 * 重置可重复事件：completed → pending（冷却结束后）
 */
export function resetEvent(id: string): Event | undefined {
  const evt = getEventById(id);
  if (!evt || evt.status !== 'completed') return undefined;
  if (evt.repeatable !== 1) return undefined;
  if (evt.maxTriggers != null && evt.triggerCount >= evt.maxTriggers) return undefined;

  return unlockEvent(id) ? updateEvent(id, { status: 'pending' }) : undefined;
}

// ── 辅助函数 ──────────────────────────────────────────────────

/**
 * 从条件 JSON 中提取需要订阅的 { conditionType, conditionTarget }
 * 支持设计文档中的条件格式（条件组 + 组内条件）
 */
function extractSubscriptionsFromConditions(conditions: any): Array<{
  conditionType: string;
  conditionTarget: string;
}> {
  const subs: Array<{ conditionType: string; conditionTarget: string }> = [];

  try {
    // 扁平条件列表
    const condList: any[] = [];

    if (Array.isArray(conditions)) {
      // 直接是条件数组
      condList.push(...conditions);
    } else if (conditions.条件组) {
      // 设计文档格式：{ 组间逻辑, 条件组: [{ 组内逻辑, 条件: [...] }] }
      for (const group of conditions.条件组) {
        if (Array.isArray(group.条件)) condList.push(...group.条件);
      }
    } else if (conditions.groups) {
      // 英文格式：{ logic, groups: [{ logic, conditions: [...] }] }
      for (const group of conditions.groups) {
        if (Array.isArray(group.conditions)) condList.push(...group.conditions);
      }
    }

    for (const c of condList) {
      const type = c.类型 || c.type;
      const target = c.目标 || c.target || c.值 || c.value;
      if (type && target) {
        subs.push({ conditionType: String(type), conditionTarget: String(target) });
      }
    }
  } catch { /* 格式无法解析 */ }

  return subs;
}
