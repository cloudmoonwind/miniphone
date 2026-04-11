import { Router } from 'express';
import { timelineStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router({ mergeParams: true });

// GET /api/characters/:charId/timeline
router.get('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const entries = await timelineStore.getAll(e => e.charId === charId);
    res.json(entries.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/characters/:charId/timeline
router.post('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const { title, content = '', type = 'event', timestamp } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: '标题不能为空' });
    const entry = await timelineStore.create({
      id: genId('tl'), charId,
      title: title.trim(), content,
      type, // event / chat / custom
      timestamp: timestamp || new Date().toISOString(),
      linkedItemIds: [],
    });
    res.status(201).json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/characters/:charId/timeline/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await timelineStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/characters/:charId/timeline/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await timelineStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
