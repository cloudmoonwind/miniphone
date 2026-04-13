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

/** 获取角色的所有数值 */
export function getValuesByCharacter(characterId: string): CharacterValue[] {
  const db = getDrizzle();
  return db.select().from(characterValues)
    .where(eq(characterValues.characterId, characterId))
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
  currentValue?: number;
  minValue?: number;
  maxValue?: number;
}): CharacterValue {
  const db = getDrizzle();
  const now = new Date().toISOString();
  const result = db.insert(characterValues).values({
    characterId: data.characterId,
    category: data.category,
    name: data.name,
    variableName: data.variableName,
    currentValue: data.currentValue ?? 0,
    minValue: data.minValue ?? 0,
    maxValue: data.maxValue ?? 100,
    createdAt: now,
  }).returning().get();
  return result;
}

/** 更新数值（部分字段） */
export function updateValue(id: number, patch: Partial<{
  category: string;
  name: string;
  variableName: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
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
