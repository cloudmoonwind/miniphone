/**
 * 能力清单接口（变量管道自省）。
 *
 * 路由：
 *   GET  /api/capabilities?characterId=&personaId=
 *     → 返回当前已注册的所有命名空间及其 identifier 清单
 *     → 每个 identifier 同时给出"用当前 ctx 求值的当前值"，作为肉眼验收依据
 *
 *   POST /api/capabilities/test
 *     body: { template, characterId, personaId? }
 *     → 返回 { output, records }，records 含每个占位符的命中详情（命名空间/状态/结果）
 *
 *   GET  /api/capabilities/triggers   阶段 4 才有内容，当前返回空数组
 *   GET  /api/capabilities/effects    同上
 */

import { Router } from 'express';
import {
  listRegistered,
  resolveAndExplain,
  type ResolveContext,
} from '../services/placeholders.js';
import { listRegisteredEffects } from '../services/eventEngine.js';
import { listKnownTriggerTypes } from '../services/triggerBus.js';

const router = Router();

// ── GET /api/capabilities ────────────────────────────────────────

router.get('/', (req, res) => {
  try {
    const characterId = String(req.query.characterId || '');
    const personaId   = req.query.personaId ? String(req.query.personaId) : null;

    if (!characterId) {
      // 无角色 ctx：依旧返回结构（给前端"未选角色"的退化视图用），动态命名空间会自动空列表
      const namespaces = listRegistered().map(reg => ({
        namespace: reg.namespace,
        identifiers: reg.identifiers.map(id => ({ ...id, currentValue: null, status: 'no-context' })),
      }));
      return res.json({ namespaces, ctx: null });
    }

    const ctx: ResolveContext = { characterId, personaId };
    const namespaces = listRegistered(ctx).map(reg => ({
      namespace: reg.namespace,
      identifiers: reg.identifiers.map(id => {
        // 用当前 ctx 求值，给前端展示"当前值"
        const probe = `{{${reg.namespace}:${id.identifier}}}`;
        const { output, records } = resolveAndExplain(probe, ctx);
        const rec = records[0];
        return {
          ...id,
          currentValue: rec?.status === 'ok' ? output : null,
          status: rec?.status ?? 'no-record',
        };
      }),
    }));

    res.json({ namespaces, ctx });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── POST /api/capabilities/test ──────────────────────────────────

router.post('/test', (req, res) => {
  try {
    const { template, characterId, personaId } = req.body ?? {};
    if (typeof template !== 'string') {
      return res.status(400).json({ error: 'template 必须是字符串' });
    }
    if (!characterId) {
      return res.status(400).json({ error: '缺少 characterId' });
    }

    const ctx: ResolveContext = {
      characterId: String(characterId),
      personaId: personaId ? String(personaId) : null,
    };

    const { output, records } = resolveAndExplain(template, ctx);
    res.json({ output, records, ctx });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// ── GET /api/capabilities/triggers ───────────────────────────────
// 返回已知 trigger 类型库（阶段 4 接入）。
// trigger 字符串本身是开放的，下面的列表只是"我们知道的、官方在用的"

router.get('/triggers', (_req, res) => {
  res.json({ triggers: listKnownTriggerTypes() });
});

// ── GET /api/capabilities/effects ────────────────────────────────
// 返回已注册的 effect 类型（registerBuiltinEffects 启动时填充）

router.get('/effects', (_req, res) => {
  res.json({ effects: listRegisteredEffects() });
});

export default router;
