import { Router } from 'express';
import { itemStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router({ mergeParams: true });

// GET /api/characters/:charId/items
router.get('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const items = await itemStore.getAll(i => i.charId === charId);
    res.json(items.sort((a, b) => new Date(b.obtainedAt) - new Date(a.obtainedAt)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/characters/:charId/items
router.post('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const {
      name, emoji = '📦', description = '',
      category = 'other', source, emotionalValue = 50,
      condition = 100, status = 'active', location = '',
      characterNotes = '',
    } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '物品名不能为空' });
    const item = await itemStore.create({
      id: genId('item'), charId,
      name: name.trim(), emoji, description,
      category, source: source || null,
      emotionalValue, condition, status, location,
      characterNotes,
      linkedTimelineIds: [],
      obtainedAt: req.body.obtainedAt || new Date().toISOString(),
    });
    res.status(201).json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/characters/:charId/items/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await itemStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/characters/:charId/items/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await itemStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
