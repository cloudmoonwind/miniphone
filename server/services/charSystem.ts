/**
 * charSystem.js — 角色系统引擎
 *
 * 角色系统是角色生活的核心，聊天是它的一个数据来源，不是反过来。
 *
 * 三条管道：
 *   1. 总结 → 时间线：聊天产生的总结经评估后成为角色时间线事件
 *   2. 数值 → 事件：数值变化触发世界书条件事件和里程碑
 *   3. 生活 → 时间线/物品/技能：日常生活日志中提取结构化数据
 *
 * 所有管道可通过 activeStore.charSystemSettings 开关控制。
 * 使用 featurePresets.charSystem 作为专用 AI 预设（fallback 到 summaries → primary）。
 */

import {
  activeStore, presetStore, charStatStore,
  timelineStore, itemStore, skillStore, relationStore,
  summaryStore,
} from '../storage/index.js';
import { getClient, chatCompletion } from '../services/ai.js';
import { genId } from '../storage/FileStore.js';
import { getEventPool } from '../services/events.js';
import { getCharStats, getMergedStatDefs } from '../services/charstats.js';
import { getPrompt, BUILTIN_PROMPT_PRESETS } from '../services/promptPresets.js';

const _builtinCS = BUILTIN_PROMPT_PRESETS.find(p => p.id === 'builtin-charsystem-default');
const FALLBACK_TIMELINE_EVAL_PROMPT = _builtinCS?.prompts?.timelineEval || '';
const FALLBACK_LIFE_EXTRACT_PROMPT  = _builtinCS?.prompts?.lifeExtract  || '';

/* ── 获取角色系统设置 ─────────────────────────────────────────────── */
export async function getCharSystemSettings() {
  const active = await activeStore.getObject();
  return {
    extractionEnabled: false,
    summaryToTimelineEnabled: true,
    statEventsEnabled: true,
    lifeToTimelineEnabled: true,
    ...(active?.charSystemSettings || {}),
  };
}

/* ── 获取角色系统 AI 客户端 ──────────────────────────────────────── */
async function resolveCharSystemClient() {
  const active = await activeStore.getObject();
  // 优先级：charSystem 专用预设 → summaries 预设 → 主预设
  const presetId =
    active?.featurePresets?.charSystem ||
    active?.featurePresets?.summaries ||
    active?.primaryPresetId ||
    active?.activePresetId;
  if (!presetId) return null;
  const preset = await presetStore.getById(presetId);
  if (!preset?.apiKey) return null;
  return { client: getClient(preset), model: preset.model, preset };
}

/* ════════════════════════════════════════════════════════════════════
 * 管道 1：总结 → 时间线
 *
 * 当任何类型的总结被创建后调用。
 * 评估总结的重要性，决定是否值得成为时间线事件。
 *
 * 判断逻辑：
 *   - 如果有 AI 可用：让 AI 评估是否值得记录 + 生成标题
 *   - 如果无 AI：简单规则（importance > 5 或内容包含关键词）
 *
 * 生成的时间线事件：
 *   - type: 'chat'
 *   - content: 总结内容
 *   - linkedSummaryId: 关联的总结 ID
 *   - linkedMessageIds: 来源消息 ID（可以在 UI 中跳转到聊天）
 * ════════════════════════════════════════════════════════════════ */
