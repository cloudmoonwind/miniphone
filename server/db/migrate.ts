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
