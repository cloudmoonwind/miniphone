/**
 * 事件系统路由
 *
 * 事件书 (event-books):
 *   GET    /api/event-books                           - 列出所有书（?charId= 过滤）
 *   POST   /api/event-books                           - 新建书
 *   PUT    /api/event-books/:id                       - 修改书
 *   DELETE /api/event-books/:id                       - 删除书（级联删事件）
 *
 * 事件 (events):
 *   GET    /api/events/:charId                        - 获取角色相关事件（?bookId= 过滤）
 *   GET    /api/events/pool/:charId                   - 获取事件池（repeatable，供生活模拟）
 *   GET    /api/events/item/:id                       - 获取单个事件详情（含标签、连接、订阅）
 *   POST   /api/events/:charId                        - 创建事件
 *   PUT    /api/events/item/:id                       - 更新事件
 *   DELETE /api/events/item/:id                       - 删除事件
 *
 * 状态流转:
 *   POST   /api/events/item/:id/unlock                - locked → pending
 *   POST   /api/events/item/:id/complete              - → completed
 *   POST   /api/events/item/:id/reset                 - completed → pending（可重复事件）
 *
 * 标签 (event_tags):
 *   GET    /api/events/item/:eventId/tags             - 获取标签
 *   PUT    /api/events/item/:eventId/tags             - 批量设置标签
 *   POST   /api/events/item/:eventId/tags             - 添加标签
 *   DELETE /api/events/tags/:id                       - 删除标签
 *
 * 连接 (event_connections):
 *   GET    /api/events/:charId/connections            - 获取角色所有事件连接
 *   GET    /api/events/item/:eventId/connections      - 获取单个事件的连接
 *   POST   /api/events/connections                    - 创建连接
 *   PUT    /api/events/connections/:id                - 更新连接
 *   DELETE /api/events/connections/:id                - 删除连接
 *
 * 条件订阅 (condition_subscriptions):
 *   GET    /api/events/item/:eventId/subscriptions   - 获取事件订阅
 *   GET    /api/events/subscribers/:type/:target      - 按条件查找订阅者
 *
 * 待注入 (pending_injections):
 *   GET    /api/injections/:charId                   - 获取角色所有待注入
 *   POST   /api/injections/:charId                   - 创建注入
 *   DELETE /api/injections/:id                       - 删除注入
 *   POST   /api/injections/:charId/consume           - 消耗一轮注入
 */

import { Router } from 'express';
import * as svc from '../services/events.js';

// ── 事件书路由（独立导出，挂载到 /api/event-books） ───────────

export const eventBooksRouter = Router();

