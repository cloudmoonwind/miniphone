/**
 * 聊天后数据提取服务
 *
 * AI 回复后异步分析最近对话，自动提取结构化数据：
 *   - 角色状态变化（心情、位置、活动）
 *   - 新物品（礼物、购买、获得）
 *   - 关系发展
 *   - 时间线事件
 *   - 技能表现
 *
 * 所有提取数据标记 source:'ai-extract'，用户可编辑/删除/驳回。
 * 通过 activeStore.extractionSettings.enabled 开关控制。
 */

import {
  activeStore, presetStore, messageStore,
  charStatStore, itemStore, timelineStore,
  relationStore, skillStore,
} from '../storage/index.js';
import { getClient, chatCompletion } from '../services/ai.js';
import { genId } from '../storage/FileStore.js';
import { getPrompt, BUILTIN_PROMPT_PRESETS } from '../services/promptPresets.js';

const _builtinCharSystem = BUILTIN_PROMPT_PRESETS.find(p => p.id === 'builtin-charsystem-default');
const FALLBACK_EXTRACTION_PROMPT = _builtinCharSystem?.prompts?.extraction || '';

/**
 * 解析 AI 客户端
 * 优先级：charSystem 专用预设 → summaries 预设 → 主预设
 */
async function resolveExtractionClient() {
  const active = await activeStore.getObject();
  const presetId =
    active?.featurePresets?.charSystem ||
    active?.featurePresets?.summaries ||
    active?.primaryPresetId ||
    active?.activePresetId;
  if (!presetId) return null;
  const preset = await presetStore.getById(presetId);
  if (!preset?.apiKey) return null;
  return { client: getClient(preset), model: preset.model };
}

/**
 * 主提取函数 — 聊天后调用
 */
export async function triggerExtraction(charId) {
  try {
    const active = await activeStore.getObject();
    const csSettings = active?.charSystemSettings || {};
    if (!csSettings.extractionEnabled) return;

    const ai = await resolveExtractionClient();
    if (!ai) return;

    // 取最近 6 条消息作为提取上下文
    const allMsgs = (await messageStore.getAll(m => m.charId === charId))
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
      .slice(0, 6)
      .reverse();

    if (allMsgs.length < 2) return;

    const convText = allMsgs.map(m =>
      `[${m.sender === 'user' ? '用户' : '角色'}] ${m.content}`
    ).join('\n');

    const extractionPrompt = (await getPrompt('charSystem', 'extraction').catch(() => null)) || FALLBACK_EXTRACTION_PROMPT;
    const messages = [
      { role: 'system', content: extractionPrompt },
      { role: 'user', content: convText },
    ];

    const raw = await chatCompletion(ai.client, messages, {
      model: ai.model || 'gpt-3.5-turbo',
      max_tokens: 1200,
      temperature: 0.3,
    }, {
      source: 'charSystem.extraction',
    });

    // 解析 JSON（容忍 markdown 代码块包裹）
    let data;
    try {
      const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
      data = JSON.parse(cleaned);
    } catch {
      console.warn('[extraction] JSON parse failed:', raw.slice(0, 200));
      return;
    }

    if (!data || typeof data !== 'object') return;

    const now = new Date().toISOString();

    // ── 写入状态 ──
    if (data.status && Object.keys(data.status).length > 0) {
      const existing = (await charStatStore.getAll(s => s.charId === charId))[0];
      const statusInfo = { ...(existing?.statusInfo || {}), ...data.status, lastUpdated: now };
      if (existing) {
        await charStatStore.update(existing.id, { statusInfo });
      } else {
        await charStatStore.create({
          id: genId('cs'), charId, stats: {}, statusInfo, createdAt: now,
        });
      }
      console.log('[extraction] status updated for', charId);
    }

    // ── 写入物品 ──
    if (data.items?.length > 0) {
      for (const item of data.items) {
        await itemStore.create({
          id: genId('item'), charId,
          name: item.name, emoji: item.emoji || '📦',
          description: item.description || '',
          category: item.category || 'other',
          source: item.source || null,
          emotionalValue: item.emotionalValue ?? 50,
          condition: 100, status: 'active', location: '',
          characterNotes: '', linkedTimelineIds: [],
          obtainedAt: now,
          extractedSource: 'ai-extract',
        });
      }
      console.log('[extraction]', data.items.length, 'items created for', charId);
    }

    // ── 写入时间线 ──
    if (data.timeline?.length > 0) {
      for (const ev of data.timeline) {
        await timelineStore.create({
          id: genId('tl'), charId,
          title: ev.title, content: ev.content || '',
          type: ev.type || 'event',
          timestamp: now,
          linkedItemIds: [], linkedEventId: null,
          extractedSource: 'ai-extract',
        });
      }
      console.log('[extraction]', data.timeline.length, 'timeline events for', charId);
    }

    // ── 更新关系亲密度 ──
    if (data.relations?.length > 0) {
      const existingRels = await relationStore.getAll(r => r.charId === charId);
      for (const rel of data.relations) {
        const existing = existingRels.find(r =>
          r.targetName === rel.targetName
        );
        if (existing && rel.change) {
          const delta = parseInt(rel.change) || 0;
          const newCloseness = Math.max(0, Math.min(100, (existing.closeness || 50) + delta));
          await relationStore.update(existing.id, {
            closeness: newCloseness,
            notes: rel.reason ? `${existing.notes ? existing.notes + '\n' : ''}${rel.reason}` : existing.notes,
          });
        }
        // 不自动创建新关系 — 那是更慎重的操作
      }
    }

    // ── 技能经验 ──
    if (data.skills?.length > 0) {
      const existingSkills = await skillStore.getAll(s => s.charId === charId);
      for (const sk of data.skills) {
        const existing = existingSkills.find(s => s.name === sk.name);
        if (existing) {
          // 已有技能 +0.5 经验（需要多次才能升级）
          // 存为浮点数，UI 显示取整
          const newExp = (existing.experience || 0) + 0.5;
          const newLevel = Math.min(5, Math.floor(newExp / 2) + 1);
          if (newLevel > existing.level) {
            await skillStore.update(existing.id, { level: newLevel, experience: newExp });
            console.log('[extraction] skill leveled up:', sk.name, newLevel);
          } else {
            await skillStore.update(existing.id, { experience: newExp });
          }
        }
        // 不自动创建新技能 — AI 有时候会编造
      }
    }

    console.log('[extraction] completed for', charId);
  } catch (err) {
    console.error('[extraction] error:', err.message);
  }
}
