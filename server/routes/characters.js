import { Router } from 'express';
import { characterStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router();

// GET /api/characters
router.get('/', async (req, res) => {
  try {
    const chars = await characterStore.getAll();
    res.json(chars);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/characters/:id
router.get('/:id', async (req, res) => {
  try {
    const char = await characterStore.getById(req.params.id);
    if (!char) return res.status(404).json({ error: 'Not found' });
    res.json(char);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/characters
router.post('/', async (req, res) => {
  try {
    const { name, avatar, tags, group, core, persona, apiPresetId, isFavorite, isBlacklisted } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '名称不能为空' });
    const char = await characterStore.create({
      id: genId('char'),
      name: name.trim(),
      avatar: avatar || '',
      tags: tags || [],
      group: group || '',
      core: core || '',
      persona: persona || '',
      apiPresetId: apiPresetId || null,
      isFavorite: !!isFavorite,
      isBlacklisted: !!isBlacklisted,
    });
    res.status(201).json(char);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/characters/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await characterStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/characters/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await characterStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
