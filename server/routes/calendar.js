/**
 * 日历/备忘录 API
 *
 *   GET    /api/calendar           - 列出事件（?month=YYYY-MM 或 ?date=YYYY-MM-DD 过滤）
 *   POST   /api/calendar           - 创建事件
 *   PUT    /api/calendar/:id       - 更新事件
 *   DELETE /api/calendar/:id       - 删除事件
 */
import { Router } from 'express';
import { calendarStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { month, date } = req.query;
    let events = await calendarStore.getAll();
    if (date)  events = events.filter(e => e.date === date);
    else if (month) events = events.filter(e => e.date?.startsWith(month));
    res.json(events.sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (a.startTime || '').localeCompare(b.startTime || '');
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const {
      title, date, startTime = null, endTime = null,
      type = 'event',   // event | todo | reminder
      color = '#6366f1',
      notes = '',
      completed = false,
    } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: '标题不能为空' });
    if (!date) return res.status(400).json({ error: '日期不能为空' });
    const event = await calendarStore.create({
      id: genId('cal'),
      title: title.trim(),
      date,
      startTime,
      endTime,
      type,
      color,
      notes: notes.trim(),
      completed,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(event);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await calendarStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const ok = await calendarStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
