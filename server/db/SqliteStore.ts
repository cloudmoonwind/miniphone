// ============================================================
// server/db/SqliteStore.ts
// 通用 SQLite 存储，实现与 FileStore 完全相同的 IFileStore<T> 接口。
// 每张表结构：id TEXT, char_id TEXT, data TEXT (JSON blob), created_at TEXT
// 所有路由层代码无需改动。
// ============================================================

import type Database from 'better-sqlite3';
import type { IFileStore } from '../types.js';

// 单条数据库行
interface Row {
  id: string;
  char_id: string | null;
  data: string;
  created_at: string | null;
}

// 随机短码生成（同 FileStore 风格）
function shortId(): string {
  return Math.random().toString(36).slice(2, 6);
}

export class SqliteStore<T extends { id: string }> implements IFileStore<T> {
  private db: Database.Database;
  private table: string;         // SQLite 表名
  private singleton: boolean;    // 单对象模式（active 等）
  private defaultVal: T | null;  // 单对象模式的默认值

  constructor(
    db: Database.Database,
    table: string,
    options?: { singleton?: boolean; defaultValue?: T }
  ) {
    this.db = db;
    this.table = table;
    this.singleton = options?.singleton ?? false;
    this.defaultVal = options?.defaultValue ?? null;
    this.initTable();
  }

  // ── 建表 ────────────────────────────────────────────────────
  private initTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${this.table}" (
        id         TEXT PRIMARY KEY,
        char_id    TEXT,
        data       TEXT NOT NULL,
        created_at TEXT
      )
    `);
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS "idx_${this.table}_char_id" ON "${this.table}"(char_id)`
    );
  }

  // ── 内部工具 ─────────────────────────────────────────────────
  private parse(row: Row): T {
    return JSON.parse(row.data) as T;
  }

  private extractCharId(item: T): string | null {
    return (item as any).charId ?? null;
  }

  // ── getAll ───────────────────────────────────────────────────
  async getAll(filter?: ((item: T) => boolean) | null): Promise<T[]> {
    const rows = this.db
      .prepare<[], Row>(`SELECT * FROM "${this.table}" ORDER BY created_at ASC`)
      .all();
    const items = rows.map(r => this.parse(r));
    return filter ? items.filter(filter) : items;
  }

  // ── getById ──────────────────────────────────────────────────
  async getById(id: string): Promise<T | null> {
    const row = this.db
      .prepare<[string], Row>(`SELECT * FROM "${this.table}" WHERE id = ?`)
      .get(id);
    return row ? this.parse(row) : null;
  }

  // ── getObject（单对象模式）──────────────────────────────────
  async getObject(): Promise<T> {
    const row = this.db
      .prepare<[], Row>(`SELECT * FROM "${this.table}" LIMIT 1`)
      .get();
    if (!row) {
      if (this.defaultVal) return this.defaultVal;
      throw new Error(`SqliteStore(${this.table}): no object found`);
    }
    return this.parse(row);
  }

  // ── create ───────────────────────────────────────────────────
  async create(item: Partial<T>): Promise<T> {
    const now = new Date().toISOString();
    const newItem = {
      id: `${this.table}_${Date.now()}_${shortId()}`,
      createdAt: now,
      ...item,
    } as unknown as T;
    this.db
      .prepare<[string, string | null, string, string]>(
        `INSERT INTO "${this.table}" (id, char_id, data, created_at) VALUES (?, ?, ?, ?)`
      )
      .run(newItem.id, this.extractCharId(newItem), JSON.stringify(newItem), now);
    return newItem;
  }

  // ── update ───────────────────────────────────────────────────
  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch } as T;
    this.db
      .prepare<[string, string | null, string]>(
        `UPDATE "${this.table}" SET data = ?, char_id = ? WHERE id = ?`
      )
      .run(JSON.stringify(updated), this.extractCharId(updated), id);
    return updated;
  }

  // ── delete ───────────────────────────────────────────────────
  async delete(id: string): Promise<boolean> {
    const result = this.db
      .prepare<[string]>(`DELETE FROM "${this.table}" WHERE id = ?`)
      .run(id);
    return result.changes > 0;
  }

  // ── deleteMany ───────────────────────────────────────────────
  async deleteMany(filter: (item: T) => boolean): Promise<number> {
    const all = await this.getAll();
    const toDelete = all.filter(filter);
    const stmt = this.db.prepare<[string]>(`DELETE FROM "${this.table}" WHERE id = ?`);
    const deleteAll = this.db.transaction((ids: string[]) => {
      for (const id of ids) stmt.run(id);
    });
    deleteAll(toDelete.map(i => i.id));
    return toDelete.length;
  }

  // ── setObject（单对象模式）──────────────────────────────────
  async setObject(obj: T): Promise<T> {
    const now = new Date().toISOString();
    this.db
      .prepare<[string, string | null, string, string]>(`
        INSERT INTO "${this.table}" (id, char_id, data, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, char_id = excluded.char_id
      `)
      .run('singleton', this.extractCharId(obj), JSON.stringify(obj), now);
    return obj;
  }
}
