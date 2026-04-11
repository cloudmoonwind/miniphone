// ============================================================
// routes/sessions.ts
// 角色数据文件表（sessions）CRUD
// GET    /api/characters/:charId/sessions            获取角色所有 sessions
// GET    /api/characters/:charId/sessions/:type      获取特定类型 sessions
// POST   /api/characters/:charId/sessions            创建 session
// PATCH  /api/characters/:charId/sessions/:id        更新 session（改名/切换激活）
// DELETE /api/characters/:charId/sessions/:id        删除 session
// ============================================================

import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router({ mergeParams: true });

function genId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// GET /api/characters/:charId/sessions
// 可带 ?type=chat 过滤
router.get('/', (req, res) => {
  const { charId } = req.params;
  const { type } = req.query;
  const db = getDb();
  try {
    let rows;
    if (type) {
      rows = db.prepare(
        'SELECT * FROM sessions WHERE char_id = ? AND type = ? ORDER BY created_at ASC'
      ).all(charId, type as string);
    } else {
      rows = db.prepare(
        'SELECT * FROM sessions WHERE char_id = ? ORDER BY type ASC, created_at ASC'
      ).all(charId);
    }
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/characters/:charId/sessions
router.post('/', (req, res) => {
  const { charId } = req.params;
  const { type, name } = req.body;
  if (!type) return res.status(400).json({ error: 'type is required' });

  const db = getDb();
  const now = new Date().toISOString();
  const id  = genId();
  try {
    db.prepare(
      'INSERT INTO sessions (id, char_id, type, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)'
    ).run(id, charId, type, name ?? null, now, now);
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    res.status(201).json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/characters/:charId/sessions/:id
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { name, is_active } = req.body;
  const db  = getDb();
  const now = new Date().toISOString();
  try {
    const fields: string[] = [];
    const vals: any[] = [];
    if (name !== undefined)      { fields.push('name = ?');      vals.push(name); }
    if (is_active !== undefined) { fields.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
    if (fields.length === 0) return res.status(400).json({ error: 'nothing to update' });
    fields.push('updated_at = ?');
    vals.push(now, id);
    db.prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/characters/:charId/sessions/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  try {
    const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
