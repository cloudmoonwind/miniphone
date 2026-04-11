import { Router } from 'express';
import { presetStore, activeStore, promptStore } from '../storage/index.js';
import { getClient, listModels } from '../services/ai.js';
import { PROVIDER_CONFIGS } from '../providers/index.js';
import { genId } from '../storage/FileStore.js';
import { BUILTIN_PROMPT_PRESETS } from '../services/promptPresets.js';

const router = Router();

// ── Presets ──────────────────────────────────────────────────────────

// GET /api/settings/presets
router.get('/presets', async (req, res) => {
  try {
    res.json(await presetStore.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/providers — 返回各 provider 的配置（前端用于填充表单）
router.get('/providers', (_req, res) => {
  res.json(PROVIDER_CONFIGS);
});

// POST /api/settings/presets
router.post('/presets', async (req, res) => {
  try {
    const { name, apiKey, baseURL, model, provider, params, contextMode, stream } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '名称不能为空' });
    if (!apiKey?.trim()) return res.status(400).json({ error: 'API Key 不能为空' });
    const preset = await presetStore.create({
      id: genId('preset'),
      name: name.trim(), apiKey: apiKey.trim(),
      baseURL: baseURL || '', model: model || '',
      provider: provider || 'openai',
      params: params || { temperature: 0.7 },
      contextMode: contextMode || 'flexible',
      stream: !!stream,
    });
    res.status(201).json(preset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/presets/:id
router.put('/presets/:id', async (req, res) => {
  try {
    const updated = await presetStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/settings/presets/:id
router.delete('/presets/:id', async (req, res) => {
  try {
    const ok = await presetStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    // If this was the active preset, clear it
    const active = await activeStore.getObject();
    if (active.activePresetId === req.params.id) {
      await activeStore.setObject({ ...active, activePresetId: null });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Active preset ─────────────────────────────────────────────────────

// GET /api/settings/active-preset  (primary preset)
router.get('/active-preset', async (req, res) => {
  try {
    const active = await activeStore.getObject();
    const presetId = active.primaryPresetId ?? active.activePresetId;
    if (!presetId) return res.json(null);
    const preset = await presetStore.getById(presetId);
    res.json(preset ?? null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/active-preset  (set primary preset)
router.put('/active-preset', async (req, res) => {
  try {
    const { id } = req.body;
    const active = await activeStore.getObject();
    await activeStore.setObject({ ...active, primaryPresetId: id ?? null, activePresetId: id ?? null });
    res.json({ ok: true, primaryPresetId: id ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Feature presets ────────────────────────────────────────────────

// GET /api/settings/feature-presets
router.get('/feature-presets', async (req, res) => {
  try {
    const active = await activeStore.getObject();
    res.json(active.featurePresets || { summaries: null, dafu: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/feature-presets
router.put('/feature-presets', async (req, res) => {
  try {
    const active = await activeStore.getObject();
    const merged = { ...(active.featurePresets || {}), ...req.body };
    await activeStore.setObject({ ...active, featurePresets: merged });
    res.json({ ok: true, featurePresets: merged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 时间戳设置 ──────────────────────────────────────────────────────

// GET /api/settings/timestamp
router.get('/timestamp', async (_req, res) => {
  try {
    const active = await activeStore.getObject();
    res.json(active?.timestampSettings || { sendUserTimestamp: true, sendCharTimestamp: false, syncConfirmed: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/timestamp
router.put('/timestamp', async (req, res) => {
  try {
    const active  = await activeStore.getObject();
    const current = active?.timestampSettings || {};
    const updated = { ...current, ...req.body };
    await activeStore.setObject({ ...active, timestampSettings: updated });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/summary-prompts
router.get('/summary-prompts', async (_req, res) => {
  try {
    const active = await activeStore.getObject();
    res.json(active?.summaryPrompts || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/summary-prompts
router.put('/summary-prompts', async (req, res) => {
  try {
    const active  = await activeStore.getObject();
    const updated = { ...(active?.summaryPrompts || {}), ...req.body };
    await activeStore.setObject({ ...active, summaryPrompts: updated });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Prompt presets ─────────────────────────────────────────────────

// GET /api/settings/prompt-presets  (?feature=xxx 可选过滤)
router.get('/prompt-presets', async (req, res) => {
  try {
    const { feature } = req.query;
    let userPresets = await promptStore.getAll();
    let all = [...BUILTIN_PROMPT_PRESETS, ...userPresets];
    if (feature) all = all.filter(p => p.feature === feature);
    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/prompt-presets
router.post('/prompt-presets', async (req, res) => {
  try {
    const { name, feature, description, prompts } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '名称不能为空' });
    if (!feature)      return res.status(400).json({ error: 'feature 不能为空' });
    const preset = await promptStore.create({
      id: genId('pp'),
      name: name.trim(),
      feature,
      description: description || '',
      prompts: prompts || {},
      builtin: false,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(preset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/prompt-presets/:id
router.put('/prompt-presets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (BUILTIN_PROMPT_PRESETS.find(p => p.id === id)) {
      return res.status(403).json({ error: '内置预设不可修改' });
    }
    const updated = await promptStore.update(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/settings/prompt-presets/:id
router.delete('/prompt-presets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (BUILTIN_PROMPT_PRESETS.find(p => p.id === id)) {
      return res.status(403).json({ error: '内置预设不可删除' });
    }
    const ok = await promptStore.delete(id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/feature-prompt-presets
router.get('/feature-prompt-presets', async (_req, res) => {
  try {
    const active = await activeStore.getObject();
    res.json(active?.featurePromptPresets || { summaries: null, life: null, charSystem: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/feature-prompt-presets
router.put('/feature-prompt-presets', async (req, res) => {
  try {
    const active  = await activeStore.getObject();
    const merged  = { ...(active?.featurePromptPresets || {}), ...req.body };
    await activeStore.setObject({ ...active, featurePromptPresets: merged });
    res.json({ ok: true, featurePromptPresets: merged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Context budget ─────────────────────────────────────────────────

// GET /api/settings/context-budget
router.get('/context-budget', async (_req, res) => {
  try {
    const active = await activeStore.getObject();
    res.json({ maxTokens: active?.contextBudget ?? 4000 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/context-budget
router.put('/context-budget', async (req, res) => {
  try {
    const { maxTokens } = req.body;
    const active = await activeStore.getObject();
    await activeStore.setObject({ ...active, contextBudget: maxTokens });
    res.json({ maxTokens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── AI utility routes (kept for compatibility) ─────────────────────

// POST /api/settings/models  (also aliased as POST /api/models for old clients)
router.post('/models', async (req, res) => {
  const { apiKey, baseURL, provider } = req.body;
  if (!apiKey) return res.status(400).json({ success: false, message: 'API Key 不能为空' });
  try {
    const client = getClient({ apiKey, baseURL, provider });
    const models = await listModels(client);
    res.json({ success: true, models });
  } catch (err) {
    // 不透传服务商的原始状态码（如 404），统一返回 502 让前端识别为上游错误
    res.status(502).json({ success: false, message: err.message });
  }
});

// POST /api/settings/test-connection
router.post('/test-connection', async (req, res) => {
  const { apiKey, baseURL, model, provider } = req.body;
  if (!apiKey) return res.status(400).json({ success: false, message: 'API Key 不能为空' });
  try {
    const p = getClient({ apiKey, baseURL, provider });
    await p.chatCompletion([{ role: 'user', content: 'Hi' }], {
      model: model || 'gpt-4o-mini',
      max_tokens: 500,
    });
    res.json({ success: true, message: '连接成功' });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
});

export default router;
