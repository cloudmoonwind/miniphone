// ============================================================
// server/db/database.ts
// SQLite 数据库连接单例
// 使用 better-sqlite3（同步接口，WAL 模式）
// Drizzle ORM 用于新列式表（数值系统/事件系统/世界状态）
// ============================================================

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../data/ics.db');

let _db: Database.Database | null = null;
let _drizzle: ReturnType<typeof drizzle> | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('synchronous = NORMAL');
    initSpecialTables(_db);
    initDrizzleTables(_db);
  }
  return _db;
}

/** 获取 Drizzle 实例（用于列式表的类型安全查询） */
export function getDrizzle() {
  if (!_drizzle) {
    _drizzle = drizzle(getDb(), { schema });
  }
  return _drizzle;
}

// ── sessions 表（blob 体系的专用列式表）──────────────────────
function initSpecialTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      char_id     TEXT NOT NULL,
      type        TEXT NOT NULL,
      name        TEXT,
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT NOT NULL,
      updated_at  TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_char_id ON sessions(char_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_type    ON sessions(type)`);
}

// ── 数值系统 / 事件系统 / 世界状态表 ────────────────────────
function initDrizzleTables(db: Database.Database): void {
  // 数值系统
  db.exec(`
    CREATE TABLE IF NOT EXISTS character_values (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id    TEXT NOT NULL,
      category        TEXT NOT NULL,
      name            TEXT NOT NULL,
      variable_name   TEXT NOT NULL,
      current_value   REAL NOT NULL DEFAULT 0,
      min_value       REAL NOT NULL DEFAULT 0,
      max_value       REAL NOT NULL DEFAULT 100,
      created_at      TEXT NOT NULL,
      updated_at      TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cv_char_id ON character_values(character_id)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cv_char_var ON character_values(character_id, variable_name)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS value_stages (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      value_id        INTEGER NOT NULL REFERENCES character_values(id) ON DELETE CASCADE,
      range_min       REAL NOT NULL,
      range_max       REAL NOT NULL,
      stage_name      TEXT NOT NULL,
      description     TEXT,
      prompt_snippet  TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_vs_value_id ON value_stages(value_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS value_rules (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      value_id        INTEGER NOT NULL REFERENCES character_values(id) ON DELETE CASCADE,
      range_min       REAL,
      range_max       REAL,
      trigger_on      TEXT NOT NULL,
      conditions      TEXT,
      operation       TEXT NOT NULL,
      amount          REAL NOT NULL,
      enabled         INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_vr_value_id ON value_rules(value_id)`);

  // 事件系统
  db.exec(`
    CREATE TABLE IF NOT EXISTS event_books (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT,
      scope         TEXT NOT NULL DEFAULT 'global',
      character_id  TEXT,
      enabled       INTEGER NOT NULL DEFAULT 1,
      priority      INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      updated_at    TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_eb_char_id ON event_books(character_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_eb_scope   ON event_books(scope)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id                          TEXT PRIMARY KEY,
      book_id                     TEXT REFERENCES event_books(id) ON DELETE SET NULL,
      character_id                TEXT,
      name                        TEXT NOT NULL,
      description                 TEXT,
      status                      TEXT NOT NULL DEFAULT 'locked',
      priority                    INTEGER NOT NULL DEFAULT 0,
      probability                 INTEGER NOT NULL DEFAULT 100,
      weight                      INTEGER NOT NULL DEFAULT 100,
      repeatable                  INTEGER NOT NULL DEFAULT 0,
      max_triggers                INTEGER,
      trigger_count               INTEGER NOT NULL DEFAULT 0,
      unlock_conditions           TEXT,
      trigger_conditions          TEXT,
      effects                     TEXT,
      cooldown_type               TEXT DEFAULT 'none',
      cooldown_value              INTEGER DEFAULT 0,
      cooldown_remaining          INTEGER DEFAULT 0,
      condition_cooldown          INTEGER DEFAULT 0,
      condition_cooldown_remaining INTEGER DEFAULT 0,
      steps                       TEXT,
      current_step                TEXT,
      created_at                  TEXT NOT NULL,
      last_triggered_at           TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_events_char_id ON events(character_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_events_status  ON events(status)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_tags (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      tag_type    TEXT NOT NULL,
      tag_value   TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_et_event_id ON event_tags(event_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_connections (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      from_event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      to_event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      relation_type   TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ec_from ON event_connections(from_event_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ec_to   ON event_connections(to_event_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS condition_subscriptions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id          TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      condition_type    TEXT NOT NULL,
      condition_target  TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cs_event_id ON condition_subscriptions(event_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cs_type_target ON condition_subscriptions(condition_type, condition_target)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_injections (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id      TEXT NOT NULL,
      source_event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      content           TEXT NOT NULL,
      position          TEXT NOT NULL,
      depth_value       INTEGER,
      duration_type     TEXT NOT NULL,
      duration_value    TEXT,
      remaining_turns   INTEGER,
      created_at        TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pi_char_id ON pending_injections(character_id)`);

  // 世界书
  db.exec(`
    CREATE TABLE IF NOT EXISTS worldbooks (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      priority    INTEGER NOT NULL DEFAULT 0,
      scope       TEXT NOT NULL DEFAULT 'global',
      bound_id    TEXT,
      scan_depth  INTEGER NOT NULL DEFAULT 20,
      description TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS worldbook_entries (
      id                  TEXT PRIMARY KEY,
      worldbook_id        TEXT NOT NULL REFERENCES worldbooks(id) ON DELETE CASCADE,
      memo                TEXT,
      content             TEXT NOT NULL DEFAULT '',
      enabled             INTEGER NOT NULL DEFAULT 1,
      strategy            TEXT NOT NULL DEFAULT 'constant',
      probability         INTEGER NOT NULL DEFAULT 100,
      keywords            TEXT,
      filter_keywords     TEXT,
      filter_logic        TEXT DEFAULT 'AND_ANY',
      scan_depth          INTEGER,
      case_sensitive      INTEGER NOT NULL DEFAULT 0,
      match_whole_word    INTEGER NOT NULL DEFAULT 0,
      position            TEXT NOT NULL DEFAULT 'system-bottom',
      depth               INTEGER NOT NULL DEFAULT 0,
      order_num           INTEGER NOT NULL DEFAULT 0,
      no_recurse          INTEGER NOT NULL DEFAULT 0,
      no_further_recurse  INTEGER NOT NULL DEFAULT 0,
      inclusion_group     TEXT,
      group_weight        INTEGER NOT NULL DEFAULT 100,
      sticky              INTEGER NOT NULL DEFAULT 0,
      cooldown            INTEGER NOT NULL DEFAULT 0,
      delay               INTEGER NOT NULL DEFAULT 0,
      character_filter    TEXT,
      filter_mode         TEXT DEFAULT 'include',
      created_at          TEXT NOT NULL,
      updated_at          TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wbe_worldbook_id ON worldbook_entries(worldbook_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS worldbook_event_entries (
      id                TEXT PRIMARY KEY,
      worldbook_id      TEXT NOT NULL REFERENCES worldbooks(id) ON DELETE CASCADE,
      memo              TEXT,
      content           TEXT NOT NULL DEFAULT '',
      enabled           INTEGER NOT NULL DEFAULT 1,
      event_type        TEXT NOT NULL DEFAULT 'random',
      probability       INTEGER NOT NULL DEFAULT 100,
      weight            INTEGER NOT NULL DEFAULT 1,
      condition_stat    TEXT,
      condition_op      TEXT,
      condition_value   REAL,
      tags              TEXT,
      order_num         INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL,
      updated_at        TEXT
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_wbee_worldbook_id ON worldbook_event_entries(worldbook_id)`);

  // 兼容升级：给已存在的 events 表补新列（幂等，列已存在时会抛异常，忽略即可）
  const addIfMissing = (sql: string) => { try { db.exec(sql); } catch {} };
  addIfMissing(`ALTER TABLE events ADD COLUMN book_id TEXT REFERENCES event_books(id) ON DELETE SET NULL`);
  addIfMissing(`ALTER TABLE events ADD COLUMN weight INTEGER NOT NULL DEFAULT 100`);
  addIfMissing(`ALTER TABLE events ADD COLUMN outcome TEXT`);
  // character_id 在旧表是 NOT NULL，SQLite 不支持修改约束，保持现状即可（新事件允许 null）

  // 世界状态
  db.exec(`
    CREATE TABLE IF NOT EXISTS world_state (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )
  `);
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    _drizzle = null;
  }
}
