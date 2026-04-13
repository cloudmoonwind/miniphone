// ============================================================
// server/db/migrate.ts
// 一次性迁移脚本：把所有 server/data/**/*.json 导入 SQLite。
// 迁移完成后把 .json 文件改名为 .json.bak（保留备份，不删除）。
// 幂等：如果目标表已有数据则跳过，不重复导入。
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '../data');

// ── 需要迁移的清单 ───────────────────────────────────────────
// { table: SQLite 表名, file: 相对 DATA_ROOT 的 JSON 路径, singleton: 是单对象还是数组 }
const MIGRATIONS = [
  // 聊天
  { table: 'messages',         file: 'chat/messages.json',            singleton: false },
  { table: 'summaries',        file: 'chat/summaries.json',           singleton: false },
  // 角色主数据
  { table: 'characters',       file: 'chars/characters.json',         singleton: false },
  { table: 'char_stats',       file: 'chars/char_stats.json',         singleton: false },
  { table: 'stat_defs',        file: 'chars/stat_defs.json',          singleton: false },
  { table: 'life',             file: 'chars/life.json',               singleton: false },
  // 角色附属数据
  { table: 'items',            file: 'chardata/items.json',           singleton: false },
  { table: 'timeline',         file: 'chardata/timeline.json',        singleton: false },
  { table: 'skills',           file: 'chardata/skills.json',          singleton: false },
  { table: 'relations',        file: 'chardata/relations.json',       singleton: false },
  { table: 'memories',         file: 'chardata/memories.json',        singleton: false },
  { table: 'dreams',           file: 'chardata/dreams.json',          singleton: false },
  // 系统配置
  { table: 'presets',          file: 'system/presets.json',           singleton: false },
  { table: 'prompt_presets',   file: 'system/prompt_presets.json',    singleton: false },
  // 世界书
  { table: 'wb_books',         file: 'worldbook/wb_books.json',       singleton: false },
  { table: 'wb_entries',       file: 'worldbook/wb_entries.json',     singleton: false },
  // 用户数据
  { table: 'personas',         file: 'user/personas.json',            singleton: false },
  { table: 'maps',             file: 'user/maps.json',                singleton: false },
  // 各 App 数据
  { table: 'calendar_events',  file: 'apps/calendar_events.json',     singleton: false },
  { table: 'dafu_game',        file: 'apps/dafu_game.json',           singleton: false },
  { table: 'diary',            file: 'apps/diary.json',               singleton: false },
  { table: 'suixiang_cards',   file: 'apps/suixiang_cards.json',      singleton: false },
  { table: 'suixiang_entries', file: 'apps/suixiang_entries.json',    singleton: false },
  // 全局配置（单对象）
  { table: 'active',           file: 'system/active.json',            singleton: true  },
] as const;

// 遗留根目录 JSON（旧版留下的，不在存储清单里，只需改名即可）
const LEGACY_FILES = [
  'active.json',
  'presets.json',
  'prompt_presets.json',
];

// ── 主函数 ──────────────────────────────────────────────────
export async function runMigration(db: Database.Database): Promise<void> {
  let totalMigrated = 0;
  let totalSkipped  = 0;

  console.log('[migrate] 开始检查 JSON → SQLite 迁移...');

  // ── 世界书 blob→列式迁移 ──────────────────────────────────
  migrateWorldbookBlob(db);

  // ── worldbook_event_entries → events 迁移 ────────────────
  migrateWbEventEntriesToEvents(db);

  for (const m of MIGRATIONS) {
    const filePath = path.join(DATA_ROOT, m.file);

    // JSON 不存在 → 跳过（可能从未创建过）
    if (!fs.existsSync(filePath)) {
      continue;
    }

    // 检查 SQLite 表是否已有数据 → 幂等保护
    const count = (db.prepare(`SELECT COUNT(*) as c FROM "${m.table}"`).get() as { c: number }).c;
    if (count > 0) {
      console.log(`[migrate] SKIP  ${m.table} (已有 ${count} 条记录)`);
      totalSkipped++;
      renameToBackup(filePath);
      continue;
    }

    // 读取 JSON
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      console.warn(`[migrate] WARN  读取 ${m.file} 失败:`, e);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.warn(`[migrate] WARN  解析 ${m.file} 失败:`, e);
      continue;
    }

    if (m.singleton) {
      // 单对象模式：整个 JSON 是一个 config 对象
      migrateObject(db, m.table, parsed as Record<string, unknown>);
      console.log(`[migrate] OK    ${m.table} (singleton)`);
    } else {
      // 数组模式
      const items = Array.isArray(parsed) ? parsed as Record<string, unknown>[] : [];
      migrateArray(db, m.table, items);
      console.log(`[migrate] OK    ${m.table} (${items.length} 条)`);
    }

    totalMigrated++;
    renameToBackup(filePath);
  }

  // 处理遗留根目录文件（只改名，不导入，数据已在 system/ 子目录中）
  for (const f of LEGACY_FILES) {
    const fp = path.join(DATA_ROOT, f);
    if (fs.existsSync(fp)) {
      renameToBackup(fp);
      console.log(`[migrate] BAK   遗留文件 ${f}`);
    }
  }

  console.log(`[migrate] 迁移完成：${totalMigrated} 张表迁移，${totalSkipped} 张表跳过`);
}

