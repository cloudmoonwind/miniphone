import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '../data');

export const genId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    throw err;
  }
}

async function writeRaw(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── 文件级操作锁 ──────────────────────────────────────────────────────────
// 所有 mutating 操作（create/update/delete/setObject）都通过 withLock 串行。
// 这保证了 read-modify-write 的原子性：
//   操作 A 读旧数据 → 修改 → 写入 → 操作 B 再读（拿到 A 写后的新数据）
// 若只排队 write 而不排队 read，并发操作仍会互相覆盖。
const locks = new Map<string, Promise<void>>();

function withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(filePath) ?? Promise.resolve();
  const next = prev.then(fn);
  // 无论成功/失败都推进队列，防止一次错误卡死后续所有操作
  locks.set(filePath, next.catch(() => {}) as Promise<void>);
  return next;
}

// ─────────────────────────────────────────────────────────────────────────

/** 数组模式（默认）：存储条目列表，每条有 id */
export class FileStore<T extends Record<string, any> = Record<string, any>> {
  readonly filePath: string;
  readonly defaultValue: T | T[];
  private readonly _idPrefix: string;

  constructor(name: string, defaultValue: T | T[] = [] as unknown as T[]) {
    this.filePath = path.join(DATA_ROOT, `${name}.json`);
    this.defaultValue = defaultValue;
    // id 前缀映射（取路径最后一段）
    const baseName = name.split('/').pop() ?? name;
    const prefixMap: Record<string, string> = {
      characters: 'char', messages: 'msg', summaries: 'sum',
      memories: 'mem', dreams: 'drm', maps: 'map',
      presets: 'preset', prompt_presets: 'pp', life: 'life',
      wb_books: 'wb', wb_entries: 'wbe', stat_defs: 'sd',
      char_stats: 'cs', personas: 'persona', diary: 'diary',
      items: 'item', timeline: 'tl', skills: 'sk', relations: 'rel',
    };
    this._idPrefix = prefixMap[baseName] ?? 'item';
  }

  // ── 只读，不加锁（查询不应被写操作阻塞）────────────────────────────────

  async getAll(filter: ((item: T) => boolean) | null = null): Promise<T[]> {
    const data = await readJson<T[]>(this.filePath, this.defaultValue as T[]);
    return filter ? data.filter(filter) : data;
  }

  async getById(id: string): Promise<T | null> {
    const data = await readJson<T[]>(this.filePath, this.defaultValue as T[]);
    return data.find((item: any) => item.id === id) ?? null;
  }

  async getObject(): Promise<T> {
    return readJson<T>(this.filePath, this.defaultValue as T);
  }

  // ── 写操作：全部加锁，保证原子 read-modify-write ─────────────────────────

  async create(item: Partial<T>): Promise<T> {
    return withLock(this.filePath, async () => {
      const data = await readJson<T[]>(this.filePath, this.defaultValue as T[]);
      const newItem = {
        id: (item as any).id || genId(this._idPrefix),
        ...item,
        createdAt: (item as any).createdAt || new Date().toISOString(),
      } as unknown as T;
      data.push(newItem);
      await writeRaw(this.filePath, data);
      return newItem;
    });
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    return withLock(this.filePath, async () => {
      const data = await readJson<T[]>(this.filePath, this.defaultValue as T[]);
      const idx = data.findIndex((item: any) => item.id === id);
      if (idx === -1) return null;
      data[idx] = { ...data[idx], ...patch, updatedAt: new Date().toISOString() };
      await writeRaw(this.filePath, data);
      return data[idx];
    });
  }

  async delete(id: string): Promise<boolean> {
    return withLock(this.filePath, async () => {
      const data = await readJson<T[]>(this.filePath, this.defaultValue as T[]);
      const idx = data.findIndex((item: any) => item.id === id);
      if (idx === -1) return false;
      data.splice(idx, 1);
      await writeRaw(this.filePath, data);
      return true;
    });
  }

  async deleteMany(filter: (item: T) => boolean): Promise<number> {
    return withLock(this.filePath, async () => {
      const data = await readJson<T[]>(this.filePath, this.defaultValue as T[]);
      const next = data.filter(item => !filter(item));
      const removed = data.length - next.length;
      await writeRaw(this.filePath, next);
      return removed;
    });
  }

  async setObject(obj: T): Promise<T> {
    return withLock(this.filePath, async () => {
      await writeRaw(this.filePath, obj);
      return obj;
    });
  }
}
