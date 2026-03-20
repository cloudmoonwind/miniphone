import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, '../data');

const genId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(filePath, defaultValue = []) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeJson(filePath, defaultValue);
      return defaultValue;
    }
    throw err;
  }
}

async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export class FileStore {
  constructor(name, defaultValue = []) {
    this.filePath = path.join(DATA_ROOT, `${name}.json`);
    this.defaultValue = defaultValue;
  }

  async getAll(filter = null) {
    const data = await readJson(this.filePath, this.defaultValue);
    return filter ? data.filter(filter) : data;
  }

  async getById(id) {
    const data = await readJson(this.filePath, this.defaultValue);
    return data.find(item => item.id === id) ?? null;
  }

  async create(item) {
    const data = await readJson(this.filePath, this.defaultValue);
    const newItem = {
      id: item.id || genId(this.filePath.includes('char') ? 'char' : this.filePath.includes('msg') ? 'msg' : this.filePath.includes('sum') ? 'sum' : this.filePath.includes('mem') ? 'mem' : this.filePath.includes('dream') ? 'drm' : this.filePath.includes('map') ? 'map' : this.filePath.includes('preset') ? 'preset' : this.filePath.includes('life') ? 'life' : 'item'),
      ...item,
      createdAt: item.createdAt || new Date().toISOString(),
    };
    data.push(newItem);
    await writeJson(this.filePath, data);
    return newItem;
  }

  async update(id, patch) {
    const data = await readJson(this.filePath, this.defaultValue);
    const idx = data.findIndex(item => item.id === id);
    if (idx === -1) return null;
    data[idx] = { ...data[idx], ...patch, updatedAt: new Date().toISOString() };
    await writeJson(this.filePath, data);
    return data[idx];
  }

  async delete(id) {
    const data = await readJson(this.filePath, this.defaultValue);
    const idx = data.findIndex(item => item.id === id);
    if (idx === -1) return false;
    data.splice(idx, 1);
    await writeJson(this.filePath, data);
    return true;
  }

  async deleteMany(filter) {
    const data = await readJson(this.filePath, this.defaultValue);
    const next = data.filter(item => !filter(item));
    const removed = data.length - next.length;
    await writeJson(this.filePath, next);
    return removed;
  }

  // For single-object files (like active.json)
  async getObject() {
    return readJson(this.filePath, this.defaultValue);
  }

  async setObject(obj) {
    await writeJson(this.filePath, obj);
    return obj;
  }
}

export { genId };
