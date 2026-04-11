import { Router } from 'express';
import { memoryStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router({ mergeParams: true });

// GET /api/characters/:charId/memories
router.get('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const memories = await memoryStore.getAll(m => m.charId === charId);
    res.json(memories.sort((a, b) => b.importance - a.importance));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/characters/:charId/memories
router.post('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const { category = 'event', content, source = 'manual', sourceId, importance = 5, tags = [] } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '内容不能为空' });
    const memory = await memoryStore.create({
      id: genId('mem'), charId,
      category, content: content.trim(),
      source, sourceId: sourceId || null,
      importance: Math.min(10, Math.max(1, +importance)),
      tags,
    });
    res.status(201).json(memory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/memories/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await memoryStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/memories/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await memoryStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
