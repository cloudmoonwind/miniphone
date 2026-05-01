import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { backupDatabase } from './db-backup.js';
import {
  COPY_TABLES,
  DB_PATH,
  MIGRATIONS_PATH,
} from './db-common.js';
import { buildHealthReport } from './db-health.js';
import * as schema from '../db/schema.js';

function q(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function tableExists(db: Database.Database, databaseName: 'main' | 'backup', table: string): boolean {
  const row = db.prepare(`
    SELECT name FROM ${databaseName}.sqlite_schema
    WHERE type = 'table' AND name = ?
  `).get(table);
  return Boolean(row);
}

function tableColumns(db: Database.Database, databaseName: 'main' | 'backup', table: string): string[] {
  return (db.prepare(`PRAGMA ${databaseName}.table_info(${q(table)})`).all() as Array<{ name: string }>).map(row => row.name);
}

function copyCommonColumns(db: Database.Database, table: string): void {
  if (!tableExists(db, 'backup', table) || !tableExists(db, 'main', table)) return;
  const mainColumns = new Set(tableColumns(db, 'main', table));
  const backupColumns = tableColumns(db, 'backup', table);
  const common = backupColumns.filter(column => mainColumns.has(column));
  if (!common.length) return;

  const columnList = common.map(q).join(', ');
  db.prepare(`
    INSERT OR IGNORE INTO ${q(table)} (${columnList})
    SELECT ${columnList} FROM backup.${q(table)}
  `).run();
}

function copyCharactersFromBlob(db: Database.Database): void {
  db.prepare(`
    INSERT OR IGNORE INTO characters
      (id, name, avatar, tags, group_name, core, persona, description, sample, timezone, api_preset_id, is_favorite, is_blacklisted, created_at, updated_at, metadata)
    SELECT
      CAST(json_extract(data, '$.id') AS TEXT),
      COALESCE(json_extract(data, '$.name'), ''),
      json_extract(data, '$.avatar'),
      json_extract(data, '$.tags'),
      json_extract(data, '$.group'),
      COALESCE(json_extract(data, '$.core'), ''),
      json_extract(data, '$.persona'),
      json_extract(data, '$.description'),
      json_extract(data, '$.sample'),
      json_extract(data, '$.timezone'),
      json_extract(data, '$.apiPresetId'),
      COALESCE(json_extract(data, '$.isFavorite'), 0),
      COALESCE(json_extract(data, '$.isBlacklisted'), 0),
      COALESCE(json_extract(data, '$.createdAt'), created_at, datetime('now')),
      json_extract(data, '$.updatedAt'),
      data
    FROM backup.characters
    WHERE json_valid(data) AND json_extract(data, '$.id') IS NOT NULL
  `).run();
}

function copyMessagesFromBlob(db: Database.Database): void {
  db.prepare(`
    INSERT OR IGNORE INTO messages
      (id, char_id, persona_id, sender, role, content, mode, timestamp, user_timestamp, char_timestamp, variable_snapshot, created_at, metadata)
    SELECT
      CAST(json_extract(data, '$.id') AS TEXT),
      json_extract(data, '$.charId'),
      json_extract(data, '$.personaId'),
      COALESCE(json_extract(data, '$.sender'), json_extract(data, '$.role'), 'user'),
      json_extract(data, '$.role'),
      COALESCE(json_extract(data, '$.content'), ''),
      COALESCE(json_extract(data, '$.mode'), 'online'),
      COALESCE(json_extract(data, '$.timestamp'), json_extract(data, '$.createdAt'), created_at, datetime('now')),
      json_extract(data, '$.userTimestamp'),
      json_extract(data, '$.charTimestamp'),
      json_extract(data, '$.variableSnapshot'),
      COALESCE(json_extract(data, '$.createdAt'), json_extract(data, '$.timestamp'), created_at, datetime('now')),
      data
    FROM backup.messages
    WHERE json_valid(data) AND json_extract(data, '$.id') IS NOT NULL
  `).run();
}

function copySummariesFromBlob(db: Database.Database): void {
  db.prepare(`
    INSERT OR IGNORE INTO summaries
      (id, char_id, persona_id, type, level, content, date, message_ids, source_ids, start_msg_id, importance, keywords, period, created_at, metadata)
    SELECT
      CAST(json_extract(data, '$.id') AS TEXT),
      json_extract(data, '$.charId'),
      json_extract(data, '$.personaId'),
      COALESCE(json_extract(data, '$.type'), json_extract(data, '$.level'), 'summary'),
      json_extract(data, '$.level'),
      COALESCE(json_extract(data, '$.content'), ''),
      json_extract(data, '$.date'),
      json_extract(data, '$.messageIds'),
      json_extract(data, '$.sourceIds'),
      json_extract(data, '$.startMsgId'),
      json_extract(data, '$.importance'),
      json_extract(data, '$.keywords'),
      json_extract(data, '$.period'),
      COALESCE(json_extract(data, '$.createdAt'), created_at, datetime('now')),
      data
    FROM backup.summaries
    WHERE json_valid(data) AND json_extract(data, '$.id') IS NOT NULL
  `).run();
}

function copyMemoriesFromBlob(db: Database.Database): void {
  db.prepare(`
    INSERT OR IGNORE INTO memories
      (id, char_id, content, text_alias, type, category, source, source_id, tags, importance, timestamp, created_at, metadata)
    SELECT
      CAST(json_extract(data, '$.id') AS TEXT),
      json_extract(data, '$.charId'),
      COALESCE(json_extract(data, '$.content'), json_extract(data, '$.text'), ''),
      json_extract(data, '$.text'),
      json_extract(data, '$.type'),
      json_extract(data, '$.category'),
      json_extract(data, '$.source'),
      json_extract(data, '$.sourceId'),
      json_extract(data, '$.tags'),
      json_extract(data, '$.importance'),
      json_extract(data, '$.timestamp'),
      COALESCE(json_extract(data, '$.createdAt'), created_at, datetime('now')),
      data
    FROM backup.memories
    WHERE json_valid(data) AND json_extract(data, '$.id') IS NOT NULL
  `).run();
}

function copyCoreTable(db: Database.Database, table: string, fromBlob: (db: Database.Database) => void): void {
  if (!tableExists(db, 'backup', table)) return;
  const backupColumns = new Set(tableColumns(db, 'backup', table));
  if (backupColumns.has('data')) {
    fromBlob(db);
  } else {
    copyCommonColumns(db, table);
  }
}

async function seedDatabase(): Promise<void> {
  const { seedAllCharacters } = await import('../services/seed.js');
  const { closeDb } = await import('../db/database.js');
  await seedAllCharacters();
  closeDb();
}

export async function resetDevDatabase(): Promise<void> {
  console.log('[db:reset] backing up current database');
  const backup = await backupDatabase();
  console.log(`[db:reset] backup created: ${backup.dir}`);

  for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
    if (existsSync(file)) unlinkSync(file);
  }
  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  console.log('[db:reset] applying migrations');
  migrate(drizzle(db, { schema }), { migrationsFolder: MIGRATIONS_PATH });

  db.pragma('foreign_keys = OFF');
  db.exec(`ATTACH DATABASE ${sqlString(backup.sqliteBackup)} AS backup`);

  console.log('[db:reset] migrating test data from backup');
  db.transaction(() => {
    copyCoreTable(db, 'characters', copyCharactersFromBlob);
    copyCoreTable(db, 'messages', copyMessagesFromBlob);
    copyCoreTable(db, 'summaries', copySummariesFromBlob);
    copyCoreTable(db, 'memories', copyMemoriesFromBlob);

    for (const table of COPY_TABLES) copyCommonColumns(db, table);
  })();

  db.exec('DETACH DATABASE backup');
  db.pragma('foreign_keys = ON');
  db.close();

  console.log('[db:reset] running seed');
  await seedDatabase();

  const report = buildHealthReport(DB_PATH);
  const reportPath = join(dirname(DB_PATH), 'health-latest.md');
  writeFileSync(reportPath, report.sections.join('\n'), 'utf8');

  console.log(`[db:reset] health report: ${reportPath}`);
  if (!report.ok) {
    console.log('[db:reset] health check completed with warnings');
  } else {
    console.log('[db:reset] health check passed');
  }
}

resetDevDatabase().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
