// ============================================================
// server/db/database.ts
// SQLite 数据库连接单例
// 使用 better-sqlite3（同步接口，WAL 模式）
// Schema 变更通过 drizzle-kit generate → db/migrations/ 管理
// ============================================================

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH         = resolve(__dirname, '../data/ics.db');
const MIGRATIONS_PATH = resolve(__dirname, './migrations');

let _db: Database.Database | null = null;
let _drizzle: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('synchronous = NORMAL');
    runMigrations(_db);
  }
  return _db;
}

export function getDrizzle() {
  if (!_drizzle) {
    _drizzle = drizzle(getDb(), { schema });
  }
  return _drizzle;
}

function runMigrations(db: Database.Database): void {
  const orm = drizzle(db, { schema });
  migrate(orm, { migrationsFolder: MIGRATIONS_PATH });
  console.log('[db] migrations applied');
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    _drizzle = null;
  }
}
