/**
 * 一次性迁移脚本：把旧 FileStore JSON (.bak) 数据导入 SQLite
 * 运行：node migrate-from-json.cjs
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const db   = new Database(path.join(DATA, 'ics.db'));

// ── 工具函数 ────────────────────────────────────────────────────
function readBak(rel) {
  const full = path.join(DATA, rel);
  if (!fs.existsSync(full)) { console.log(`  skip (not found): ${rel}`); return []; }
  try {
    const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
    return Array.isArray(raw) ? raw : Object.values(raw);
  } catch (e) {
    console.log(`  skip (parse error): ${rel} — ${e.message}`);
    return [];
  }
}

function insertBlobs(table, items) {
  if (!items.length) return 0;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO "${table}" (id, char_id, data, created_at) VALUES (?, ?, ?, ?)`
  );
  db.transaction(() => {
    for (const item of items) {
      stmt.run(
        String(item.id),
        item.charId ?? null,
        JSON.stringify(item),
        item.createdAt ?? item.timestamp ?? new Date().toISOString()
      );
    }
  })();
  return items.length;
}

// ── Blob 表迁移（SqliteStore 格式，id/char_id/data/created_at）──
const BLOB_TABLES = [
  ['chars/characters.json.bak',           'characters'],
  ['chars/char_stats.json.bak',           'char_stats'],
  ['chars/life.json.bak',                 'life'],
  ['chars/stat_defs.json.bak',            'stat_defs'],
  ['chardata/dreams.json.bak',            'dreams'],
  ['chardata/items.json.bak',             'items'],
  ['chardata/memories.json.bak',          'memories'],
  ['chardata/relations.json.bak',         'relations'],
  ['chardata/skills.json.bak',            'skills'],
  ['chardata/timeline.json.bak',          'timeline'],
  ['chat/messages.json.bak',              'messages'],
  ['chat/summaries.json.bak',             'summaries'],
  ['presets.json.bak',                    'presets'],
  ['prompt_presets.json.bak',             'prompt_presets'],
  ['user/maps.json.bak',                  'maps'],
  ['user/personas.json.bak',              'personas'],
  ['apps/calendar_events.json.bak',       'calendar_events'],
  ['apps/dafu_game.json.bak',             'dafu_game'],
  ['apps/diary.json.bak',                 'diary'],
  ['apps/suixiang_cards.json.bak',        'suixiang_cards'],
  ['apps/suixiang_entries.json.bak',      'suixiang_entries'],
];

console.log('\n=== Blob 表迁移 ===');
for (const [file, table] of BLOB_TABLES) {
  const items = readBak(file);
  const n = insertBlobs(table, items);
  if (n) console.log(`  ${table}: ${n} 条`);
}

// ── active 单对象迁移 ────────────────────────────────────────────
console.log('\n=== active 单对象 ===');
['system/active.json.bak', 'active.json.bak'].forEach(rel => {
  const full = path.join(DATA, rel);
  if (!fs.existsSync(full)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
    const obj = Array.isArray(raw) ? raw[0] : raw;
    if (!obj) return;
    const existing = db.prepare(`SELECT id FROM "active" LIMIT 1`).get();
    if (existing) { console.log(`  active: already exists, skip`); return; }
    db.prepare(`INSERT OR IGNORE INTO "active" (id, char_id, data, created_at) VALUES (?, ?, ?, ?)`)
      .run('singleton', null, JSON.stringify({ ...obj, id: 'singleton' }), new Date().toISOString());
    console.log(`  active: ok (from ${rel})`);
  } catch (e) {
    console.log(`  active: skip — ${e.message}`);
  }
});

// ── 世界书迁移（列式表，需字段映射）───────────────────────────────
console.log('\n=== 世界书迁移 ===');
const wbBooks   = readBak('worldbook/wb_books.json.bak');
const wbEntries = readBak('worldbook/wb_entries.json.bak');

if (wbBooks.length) {
  const stmtBook = db.prepare(`
    INSERT OR IGNORE INTO worldbooks
      (id, name, enabled, priority, scope, bound_id, scan_depth, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const b of wbBooks) {
      stmtBook.run(
        b.id, b.name,
        b.enabled ? 1 : 0,
        b.priority ?? 0,
        b.charId ? 'character' : 'global',
        b.charId ?? null,
        b.scanDepth ?? 20,
        b.description ?? null,
        b.createdAt ?? new Date().toISOString(),
        b.updatedAt ?? new Date().toISOString()
      );
    }
  })();
  console.log(`  worldbooks: ${wbBooks.length} 条`);
}

if (wbEntries.length) {
  const stmtEntry = db.prepare(`
    INSERT OR IGNORE INTO worldbook_entries
      (id, worldbook_id, memo, content, enabled, strategy, keywords, position, order_num, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const e of wbEntries) {
      stmtEntry.run(
        e.id,
        e.bookId,
        e.name ?? null,
        e.content ?? '',
        e.enabled ? 1 : 0,
        e.activationMode ?? 'keyword',
        JSON.stringify(e.keywords ?? []),
        e.insertionPosition ?? 'system-bottom',
        e.priority ?? 0,
        e.createdAt ?? new Date().toISOString(),
        e.updatedAt ?? new Date().toISOString()
      );
    }
  })();
  console.log(`  worldbook_entries: ${wbEntries.length} 条`);
}

// ── 汇总 ─────────────────────────────────────────────────────────
console.log('\n=== 验证 ===');
for (const table of ['characters', 'messages', 'presets', 'prompt_presets', 'worldbooks', 'worldbook_entries', 'personas']) {
  try {
    const row = db.prepare(`SELECT COUNT(*) as n FROM "${table}"`).get();
    console.log(`  ${table}: ${row.n} 条`);
  } catch {}
}

db.close();
console.log('\n迁移完成！重启服务器后数据应恢复正常。');
