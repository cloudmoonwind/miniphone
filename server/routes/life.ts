/**
 * 角色生活日志 + AI 自主生活生成
 *
 *   GET    /api/characters/:charId/life           - 获取生活日志列表
 *   POST   /api/characters/:charId/life           - 手动保存一条日志
 *   DELETE /api/characters/:charId/life/:id       - 删除日志
 *   POST   /api/characters/:charId/life/generate  - AI 生成生活内容（核心功能）
 */

import { Router } from 'express';
import { lifeStore, characterStore, messageStore, presetStore, activeStore } from '../storage/index.js';
import { getClient, chatCompletion } from '../services/ai.js';
import { processLifeLog } from '../services/charSystem.js';
import { genId } from '../storage/FileStore.js';
import { getEventPool, type Event as PoolEvent } from '../services/events.js';
import { getCharStats, getMergedStatDefs } from '../services/charstats.js';
import { getPrompt } from '../services/promptPresets.js';
import { checkAndFireEvents } from '../services/eventEngine.js';

const router = Router({ mergeParams: true });

// ── 列表 ──────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const { limit = 50, date } = req.query;
    let logs = await lifeStore.getAll(l => l.charId === charId);
    if (date) logs = logs.filter(l => l.period?.startsWith(date));
    res.json(
      logs.sort((a, b) => +new Date(b.generatedAt) - +new Date(a.generatedAt)).slice(0, +limit)
    );
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 手动保存 ──────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const { type = 'activity', content, summary, period } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '内容不能为空' });
    const log = await lifeStore.create({
      id: genId('life'), charId,
      type, content: content.trim(),
      summary: summary || content.trim().slice(0, 50),
      period: period || new Date().toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
    });
    res.status(201).json(log);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 删除 ──────────────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const ok = await lifeStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI 生活生成（核心） ───────────────────────────────────────────────────

/**
 * POST /api/characters/:charId/life/generate
 * Body: {
 *   period:      "morning"|"afternoon"|"evening"|"night"  (default: 根据当前时间推断)
 *   eventCount:  number  (default: 2, 0=不注入事件)
 *   extraSystem: string  (附加在角色定义后的自定义指令，可空)
 *   save:        boolean (default: true, 是否保存到 lifeStore)
 * }
 */
