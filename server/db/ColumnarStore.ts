import type Database from 'better-sqlite3';
import type { IFileStore } from '../types.js';

type ColumnKind = 'string' | 'number' | 'boolean' | 'json';

interface ColumnSpec {
  prop: string;
  column: string;
  kind?: ColumnKind;
  required?: boolean;
  defaultValue?: unknown;
}

interface ColumnarStoreOptions {
  orderBy?: string;
  defaultValue?: any;
}

interface Row {
  [key: string]: unknown;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 6);
}

function q(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function parseJson(raw: unknown): unknown {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function encodeValue(value: unknown, kind: ColumnKind = 'string'): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (kind === 'json') return JSON.stringify(value);
  if (kind === 'boolean') return value ? 1 : 0;
  if (kind === 'number') return Number(value);
  return value;
}

function decodeValue(value: unknown, kind: ColumnKind = 'string'): unknown {
  if (value === undefined || value === null) return undefined;
  if (kind === 'json') return parseJson(value);
  if (kind === 'boolean') return Boolean(value);
  if (kind === 'number') return Number(value);
  return value;
}

export class ColumnarStore<T extends { id: string }> implements IFileStore<T> {
  private readonly db: Database.Database;
  private readonly table: string;
  private readonly columns: ColumnSpec[];
  private readonly orderBy: string;
  private readonly defaultVal: T | null;
  private readonly explicitProps: Set<string>;

  constructor(
    db: Database.Database,
    table: string,
    columns: ColumnSpec[],
    options?: ColumnarStoreOptions,
  ) {
    this.db = db;
    this.table = table;
    this.columns = columns;
    this.orderBy = options?.orderBy ?? 'created_at ASC';
    this.defaultVal = options?.defaultValue ?? null;
    this.explicitProps = new Set(columns.map(c => c.prop));
    this.assertTable();
  }

  private assertTable(): void {
    const table = this.db
      .prepare<[string], { name: string }>("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?")
      .get(this.table);
    if (!table) {
      throw new Error(`ColumnarStore(${this.table}): table is missing. Run database migrations first.`);
    }

    const existing = new Set(
      this.db.prepare(`PRAGMA table_info(${q(this.table)})`).all().map((row: any) => row.name),
    );
    const missing = this.columns.map(c => c.column).filter(column => !existing.has(column));
    if (missing.length) {
      throw new Error(`ColumnarStore(${this.table}): missing columns ${missing.join(', ')}. Run dev reset or migrations.`);
    }
  }

  private rowToItem(row: Row): T {
    const metadata = parseJson(row.metadata);
    const item: Record<string, unknown> =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? { ...(metadata as Record<string, unknown>) }
        : {};

    for (const spec of this.columns) {
      const value = decodeValue(row[spec.column], spec.kind);
      if (value !== undefined) item[spec.prop] = value;
    }

    return item as T;
  }

  private itemToRecord(item: T): Record<string, unknown> {
    const record: Record<string, unknown> = {};

    for (const spec of this.columns) {
      const value = (item as any)[spec.prop] ?? spec.defaultValue;
      if (spec.required && (value === undefined || value === null)) {
        throw new Error(`ColumnarStore(${this.table}): ${spec.prop} is required`);
      }
      record[spec.column] = encodeValue(value, spec.kind);
    }

    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item as any)) {
      if (!this.explicitProps.has(key) && value !== undefined) metadata[key] = value;
    }
    record.metadata = Object.keys(metadata).length ? JSON.stringify(metadata) : null;

    return record;
  }

  async getAll(filter?: ((item: T) => boolean) | null): Promise<T[]> {
    const rows = this.db
      .prepare<[], Row>(`SELECT * FROM ${q(this.table)} ORDER BY ${this.orderBy}`)
      .all();
    const items = rows.map(row => this.rowToItem(row));
    return filter ? items.filter(filter) : items;
  }

  async getById(id: string): Promise<T | null> {
    const row = this.db
      .prepare<[string], Row>(`SELECT * FROM ${q(this.table)} WHERE id = ?`)
      .get(id);
    return row ? this.rowToItem(row) : null;
  }

  async getObject(): Promise<T> {
    const row = this.db
      .prepare<[], Row>(`SELECT * FROM ${q(this.table)} LIMIT 1`)
      .get();
    if (!row) {
      if (this.defaultVal) return this.defaultVal;
      throw new Error(`ColumnarStore(${this.table}): no object found`);
    }
    return this.rowToItem(row);
  }

  async create(item: Partial<T>): Promise<T> {
    const now = new Date().toISOString();
    const newItem = {
      id: `${this.table}_${Date.now()}_${shortId()}`,
      createdAt: now,
      ...item,
    } as unknown as T;

    const record = this.itemToRecord(newItem);
    const columns = Object.keys(record);
    const sql = `INSERT INTO ${q(this.table)} (${columns.map(q).join(', ')}) VALUES (${columns.map(c => `@${c}`).join(', ')})`;
    this.db.prepare(sql).run(record);
    return newItem;
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updated = { ...existing, ...patch } as T;
    const record = this.itemToRecord(updated);
    const columns = Object.keys(record).filter(column => column !== 'id');
    const sql = `UPDATE ${q(this.table)} SET ${columns.map(c => `${q(c)} = @${c}`).join(', ')} WHERE id = @id`;
    this.db.prepare(sql).run({ ...record, id });
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db
      .prepare<[string]>(`DELETE FROM ${q(this.table)} WHERE id = ?`)
      .run(id);
    return result.changes > 0;
  }

  async deleteMany(filter: (item: T) => boolean): Promise<number> {
    const all = await this.getAll();
    const toDelete = all.filter(filter);
    const stmt = this.db.prepare<[string]>(`DELETE FROM ${q(this.table)} WHERE id = ?`);
    const deleteAll = this.db.transaction((ids: string[]) => {
      for (const id of ids) stmt.run(id);
    });
    deleteAll(toDelete.map(item => item.id));
    return toDelete.length;
  }

  async setObject(obj: T): Promise<T> {
    const existing = await this.getById(obj.id);
    if (existing) {
      await this.update(obj.id, obj);
      return obj;
    }
    return this.create(obj);
  }
}
