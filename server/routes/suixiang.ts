/**
 * 随想 API — 卡片式随笔
 *
 *   GET    /api/suixiang/cards             - 列出所有卡片（按更新时间倒序）
 *   POST   /api/suixiang/cards             - 创建新卡片
 *   PUT    /api/suixiang/cards/:id         - 更新卡片（title/color/pinned）
 *   DELETE /api/suixiang/cards/:id         - 删除卡片及其所有条目
 *
 *   GET    /api/suixiang/cards/:cardId/entries  - 列出卡片下的所有条目
 *   POST   /api/suixiang/cards/:cardId/entries  - 在卡片下新增条目
 *   PUT    /api/suixiang/entries/:id            - 更新条目内容
 *   DELETE /api/suixiang/entries/:id            - 删除条目
 */
import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { suixiangCardStore, suixiangEntryStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

// ── 流场文件存储目录 ──────────────────────────────────────────────────────────
const FF_DIR    = path.join(process.cwd(), 'data', 'flowfields');
const FF_ACTIVE = path.join(FF_DIR, '_active.txt');
const FF_NAME   = /^[\w\u4e00-\u9fa5\-]+$/u; // 合法文件名

async function ensureFFDir() {
  await fs.mkdir(FF_DIR, { recursive: true });
}

const router = Router();

// ── 卡片 ──────────────────────────────────────────────────────────────────────

router.get('/cards', async (req, res) => {
  try {
    const cards = await suixiangCardStore.getAll();
    // 每张卡片附上最新条目的预览
    const entries = await suixiangEntryStore.getAll();
    const enriched = cards.map(card => {
      const cardEntries = entries.filter(e => e.cardId === card.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        ...card,
        entryCount: cardEntries.length,
        latestEntry: cardEntries[0] || null,
      };
    }).sort((a, b) => {
      // 置顶优先，然后按更新时间倒序
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cards', async (req, res) => {
  try {
    const { title = '新随想', color = '#6366f1', pinned = false } = req.body;
    const now = new Date().toISOString();
    const card = await suixiangCardStore.create({
      id: genId('sc'),
      title: title.trim() || '新随想',
      color,
      pinned,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json(card);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/cards/:id', async (req, res) => {
  try {
    const updated = await suixiangCardStore.update(req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/cards/:id', async (req, res) => {
  try {
    const ok = await suixiangCardStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    // 同步删除该卡片下所有条目
    const entries = await suixiangEntryStore.getAll();
    for (const e of entries.filter(e => e.cardId === req.params.id)) {
      await suixiangEntryStore.delete(e.id);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 条目 ──────────────────────────────────────────────────────────────────────

router.get('/cards/:cardId/entries', async (req, res) => {
  try {
    const entries = await suixiangEntryStore.getAll(e => e.cardId === req.params.cardId);
    res.json(entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/cards/:cardId/entries', async (req, res) => {
  try {
    const { content, mood = null } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '内容不能为空' });
    const now = new Date().toISOString();
    const entry = await suixiangEntryStore.create({
      id: genId('se'),
      cardId: req.params.cardId,
      content: content.trim(),
      mood,
      createdAt: now,
      updatedAt: now,
    });
    // 更新卡片的 updatedAt
    await suixiangCardStore.update(req.params.cardId, { updatedAt: now });
    res.status(201).json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/entries/:id', async (req, res) => {
  try {
    const updated = await suixiangEntryStore.update(req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/entries/:id', async (req, res) => {
  try {
    const ok = await suixiangEntryStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// 流场文件 API
//   GET    /flowfields          — 列出所有已保存流场（含 active 标记）
//   GET    /flowfields/active   — 返回当前启用流场的完整数据（未启用返回 null）
//   PUT    /flowfields/active   — 设置启用文件 { name } (name 为空 = 取消启用)
//   GET    /flowfields/:name    — 获取指定流场完整数据
//   POST   /flowfields          — 保存新流场 { name, gridW, gridH, cells }
//   DELETE /flowfields/:name    — 删除指定流场
// ══════════════════════════════════════════════════════════════════════════════

// ── 列表 ──────────────────────────────────────────────────────────────────────
router.get('/flowfields', async (req, res) => {
  try {
    await ensureFFDir();
    let active = '';
    try { active = (await fs.readFile(FF_ACTIVE, 'utf-8')).trim(); } catch {}
    const files = await fs.readdir(FF_DIR);
    const list = files
      .filter(f => f.endsWith('.json'))
      .map(f => ({ name: f.slice(0, -5), active: f.slice(0, -5) === active }));
    res.json(list);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 当前启用的完整数据（路由需在 /:name 之前）────────────────────────────────
router.get('/flowfields/active', async (req, res) => {
  try {
    let active = '';
    try { active = (await fs.readFile(FF_ACTIVE, 'utf-8')).trim(); } catch {}
    if (!active) return res.json(null);
    const fp = path.join(FF_DIR, `${active}.json`);
    const raw = await fs.readFile(fp, 'utf-8');
    res.json(JSON.parse(raw));
  } catch { res.json(null); }
});

// ── 设置启用文件 ──────────────────────────────────────────────────────────────
router.put('/flowfields/active', async (req, res) => {
  try {
    await ensureFFDir();
    const name: string = req.body?.name ?? '';
    if (name && !FF_NAME.test(name)) return res.status(400).json({ error: '非法文件名' });
    await fs.writeFile(FF_ACTIVE, name, 'utf-8');
    res.json({ active: name });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 获取指定流场 ──────────────────────────────────────────────────────────────
router.get('/flowfields/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    if (!FF_NAME.test(name)) return res.status(400).json({ error: '非法文件名' });
    const fp = path.join(FF_DIR, `${name}.json`);
    const raw = await fs.readFile(fp, 'utf-8');
    res.json(JSON.parse(raw));
  } catch { res.status(404).json({ error: '文件不存在' }); }
});

// ── 保存新流场（名称重复返回 409）────────────────────────────────────────────
router.post('/flowfields', async (req, res) => {
  try {
    await ensureFFDir();
    const { name, gridW, gridH, cells } = req.body ?? {};
    if (!name?.trim()) return res.status(400).json({ error: '名称不能为空' });
    if (!FF_NAME.test(name)) return res.status(400).json({ error: '名称含非法字符（仅限中英文/数字/下划线/连字符）' });
    const fp = path.join(FF_DIR, `${name}.json`);
    try { await fs.access(fp); return res.status(409).json({ error: '已存在同名文件' }); } catch {}
    // Round angles to 1 decimal to keep files compact
    const compact = (cells as any[])?.map((c: any) => ({
      w: !!c.water, a: Math.round((c.angle ?? 90) * 10) / 10,
    }));
    await fs.writeFile(fp, JSON.stringify({ name, gridW, gridH, cells: compact }), 'utf-8');
    res.status(201).json({ name });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 删除流场 ──────────────────────────────────────────────────────────────────
router.delete('/flowfields/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    if (!FF_NAME.test(name)) return res.status(400).json({ error: '非法文件名' });
    const fp = path.join(FF_DIR, `${name}.json`);
    await fs.unlink(fp);
    // 如果删除的是当前启用文件，清空 active
    try {
      const active = (await fs.readFile(FF_ACTIVE, 'utf-8')).trim();
      if (active === name) await fs.writeFile(FF_ACTIVE, '', 'utf-8');
    } catch {}
    res.json({ ok: true });
  } catch { res.status(404).json({ error: '文件不存在' }); }
});

export default router;
