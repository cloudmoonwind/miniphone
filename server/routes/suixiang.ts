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
import { suixiangCardStore, suixiangEntryStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

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

export default router;
