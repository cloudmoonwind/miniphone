import { Router } from 'express';
import { messageStore, summaryStore, presetStore, activeStore } from '../storage/index.js';
import { getClient, chatCompletion } from '../services/ai.js';
import { genId } from '../storage/FileStore.js';
import { evaluateSummaryForTimeline } from '../services/charSystem.js';
import { getPrompt, BUILTIN_PROMPT_PRESETS } from '../services/promptPresets.js';

// ── 各类型内置默认提示词（兜底用）──────────────────────────────────
const _builtinSummaries = BUILTIN_PROMPT_PRESETS.find(p => p.id === 'builtin-summaries-default');
const DEFAULT_PROMPTS = _builtinSummaries?.prompts || {
  segment:  '你是一个对话总结助手。请用简洁的中文总结以下对话段的关键信息，重点记录情感变化、重要事件和关键细节，100字以内。',
  daily:    '你是一个对话总结助手。请用中文为以下对话生成一份日记式总结，记录当天的重要互动、情感变化和关键事件，200字以内。',
  mode:     '你是一个对话总结助手。请用简洁中文总结以下模式段（线上/线下）对话的关键内容，80字以内。',
  periodic: '你是一个对话总结助手。请用简洁中文总结以下这段对话的核心事件和情感状态，100字以内。',
};

/** 读取活跃提示词预设中的对应 key，fallback 到内置默认 */
async function getSummaryPrompt(type) {
  try {
    const val = await getPrompt('summaries', type);
    // getPrompt returns null for empty string (life.systemExtension), but for summaries we want actual text
    if (val !== null && val !== '') return val;
    return DEFAULT_PROMPTS[type] || DEFAULT_PROMPTS.segment;
  } catch {
    return DEFAULT_PROMPTS[type] || DEFAULT_PROMPTS.segment;
  }
}

const router = Router({ mergeParams: true });

