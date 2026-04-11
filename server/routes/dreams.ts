import { Router } from 'express';
import { dreamStore, characterStore, lifeStore, messageStore, memoryStore, presetStore, activeStore } from '../storage/index.js';
import { getClient, chatCompletion } from '../services/ai.js';
import { genId } from '../storage/FileStore.js';

const router = Router({ mergeParams: true });

// GET /api/characters/:charId/dreams
router.get('/', async (req, res) => {
  try {
    const dreams = await dreamStore.getAll(d => d.charId === req.params.charId);
    res.json(dreams.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/characters/:charId/dreams
router.post('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const { title, content, type = 'emotion', importance = 5, skyX, skyY } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: '标题不能为空' });
    const dream = await dreamStore.create({
      id: genId('drm'), charId,
      title: title.trim(), content: content || '',
      type, importance: Math.min(10, Math.max(1, +importance)),
      interpreted: false, interpretation: '', summary: '',
      timestamp: req.body.timestamp || new Date().toISOString(),
      skyX: skyX ?? Math.random() * 80 + 10,
      skyY: skyY ?? Math.random() * 50 + 5,
    });
    res.status(201).json(dream);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/characters/:charId/dreams/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await dreamStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/characters/:charId/dreams/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await dreamStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI 梦境生成 ───────────────────────────────────────────────────────────
// POST /api/characters/:charId/dreams/generate
// Body: { trigger?: string, extraSystem?: string, save?: boolean }
router.post('/generate', async (req, res) => {
  try {
    const { charId } = req.params;
    const { trigger = '', extraSystem = '', save = true } = req.body;

    // 1. 角色信息
    const char = await characterStore.getById(charId);
    if (!char) return res.status(404).json({ error: '角色不存在' });

    // 2. 解析 AI 客户端（优先用 featurePresets.dreams，否则 primary）
    const active = await activeStore.getObject().catch(() => ({} as any));
    const featurePresetId = active?.featurePresets?.dreams;
    const primaryId = active?.primaryPresetId ?? active?.activePresetId;
    const resolvedId = featurePresetId || primaryId;
    let preset = null;
    if (resolvedId) preset = await presetStore.getById(resolvedId);
    if (!preset?.apiKey) return res.status(400).json({ error: '未配置 API Key，请在设置中添加 API 配置' });

    // 3. 组装上下文
    const recentLife = (await lifeStore.getAll(l => l.charId === charId))
      .sort((a, b) => +new Date(b.generatedAt) - +new Date(a.generatedAt))
      .slice(0, 3)
      .reverse();

    const recentMsgs = (await messageStore.getAll(m => m.charId === charId))
      .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
      .slice(-8);

    const memories = (await memoryStore.getAll(m => m.charId === charId))
      .filter(m => (m.importance ?? 5) >= 6)
      .slice(0, 5);

    // 4. 组装 prompt
    const charDesc = [char.core, char.persona].filter(Boolean).join('\n');
    const lifeCtx  = recentLife.map(l => `[${l.period || '近日'}] ${l.summary || l.content}`).join('\n') || '（暂无近期生活记录）';
    const memCtx   = memories.map(m => m.content || m.text).filter(Boolean).join('\n') || '（暂无重要记忆）';
    const chatCtx  = recentMsgs.map(m => `${m.sender === 'user' ? '用户' : char.name}：${m.content}`).join('\n') || '（暂无近期对话）';
    const triggerCtx = trigger ? `\n今晚梦境的触发背景：${trigger}` : '';

    const systemPrompt = `你是角色"${char.name}"的潜意识。你的任务是以第一人称为TA生成一个真实的梦境叙述。

角色设定：
${charDesc}

角色的重要记忆：
${memCtx}

角色近期生活：
${lifeCtx}
${extraSystem ? `\n附加指令：${extraSystem}` : ''}

请生成一个梦境，要求：
- 以第一人称视角（"我"）描述，像日记一样真实
- 内容要折射角色的情绪、恐惧、渴望或近期经历
- 结构分段：场景描写→情感变化→关键意象
- 长度150-300字，不要解释这是梦境，直接进入叙述
- 结尾模糊、不完整，像真实梦境一样`;

    const userPrompt = `最近与用户的对话摘要：
${chatCtx}${triggerCtx}

请根据以上信息生成今晚的梦境内容，同时在最后用JSON格式单独输出元数据（另起一行）：
{"title":"梦境标题（5-12字）","type":"emotion|omen|memory|desire","importance":1-10}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ];

    const client  = getClient(preset);
    const rawText = await chatCompletion(client, messages, {
      model:      preset.model,
      max_tokens: preset.maxTokens ?? 600,
      temperature: 0.9,
    });

    // 5. 解析内容和元数据
    const metaMatch = rawText.match(/\{[\s\S]*?"title"[\s\S]*?\}/);
    let title = '今夜的梦', type = 'emotion', importance = 5;
    let content = rawText;
    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[0]);
        title      = meta.title      || title;
        type       = meta.type       || type;
        importance = meta.importance || importance;
        content    = rawText.slice(0, rawText.lastIndexOf(metaMatch[0])).trim();
      } catch {}
    }

    const dream = {
      id: genId('drm'), charId,
      title, content, type,
      importance: Math.min(10, Math.max(1, +importance)),
      interpreted: false, interpretation: '', aiGenerated: true,
      timestamp: new Date().toISOString(),
      skyX: Math.random() * 78 + 11,
      skyY: Math.random() * 52 + 5,
    };

    if (save) await dreamStore.create(dream);
    res.json(dream);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
