/**
 * 数值系统服务层
 *
 * 基于 Drizzle ORM 操作 character_values / value_stages / value_rules 三张表。
 * 提供：CRUD、阶段查询、模板变量解析、规则执行。
 */

import { eq, and } from 'drizzle-orm';
import { getDrizzle } from '../db/database.js';
import { characterValues, valueStages, valueRules } from '../db/schema.js';

// ── 类型 ──────────────────────────────────────────────────────

export type CharacterValue = typeof characterValues.$inferSelect;
export type ValueStage     = typeof valueStages.$inferSelect;
export type ValueRule       = typeof valueRules.$inferSelect;

// ── character_values CRUD ─────────────────────────────────────

/** 获取角色的所有数值（按 sortOrder 排序） */
export function getValuesByCharacter(characterId: string): CharacterValue[] {
  const db = getDrizzle();
  return db.select().from(characterValues)
    .where(eq(characterValues.characterId, characterId))
    .orderBy(characterValues.sortOrder, characterValues.id)
    .all();
}

/** 按 ID 获取单个数值 */
export function getValueById(id: number): CharacterValue | undefined {
  const db = getDrizzle();
  return db.select().from(characterValues)
    .where(eq(characterValues.id, id))
    .get();
}

/** 按角色 + 变量名获取数值 */
export function getValueByVariable(characterId: string, variableName: string): CharacterValue | undefined {
  const db = getDrizzle();
  return db.select().from(characterValues)
    .where(and(
      eq(characterValues.characterId, characterId),
      eq(characterValues.variableName, variableName),
    ))
    .get();
}

/** 创建数值 */
export function createValue(data: {
  characterId: string;
  category: string;
  name: string;
  variableName: string;
  valueType?: string;
  currentValue?: number;
  minValue?: number;
  maxValue?: number;
  sortOrder?: number;
  groupName?: string;
}): CharacterValue {
  const db = getDrizzle();
  const now = new Date().toISOString();
  const result = db.insert(characterValues).values({
    characterId: data.characterId,
    category: data.category,
    name: data.name,
    variableName: data.variableName,
    valueType: data.valueType ?? 'continuous',
    currentValue: data.currentValue ?? 0,
    minValue: data.minValue ?? 0,
    maxValue: data.maxValue ?? 100,
    sortOrder: data.sortOrder ?? 0,
    groupName: data.groupName ?? null,
    createdAt: now,
  }).returning().get();
  return result;
}

/** 更新数值（部分字段） */
export function updateValue(id: number, patch: Partial<{
  category: string;
  name: string;
  variableName: string;
  valueType: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  sortOrder: number;
  groupName: string | null;
}>): CharacterValue | undefined {
  const db = getDrizzle();
  const result = db.update(characterValues)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(characterValues.id, id))
    .returning().get();
  return result;
}

/** 删除数值（级联删除 stages 和 rules） */
export function deleteValue(id: number): boolean {
  const db = getDrizzle();
  const result = db.delete(characterValues)
    .where(eq(characterValues.id, id))
    .returning().get();
  return !!result;
}

/** 对数值做增减，自动 clamp 到 [min, max] */
export function adjustValue(id: number, delta: number): CharacterValue | undefined {
  const val = getValueById(id);
  if (!val) return undefined;
  const clamped = Math.max(val.minValue, Math.min(val.maxValue, val.currentValue + delta));
  return updateValue(id, { currentValue: clamped });
}

// ── value_stages CRUD ─────────────────────────────────────────

/** 获取数值的所有阶段（按 rangeMin 升序） */
export function getStagesByValue(valueId: number): ValueStage[] {
  const db = getDrizzle();
  return db.select().from(valueStages)
    .where(eq(valueStages.valueId, valueId))
    .orderBy(valueStages.rangeMin)
    .all();
}

/** 获取当前数值对应的阶段 */
export function getCurrentStage(valueId: number): ValueStage | undefined {
  const val = getValueById(valueId);
  if (!val) return undefined;
  const stages = getStagesByValue(valueId);
  // 找到 currentValue 落入的阶段（rangeMin <= val < rangeMax，最后一个阶段包含上界）
  return stages.find((s, i) => {
    if (i === stages.length - 1) return val.currentValue >= s.rangeMin && val.currentValue <= s.rangeMax;
    return val.currentValue >= s.rangeMin && val.currentValue < s.rangeMax;
  });
}

/** 创建阶段 */
export function createStage(data: {
  valueId: number;
  rangeMin: number;
  rangeMax: number;
  stageName: string;
  description?: string;
  promptSnippet?: string;
}): ValueStage {
  const db = getDrizzle();
  return db.insert(valueStages).values(data).returning().get();
}

