/**
 * 数值系统路由
 *
 * 数值 (character_values):
 *   GET    /api/values/:charId                 - 获取角色所有数值
 *   POST   /api/values/:charId                 - 创建数值
 *   PUT    /api/values/item/:id                - 更新数值
 *   DELETE /api/values/item/:id                - 删除数值
 *   POST   /api/values/item/:id/adjust         - 增减数值
 *   POST   /api/values/:charId/execute-rules   - 执行指定触发时机的规则
 *
 * 阶段 (value_stages):
 *   GET    /api/values/item/:valueId/stages          - 获取阶段列表
 *   POST   /api/values/item/:valueId/stages          - 创建阶段
 *   PUT    /api/values/stages/:id                     - 更新阶段
 *   DELETE /api/values/stages/:id                     - 删除阶段
 *   PUT    /api/values/item/:valueId/stages/batch     - 批量设置阶段
 *
 * 规则 (value_rules):
 *   GET    /api/values/item/:valueId/rules            - 获取规则列表
 *   POST   /api/values/item/:valueId/rules            - 创建规则
 *   PUT    /api/values/rules/:id                      - 更新规则
 *   DELETE /api/values/rules/:id                      - 删除规则
 */

import { Router } from 'express';
import * as svc from '../services/values.js';
import { checkAndFireEvents } from '../services/eventEngine.js';

const router = Router();

// ── 数值 CRUD ─────────────────────────────────────────────────

router.get('/:charId', (req, res) => {
  try {
    svc.seedDefaultVariables(req.params.charId);
    const values = svc.getValuesByCharacter(req.params.charId);
    // 附带每个数值的当前阶段
    const result = values.map(v => ({
      ...v,
      currentStage: svc.getCurrentStage(v.id) ?? null,
    }));
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:charId', (req, res) => {
  try {
    const { category, name, variableName, valueType, currentValue, minValue, maxValue, sortOrder, groupName } = req.body;
    if (!category?.trim() || !name?.trim() || !variableName?.trim()) {
      return res.status(400).json({ error: 'category, name, variableName 不能为空' });
    }
    const value = svc.createValue({
      characterId: req.params.charId,
      category: category.trim(),
      name: name.trim(),
      variableName: variableName.trim(),
      valueType, currentValue, minValue, maxValue, sortOrder, groupName,
    });
    res.status(201).json(value);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: '该角色已存在同名变量' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.put('/item/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = svc.updateValue(id, req.body);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/item/:id', (req, res) => {
  try {
    const ok = svc.deleteValue(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/item/:id/adjust', (req, res) => {
  try {
    const { delta } = req.body;
    if (typeof delta !== 'number') return res.status(400).json({ error: 'delta 必须是数字' });
    const result = svc.adjustValue(Number(req.params.id), delta);
    if (!result) return res.status(404).json({ error: 'Not found' });
    // 事件引擎：触发 value_change 检查
    try {
      checkAndFireEvents(result.characterId, {
        trigger: 'value_change',
        changedVariable: result.variableName,
        newValue: result.currentValue,
      });
    } catch (e: any) { console.error('[values/event-engine]', e.message); }
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:charId/execute-rules', (req, res) => {
  try {
    const { triggerOn } = req.body;
    if (!triggerOn) return res.status(400).json({ error: 'triggerOn 必须提供' });
    const changes = svc.executeRules(req.params.charId, triggerOn);
    res.json({ changes });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 阶段 CRUD ─────────────────────────────────────────────────

router.get('/item/:valueId/stages', (req, res) => {
  try {
    res.json(svc.getStagesByValue(Number(req.params.valueId)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/item/:valueId/stages', (req, res) => {
  try {
    const { rangeMin, rangeMax, stageName, description, promptSnippet } = req.body;
    if (rangeMin == null || rangeMax == null || !stageName?.trim()) {
      return res.status(400).json({ error: 'rangeMin, rangeMax, stageName 不能为空' });
    }
    const stage = svc.createStage({
      valueId: Number(req.params.valueId),
      rangeMin, rangeMax,
      stageName: stageName.trim(),
      description, promptSnippet,
    });
    res.status(201).json(stage);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/stages/:id', (req, res) => {
  try {
    const result = svc.updateStage(Number(req.params.id), req.body);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/stages/:id', (req, res) => {
  try {
    const ok = svc.deleteStage(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/item/:valueId/stages/batch', (req, res) => {
  try {
    const { stages } = req.body;
    if (!Array.isArray(stages)) return res.status(400).json({ error: 'stages 必须是数组' });
    const result = svc.setStages(Number(req.params.valueId), stages);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 规则 CRUD ─────────────────────────────────────────────────

router.get('/item/:valueId/rules', (req, res) => {
  try {
    res.json(svc.getRulesByValue(Number(req.params.valueId)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/item/:valueId/rules', (req, res) => {
  try {
    const { triggerOn, operation, amount, rangeMin, rangeMax, conditions, description, enabled } = req.body;
    if (!triggerOn || !operation || amount == null) {
      return res.status(400).json({ error: 'triggerOn, operation, amount 不能为空' });
    }
    const rule = svc.createRule({
      valueId: Number(req.params.valueId),
      triggerOn, operation, amount,
      rangeMin, rangeMax, conditions, description, enabled,
    });
    res.status(201).json(rule);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/rules/:id', (req, res) => {
  try {
    const result = svc.updateRule(Number(req.params.id), req.body);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/rules/:id', (req, res) => {
  try {
    const ok = svc.deleteRule(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
