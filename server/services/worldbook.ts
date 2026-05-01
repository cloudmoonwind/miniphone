/**
 * 世界书服务层
 *
 * 基于 Drizzle ORM 操作三张列式表：
 *   worldbooks            — 书（容器）
 *   worldbook_entries     — 普通条目（constant / keyword）
 *   worldbook_event_entries — 事件条目（random / conditional）
 */

import { eq, and, inArray } from 'drizzle-orm';
import { getDrizzle } from '../db/database.js';
import {
  worldbooks,
  worldbookEntries,
  worldbookEventEntries,
} from '../db/schema.js';
import { traceSummary, traceDetail } from './trace.js';

// ── 类型导出 ─────────────────────────────────────────────────

export type Worldbook       = typeof worldbooks.$inferSelect;
export type WbEntry         = typeof worldbookEntries.$inferSelect;
export type WbEventEntry    = typeof worldbookEventEntries.$inferSelect;

// ── ID 生成 ──────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// ════════════════════════════════════════════════════════════════
// 书 CRUD
// ════════════════════════════════════════════════════════════════

export function getAllBooks(scope?: string, boundId?: string): Worldbook[] {
  const db = getDrizzle();
  let rows = db.select().from(worldbooks).all();
  if (scope) rows = rows.filter(b => b.scope === scope || b.scope === 'global');
  if (boundId) rows = rows.filter(b => b.boundId === boundId || !b.boundId);
  return rows;
}

export function getBookById(id: string): Worldbook | undefined {
  return getDrizzle().select().from(worldbooks).where(eq(worldbooks.id, id)).get();
}

export function createBook(data: {
  name: string;
  scope?: string;
  boundId?: string;
  scanDepth?: number;
  description?: string;
  priority?: number;
}): Worldbook {
  const db = getDrizzle();
  const now = new Date().toISOString();
  const id = genId('wb');
  db.insert(worldbooks).values({
    id,
    name: data.name,
    enabled: 1,
    priority: data.priority ?? 0,
    scope: data.scope ?? 'global',
    boundId: data.boundId ?? null,
    scanDepth: data.scanDepth ?? 20,
    description: data.description ?? null,
    createdAt: now,
    updatedAt: now,
  }).run();
  return getBookById(id)!;
}

export function updateBook(id: string, patch: Partial<Worldbook>): Worldbook | null {
  const existing = getBookById(id);
  if (!existing) return null;
  const db = getDrizzle();
  const now = new Date().toISOString();
  db.update(worldbooks)
    .set({ ...patch, updatedAt: now })
    .where(eq(worldbooks.id, id))
    .run();
  return getBookById(id)!;
}

export function deleteBook(id: string): boolean {
  const db = getDrizzle();
  // 级联删除由 FK ON DELETE CASCADE 处理
  const result = db.delete(worldbooks).where(eq(worldbooks.id, id)).run();
  return result.changes > 0;
}

// ════════════════════════════════════════════════════════════════
// 普通条目 CRUD
// ════════════════════════════════════════════════════════════════

export function getEntriesByBook(worldbookId: string): WbEntry[] {
  return getDrizzle().select().from(worldbookEntries)
    .where(eq(worldbookEntries.worldbookId, worldbookId))
    .all();
}

export function getEntryById(id: string): WbEntry | undefined {
  return getDrizzle().select().from(worldbookEntries)
    .where(eq(worldbookEntries.id, id))
    .get();
}

