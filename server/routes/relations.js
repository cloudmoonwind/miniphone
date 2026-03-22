import { Router } from 'express';
import { relationStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router({ mergeParams: true });

// GET /api/characters/:charId/relations
router.get('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const relations = await relationStore.getAll(r => r.charId === charId);
    res.json(relations);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/characters/:charId/relations
router.post('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const { targetName, targetEmoji = '👤', type = 'friend', closeness = 50, notes = '' } = req.body;
    if (!targetName?.trim()) return res.status(400).json({ error: '对象名称不能为空' });
    const rel = await relationStore.create({
      id: genId('rel'), charId,
      targetName: targetName.trim(), targetEmoji,
      type, // friend / romantic / rival / family / colleague / other
      closeness: Math.min(100, Math.max(0, +closeness || 50)),
      notes,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(rel);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/characters/:charId/relations/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await relationStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/characters/:charId/relations/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await relationStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
