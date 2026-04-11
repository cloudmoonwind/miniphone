// ============================================================
// server/db/database.ts
// SQLite 数据库连接单例
// 使用 better-sqlite3（同步接口，WAL 模式）
// ============================================================

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../data/ics.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');  // 写时复制，提高并发读取性能
    _db.pragma('foreign_keys = ON');
    _db.pragma('synchronous = NORMAL'); // 比 FULL 快，比 OFF 安全
    initSpecialTables(_db);
  }
  return _db;
}

// ── 有明确列结构的专用表（不走 blob 存储）──────────────────────
// sessions：记录每个角色的数据"文件"（聊天存档、梦境、生活时间线等）
// messages 通过 session_id 关联到某个聊天 session，支持一角色多存档
function initSpecialTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      char_id     TEXT NOT NULL,
      type        TEXT NOT NULL,   -- 'chat' | 'dream' | 'life' | 'dafu' | 'timeline' | 'memory' | ...
      name        TEXT,            -- 用户自定义名称（null 时显示自动名如"存档 1"）
      is_active   INTEGER DEFAULT 1, -- 0/1，是否为当前激活存档
      created_at  TEXT NOT NULL,
      updated_at  TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_char_id ON sessions(char_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_type    ON sessions(type)`);
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
