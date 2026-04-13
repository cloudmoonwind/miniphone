/**
 * 世界状态路由 — 全局键值对表
 *
 *   GET    /api/worldstate           - 获取所有世界状态
 *   GET    /api/worldstate/:key      - 获取单个键
 *   PUT    /api/worldstate/:key      - 设置键值
 *   DELETE /api/worldstate/:key      - 删除键
 *   PUT    /api/worldstate           - 批量设置（body: { entries: [{ key, value }] }）
 */

import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { getDrizzle } from '../db/database.js';
import { worldState } from '../db/schema.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const db = getDrizzle();
    const all = db.select().from(worldState).all();
    res.json(all);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/:key', (req, res) => {
  try {
    const db = getDrizzle();
    const row = db.select().from(worldState)
      .where(eq(worldState.key, req.params.key))
      .get();
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/:key', (req, res) => {
  try {
    const { value } = req.body;
    if (value == null) return res.status(400).json({ error: 'value 不能为空' });

    const db = getDrizzle();
    const now = new Date().toISOString();
    const existing = db.select().from(worldState)
      .where(eq(worldState.key, req.params.key)).get();

    if (existing) {
      const updated = db.update(worldState)
        .set({ value: String(value), updatedAt: now })
        .where(eq(worldState.key, req.params.key))
        .returning().get();
      res.json(updated);
    } else {
      const created = db.insert(worldState)
        .values({ key: req.params.key, value: String(value), updatedAt: now })
        .returning().get();
      res.status(201).json(created);
    }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/:key', (req, res) => {
  try {
    const db = getDrizzle();
    const result = db.delete(worldState)
      .where(eq(worldState.key, req.params.key))
      .returning().get();
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/', (req, res) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries 必须是数组' });

    const db = getDrizzle();
    const now = new Date().toISOString();
    const results = [];

    for (const { key, value } of entries) {
      if (!key || value == null) continue;
      const existing = db.select().from(worldState)
        .where(eq(worldState.key, key)).get();
      if (existing) {
        results.push(db.update(worldState)
          .set({ value: String(value), updatedAt: now })
          .where(eq(worldState.key, key))
          .returning().get());
      } else {
        results.push(db.insert(worldState)
          .values({ key, value: String(value), updatedAt: now })
          .returning().get());
      }
    }

    res.json(results);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