/** 更新阶段 */
export function updateStage(id: number, patch: Partial<{
  rangeMin: number;
  rangeMax: number;
  stageName: string;
  description: string;
  promptSnippet: string;
}>): ValueStage | undefined {
  const db = getDrizzle();
  return db.update(valueStages)
    .set(patch)
    .where(eq(valueStages.id, id))
    .returning().get();
}

/** 删除阶段 */
export function deleteStage(id: number): boolean {
  const db = getDrizzle();
  const result = db.delete(valueStages)
    .where(eq(valueStages.id, id))
    .returning().get();
  return !!result;
}

/** 批量设置某数值的所有阶段（先删后插） */
export function setStages(valueId: number, stages: Array<{
  rangeMin: number;
  rangeMax: number;
  stageName: string;
  description?: string;
  promptSnippet?: string;
}>): ValueStage[] {
  const db = getDrizzle();
  db.delete(valueStages).where(eq(valueStages.valueId, valueId)).run();
  if (!stages.length) return [];
  return db.insert(valueStages)
    .values(stages.map(s => ({ ...s, valueId })))
    .returning().all();
}

// ── value_rules CRUD ──────────────────────────────────────────

/** 获取数值的所有规则 */
export function getRulesByValue(valueId: number): ValueRule[] {
  const db = getDrizzle();
  return db.select().from(valueRules)
    .where(eq(valueRules.valueId, valueId))
    .all();
}

/** 创建规则 */
export function createRule(data: {
  valueId: number;
  rangeMin?: number;
  rangeMax?: number;
  triggerOn: string;
  conditions?: string;
  operation: string;
  amount: number;
  description?: string;
  enabled?: number;
}): ValueRule {
  const db = getDrizzle();
  return db.insert(valueRules).values({
    ...data,
    enabled: data.enabled ?? 1,
    createdAt: new Date().toISOString(),
  }).returning().get();
}

/** 更新规则 */
export function updateRule(id: number, patch: Partial<{
  rangeMin: number | null;
  rangeMax: number | null;
  triggerOn: string;
  conditions: string | null;
  operation: string;
  amount: number;
  description: string | null;
  enabled: number;
}>): ValueRule | undefined {
  const db = getDrizzle();
  return db.update(valueRules)
    .set(patch)
    .where(eq(valueRules.id, id))
    .returning().get();
}

/** 删除规则 */
export function deleteRule(id: number): boolean {
  const db = getDrizzle();
  const result = db.delete(valueRules)
    .where(eq(valueRules.id, id))
    .returning().get();
  return !!result;
}

// ── 模板变量解析 ──────────────────────────────────────────────

/**
 * 解析模板中的数值变量占位符：
 *   {{v:affection}}       → 当前值
 *   {{v:affection:stage}} → 阶段名
 *   {{v:affection:desc}}  → 阶段描述
 *   {{v:affection:prompt}} → 阶段提示词片段
 */
export function resolveValuePlaceholders(template: string, characterId: string): string {
  return template.replace(/\{\{v:(\w+)(?::(\w+))?\}\}/g, (_match, varName: string, field?: string) => {
    const val = getValueByVariable(characterId, varName);
    if (!val) return `[未知变量:${varName}]`;

    if (!field) return String(val.currentValue);

    const stage = getCurrentStage(val.id);
    switch (field) {
      case 'stage':  return stage?.stageName ?? '未定义';
      case 'desc':   return stage?.description ?? '';
      case 'prompt': return stage?.promptSnippet ?? '';
      default:       return `[未知字段:${field}]`;
    }
  });
}

// ── 默认变量种子 ──────────────────────────────────────────────

/** 情绪底色三轴默认值（角色首次请求变量时自动创建） */
const EMOTION_BASELINES = [
  { category: 'emotion', name: '理智', variableName: 'sanity',    currentValue: 50, minValue: -100, maxValue: 100 },
  { category: 'emotion', name: '稳定', variableName: 'stability', currentValue: 30, minValue: -100, maxValue: 100 },
  { category: 'emotion', name: '强度', variableName: 'intensity', currentValue: 20, minValue: -100, maxValue: 100 },
];

/** 为角色创建默认情绪底色变量（幂等：已存在则跳过） */
export function seedDefaultVariables(characterId: string): void {
  const existing = getValuesByCharacter(characterId);
  const existingNames = new Set(existing.map(v => v.variableName));
  for (const def of EMOTION_BASELINES) {
    if (!existingNames.has(def.variableName)) {
      createValue({ characterId, ...def });
    }
  }
}

// ── 变量快照 ──────────────────────────────────────────────────

