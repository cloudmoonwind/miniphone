import { Router } from 'express';
import { mapStore, activeStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router();

// GET /api/maps
router.get('/', async (req, res) => {
  try {
    res.json(await mapStore.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/maps/active
router.get('/active', async (req, res) => {
  try {
    const active = await activeStore.getObject();
    const mapId = active.activeMapId;
    if (!mapId) return res.json(null);
    res.json(await mapStore.getById(mapId) ?? null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/maps/active
router.put('/active', async (req, res) => {
  try {
    const active = await activeStore.getObject();
    await activeStore.setObject({ ...active, activeMapId: req.body.id ?? null });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/maps
router.post('/', async (req, res) => {
  try {
    const { name, tiles, charPositions, labels, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '地图名称不能为空' });
    const map = await mapStore.create({
      id: genId('map'), name: name.trim(),
      tiles: tiles || [], charPositions: charPositions || {},
      labels: labels || {}, description: description || '',
    });
    res.status(201).json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/maps/:id
router.put('/:id', async (req, res) => {
  try {
    const updated = await mapStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/maps/:id
router.delete('/:id', async (req, res) => {
  try {
    const ok = await mapStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
