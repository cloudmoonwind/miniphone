/**
 * /api/prompt-presets  —— FilesApp 的上下文预设存储
 *
 * 每个预设结构：
 * {
 *   id, name, contextItems: [{ entryId, enabled }],
 *   updatedAt, createdAt
 * }
 *
 * 自定义条目（entries）单独存储：
 * /api/prompt-entries
 */
import { Router } from 'express';
import { promptStore, activeStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router();

// ── Prompt Presets ────────────────────────────────────────────────────
router.get('/presets', async (req, res) => {
  try { res.json(await promptStore.getAll(p => p.type === 'preset')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/presets', async (req, res) => {
  try {
    const item = await promptStore.create({ ...req.body, id: genId('ppr'), type: 'preset' });
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/presets/:id', async (req, res) => {
  try {
    const updated = await promptStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/presets/:id', async (req, res) => {
  try {
    const ok = await promptStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Prompt Entries (custom) ───────────────────────────────────────────
router.get('/entries', async (req, res) => {
  try { res.json(await promptStore.getAll(e => e.type === 'entry')); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/entries', async (req, res) => {
  try {
    const item = await promptStore.create({ ...req.body, id: genId('pent'), type: 'entry' });
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/entries/:id', async (req, res) => {
  try {
    const updated = await promptStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/entries/:id', async (req, res) => {
  try {
    const ok = await promptStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Active prompt preset ──────────────────────────────────────────────
router.get('/active', async (req, res) => {
  try {
    const active = await activeStore.getObject();
    res.json({ activePromptPresetId: active?.activePromptPresetId || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/active', async (req, res) => {
  try {
    const active = await activeStore.getObject();
    await activeStore.setObject({ ...active, activePromptPresetId: req.body.id || null });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