export function createEntry(worldbookId: string, data: Partial<WbEntry>): WbEntry {
  const db = getDrizzle();
  const now = new Date().toISOString();
  const id = genId('wbe');
  db.insert(worldbookEntries).values({
    id,
    worldbookId,
    memo: data.memo ?? null,
    content: data.content ?? '',
    enabled: data.enabled ?? 1,
    strategy: data.strategy ?? 'constant',
    probability: data.probability ?? 100,
    keywords: data.keywords ?? null,
    filterKeywords: data.filterKeywords ?? null,
    filterLogic: data.filterLogic ?? 'AND_ANY',
    scanDepth: data.scanDepth ?? null,
    caseSensitive: data.caseSensitive ?? 0,
    matchWholeWord: data.matchWholeWord ?? 0,
    position: data.position ?? 'system-bottom',
    depth: data.depth ?? 0,
    orderNum: data.orderNum ?? 0,
    noRecurse: data.noRecurse ?? 0,
    noFurtherRecurse: data.noFurtherRecurse ?? 0,
    inclusionGroup: data.inclusionGroup ?? null,
    groupWeight: data.groupWeight ?? 100,
    sticky: data.sticky ?? 0,
    cooldown: data.cooldown ?? 0,
    delay: data.delay ?? 0,
    characterFilter: data.characterFilter ?? null,
    filterMode: data.filterMode ?? 'include',
    createdAt: now,
    updatedAt: now,
  }).run();
  return getEntryById(id)!;
}

export function updateEntry(id: string, patch: Partial<WbEntry>): WbEntry | null {
  const existing = getEntryById(id);
  if (!existing) return null;
  const db = getDrizzle();
  const now = new Date().toISOString();
  db.update(worldbookEntries)
    .set({ ...patch, updatedAt: now })
    .where(eq(worldbookEntries.id, id))
    .run();
  return getEntryById(id)!;
}

export function deleteEntry(id: string): boolean {
  return getDrizzle().delete(worldbookEntries).where(eq(worldbookEntries.id, id)).run().changes > 0;
}

// ════════════════════════════════════════════════════════════════
// 事件条目 CRUD
// ════════════════════════════════════════════════════════════════

export function getEventEntriesByBook(worldbookId: string): WbEventEntry[] {
  return getDrizzle().select().from(worldbookEventEntries)
    .where(eq(worldbookEventEntries.worldbookId, worldbookId))
    .all();
}

export function getEventEntryById(id: string): WbEventEntry | undefined {
  return getDrizzle().select().from(worldbookEventEntries)
    .where(eq(worldbookEventEntries.id, id))
    .get();
}

export function createEventEntry(worldbookId: string, data: Partial<WbEventEntry>): WbEventEntry {
  const db = getDrizzle();
  const now = new Date().toISOString();
  const id = genId('wbev');
  db.insert(worldbookEventEntries).values({
    id,
    worldbookId,
    memo: data.memo ?? null,
    content: data.content ?? '',
    enabled: data.enabled ?? 1,
    eventType: data.eventType ?? 'random',
    probability: data.probability ?? 100,
    weight: data.weight ?? 1,
    conditionStat: data.conditionStat ?? null,
    conditionOp: data.conditionOp ?? null,
    conditionValue: data.conditionValue ?? null,
    tags: data.tags ?? null,
    orderNum: data.orderNum ?? 0,
    createdAt: now,
    updatedAt: now,
  }).run();
  return getEventEntryById(id)!;
}

export function updateEventEntry(id: string, patch: Partial<WbEventEntry>): WbEventEntry | null {
  const existing = getEventEntryById(id);
  if (!existing) return null;
  const db = getDrizzle();
  const now = new Date().toISOString();
  db.update(worldbookEventEntries)
    .set({ ...patch, updatedAt: now })
    .where(eq(worldbookEventEntries.id, id))
    .run();
  return getEventEntryById(id)!;
}

export function deleteEventEntry(id: string): boolean {
  return getDrizzle().delete(worldbookEventEntries).where(eq(worldbookEventEntries.id, id)).run().changes > 0;
}

// ════════════════════════════════════════════════════════════════
// 上下文注入：获取激活的普通条目（供 context.ts）
// ════════════════════════════════════════════════════════════════