// ── 插入数组数据 ─────────────────────────────────────────────
function migrateArray(
  db: Database.Database,
  table: string,
  items: Record<string, unknown>[]
): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO "${table}" (id, char_id, data, created_at) VALUES (?, ?, ?, ?)`
  );
  const insertAll = db.transaction((rows: Record<string, unknown>[]) => {
    for (const item of rows) {
      const id = String(item.id ?? `${table}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`);
      const charId = (item.charId as string | null | undefined) ?? null;
      const createdAt = (item.createdAt as string | null | undefined) ?? new Date().toISOString();
      insert.run(id, charId, JSON.stringify(item), createdAt);
    }
  });
  insertAll(items);
}

// ── 插入单对象数据 ───────────────────────────────────────────
function migrateObject(
  db: Database.Database,
  table: string,
  obj: Record<string, unknown>
): void {
  db.prepare(
    `INSERT OR IGNORE INTO "${table}" (id, char_id, data, created_at) VALUES (?, ?, ?, ?)`
  ).run('singleton', null, JSON.stringify(obj), new Date().toISOString());
}

// ── 世界书 blob→列式迁移 ─────────────────────────────────────
function migrateWorldbookBlob(db: Database.Database): void {
  // 检查旧 blob 表是否存在且有数据
  const hasOldBooks = (() => {
    try {
      const r = db.prepare(`SELECT COUNT(*) as c FROM wb_books`).get() as { c: number };
      return r.c > 0;
    } catch { return false; }
  })();
  if (!hasOldBooks) return;

  // 检查新表是否已有数据（幂等）
  const hasNew = (() => {
    try {
      const r = db.prepare(`SELECT COUNT(*) as c FROM worldbooks`).get() as { c: number };
      return r.c > 0;
    } catch { return false; }
  })();
  if (hasNew) {
    console.log('[migrate] SKIP  worldbook blob→column（新表已有数据）');
    return;
  }

  console.log('[migrate] 开始世界书 blob→列式迁移...');

  const oldBooks = db.prepare(`SELECT * FROM wb_books`).all() as { id: string; data: string }[];
  const oldEntries = db.prepare(`SELECT * FROM wb_entries`).all() as { id: string; data: string }[];

  const insertBook = db.prepare(`
    INSERT INTO worldbooks (id, name, enabled, priority, scope, bound_id, scan_depth, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEntry = db.prepare(`
    INSERT INTO worldbook_entries (id, worldbook_id, memo, content, enabled, strategy, probability,
      keywords, position, order_num, no_recurse, no_further_recurse, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEventEntry = db.prepare(`
    INSERT INTO worldbook_event_entries (id, worldbook_id, memo, content, enabled, event_type, probability,
      weight, condition_stat, condition_op, condition_value, tags, order_num, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const migrate = db.transaction(() => {
    let bookCount = 0;
    let entryCount = 0;
    let eventCount = 0;

    for (const row of oldBooks) {
      try {
        const b = JSON.parse(row.data);
        const now = b.createdAt || new Date().toISOString();
        insertBook.run(
          b.id, b.name || 'Untitled', b.enabled ? 1 : 0, 0,
          b.charId ? 'character' : 'global', b.charId || null,
          b.scanDepth ?? 20, b.description || null, now, now,
        );
        bookCount++;
      } catch (e) { console.warn('[migrate] WARN  跳过书:', row.id, e); }
    }

    for (const row of oldEntries) {
      try {
        const e = JSON.parse(row.data);
        const now = e.createdAt || new Date().toISOString();
        const isEvent = e.activationMode?.startsWith('event-');

        if (isEvent) {
          const cond = e.eventConfig?.condition;
          insertEventEntry.run(
            e.id, e.bookId, e.name || null, e.content || '', e.enabled ? 1 : 0,
            e.activationMode === 'event-conditional' ? 'conditional' : 'random',
            100, // probability
            e.eventConfig?.weight ?? e.weight ?? 1,
            cond?.stat || null, cond?.op || null, cond?.value ?? null,
            e.eventConfig?.tags ? JSON.stringify(e.eventConfig.tags) : null,
            e.priority ?? 0, now, now,
          );
          eventCount++;
        } else {
          const strategy = e.activationMode === 'keyword' ? 'keyword' : 'constant';
          insertEntry.run(
            e.id, e.bookId, e.name || null, e.content || '', e.enabled ? 1 : 0,
            strategy, 100, // probability
            e.keywords ? JSON.stringify(e.keywords) : null,
            e.insertionPosition || 'system-bottom',
            e.priority ?? 0,
            e.noRecurse ? 1 : 0, e.noFurtherRecurse ? 1 : 0,
            now, now,
          );
          entryCount++;
        }
      } catch (e) { console.warn('[migrate] WARN  跳过条目:', row.id, e); }
    }

    console.log(`[migrate] OK    worldbook: ${bookCount} 书, ${entryCount} 普通条目, ${eventCount} 事件条目`);
  });

  migrate();
}

// ── worldbook_event_entries → event_books + events 迁移 ──────
function migrateWbEventEntriesToEvents(db: Database.Database): void {
  // 检查源表是否存在且有数据
  const hasSource = (() => {
    try {
      const r = db.prepare(`SELECT COUNT(*) as c FROM worldbook_event_entries`).get() as { c: number };
      return r.c > 0;
    } catch { return false; }
  })();
  if (!hasSource) return;

  // 幂等：检查迁移出的事件是否已存在（通过 book_id 前缀判断，比仅检查 event_books 更准确）
  const alreadyMigrated = (() => {
    try {
      const r = db.prepare(
        `SELECT COUNT(*) as c FROM events WHERE book_id LIKE 'evtbook_%'`
      ).get() as { c: number };
      return r.c > 0;
    } catch { return false; }
  })();
  if (alreadyMigrated) {
    console.log('[migrate] SKIP  worldbook_event_entries→events（已迁移）');
    return;
  }

  console.log('[migrate] 开始 worldbook_event_entries → events 迁移...');

  // 查旧事件条目，联查世界书信息
  const oldEntries = db.prepare(`
    SELECT ee.*, wb.scope, wb.bound_id as wbBoundId, wb.name as wbName
    FROM worldbook_event_entries ee
    LEFT JOIN worldbooks wb ON wb.id = ee.worldbook_id
  `).all() as Array<{
    id: string; worldbook_id: string; memo: string | null; content: string;
    enabled: number; event_type: string; probability: number; weight: number;
    condition_stat: string | null; condition_op: string | null; condition_value: number | null;
    tags: string | null; order_num: number; created_at: string;
    scope: string | null; wbBoundId: string | null; wbName: string | null;
  }>;

  if (!oldEntries.length) return;

  // 按来源世界书分组，每本世界书创建一个事件书
  const bookMap = new Map<string, string>(); // worldbookId → eventBookId

  const insertBook = db.prepare(`
    INSERT OR IGNORE INTO event_books (id, name, description, scope, character_id, enabled, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
  `);
  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO events (
      id, book_id, character_id, name, description,
      status, priority, probability, weight,
      repeatable, max_triggers, trigger_count,
      trigger_conditions,
      cooldown_type, cooldown_value, cooldown_remaining,
      condition_cooldown, condition_cooldown_remaining,
      created_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, 1, NULL, 0, ?, 'none', 0, 0, 0, 0, ?)
  `);

  const migrate = db.transaction(() => {
    let bookCount = 0;
    let evtCount = 0;

    for (const e of oldEntries) {
      // 确保有对应的事件书
      if (!bookMap.has(e.worldbook_id)) {
        const bookId = `evtbook_${e.worldbook_id}`;
        const scope = e.scope === 'character' ? 'character' : 'global';
        const charId = e.wbBoundId || null;
        const now = e.created_at || new Date().toISOString();
        insertBook.run(
          bookId,
          e.wbName ? `${e.wbName}（事件）` : '迁移事件书',
          `[migrated-from-wbee] 从世界书 ${e.worldbook_id} 迁移`,
          scope, charId, now, now,
        );
        bookMap.set(e.worldbook_id, bookId);
        bookCount++;
      }

      const bookId = bookMap.get(e.worldbook_id)!;
      // 构建 trigger_conditions JSON（conditional 类型）
      let triggerCond: string | null = null;
      if (e.event_type === 'conditional' && e.condition_stat) {
        triggerCond = JSON.stringify({
          组间逻辑: '或',
          条件组: [{
            组内逻辑: '且',
            条件: [{
              类型: '数值',
              目标: e.condition_stat,
              比较: e.condition_op || '>=',
              值: e.condition_value ?? 0,
            }],
          }],
        });
      }

      // character_id：字符专属书用 wbBoundId，全局书暂用 '_global_'（兼容 NOT NULL 约束）
      const charId = e.wbBoundId || '_global_';
      insertEvent.run(
        e.id, bookId, charId,
        e.memo || '未命名事件', null,
        e.order_num ?? 0,
        e.probability ?? 100,
        e.weight ?? 100,
        triggerCond,
        e.created_at || new Date().toISOString(),
      );
      evtCount++;
    }

    console.log(`[migrate] OK    wbee→events: ${bookCount} 事件书, ${evtCount} 事件`);
  });

  migrate();
}

// ── 改名备份 ─────────────────────────────────────────────────
function renameToBackup(filePath: string): void {
  const bakPath = filePath + '.bak';
  try {
    // 如果 .bak 已存在，先删掉（防止 rename 失败）
    if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
    fs.renameSync(filePath, bakPath);
  } catch (e) {
    console.warn(`[migrate] WARN  改名失败 ${filePath}:`, e);
  }
}