eventBooksRouter.get('/', (req, res) => {
  try {
    const { charId } = req.query;
    res.json(svc.getAllBooks(charId as string | undefined));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

eventBooksRouter.post('/', (req, res) => {
  try {
    const { name, description, scope, characterId, enabled, priority } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '名称不能为空' });
    const book = svc.createBook({ name: name.trim(), description, scope, characterId, enabled, priority });
    res.status(201).json(book);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

eventBooksRouter.put('/:id', (req, res) => {
  try {
    const result = svc.updateBook(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

eventBooksRouter.get('/:id/events', (req, res) => {
  try {
    res.json(svc.getEventsByBook(req.params.id));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

eventBooksRouter.post('/:id/events', (req, res) => {
  try {
    const book = svc.getBookById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    const { name, ...rest } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name 不能为空' });
    const evt = svc.createEvent({
      name: name.trim(),
      bookId: req.params.id,
      characterId: book.scope === 'character' ? book.characterId : null,
      ...rest,
    });
    res.status(201).json(evt);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

eventBooksRouter.delete('/:id', (req, res) => {
  try {
    const ok = svc.deleteBook(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 事件路由 ──────────────────────────────────────────────────

const router = Router();

// 事件池（repeatable，供生活模拟 — 注意必须在 /:charId 之前注册）
router.get('/pool/:charId', (req, res) => {
  try {
    res.json(svc.getEventPool(req.params.charId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 事件 CRUD ─────────────────────────────────────────────────

router.get('/:charId', (req, res) => {
  try {
    const { bookId } = req.query;
    const evts = svc.getEventsByCharacter(req.params.charId, bookId as string | undefined);
    res.json(evts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/item/:id', (req, res) => {
  try {
    const evt = svc.getEventById(req.params.id);
    if (!evt) return res.status(404).json({ error: 'Not found' });
    const tags = svc.getTagsByEvent(evt.id);
    const connections = svc.getConnectionsByEvent(evt.id);
    const subscriptions = svc.getSubscriptionsByEvent(evt.id);
    res.json({ ...evt, tags, connections, subscriptions });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:charId', (req, res) => {
  try {
    const { name, bookId, ...rest } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name 不能为空' });
    const evt = svc.createEvent({
      characterId: req.params.charId,
      name: name.trim(),
      bookId: bookId ?? null,
      ...rest,
    });
    res.status(201).json(evt);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.message?.includes('PRIMARY')) {
      return res.status(409).json({ error: '事件 ID 已存在' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.put('/item/:id', (req, res) => {
  try {
    const result = svc.updateEvent(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/item/:id', (req, res) => {
  try {
    const ok = svc.deleteEvent(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 状态流转 ──────────────────────────────────────────────────

router.post('/item/:id/unlock', (req, res) => {
  try {
    const result = svc.unlockEvent(req.params.id);
    if (!result) return res.status(400).json({ error: '无法解锁（不存在或状态不是 locked）' });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/item/:id/complete', (req, res) => {
  try {
    const result = svc.completeEvent(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/item/:id/reset', (req, res) => {
  try {
    const result = svc.resetEvent(req.params.id);
    if (!result) return res.status(400).json({ error: '无法重置（不可重复或已达最大触发次数）' });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 标签 ──────────────────────────────────────────────────────

router.get('/item/:eventId/tags', (req, res) => {
  try {
    res.json(svc.getTagsByEvent(req.params.eventId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/item/:eventId/tags', (req, res) => {
  try {
    const { tagType, tagValue } = req.body;
    if (!tagType?.trim() || !tagValue?.trim()) {
      return res.status(400).json({ error: 'tagType 和 tagValue 不能为空' });
    }
    const tag = svc.createTag({ eventId: req.params.eventId, tagType: tagType.trim(), tagValue: tagValue.trim() });
    res.status(201).json(tag);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/item/:eventId/tags', (req, res) => {
  try {
    const { tags } = req.body;
    if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags 必须是数组' });
    const result = svc.setTags(req.params.eventId, tags);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/tags/:id', (req, res) => {
  try {
    const ok = svc.deleteTag(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 连接 ──────────────────────────────────────────────────────

router.get('/:charId/connections', (req, res) => {
  try {
    const { bookId } = req.query;
    res.json(svc.getAllConnections(req.params.charId, bookId as string | undefined));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/item/:eventId/connections', (req, res) => {
  try {
    res.json(svc.getConnectionsByEvent(req.params.eventId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/connections', (req, res) => {
  try {
    const { fromEventId, toEventId, relationType, requiredOutcome } = req.body;
    if (!fromEventId || !toEventId || !relationType) {
      return res.status(400).json({ error: 'fromEventId, toEventId, relationType 不能为空' });
    }
    const conn = svc.createConnection({
      fromEventId, toEventId, relationType,
      requiredOutcome: requiredOutcome ?? null,
    });
    res.status(201).json(conn);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/connections/:id', (req, res) => {
  try {
    const result = svc.updateConnection(Number(req.params.id), req.body);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/connections/:id', (req, res) => {
  try {
    const ok = svc.deleteConnection(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 条件订阅 ──────────────────────────────────────────────────

router.get('/item/:eventId/subscriptions', (req, res) => {
  try {
    res.json(svc.getSubscriptionsByEvent(req.params.eventId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/subscribers/:type/:target', (req, res) => {
  try {
    res.json(svc.findSubscribers(req.params.type, req.params.target));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;

// ── 注入路由（独立导出，挂载到 /api/injections） ──────────────

export const injectionsRouter = Router();

injectionsRouter.get('/:charId', (req, res) => {
  try {
    res.json(svc.getInjectionsByCharacter(req.params.charId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

injectionsRouter.post('/:charId', (req, res) => {
  try {
    const { sourceEventId, content, position, depthValue, durationType, durationValue, remainingTurns } = req.body;
    if (!sourceEventId || !content || !position || !durationType) {
      return res.status(400).json({ error: 'sourceEventId, content, position, durationType 不能为空' });
    }
    const inj = svc.createInjection({
      characterId: req.params.charId,
      sourceEventId, content, position, depthValue, durationType, durationValue, remainingTurns,
    });
    res.status(201).json(inj);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

injectionsRouter.delete('/:id', (req, res) => {
  try {
    const ok = svc.deleteInjection(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

injectionsRouter.post('/:charId/consume', (req, res) => {
  try {
    svc.consumeInjectionTurns(req.params.charId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
