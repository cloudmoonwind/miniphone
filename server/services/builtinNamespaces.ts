/**
 * 内置命名空间注册中心。
 *
 * 启动时调用 registerBuiltinNamespaces() 一次。各命名空间约定见
 * docs/archive/ICS_近期开发计划_v1.md 第二节（已归档）。
 *
 * 命名空间清单（阶段 1）：
 *   char    角色信息
 *   user    用户/马甲（当前激活）
 *   val     数值系统（实现在 services/values.ts）
 *   world   世界状态（world_state 表）
 *   wb      世界书（占位，阶段 1 不实现 identifier）
 *   time    设备时间
 *   util    工具函数（占位，阶段 1 不实现）
 */

import {
  registerNamespace,
  type Resolver,
  type NamespaceLister,
  type ResolveContext,
} from './placeholders.js';
import { getDb } from '../db/database.js';
import { characterStore, personaStore, activeStore } from '../storage/index.js';
import { valResolver, valList } from './values.js';

// ── char ─────────────────────────────────────────────────────────

const charResolver: Resolver = (identifier, _modifier, ctx) => {
  const char = characterStoreGetSync(ctx.characterId);
  if (!char) return null;

  switch (identifier) {
    case 'name':        return char.name;
    case 'core':        return char.core ?? '';
    case 'persona':     return char.persona ?? '';
    case 'description': return char.description ?? '';
    case 'sample':      return char.sample ?? '';
    default:            return null;
  }
};

const charList: NamespaceLister = () => [
  { identifier: 'name',        description: '角色名' },
  { identifier: 'core',        description: '角色核心设定' },
  { identifier: 'persona',     description: '角色人设描述' },
  { identifier: 'description', description: '角色简介' },
  { identifier: 'sample',      description: '角色对话样例' },
];

// 同步取角色（characterStore 是 async 接口，但这里需要同步 resolver）
// 直接走底层 better-sqlite3 同步查询
function characterStoreGetSync(id: string): any {
  const db = getDb();
  const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    core: row.core,
    persona: row.persona,
    description: row.description,
    sample: row.sample,
  };
}

// ── user ─────────────────────────────────────────────────────────

const userResolver: Resolver = (identifier, _modifier, ctx) => {
  const persona = userResolveActivePersona(ctx);
  if (!persona) return null;

  switch (identifier) {
    case 'name':    return persona.name ?? '';
    case 'persona': return persona.content ?? '';
    default:        return null;
  }
};

const userList: NamespaceLister = () => [
  { identifier: 'name',    description: '当前激活马甲名字' },
  { identifier: 'persona', description: '当前激活马甲人设全文' },
];

// 优先使用 ctx.personaId，否则从 active store 读 activePersonaId
function userResolveActivePersona(ctx: ResolveContext): { name: string; content: string } | null {
  const db = getDb();
  let personaId = ctx.personaId ?? null;

  if (!personaId) {
    const activeRow = db.prepare('SELECT data FROM active WHERE id = ?').get('singleton') as any;
    if (activeRow?.data) {
      try {
        const obj = JSON.parse(activeRow.data);
        personaId = obj?.activePersonaId ?? null;
      } catch { /* ignore */ }
    }
  }

  if (!personaId) return null;

  const row = db.prepare('SELECT data FROM personas WHERE id = ?').get(personaId) as any;
  if (!row?.data) return null;
  try {
    const obj = JSON.parse(row.data);
    return { name: obj.name ?? '', content: obj.content ?? '' };
  } catch {
    return null;
  }
}

// ── world ────────────────────────────────────────────────────────
// 数据来源：world_state 表（key/value）。
// 当前已用 key：weather / location / time_period / season / day_type / date
// 故意不放 world:time —— 没接外部 API 时它和 time:now 同值会让作者困惑

const WORLD_KNOWN_KEYS = ['weather', 'location', 'time_period', 'season', 'day_type', 'date'];

const worldResolver: Resolver = (identifier, _modifier) => {
  const db = getDb();
  const row = db.prepare('SELECT value FROM world_state WHERE key = ?').get(identifier) as any;
  if (!row) return null;
  return String(row.value);
};

const worldList: NamespaceLister = () => {
  const db = getDb();
  const rows = db.prepare('SELECT key FROM world_state').all() as Array<{ key: string }>;
  const keys = new Set(rows.map(r => r.key));
  for (const k of WORLD_KNOWN_KEYS) keys.add(k);
  return [...keys].map(k => ({ identifier: k, description: `世界状态：${k}` }));
};

// ── mode ─────────────────────────────────────────────────────────
// 当前对话模式（'online' / 'offline' / 自定义）
// 数据来源：ResolveContext.mode（由 chat.ts 传给 assembleMessages，再传到 placeholderCtx）

const modeResolver: Resolver = (identifier, _modifier, ctx) => {
  if (identifier !== 'name') return null;
  return ctx.mode ?? null;
};

const modeList: NamespaceLister = (ctx) => {
  if (!ctx?.mode) return [{ identifier: 'name', description: '当前对话模式名（无 mode 时为空）' }];
  return [{ identifier: 'name', description: `当前对话模式名（当前：${ctx.mode}）` }];
};

// ── time ─────────────────────────────────────────────────────────
// 设备/服务器时间，永远不受角色设定影响

const TIME_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const timeResolver: Resolver = (identifier) => {
  const now = new Date();
  switch (identifier) {
    case 'now':     return now.toISOString();
    case 'date':    return now.toISOString().slice(0, 10);
    case 'hour':    return String(now.getHours());
    case 'minute':  return String(now.getMinutes());
    case 'weekday': return TIME_WEEKDAYS[now.getDay()];
    case 'year':    return String(now.getFullYear());
    case 'month':   return String(now.getMonth() + 1);
    case 'day':     return String(now.getDate());
    default:        return null;
  }
};

const timeList: NamespaceLister = () => [
  { identifier: 'now',     description: '当前设备时间 ISO 字符串' },
  { identifier: 'date',    description: '当前日期 YYYY-MM-DD' },
  { identifier: 'hour',    description: '当前小时 0-23' },
  { identifier: 'minute',  description: '当前分钟 0-59' },
  { identifier: 'weekday', description: '当前星期（中文）' },
  { identifier: 'year',    description: '当前年份' },
  { identifier: 'month',   description: '当前月份 1-12' },
  { identifier: 'day',     description: '当前日 1-31' },
];

// ── wb / util（占位）─────────────────────────────────────────────
// 注册命名空间但 resolver 永远返回 null（→ 标记为 [未知字段:...]）。
// 阶段 1 暂不设计具体 identifier；未来真有用例再补。

const placeholderResolver: Resolver = () => null;
const emptyList: NamespaceLister = () => [];

// ── 注册入口 ─────────────────────────────────────────────────────

let registered = false;

/**
 * 注册所有内置命名空间。可重复调用（幂等）。
 * 启动时调用一次（server/index.ts 启动钩子里）。
 */
export function registerBuiltinNamespaces(): void {
  if (registered) return;
  registered = true;

  registerNamespace('char',  charResolver,        charList);
  registerNamespace('user',  userResolver,        userList);
  registerNamespace('val',   valResolver,         valList);
  registerNamespace('world', worldResolver,       worldList);
  registerNamespace('mode',  modeResolver,        modeList);
  registerNamespace('time',  timeResolver,        timeList);
  registerNamespace('wb',    placeholderResolver, emptyList);
  registerNamespace('util',  placeholderResolver, emptyList);
}

/** 测试钩子：允许重复注册 */
export function __resetBuiltinNamespacesFlag(): void {
  registered = false;
}