export async function evaluateSummaryForTimeline(charId, summary) {
  try {
    const settings = await getCharSystemSettings();
    if (!settings.summaryToTimelineEnabled) return null;

    const ai = await resolveCharSystemClient();

    let shouldRecord = false;
    let title = '';

    if (ai) {
      // AI 评估
      const basePrompt = (await getPrompt('charSystem', 'timelineEval').catch(() => null)) || FALLBACK_TIMELINE_EVAL_PROMPT;
      const prompt = `${basePrompt}\n\n总结内容：\n${summary.content}`;

      try {
        const raw = await chatCompletion(ai.client, [
          { role: 'system', content: prompt },
          { role: 'user', content: '请评估' },
        ], { model: ai.model || 'gpt-3.5-turbo', max_tokens: 250, temperature: 0.3 });

        const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
        const result = JSON.parse(cleaned);
        shouldRecord = result.record === true;
        title = result.title || '';
      } catch {
        // AI 调用失败，降级为规则判断
        shouldRecord = (summary.importance || 5) >= 6;
        title = summary.content?.slice(0, 20) + '…';
      }
    } else {
      // 无 AI，简单规则
      shouldRecord = (summary.importance || 5) >= 6;
      title = summary.content?.slice(0, 20) + '…';
    }

    if (!shouldRecord) {
      console.log('[charSystem] summary not significant enough for timeline:', charId);
      return null;
    }

    // 创建时间线事件
    const event = await timelineStore.create({
      id: genId('tl'),
      charId,
      title,
      content: summary.content,
      type: 'chat',
      timestamp: summary.period?.to || summary.createdAt || new Date().toISOString(),
      linkedItemIds: [],
      linkedEventId: null,
      linkedSummaryId: summary.id,
      linkedMessageIds: summary.sourceIds || [],
      extractedSource: 'summary-eval',
    });

    console.log('[charSystem] timeline event created from summary:', title);
    return event;
  } catch (err) {
    console.error('[charSystem] evaluateSummaryForTimeline error:', err.message);
    return null;
  }
}

/* ════════════════════════════════════════════════════════════════════
 * 管道 2：数值变化 → 事件
 *
 * 当角色数值发生变化后调用。
 * 检查世界书中的条件事件（event-conditional），
 * 如果某个条件从「不满足」变为「满足」，触发该事件。
 *
 * 同时检查内置里程碑（好感度超过 80、信任度超过 70 等）。
 * ════════════════════════════════════════════════════════════════ */

const MILESTONES = [
  { stat: 'relationship', threshold: 80, op: 'gte', title: '关系突破', desc: '好感度超过了80，关系进入了新阶段' },
  { stat: 'trust',        threshold: 70, op: 'gte', title: '建立信任', desc: '信任度达到了70，角色开始分享更多心事' },
  { stat: 'mood',         threshold: 90, op: 'gte', title: '极好心情', desc: '心情值达到顶峰' },
  { stat: 'mood',         threshold: 20, op: 'lte', title: '情绪低落', desc: '心情跌至低谷，需要关怀' },
  { stat: 'stress',       threshold: 80, op: 'gte', title: '压力过大', desc: '压力值过高，可能会影响行为' },
];

function checkCondition(value: number, op: string, threshold: number): boolean {
  switch (op) {
    case 'gte': case '>=': return value >= threshold;
    case 'lte': case '<=': return value <= threshold;
    case 'gt':  case '>':  return value >  threshold;
    case 'lt':  case '<':  return value <  threshold;
    case 'eq':  case '==': return value === threshold;
    default: return false;
  }
}

export async function checkStatThresholds(charId, prevStats, newStats) {
  try {
    const settings = await getCharSystemSettings();
    if (!settings.statEventsEnabled) return [];

    const events = [];
    const now = new Date().toISOString();

    // 检查事件池中的条件事件（有 triggerConditions 的 repeatable 事件）
    const eventPool = getEventPool(charId);
    const conditionalEvents = eventPool.filter(e => e.triggerConditions);

    for (const poolEvent of conditionalEvents) {
      try {
        const cond = JSON.parse(poolEvent.triggerConditions!);
        const firstCond = cond?.条件组?.[0]?.条件?.[0];
        if (!firstCond || firstCond.类型 !== '数值' || !firstCond.目标) continue;

        const prevVal = prevStats[firstCond.目标];
        const newVal  = newStats[firstCond.目标];
        if (prevVal == null || newVal == null) continue;

        const wasMet = checkCondition(prevVal, firstCond.比较 ?? '>=', firstCond.值 ?? 0);
        const isMet  = checkCondition(newVal,  firstCond.比较 ?? '>=', firstCond.值 ?? 0);

        // 只在条件从「不满足」变为「满足」时触发
        if (!wasMet && isMet) {
          const event = await timelineStore.create({
            id: genId('tl'), charId,
            title: poolEvent.name,
            content: poolEvent.description ?? poolEvent.effects ?? '',
            type: 'event',
            timestamp: now,
            linkedItemIds: [], linkedEventId: poolEvent.id,
            extractedSource: 'stat-threshold',
          });
          events.push(event);
          console.log('[charSystem] stat threshold event triggered:', poolEvent.name);
        }
      } catch { /* 跳过格式错误的条件 */ }
    }

    // 检查内置里程碑
    for (const ms of MILESTONES) {
      const prevVal = prevStats[ms.stat];
      const newVal = newStats[ms.stat];
      if (prevVal == null || newVal == null) continue;

      const wasMet = checkCondition(prevVal, ms.op, ms.threshold);
      const isMet  = checkCondition(newVal, ms.op, ms.threshold);

      if (!wasMet && isMet) {
        // 检查是否已存在同标题事件（防重复）
        const existing = await timelineStore.getAll(t =>
          t.charId === charId && t.title === ms.title
        );
        if (existing.length > 0) continue;

        const event = await timelineStore.create({
          id: genId('tl'), charId,
          title: ms.title,
          content: ms.desc,
          type: 'milestone',
          timestamp: now,
          linkedItemIds: [], linkedEventId: null,
          extractedSource: 'milestone',
        });
        events.push(event);
        console.log('[charSystem] milestone reached:', ms.title);
      }
    }

    return events;
  } catch (err) {
    console.error('[charSystem] checkStatThresholds error:', err.message);
    return [];
  }
}

