import { Router } from 'express';
import { skillStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router({ mergeParams: true });

// GET /api/characters/:charId/skills
router.get('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const skills = await skillStore.getAll(s => s.charId === charId);
    res.json(skills);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/characters/:charId/skills
router.post('/', async (req, res) => {
  try {
    const { charId } = req.params;
    const { name, category = 'life', level = 0, description = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '技能名不能为空' });
    const skill = await skillStore.create({
      id: genId('sk'), charId,
      name: name.trim(), category, // work / life / emotion
      level: Math.min(5, Math.max(0, +level || 0)),
      description,
      unlockedAt: new Date().toISOString(),
    });
    res.status(201).json(skill);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/characters/:charId/skills/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await skillStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/characters/:charId/skills/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await skillStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
