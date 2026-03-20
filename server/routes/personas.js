/**
 * 命格 — 用户马甲（User Persona）API
 *
 *   GET    /api/personas            - 列出所有马甲
 *   POST   /api/personas            - 创建马甲
 *   PUT    /api/personas/:id        - 更新马甲
 *   DELETE /api/personas/:id        - 删除马甲
 *   POST   /api/personas/:id/activate - 设为当前活跃马甲
 */
import { Router } from 'express';
import { personaStore, activeStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const personas = await personaStore.getAll();
    const active = await activeStore.getObject().catch(() => ({}));
    res.json({ personas, activePersonaId: active.activePersonaId || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, avatar = '🙂', description = '', color = '#6366f1' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '名称不能为空' });
    const persona = await personaStore.create({
      id: genId('prs'), name: name.trim(), avatar, description, color,
    });
    res.status(201).json(persona);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await personaStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const ok = await personaStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    // 若删的是当前活跃马甲，清除
    const active = await activeStore.getObject().catch(() => ({}));
    if (active.activePersonaId === req.params.id) {
      await activeStore.setObject({ ...active, activePersonaId: null });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/activate', async (req, res) => {
  try {
    const persona = await personaStore.getById(req.params.id);
    if (!persona) return res.status(404).json({ error: 'Not found' });
    const active = await activeStore.getObject().catch(() => ({}));
    await activeStore.setObject({ ...active, activePersonaId: req.params.id });
    res.json({ ok: true, activePersonaId: req.params.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/deactivate', async (req, res) => {
  try {
    const active = await activeStore.getObject().catch(() => ({}));
    await activeStore.setObject({ ...active, activePersonaId: null });
    res.json({ ok: true, activePersonaId: null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
