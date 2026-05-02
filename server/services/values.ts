/**
 * 数值系统服务层
 *
 * 基于 Drizzle ORM 操作 character_values / value_stages / value_rules 三张表。
 * 提供：CRUD、阶段查询、模板变量解析、规则执行。
 */

import { eq, and } from 'drizzle-orm';
import { getDrizzle } from '../db/database.js';
import { characterValues, valueStages, valueRules } from '../db/schema.js';
import { traceSummary, traceDetail } from './trace.js';

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

/** 获取某角色当前值范围内匹配的规则文本（用于 sys-variables 注入） */
export function getActiveRuleTexts(characterId: string): Array<{
  variableName: string;
  name: string;
  currentValue: number;
  ruleText: string;
}> {
  const charVars = getValuesByCharacter(characterId);
  const result: Array<{ variableName: string; name: string; currentValue: number; ruleText: string }> = [];

  for (const val of charVars) {
    const rules = getRulesByValue(val.id).filter(r => {
      if (r.enabled === 0) return false;
      if (!r.ruleText?.trim()) return false;
      if (r.rangeMin != null && val.currentValue < r.rangeMin) return false;
      if (r.rangeMax != null && val.currentValue > r.rangeMax) return false;
      return true;
    });

    for (const rule of rules) {
      result.push({
        variableName: val.variableName,
        name: val.name,
        currentValue: val.currentValue,
        ruleText: rule.ruleText,
      });
    }
  }

  return result;
}

/** 创建规则 */
export function createRule(data: {
  valueId: number;
  rangeMin?: number | null;
  rangeMax?: number | null;
  ruleText: string;
  enabled?: number;
}): ValueRule {
  const db = getDrizzle();
  return db.insert(valueRules).values({
    valueId: data.valueId,
    rangeMin: data.rangeMin ?? null,
    rangeMax: data.rangeMax ?? null,
    ruleText: data.ruleText,
    enabled: data.enabled ?? 1,
    createdAt: new Date().toISOString(),
  }).returning().get();
}