/** 将角色所有数值导出为快照对象 { variableName → currentValue } */
export function buildVariableSnapshot(characterId: string): Record<string, number> {
  const values = getValuesByCharacter(characterId);
  const snapshot: Record<string, number> = {};
  for (const v of values) {
    snapshot[v.variableName] = v.currentValue;
  }
  return snapshot;
}

// ── <var> 块解析与应用 ────────────────────────────────────────

/**
 * 从 AI 回复中提取并移除 <var>...</var> 块。
 * 返回去掉该块后的干净内容，以及块内文本（null 表示无）。
 */
export function extractVarBlock(content: string): { cleanContent: string; varBlock: string | null } {
  const match = content.match(/<var>([\s\S]*?)<\/var>/i);
  if (!match) return { cleanContent: content, varBlock: null };
  const varBlock = match[1].trim();
  const cleanContent = content.replace(/<var>[\s\S]*?<\/var>/i, '').trim();
  return { cleanContent, varBlock };
}

/**
 * 解析并应用 <var> 块：
 * - 数值行格式：`变量名：原值→新值`（支持显示名或变量名，原值需与当前值相差 ≤1）
 * - 情绪行格式：`情绪：情绪词 X% | 情绪词 Y%`（百分比之和应在 95~105）
 *
 * 返回应用后的完整快照（含 emotion_state 字符串，若有效则写入）。
 */
export function parseAndApplyVarBlock(
  characterId: string,
  varBlock: string,
): { snapshot: Record<string, any>; emotionState: string | null } {
  const allValues = getValuesByCharacter(characterId);
  // 同时支持按 variableName 和 name 查找
  const byVarName = new Map<string, CharacterValue>(allValues.map(v => [v.variableName, v]));
  const byName    = new Map<string, CharacterValue>(allValues.map(v => [v.name, v]));

  let emotionState: string | null = null;

  for (const raw of varBlock.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    // 情绪行：情绪：愤怒 40% | 委屈 35% | 不甘 25%
    if (/^情绪[：:]/.test(line)) {
      const body = line.replace(/^情绪[：:]/, '').trim();
      const pcts = [...body.matchAll(/(\d+)%/g)].map(m => parseInt(m[1]));
      const sum  = pcts.reduce((a, b) => a + b, 0);
      if (pcts.length > 0 && Math.abs(sum - 100) <= 5) {
        emotionState = body;
      }
      continue;
    }

    // 数值行：变量名：原值→新值（→ 或 -> 均接受）
    const match = line.match(/^(.+?)[：:]([\d.]+)\s*(?:→|->)\s*([\d.]+)$/);
    if (!match) continue;

    const key    = match[1].trim();
    const oldVal = parseFloat(match[2]);
    const newVal = parseFloat(match[3]);

    const val = byVarName.get(key) ?? byName.get(key);
    if (!val) continue;

    // 原值校验（±1 容忍，防止重新生成时错误 delta 累积）
    if (Math.abs(val.currentValue - oldVal) > 1) continue;

    const clamped = Math.max(val.minValue, Math.min(val.maxValue, newVal));
    updateValue(val.id, { currentValue: clamped });
  }

  // 重新读取（含刚更新的值），构建快照
  const snapshot: Record<string, any> = buildVariableSnapshot(characterId);
  if (emotionState) snapshot['emotion_state'] = emotionState;

  return { snapshot, emotionState };
}

// ── 规则执行引擎 ──────────────────────────────────────────────

/**
 * 对某个角色执行指定触发时机的所有规则
 * @returns 变化的数值列表 [{ valueId, variableName, prev, next }]
 */
export function executeRules(characterId: string, triggerOn: string): Array<{
  valueId: number;
  variableName: string;
  prev: number;
  next: number;
}> {
  const values = getValuesByCharacter(characterId);
  const changes: Array<{ valueId: number; variableName: string; prev: number; next: number }> = [];

  for (const val of values) {
    const rules = getRulesByValue(val.id).filter(r =>
      r.enabled === 1 &&
      r.triggerOn === triggerOn &&
      (r.rangeMin == null || val.currentValue >= r.rangeMin) &&
      (r.rangeMax == null || val.currentValue <= r.rangeMax)
    );

    if (!rules.length) continue;

    let newValue = val.currentValue;
    for (const rule of rules) {
      switch (rule.operation) {
        case 'add':      newValue += rule.amount; break;
        case 'set':      newValue = rule.amount; break;
        case 'multiply': newValue *= rule.amount; break;
      }
    }

    // clamp
    newValue = Math.max(val.minValue, Math.min(val.maxValue, newValue));

    if (newValue !== val.currentValue) {
      updateValue(val.id, { currentValue: newValue });
      changes.push({
        valueId: val.id,
        variableName: val.variableName,
        prev: val.currentValue,
        next: newValue,
      });
    }
  }

  return changes;
}