/**
 * 带级联激活 + 概率 + 互斥组的世界书条目激活
 *
 * 规则：
 * 1. 找到所有启用书中的启用条目
 * 2. constant 条目无条件激活（受 probability 控制）
 * 3. keyword 条目：匹配关键词后激活（受 probability、互斥组控制）
 * 4. 级联激活：激活条目的 content 可触发其他 keyword 条目
 * 5. 互斥组：同组只激活一个（按 groupWeight 加权随机）
 */
export function getActivatedEntries(
  charId: string | null,
  messages: { role: string; content: string }[] = [],
): WbEntry[] {
  const db = getDrizzle();

  // 获取启用的书
  const books = db.select().from(worldbooks)
    .where(eq(worldbooks.enabled, 1))
    .all()
    .filter(b => b.scope === 'global' || b.boundId === charId);

  if (books.length === 0) return [];
  const bookIds = books.map(b => b.id);

  // 获取所有候选条目
  const allEntries = db.select().from(worldbookEntries)
    .where(and(
      eq(worldbookEntries.enabled, 1),
      inArray(worldbookEntries.worldbookId, bookIds),
    ))
    .all();
  const scanTraceId = traceSummary('worldbook', 'worldbook.scan', `${books.length} books / ${allEntries.length} entries scanned`, {
    charId,
    bookCount: books.length,
    entryCount: allEntries.length,
    bookIds,
    scanDepth: books.map(b => ({ id: b.id, name: b.name, scanDepth: b.scanDepth })),
  });
  const decisionStats = {
    matched: 0,
    injected: 0,
    probabilityDropped: 0,
    groupDropped: 0,
    cascaded: 0,
  };

  // 取最大 scanDepth
  const maxScanDepth = books.reduce((max, b) => Math.max(max, b.scanDepth), 20);

  const baseText = messages
    .slice(-maxScanDepth)
    .map(m => m.content || '')
    .join(' ');

  let scanText = baseText;
  const activated = new Map<string, WbEntry>();
  let remaining = [...allEntries];

  // 级联激活循环
  let changed = true;
  while (changed) {
    changed = false;
    const nextRemaining: WbEntry[] = [];
    for (const entry of remaining) {
      let shouldActivate = false;
      let reason = 'none';
      let matchedKeywords: string[] = [];

      if (entry.strategy === 'constant') {
        shouldActivate = true;
        reason = 'constant';
      } else if (entry.strategy === 'keyword') {
        const kws: string[] = entry.keywords ? JSON.parse(entry.keywords) : [];
        const cs = !!entry.caseSensitive;
        const textToScan = entry.noRecurse ? baseText : scanText;
        const haystack = cs ? textToScan : textToScan.toLowerCase();

        shouldActivate = kws.some(kw => {
          const needle = cs ? kw : kw.toLowerCase();
          const matched = entry.matchWholeWord
            ? (() => {
            const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, cs ? '' : 'i');
            return re.test(textToScan);
          })()
            : haystack.includes(needle);
          if (matched) matchedKeywords.push(kw);
          return matched;
        });
        if (shouldActivate) reason = 'keyword';

        // 二级关键词过滤
        if (shouldActivate && entry.filterKeywords) {
          const fkws: string[] = JSON.parse(entry.filterKeywords);
          if (fkws.length > 0) {
            const logic = entry.filterLogic || 'AND_ANY';
            const fMatches = fkws.filter(fk => {
              const fn = cs ? fk : fk.toLowerCase();
              return haystack.includes(fn);
            });
            switch (logic) {
              case 'AND_ALL':  shouldActivate = fMatches.length === fkws.length; break;
              case 'NOT_ANY':  shouldActivate = fMatches.length === 0; break;
              case 'NOT_ALL':  shouldActivate = fMatches.length < fkws.length; break;
              case 'AND_ANY':
              default:         shouldActivate = fMatches.length > 0; break;
            }
            if (!shouldActivate) reason = `filter-${logic}`;
          }
        }
      }

      // 概率检查
      if (shouldActivate && entry.probability < 100) {
        const roll = Math.random() * 100;
        shouldActivate = roll < entry.probability;
        if (!shouldActivate) {
          decisionStats.probabilityDropped++;
          traceDetail('worldbook', 'worldbook.drop', `${entry.id} dropped: probability ${entry.probability}%`, {
            entryId: entry.id,
            memo: entry.memo,
            reason: 'probability',
            probability: entry.probability,
            roll,
            matchedKeywords,
          }, scanTraceId);
        }
      }

      if (shouldActivate) {
        decisionStats.matched++;
        activated.set(entry.id, entry);
        changed = true;
        if (!entry.noFurtherRecurse && entry.content) {
          scanText += ' ' + entry.content;
          decisionStats.cascaded++;
        }
        traceDetail('worldbook', 'worldbook.match', `${entry.id} ${reason} matched`, {
          entryId: entry.id,
          memo: entry.memo,
          strategy: entry.strategy,
          reason,
          matchedKeywords,
          position: entry.position,
          inclusionGroup: entry.inclusionGroup,
          groupWeight: entry.groupWeight,
          noRecurse: entry.noRecurse,
          noFurtherRecurse: entry.noFurtherRecurse,
        }, scanTraceId);
      } else {
        nextRemaining.push(entry);
      }
    }
    remaining = nextRemaining;
  }

  // 互斥组处理：同组只保留一个（按 groupWeight 加权随机）
  const grouped = new Map<string, WbEntry[]>();
  const ungrouped: WbEntry[] = [];
  for (const entry of activated.values()) {
    if (entry.inclusionGroup) {
      const arr = grouped.get(entry.inclusionGroup) || [];
      arr.push(entry);
      grouped.set(entry.inclusionGroup, arr);
    } else {
      ungrouped.push(entry);
    }
  }

  const result = [...ungrouped];
  for (const [, entries] of grouped) {
    if (entries.length === 1) {
      result.push(entries[0]);
    } else {
      // 加权随机选一个
      const totalWeight = entries.reduce((s, e) => s + e.groupWeight, 0);
      let roll = Math.random() * totalWeight;
      let selected: WbEntry | null = null;
      for (const e of entries) {
        roll -= e.groupWeight;
        if (roll <= 0) { selected = e; result.push(e); break; }
      }
      for (const e of entries) {
        if (selected && e.id !== selected.id) {
          decisionStats.groupDropped++;
          traceDetail('worldbook', 'worldbook.drop', `${e.id} dropped: same group as ${selected.id}`, {
            entryId: e.id,
            selectedEntryId: selected.id,
            reason: 'inclusionGroup',
            inclusionGroup: e.inclusionGroup,
            groupWeight: e.groupWeight,
          }, scanTraceId);
        }
      }
    }
  }

  const sorted = result.sort((a, b) => a.orderNum - b.orderNum);
  decisionStats.injected = sorted.length;
  traceSummary('worldbook', 'worldbook.summary', `${books.length} books / ${allEntries.length} entries / ${decisionStats.matched} matched / ${sorted.length} injected`, {
    ...decisionStats,
    bookCount: books.length,
    entryCount: allEntries.length,
    injectedIds: sorted.map(e => e.id),
    byPosition: sorted.reduce((acc, entry) => {
      const pos = entry.position || 'system-bottom';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  });

  return sorted;
}

// ════════════════════════════════════════════════════════════════
// 事件池：获取事件条目（供 life 生成）
// ════════════════════════════════════════════════════════════════

export function getEventPoolEntries(charId: string | null): WbEventEntry[] {
  const db = getDrizzle();

  const books = db.select().from(worldbooks)
    .where(eq(worldbooks.enabled, 1))
    .all()
    .filter(b => b.scope === 'global' || b.boundId === charId);

  if (books.length === 0) return [];
  const bookIds = books.map(b => b.id);

  return db.select().from(worldbookEventEntries)
    .where(and(
      eq(worldbookEventEntries.enabled, 1),
      inArray(worldbookEventEntries.worldbookId, bookIds),
    ))
    .all();
}