/* ════════════════════════════════════════════════════════════════════
 * 管道 3：生活日志 → 时间线/物品
 *
 * 当 AI 生成生活日志后调用。
 * 用 AI 分析生活内容，提取：
 *   - 值得记录的时间线事件
 *   - 新获得的物品
 *   - 技能成长
 * ════════════════════════════════════════════════════════════════ */
export async function processLifeLog(charId, lifeLog) {
  try {
    const settings = await getCharSystemSettings();
    if (!settings.lifeToTimelineEnabled) return;

    const ai = await resolveCharSystemClient();
    if (!ai) return;

    const baseLifePrompt = (await getPrompt('charSystem', 'lifeExtract').catch(() => null)) || FALLBACK_LIFE_EXTRACT_PROMPT;
    const prompt = `${baseLifePrompt}\n\n生活日志：\n${lifeLog.content}`;

    const raw = await chatCompletion(ai.client, [
      { role: 'system', content: prompt },
      { role: 'user', content: '请提取' },
    ], { model: ai.model || 'gpt-3.5-turbo', max_tokens: 800, temperature: 0.3 });

    let data;
    try {
      const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      data = JSON.parse(cleaned);
    } catch { return; }

    const now = lifeLog.generatedAt || new Date().toISOString();

    // 时间线事件
    if (data.timeline?.length > 0) {
      for (const ev of data.timeline) {
        await timelineStore.create({
          id: genId('tl'), charId,
          title: ev.title, content: ev.content || '',
          type: 'event', timestamp: now,
          linkedItemIds: [], linkedEventId: null,
          linkedLifeLogId: lifeLog.id,
          extractedSource: 'life-extract',
        });
      }
      console.log('[charSystem]', data.timeline.length, 'timeline events from life log');
    }

    // 物品
    if (data.items?.length > 0) {
      for (const item of data.items) {
        await itemStore.create({
          id: genId('item'), charId,
          name: item.name, emoji: item.emoji || '📦',
          description: item.description || '',
          category: item.category || 'other',
          source: { type: 'found', from: '日常生活' },
          emotionalValue: 50, condition: 100,
          status: 'active', location: '',
          characterNotes: '', linkedTimelineIds: [],
          obtainedAt: now,
          extractedSource: 'life-extract',
        });
      }
    }

    // 技能经验（已有技能 +0.3，不创建新技能）
    if (data.skills?.length > 0) {
      const existingSkills = await skillStore.getAll(s => s.charId === charId);
      for (const sk of data.skills) {
        const existing = existingSkills.find(s => s.name === sk.name);
        if (existing) {
          const newExp = (existing.experience || 0) + 0.3;
          const newLevel = Math.min(5, Math.floor(newExp / 2) + 1);
          await skillStore.update(existing.id, { level: Math.max(existing.level, newLevel), experience: newExp });
        }
      }
    }
  } catch (err) {
    console.error('[charSystem] processLifeLog error:', err.message);
  }
}

/* ════════════════════════════════════════════════════════════════════
 * 统一入口：聊天后数据提取
 *
 * 替代之前独立的 extraction.js，集成到角色系统引擎中。
 * ════════════════════════════════════════════════════════════════ */
export { triggerExtraction } from './extraction.js';
