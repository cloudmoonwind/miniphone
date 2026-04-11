/**
 * 道枢 - 角色数值系统
 *
 *   GET  /api/charstats/:charId          - 获取角色数值快照（不存在则返回默认值）
 *   PUT  /api/charstats/:charId          - 更新角色数值（增量 patch）
 *   POST /api/charstats/:charId/delta    - 对指定属性增减（{ key, delta }）
 *
 * 属性定义（statDef）— 全局或角色专属：
 *   GET  /api/statdefs                   - 列出属性定义
 *   POST /api/statdefs                   - 新建属性定义
 *   PUT  /api/statdefs/:id               - 修改
 *   DELETE /api/statdefs/:id             - 删除
 */

import { Router } from 'express';
import { charStatStore, statDefStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';
import { getMergedStatDefs, getCharStats } from '../services/charstats.js';
import { checkStatThresholds } from '../services/charSystem.js';
export { getMergedStatDefs, getCharStats, DEFAULT_STAT_DEFS } from '../services/charstats.js';

const router = Router();

// ── 属性定义 CRUD（必须在 /:charId 之前注册，否则 Express 会把 'defs' 当 charId）────

router.get('/defs', async (req, res) => {
  try {
    const { charId } = req.query;
    const defs = await getMergedStatDefs(charId || null);
    res.json(defs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/defs', async (req, res) => {
  try {
    const { charId = null, key, name, min = 0, max = 100, defaultValue = 50, description = '' } = req.body;
    if (!key?.trim() || !name?.trim()) return res.status(400).json({ error: 'key 和 name 不能为空' });
    const def = await statDefStore.create({
      id: genId('sdef'), charId, key: key.trim(), name: name.trim(),
      min, max, default: defaultValue, description,
    });
    res.status(201).json(def);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/defs/:id', async (req, res) => {
  try {
    const updated = await statDefStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/defs/:id', async (req, res) => {
  try {
    const ok = await statDefStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 角色数值快照 ───────────────────────────────────────────────────────────

router.get('/:charId', async (req, res) => {
  try {
    const { charId } = req.params;
    const existing = await charStatStore.getAll(s => s.charId === charId);
    if (existing.length) return res.json(existing[0]);
    // 不存在时用默认值生成快照（不写入，由前端决定是否保存）
    const defs = await getMergedStatDefs(charId);
    const stats = Object.fromEntries(defs.map(d => [d.key, d.default]));
    res.json({ charId, stats, isDefault: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:charId', async (req, res) => {
  try {
    const { charId } = req.params;
    const { stats, statusInfo } = req.body;
    const existing = await charStatStore.getAll(s => s.charId === charId);
    let patch: Record<string, any> = {};
    if (stats && typeof stats === 'object') {
      patch.stats = existing.length ? { ...existing[0].stats, ...stats } : stats;
    }
    if (statusInfo && typeof statusInfo === 'object') {
      patch.statusInfo = { ...(existing[0]?.statusInfo || {}), ...statusInfo, lastUpdated: new Date().toISOString() };
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'stats 或 statusInfo 至少提供一个' });
    const prevStats = existing.length ? { ...existing[0].stats } : {};
    let record;
    if (existing.length) {
      record = await charStatStore.update(existing[0].id, patch);
    } else {
      record = await charStatStore.create({ id: genId('cst'), charId, stats: stats || {}, ...patch });
    }
    // 角色系统：检查数值阈值事件
    if (patch.stats) {
      checkStatThresholds(charId, prevStats, patch.stats).catch(e => console.error('[charSystem]', e.message));
    }
    res.json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:charId/delta', async (req, res) => {
  try {
    const { charId } = req.params;
    const { key, delta } = req.body;
    if (!key || typeof delta !== 'number') return res.status(400).json({ error: 'key 和 delta 必须提供' });
    const defs = await getMergedStatDefs(charId);
    const def = defs.find(d => d.key === key);

    const existing = await charStatStore.getAll(s => s.charId === charId);
    const current = existing.length ? existing[0].stats : Object.fromEntries(defs.map(d => [d.key, d.default]));
    const prev = typeof current[key] === 'number' ? current[key] : (def?.default ?? 50);
    const min = def?.min ?? 0;
    const max = def?.max ?? 100;
    const next = Math.max(min, Math.min(max, prev + delta));
    const newStats = { ...current, [key]: next };

    let record;
    if (existing.length) {
      record = await charStatStore.update(existing[0].id, { stats: newStats });
    } else {
      record = await charStatStore.create({ id: genId('cst'), charId, stats: newStats });
    }
    // 角色系统：检查数值阈值事件
    checkStatThresholds(charId, current, newStats).catch(e => console.error('[charSystem]', e.message));
    res.json({ ...record, changed: { key, prev, next, delta } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
