/**
 * 世界书 API
 *
 * 书（容器）：
 *   GET    /api/worldbook/books            - 列出所有书（可 ?charId= 过滤）
 *   POST   /api/worldbook/books            - 新建书
 *   PUT    /api/worldbook/books/:bookId    - 修改书
 *   DELETE /api/worldbook/books/:bookId    - 删除书（级联删条目）
 *
 * 条目：
 *   GET    /api/worldbook/entries          - 列出条目（可 ?bookId= / ?charId= 过滤）
 *   POST   /api/worldbook/entries          - 新建条目
 *   PUT    /api/worldbook/entries/:id      - 修改条目
 *   DELETE /api/worldbook/entries/:id      - 删除条目
 *
 * 聚合：
 *   GET    /api/worldbook/active-entries?charId= - 返回角色上下文应注入的条目（已启用的 book）
 */

import { Router } from 'express';
import { wbBookStore, wbEntryStore } from '../storage/index.js';
import { genId } from '../storage/FileStore.js';
export { getActiveNonEventEntries, getEventPoolEntries } from '../services/worldbook.js';

const router = Router();

// ── 书 CRUD ──────────────────────────────────────────────────────────────

router.get('/books', async (req, res) => {
  try {
    const { charId } = req.query;
    const books = await wbBookStore.getAll(
      charId ? b => b.charId === charId || b.charId == null : null
    );
    res.json(books);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/books', async (req, res) => {
  try {
    const { name, description = '', charId = null } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '名称不能为空' });
    const book = await wbBookStore.create({
      id: genId('wb'), name: name.trim(), description, charId, enabled: true,
    });
    res.status(201).json(book);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/books/:bookId', async (req, res) => {
  try {
    const updated = await wbBookStore.update(req.params.bookId, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/books/:bookId', async (req, res) => {
  try {
    const ok = await wbBookStore.delete(req.params.bookId);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    // 级联删除该书的所有条目
    const removed = await wbEntryStore.deleteMany(e => e.bookId === req.params.bookId);
    res.json({ ok: true, entriesRemoved: removed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 条目 CRUD ──────────────────────────────────────────────────────────────

router.get('/entries', async (req, res) => {
  try {
    const { bookId } = req.query;
    const entries = await wbEntryStore.getAll(bookId ? e => e.bookId === bookId : null);
    res.json(entries);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/entries', async (req, res) => {
  try {
    const {
      bookId, name = '', content = '',
      enabled = true,
      keywords = [],
      // activationMode: "always" | "keyword" | "event-random" | "event-conditional"
      activationMode = 'always',
      // insertionPosition: "system-top" | "system-bottom" | "before-chat" | "after-chat"
      insertionPosition = 'system-bottom',
      priority = 100,
      // eventConfig 仅用于 event-* 模式
      eventConfig = null,
    } = req.body;
    if (!bookId) return res.status(400).json({ error: 'bookId 不能为空' });
    const entry = await wbEntryStore.create({
      id: genId('wbe'), bookId, name, content, enabled,
      keywords, activationMode, insertionPosition, priority,
      eventConfig: eventConfig || null,
    });
    res.status(201).json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/entries/:id', async (req, res) => {
  try {
    const updated = await wbEntryStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/entries/:id', async (req, res) => {
  try {
    const ok = await wbEntryStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 聚合：返回角色上下文应注入的条目（供 context.js 和前端预览） ──────────────

/**
 * GET /api/worldbook/active-entries?charId=xxx
 * 返回：所有启用中的书中属于该角色（charId 匹配或 charId=null 全局）且条目 enabled=true 的条目
 * 不包含 event-* 条目（事件由 life/generate 和 context.js 自行选取）
 */
router.get('/active-entries', async (req, res) => {
  try {
    const { charId } = req.query;
    const entries = await getActiveNonEventEntries(charId || null);
    res.json(entries);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