// GET /api/characters/:charId/summaries
router.get('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const { type, level } = req.query;
    const summaries = await summaryStore.getAll(s =>
      s.charId === charId &&
      (!type  || s.type  === type) &&
      (!level || s.level === level)
    );
    res.json(summaries.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/characters/:charId/summaries  – manual create / save edited summary
router.post('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const { personaId, type = 'conversation', level = 'segment', sourceIds = [], content, period, importance = 5, keywords = [] } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '内容不能为空' });
    const summary = await summaryStore.create({
      id: genId('sum'), charId, personaId: personaId || null,
      type, level, sourceIds, content: content.trim(),
      period: period || null,
      importance: Math.min(10, Math.max(1, +importance)),
      keywords,
    });
    // 角色系统：评估是否值得记入时间线
    evaluateSummaryForTimeline(charId, summary).catch(e => console.error('[charSystem]', e.message));
    res.status(201).json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/characters/:charId/summaries/generate  – AI-powered summarization
router.post('/generate', async (req, res) => {
  try {
    const { charId } = req.params;
    const { personaId, messageIds, periodFrom, periodTo, type = 'conversation', level = 'segment', apiKey, baseURL, model } = req.body;

    // Get the messages to summarize
    const allMsgs = await messageStore.getAll(m => m.charId === charId);
    const sorted = allMsgs.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
    const toSummarize = messageIds?.length > 0
      ? sorted.filter(m => messageIds.includes(m.id))
      : (periodFrom && periodTo)
        ? sorted.filter(m => m.timestamp >= periodFrom && m.timestamp <= periodTo)
        : sorted.slice(-30);

    if (toSummarize.length === 0) return res.status(400).json({ error: '没有可总结的消息' });

    // Resolve AI client: feature preset first, then primary
    let aiKey = apiKey, aiBase = baseURL, aiModel = model;
    let aiPreset = null;
    if (!aiKey) {
      const active = await activeStore.getObject();
      const featurePresetId = active?.featurePresets?.summaries;
      const primaryId = active?.primaryPresetId ?? active?.activePresetId;
      const resolvedId = featurePresetId || primaryId;
      if (resolvedId) {
        const preset = await presetStore.getById(resolvedId);
        if (preset) { aiPreset = preset; aiKey = preset.apiKey; aiBase = preset.baseURL; aiModel = preset.model; }
      }
    }

    const summaryType = (type === 'mode') ? 'mode' : (type === 'periodic') ? 'periodic' : 'segment';
    const systemPrompt = await getSummaryPrompt(summaryType);
    const convText = toSummarize.map(m => `${m.sender === 'user' ? '用户' : '角色'}：${m.content}`).join('\n');
    const promptMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: convText },
    ];

    const client = getClient(aiPreset || { apiKey: aiKey, baseURL: aiBase });
    const content = await chatCompletion(
      client,
      promptMessages,
      { model: aiModel || 'gpt-4o-mini', max_tokens: 300 },
      { source: 'summaries.generate' },
    );

    const period = {
      from: toSummarize[0].timestamp,
      to: toSummarize[toSummarize.length - 1].timestamp,
    };

    const summary = await summaryStore.create({
      id: genId('sum'), charId, personaId: personaId || null,
      type, level, sourceIds: toSummarize.map(m => m.id),
      content, period, importance: 5, keywords: [],
    });

    // 角色系统：评估是否值得记入时间线
    evaluateSummaryForTimeline(charId, summary).catch(e => console.error('[charSystem]', e.message));
    res.status(201).json(summary);
  } catch (err) {
    console.error('[summaries/generate]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/characters/:charId/summaries/by-date?date=2026-03-14
// 返回指定日期的日总结，以及当天所有 periodic/mode 总结
router.get('/by-date', async (req, res) => {
  try {
    const { charId } = req.params;
    const { date }   = req.query; // 格式 YYYY-MM-DD
    if (!date) return res.status(400).json({ error: '缺少 date 参数' });

    const dayStart = new Date(`${date}T00:00:00.000Z`).toISOString();
    const dayEnd   = new Date(`${date}T23:59:59.999Z`).toISOString();

    const summaries = await summaryStore.getAll(s => {
      if (s.charId !== charId) return false;
      // 按日期存的 day 总结
      if (s.type === 'day' && s.date === date) return true;
      // period 在这一天内的总结
      const from = s.period?.from;
      const to   = s.period?.to;
      if (from && to) {
        return (from >= dayStart && from <= dayEnd) || (to >= dayStart && to <= dayEnd) ||
               (from <= dayStart && to >= dayEnd);
      }
      return false;
    });

    res.json(summaries.sort((a, b) => +new Date(a.period?.from || a.createdAt) - +new Date(b.period?.from || b.createdAt)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/characters/:charId/summaries/generate-daily  – 手动触发日总结
// body: { date: "2026-03-14" }（不传则默认昨天）
router.post('/generate-daily', async (req, res) => {
  try {
    const { charId }  = req.params;
    const targetDate  = req.body.date || (() => {
      const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10);
    })();

    // 检查是否已有当天的 day 总结
    const existing = await summaryStore.getAll(s => s.charId === charId && s.type === 'day' && s.date === targetDate);
    if (existing.length) return res.json({ skipped: true, reason: '当天已有日总结', existing: existing[0] });

    // 取当天的所有消息
    const dayStart = new Date(`${targetDate}T00:00:00.000Z`).toISOString();
    const dayEnd   = new Date(`${targetDate}T23:59:59.999Z`).toISOString();
    const allMsgs  = await messageStore.getAll(m =>
      m.charId === charId && m.timestamp >= dayStart && m.timestamp <= dayEnd
    );

    if (!allMsgs.length) return res.status(400).json({ error: `${targetDate} 没有消息记录` });

    const sorted = allMsgs.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));

    // 解析 AI 客户端
    let aiPreset = null;
    const active = await activeStore.getObject();
    const featurePresetId = active?.featurePresets?.summaries;
    const primaryId       = active?.primaryPresetId ?? active?.activePresetId;
    const resolvedId      = featurePresetId || primaryId;
    if (resolvedId) {
      aiPreset = await presetStore.getById(resolvedId);
    }
    if (!aiPreset?.apiKey) return res.status(400).json({ error: '未配置 API Key' });

    const systemPrompt = await getSummaryPrompt('daily');
    const convText = sorted.map(m => `${m.sender === 'user' ? '用户' : '角色'}：${m.content}`).join('\n');
    const promptMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: convText },
    ];

    const client  = getClient(aiPreset);
    const content = await chatCompletion(
      client,
      promptMessages,
      { model: aiPreset.model || 'gpt-3.5-turbo', max_tokens: 500 },
      { source: 'summaries.generateDaily' },
    );

    const summary = await summaryStore.create({
      id: genId('sum'), charId, personaId: null,
      type: 'day', level: 'day', date: targetDate,
      sourceIds: sorted.map(m => m.id),
      content,
      period: { from: sorted[0].timestamp, to: sorted[sorted.length - 1].timestamp },
      importance: 5, keywords: [],
      createdAt: new Date().toISOString(),
    });

    // 角色系统：日总结通常值得记入时间线
    evaluateSummaryForTimeline(charId, { ...summary, importance: 7 }).catch(e => console.error('[charSystem]', e.message));
    res.status(201).json(summary);
  } catch (err) {
    console.error('[generate-daily]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/characters/:charId/summaries/settings  – 读写自动总结设置
router.get('/settings', async (_req, res) => {
  try {
    const active = await activeStore.getObject();
    res.json(active?.summarySettings || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.put('/settings', async (req, res) => {
  try {
    const active   = await activeStore.getObject();
    const current  = active?.summarySettings || {};
    const updated  = { ...current, ...req.body };
    await activeStore.setObject({ ...active, summarySettings: updated });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/summaries/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await summaryStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
