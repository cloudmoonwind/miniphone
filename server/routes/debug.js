import { Router } from 'express';
import { getAICallLog, clearAICallLog } from '../services/ai.js';

const router = Router();

// GET /api/debug/ai-log?limit=30
router.get('/ai-log', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 50);
  res.json(getAICallLog().slice(0, limit));
});

// DELETE /api/debug/ai-log
router.delete('/ai-log', (_req, res) => {
  clearAICallLog();
  res.json({ ok: true });
});

export default router;
