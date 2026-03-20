import { Router } from 'express';
import { dreamStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router({ mergeParams: true });

// GET /api/characters/:charId/dreams
router.get('/', async (req, res) => {
  try {
    const dreams = await dreamStore.getAll(d => d.charId === req.params.charId);
    res.json(dreams.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
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

// PUT /api/dreams/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await dreamStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/dreams/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await dreamStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