router.post('/generate', async (req, res) => {
  try {
    const { charId } = req.params;
    const {
      period     = inferPeriod(),
      eventCount = 2,
      extraSystem = '',
      save       = true,
    } = req.body;

    // 1. 角色信息
    const char = await characterStore.getById(charId);
    if (!char) return res.status(404).json({ error: '角色不存在' });

    // 2. 解析 AI 客户端（用 featurePresets.life 或主 API）
    const active = await activeStore.getObject().catch(() => ({} as any));
    const featurePresetId = active?.featurePresets?.life;
    const primaryId = active?.primaryPresetId ?? active?.activePresetId;
    const resolvedId = featurePresetId || primaryId;
    let preset = null;
    if (resolvedId) preset = await presetStore.getById(resolvedId);
    if (!preset?.apiKey) return res.status(400).json({ error: '未配置 API Key，请在设置中添加 API 配置' });

    // 3. 道枢数值
    const stats = await getCharStats(charId);
    const statDefs = await getMergedStatDefs(charId);

    // 4. 从事件池中选取事件
    const eventPool = getEventPool(charId);
    const selectedEvents = pickEvents(eventPool, stats, +eventCount);

    // 5. 最近3条生活日志（从旧到新）
    const recentLogs = (await lifeStore.getAll(l => l.charId === charId))
      .sort((a, b) => +new Date(a.generatedAt) - +new Date(b.generatedAt))
      .slice(-3);

    // 6. 最近5条聊天消息（从旧到新，仅取 content + sender）
    const recentMsgs = (await messageStore.getAll(m => m.charId === charId))
      .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
      .slice(-5);

    // 7. 组装 prompt（叠加提示词预设中的 systemExtension）
    const presetSystemExt = await getPrompt('life', 'systemExtension').catch(() => null);
    const combinedExtraSystem = [extraSystem, presetSystemExt].filter(s => s && s.trim()).join('\n');
    const { systemPrompt, userPrompt } = buildLifePrompt({
      char, stats, statDefs, selectedEvents,
      recentLogs, recentMsgs, period, extraSystem: combinedExtraSystem,
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ];

    const client  = getClient(preset);
    const content = await chatCompletion(client, messages, {
      model: preset.model || 'gpt-3.5-turbo',
      temperature: preset.params?.temperature ?? 0.9,
      max_tokens: 800,
    }, {
      source: 'life.generate',
    });

    // 8. 可选保存
    const today = new Date().toISOString().slice(0, 10);
    let log = null;
    if (save) {
      log = await lifeStore.create({
        id: genId('life'), charId,
        type: 'generated',
        period: today,
        timeOfDay: period,
        content: content.trim(),
        summary: content.trim().slice(0, 60),
        eventsUsed: selectedEvents.map(e => ({ id: e.id, name: e.name })),
        statsSnapshot: stats,
        generatedAt: new Date().toISOString(),
      });
      // 角色系统：从生活日志中提取时间线事件、物品、技能
      processLifeLog(charId, log).catch(e => console.error('[charSystem]', e.message));
      // 事件引擎：time_pass_life 触发
      try {
        checkAndFireEvents(charId, { trigger: 'time_pass_life' });
      } catch (e) { console.error('[life/event-engine]', e.message); }
    }

    res.status(201).json({
      log,
      debug: {
        eventsSelected: selectedEvents.map(e => e.name),
        statsUsed: stats,
        messagesPayload: messages, // 前端终端可直接看到
      },
    });

  } catch (err) {
    console.error('[life/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

// ── 工具函数 ──────────────────────────────────────────────────────────────

function inferPeriod() {
  const h = new Date().getHours();
  if (h < 6)  return 'night';
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  if (h < 22) return 'evening';
  return 'night';
}

const PERIOD_ZH = { morning: '上午', afternoon: '下午', evening: '傍晚/晚上', night: '深夜' };

/**
 * 从事件池中选取事件
 * - 无 triggerConditions：纯随机事件，按 weight 加权随机
 * - 有 triggerConditions：检查数值条件，满足则加入候选池
 */
function pickEvents(pool: PoolEvent[], stats: Record<string, number>, count: number) {
  if (!count || !pool.length) return [];

  // 概率过滤（probability = 事件被纳入候选的概率）
  const probPool = pool.filter(e =>
    (e.probability ?? 100) >= 100 || Math.random() * 100 < (e.probability ?? 100)
  );

  // 分离：有触发条件的 vs 纯随机
  const conditional = probPool.filter(e => {
    if (!e.triggerConditions) return false;
    try {
      const cond = JSON.parse(e.triggerConditions);
      // 目前只处理单层简单条件（数值比较），复杂条件留给阶段二引擎
      const firstGroup = cond?.条件组?.[0]?.条件?.[0];
      if (!firstGroup || firstGroup.类型 !== '数值') return false;
      const val = stats[firstGroup.目标];
      if (val == null) return false;
      switch (firstGroup.比较) {
        case '>=': return val >= firstGroup.值;
        case '<=': return val <= firstGroup.值;
        case '>':  return val >  firstGroup.值;
        case '<':  return val <  firstGroup.值;
        case '==': return val === firstGroup.值;
        default:   return false;
      }
    } catch { return false; }
  });

  const random = probPool.filter(e => !e.triggerConditions);

  // 加权随机选取（条件事件优先，最多占 count 的一半）
  const selected: PoolEvent[] = [];
  const maxConditional = Math.floor(count / 2) + (count % 2);
  const picked = new Set<string>();

  const condAvail = weightedShuffle(conditional);
  for (const e of condAvail) {
    if (selected.length >= maxConditional) break;
    selected.push(e);
    picked.add(e.id);
  }

  const randAvail = weightedShuffle(random).filter(e => !picked.has(e.id));
  for (const e of randAvail) {
    if (selected.length >= count) break;
    selected.push(e);
  }

  return selected;
}

/** 按 weight 加权随机打乱 */
function weightedShuffle(entries: PoolEvent[]) {
  const weighted = entries.flatMap(e => {
    const w = Math.max(1, e.weight ?? 1);
    return Array(w).fill(e);
  });
  for (let i = weighted.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
  }
  const seen = new Set<string>();
  return weighted.filter((e: PoolEvent) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

/**
 * 组装发给 AI 的提示词
 */
function buildLifePrompt({ char, stats, statDefs, selectedEvents, recentLogs, recentMsgs, period, extraSystem }) {
  const periodZh = PERIOD_ZH[period] || period;
  const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  // System prompt：角色定义 + 生活生成指令
  const sysLines = [];
  sysLines.push(`你是${char.name}，正在进行自主的日常生活（与用户无关的独立世界）。`);
  if (char.core) sysLines.push(char.core);
  if (char.persona) sysLines.push(char.persona);

  sysLines.push('\n【生活生成规则】');
  sysLines.push('- 以第三人称叙述视角记录你今天的生活片段，细节真实，有感情起伏');
  sysLines.push('- 根据当前状态数值体现合理的行为和情绪');
  sysLines.push('- 如果有触发的情境事件，自然融入（不要直接复述事件文本）');
  sysLines.push('- 以时间节点+活动描述的格式输出，200-400字');
  sysLines.push('- 记录格式示例：\n  09:30 做早饭，煎蛋时走神了好几次…\n  10:00 翻出一本旧日记，停在某页上看了很久。');

  if (extraSystem) {
    sysLines.push('\n【附加指令】');
    sysLines.push(extraSystem);
  }

  const systemPrompt = sysLines.join('\n');

  // User prompt：上下文信息（今日状态 + 事件 + 近期记录）
  const uLines = [];
  uLines.push(`【今日】${today}　时段：${periodZh}`);

  // 道枢数值
  const statStr = statDefs
    .filter(d => stats[d.key] != null)
    .map(d => `${d.name}=${stats[d.key]}`)
    .join('　');
  if (statStr) {
    uLines.push(`\n【当前状态】${statStr}`);
    uLines.push('（请根据这些数值体现合理的行为和心理状态）');
  }

  // 触发的情境事件
  if (selectedEvents.length > 0) {
    uLines.push('\n【今日情境（可能发生的事）】');
    selectedEvents.forEach((e, i) => {
      uLines.push(`${i + 1}. ${e.content}`);
    });
    uLines.push('（请从中选择1-2个自然融入生活记录，或结合多个情境）');
  }

  // 近期生活记录
  if (recentLogs.length > 0) {
    uLines.push('\n【近期生活记录（供参考，保持连贯性）】');
    recentLogs.forEach(l => {
      const d = l.period || l.generatedAt?.slice(0, 10);
      const t = l.timeOfDay ? PERIOD_ZH[l.timeOfDay] || l.timeOfDay : '';
      uLines.push(`─ ${d}${t ? ' ' + t : ''}：${l.summary || l.content.slice(0, 80)}`);
    });
  }

  // 最近与用户的互动
  if (recentMsgs.length > 0) {
    uLines.push('\n【最近与用户的互动（user 是生活的一小部分）】');
    recentMsgs.slice(-3).forEach(m => {
      const role = m.sender === 'user' ? 'user' : char.name;
      uLines.push(`${role}：${m.content.slice(0, 60)}${m.content.length > 60 ? '…' : ''}`);
    });
  }

  uLines.push(`\n请生成${char.name}今天${periodZh}的生活记录：`);

  return { systemPrompt, userPrompt: uLines.join('\n') };
}
