/**
 * 日记/随笔 API
 *
 *   GET    /api/diary               - 列出条目（?month=YYYY-MM 过滤）
 *   POST   /api/diary               - 创建条目
 *   PUT    /api/diary/:id           - 更新条目
 *   DELETE /api/diary/:id           - 删除条目
 */
import { Router } from 'express';
import { diaryStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { month } = req.query; // 'YYYY-MM'
    let entries = await diaryStore.getAll();
    if (month) entries = entries.filter(e => e.date?.startsWith(month));
    res.json(entries.sort((a, b) => (b.date || '').localeCompare(a.date || '')));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { title = '', content, date, type = 'diary', mood = null } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '内容不能为空' });
    const entry = await diaryStore.create({
      id: genId('diary'),
      date: date || new Date().toISOString().slice(0, 10),
      title: title.trim(),
      content: content.trim(),
      type,
      mood,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await diaryStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const ok = await diaryStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
