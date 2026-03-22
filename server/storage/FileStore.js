import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '../data');

export const genId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(filePath, defaultValue = []) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
      return defaultValue;
    }
    throw err;
  }
}

async function writeRaw(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── 文件级操作锁 ──────────────────────────────────────────────────────────
// 所有 mutating 操作（create/update/delete/setObject）都通过 withLock 串行。
// 这保证了 read-modify-write 的原子性：
//   操作 A 读旧数据 → 修改 → 写入 → 操作 B 再读（拿到 A 写后的新数据）
// 若只排队 write 而不排队 read，并发操作仍会互相覆盖。
const locks = new Map();

function withLock(filePath, fn) {
  const prev = locks.get(filePath) ?? Promise.resolve();
  const next = prev.then(fn);
  // 无论成功/失败都推进队列，防止一次错误卡死后续所有操作
  locks.set(filePath, next.catch(() => {}));
  return next;
}

// ─────────────────────────────────────────────────────────────────────────

export class FileStore {
  constructor(name, defaultValue = []) {
    this.filePath = path.join(DATA_ROOT, `${name}.json`);
    this.defaultValue = defaultValue;
    // id 前缀映射
    const prefixMap = {
      characters: 'char', messages: 'msg', summaries: 'sum',
      memories: 'mem', dreams: 'drm', maps: 'map',
      presets: 'preset', prompt_presets: 'pp', life: 'life',
      wb_books: 'wb', wb_entries: 'wbe', stat_defs: 'sd',
      char_stats: 'cs', personas: 'persona', diary: 'diary',
      items: 'item', timeline: 'tl', skills: 'sk', relations: 'rel',
    };
    this._idPrefix = prefixMap[name] || 'item';
  }

  // ── 只读，不加锁（查询不应被写操作阻塞）────────────────────────────────

  async getAll(filter = null) {
    const data = await readJson(this.filePath, this.defaultValue);
    return filter ? data.filter(filter) : data;
  }

  async getById(id) {
    const data = await readJson(this.filePath, this.defaultValue);
    return data.find(item => item.id === id) ?? null;
  }

  async getObject() {
    return readJson(this.filePath, this.defaultValue);
  }

  // ── 写操作：全部加锁，保证原子 read-modify-write ─────────────────────────

  async create(item) {
    return withLock(this.filePath, async () => {
      const data = await readJson(this.filePath, this.defaultValue);
      const newItem = {
        id: item.id || genId(this._idPrefix),
        ...item,
        createdAt: item.createdAt || new Date().toISOString(),
      };
      data.push(newItem);
      await writeRaw(this.filePath, data);
      return newItem;
    });
  }

  async update(id, patch) {
    return withLock(this.filePath, async () => {
      const data = await readJson(this.filePath, this.defaultValue);
      const idx = data.findIndex(item => item.id === id);
      if (idx === -1) return null;
      data[idx] = { ...data[idx], ...patch, updatedAt: new Date().toISOString() };
      await writeRaw(this.filePath, data);
      return data[idx];
    });
  }

  async delete(id) {
    return withLock(this.filePath, async () => {
      const data = await readJson(this.filePath, this.defaultValue);
      const idx = data.findIndex(item => item.id === id);
      if (idx === -1) return false;
      data.splice(idx, 1);
      await writeRaw(this.filePath, data);
      return true;
    });
  }

  async deleteMany(filter) {
    return withLock(this.filePath, async () => {
      const data = await readJson(this.filePath, this.defaultValue);
      const next = data.filter(item => !filter(item));
      const removed = data.length - next.length;
      await writeRaw(this.filePath, next);
      return removed;
    });
  }

  async setObject(obj) {
    return withLock(this.filePath, async () => {
      await writeRaw(this.filePath, obj);
      return obj;
    });
  }
}
