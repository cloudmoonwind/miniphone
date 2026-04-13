/**
 * 世界书 API
 *
 * 书（容器）：
 *   GET    /api/worldbook/books              - 列出所有书（可 ?scope= &boundId= 过滤）
 *   POST   /api/worldbook/books              - 新建书
 *   PUT    /api/worldbook/books/:id           - 修改书
 *   DELETE /api/worldbook/books/:id           - 删除书（级联删条目）
 *
 * 普通条目：
 *   GET    /api/worldbook/entries?bookId=     - 列出普通条目
 *   POST   /api/worldbook/entries             - 新建普通条目
 *   PUT    /api/worldbook/entries/:id         - 修改普通条目
 *   DELETE /api/worldbook/entries/:id         - 删除普通条目
 *
 * 事件条目：
 *   GET    /api/worldbook/event-entries?bookId= - 列出事件条目
 *   POST   /api/worldbook/event-entries         - 新建事件条目
 *   PUT    /api/worldbook/event-entries/:id     - 修改事件条目
 *   DELETE /api/worldbook/event-entries/:id     - 删除事件条目
 *
 * 聚合：
 *   GET    /api/worldbook/active-entries?charId= - 激活的普通条目（供调试）
 */

import { Router } from 'express';
import * as svc from '../services/worldbook.js';

const router = Router();

// ── 书 CRUD ──────────────────────────────────────────────────

router.get('/books', (req, res) => {
  try {
    const { scope, boundId } = req.query;
    const books = svc.getAllBooks(scope as string, boundId as string);
    res.json(books);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/books', (req, res) => {
  try {
    const { name, scope, boundId, scanDepth, description, priority } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '名称不能为空' });
    const book = svc.createBook({
      name: name.trim(), scope, boundId, scanDepth, description, priority,
    });
    res.status(201).json(book);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/books/:id', (req, res) => {
  try {
    const updated = svc.updateBook(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/books/:id', (req, res) => {
  try {
    const ok = svc.deleteBook(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 普通条目 CRUD ────────────────────────────────────────────

router.get('/entries', (req, res) => {
  try {
    const { bookId } = req.query;
    if (!bookId) return res.status(400).json({ error: 'bookId 必填' });
    const entries = svc.getEntriesByBook(bookId as string);
    res.json(entries);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/entries', (req, res) => {
  try {
    const { bookId, ...data } = req.body;
    if (!bookId) return res.status(400).json({ error: 'bookId 不能为空' });
    const entry = svc.createEntry(bookId, data);
    res.status(201).json(entry);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/entries/:id', (req, res) => {
  try {
    const updated = svc.updateEntry(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/entries/:id', (req, res) => {
  try {
    const ok = svc.deleteEntry(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 事件条目 CRUD ────────────────────────────────────────────

router.get('/event-entries', (req, res) => {
  try {
    const { bookId } = req.query;
    if (!bookId) return res.status(400).json({ error: 'bookId 必填' });
    const entries = svc.getEventEntriesByBook(bookId as string);
    res.json(entries);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/event-entries', (req, res) => {
  try {
    const { bookId, ...data } = req.body;
    if (!bookId) return res.status(400).json({ error: 'bookId 不能为空' });
    const entry = svc.createEventEntry(bookId, data);
    res.status(201).json(entry);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/event-entries/:id', (req, res) => {
  try {
    const updated = svc.updateEventEntry(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/event-entries/:id', (req, res) => {
  try {
    const ok = svc.deleteEventEntry(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 聚合：激活条目（供调试） ─────────────────────────────────

router.get('/active-entries', (req, res) => {
  try {
    const { charId } = req.query;
    const entries = svc.getActivatedEntries(charId as string || null);
    res.json(entries);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// /all-event-entries 已迁移到 /api/events/pool/:charId

export default router;
