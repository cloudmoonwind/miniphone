import { charStatStore, statDefStore } from '../storage/index.js';

export const DEFAULT_STAT_DEFS = [
  { key: 'mood',         name: '心情',   min: 0, max: 100, default: 70,  description: '角色当前情绪状态，影响行为倾向' },
  { key: 'energy',       name: '精力',   min: 0, max: 100, default: 80,  description: '体力与精神状态' },
  { key: 'relationship', name: '好感度', min: 0, max: 100, default: 50,  description: '对 user 的好感与亲近程度' },
  { key: 'trust',        name: '信任度', min: 0, max: 100, default: 40,  description: '对 user 的信任深度' },
  { key: 'stress',       name: '压力',   min: 0, max: 100, default: 20,  description: '当前承受的心理压力' },
];

/**
 * 获取角色的属性定义：自定义覆盖内置，最终合并
 */
export async function getMergedStatDefs(charId) {
  const custom = await statDefStore.getAll(d => d.charId == null || d.charId === charId);
  if (!custom.length) return DEFAULT_STAT_DEFS;
  const customKeys = new Set(custom.map(d => d.key));
  const base = DEFAULT_STAT_DEFS.filter(d => !customKeys.has(d.key));
  return [...base, ...custom];
}

/**
 * 获取角色当前数值（若无记录则使用默认值）
 */
export async function getCharStats(charId) {
  const existing = await charStatStore.getAll(s => s.charId === charId);
  if (existing.length) return existing[0].stats;
  const defs = await getMergedStatDefs(charId);
  return Object.fromEntries(defs.map(d => [d.key, d.default]));
}