/** 更新规则 */
export function updateRule(id: number, patch: Partial<{
  rangeMin: number | null;
  rangeMax: number | null;
  ruleText: string;
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

// ── 占位符 resolver（val 命名空间）─────────────────────────────
//
// 接入新版变量管道（server/services/placeholders.ts）。
// {{val:affection}}        → 当前值
// {{val:affection:stage}}  → 阶段名
// {{val:affection:desc}}   → 阶段描述
// {{val:affection:prompt}} → 阶段提示词片段
// {{val:affection:name}}   → 显示名
// {{val:affection:min}}    → 最小值
// {{val:affection:max}}    → 最大值
import type { Resolver, NamespaceLister, ResolveContext } from './placeholders.js';

export const valResolver: Resolver = (identifier, modifier, ctx: ResolveContext) => {
  const val = getValueByVariable(ctx.characterId, identifier);
  if (!val) return null;

  if (!modifier) return String(val.currentValue);

  switch (modifier) {
    case 'name': return val.name;
    case 'min':  return String(val.minValue);
    case 'max':  return String(val.maxValue);
    case 'stage': {
      const s = getCurrentStage(val.id);
      return s?.stageName ?? '';
    }
    case 'desc': {
      const s = getCurrentStage(val.id);
      return s?.description ?? '';
    }
    case 'prompt': {
      const s = getCurrentStage(val.id);
      return s?.promptSnippet ?? '';
    }
    default: return null; // 未知 modifier → [未知字段:val:xxx:yyy]
  }
};

export const valList: NamespaceLister = (ctx) => {
  if (!ctx?.characterId) return [];
  const vars = getValuesByCharacter(ctx.characterId);
  const modifiers = ['name', 'stage', 'desc', 'prompt', 'min', 'max'];
  return vars.map(v => ({
    identifier: v.variableName,
    description: `${v.name}（当前 ${v.currentValue}）`,
    modifiers,
  }));
};

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

// ── <var> 应用层（接受结构化输入，由 aiProtocol.parseAIOutput 解析） ──

/** applyVarBlock 应用后实际发生变化的变量 */
export interface ChangedVariable {
  variableName: string;
  oldValue: number;
  newValue: number;
}

/**
 * 应用 AI 协议解析后的变量更新到数据库。
 *
 * 校验规则：
 *   - 变量名按 variableName / displayName 顺序查找
 *   - 旧值需与当前值相差 ≤ ±1（防止重新生成时错误 delta 累积）
 *   - 新值自动 clamp 到 [min, max]
 *
 * 返回：
 *   - snapshot: 应用后的完整快照（含 emotion_state 字符串，若有 emotion）
 *   - emotionState: 情绪行原文（无则 null）
 *   - changedVariables: 实际发生变化的变量列表，调用方需为每项触发 value_change 事件检查
 */
export function applyVarBlock(
  characterId: string,
  varUpdates: Array<{ variableName: string; oldValue: number; newValue: number; reason?: string }>,
  emotion: { raw: string; parts: Array<{ word: string; pct: number }> } | null = null,
): { snapshot: Record<string, any>; emotionState: string | null; changedVariables: ChangedVariable[] } {
  const allValues = getValuesByCharacter(characterId);
  const byVarName = new Map<string, CharacterValue>(allValues.map(v => [v.variableName, v]));
  const byName    = new Map<string, CharacterValue>(allValues.map(v => [v.name, v]));

  const changedVariables: ChangedVariable[] = [];
  let failedCount = 0;
  const traceParentId = traceSummary('variables', 'var.apply.start', 'apply structured var updates', {
    characterId,
    updateCount: varUpdates.length,
    hasEmotion: !!emotion,
  });

  for (const upd of varUpdates) {
    const val = byVarName.get(upd.variableName) ?? byName.get(upd.variableName);
    if (!val) {
      failedCount++;
      traceDetail('variables', 'var.apply.failed', `${upd.variableName} unknown variable`, {
        ...upd, reason: 'unknown-variable',
      }, traceParentId);
      continue;
    }

    // 旧值校验（±1 容忍）
    if (Math.abs(val.currentValue - upd.oldValue) > 1) {
      failedCount++;
      traceDetail('variables', 'var.apply.failed', `${val.variableName} old value mismatch`, {
        ...upd,
        variableName: val.variableName,
        currentValue: val.currentValue,
        reason: 'old-value-mismatch',
      }, traceParentId);
      continue;
    }

    const clamped = Math.max(val.minValue, Math.min(val.maxValue, upd.newValue));
    if (clamped === val.currentValue) {
      traceDetail('variables', 'var.apply.unchanged', `${val.variableName} unchanged`, {
        ...upd,
        variableName: val.variableName,
        currentValue: val.currentValue,
        clamped,
      }, traceParentId);
      continue;
    }

    updateValue(val.id, { currentValue: clamped });
    changedVariables.push({
      variableName: val.variableName,
      oldValue: val.currentValue,
      newValue: clamped,
    });
    traceDetail('variables', 'var.apply.applied', `${val.variableName}: ${val.currentValue} -> ${clamped}`, {
      ...upd,
      variableName: val.variableName,
      oldValue: val.currentValue,
      newValue: clamped,
      clamped: clamped !== upd.newValue,
    }, traceParentId);
  }

  const emotionState: string | null = emotion ? emotion.raw : null;
  if (emotion) {
    traceDetail('variables', 'var.apply.emotion', 'emotion state accepted', {
      raw: emotion.raw,
      parts: emotion.parts,
    }, traceParentId);
  }

  // 重新读取（含刚更新的值），构建快照
  const snapshot: Record<string, any> = buildVariableSnapshot(characterId);
  if (emotionState) snapshot['emotion_state'] = emotionState;

  traceSummary('variables', 'var.apply.summary', `${changedVariables.length} applied, ${failedCount} failed`, {
    appliedCount: changedVariables.length,
    failedCount,
    emotionState,
    changedVariables,
  });

  return { snapshot, emotionState, changedVariables };
}
