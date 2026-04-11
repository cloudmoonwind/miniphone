import { api } from './api.js';

/**
 * charSystemService — 角色系统 API
 *
 * 对应服务端路由：
 *   /api/characters/:charId/items
 *   /api/characters/:charId/timeline
 *   /api/characters/:charId/skills
 *   /api/characters/:charId/relations
 *   /api/charstats/:charId
 *   /api/charstats/defs
 *
 * BRIDGE[charSystem → chat]：时间线事件可以关联 linkedMessageIds，
 *   未来可支持从聊天界面直接跳转到时间线对应消息。
 *   当前状态：时间线存有 linkedMessageIds 字段，但 ChatApp 未实现跳转入口。
 *
 * BRIDGE[stats → worldbook events]：数值变化触发世界书条件事件，
 *   服务端 charSystem.js 已实现 checkStatThresholds。
 *   前端 RuleSystemApp 可在调用 applyDelta 后通过 eventBus.emit('charSystem:updated')
 *   通知其他 App 刷新。
 */
export const charSystemService = {
  // ── 时间线 ────────────────────────────────────────────────
  getTimeline:     (charId)        => api.get(`/api/characters/${charId}/timeline`),
  createEvent:     (charId, data)  => api.post(`/api/characters/${charId}/timeline`, data),
  updateEvent:     (charId, id, d) => api.put(`/api/characters/${charId}/timeline/${id}`, d),
  deleteEvent:     (charId, id)    => api.delete(`/api/characters/${charId}/timeline/${id}`),

  // ── 物品 ──────────────────────────────────────────────────
  getItems:    (charId)        => api.get(`/api/characters/${charId}/items`),
  createItem:  (charId, data)  => api.post(`/api/characters/${charId}/items`, data),
  updateItem:  (charId, id, d) => api.put(`/api/characters/${charId}/items/${id}`, d),
  deleteItem:  (charId, id)    => api.delete(`/api/characters/${charId}/items/${id}`),

  // ── 技能 ──────────────────────────────────────────────────
  getSkills:   (charId)        => api.get(`/api/characters/${charId}/skills`),
  createSkill: (charId, data)  => api.post(`/api/characters/${charId}/skills`, data),
  updateSkill: (charId, id, d) => api.put(`/api/characters/${charId}/skills/${id}`, d),
  deleteSkill: (charId, id)    => api.delete(`/api/characters/${charId}/skills/${id}`),

  // ── 关系 ──────────────────────────────────────────────────
  getRelations:   (charId)        => api.get(`/api/characters/${charId}/relations`),
  createRelation: (charId, data)  => api.post(`/api/characters/${charId}/relations`, data),
  updateRelation: (charId, id, d) => api.put(`/api/characters/${charId}/relations/${id}`, d),
  deleteRelation: (charId, id)    => api.delete(`/api/characters/${charId}/relations/${id}`),

  // ── 数值 ──────────────────────────────────────────────────
  /** 获取角色当前数值 */
  getStats:      (charId)        => api.get(`/api/charstats/${charId}`),
  /** 保存角色数值（完整替换 stats 对象）*/
  updateStats:   (charId, stats) => api.put(`/api/charstats/${charId}`, { stats }),
  /** 应用数值增量（delta: { stat: deltaValue }），服务端检查里程碑 */
  applyDelta:    (charId, delta) => api.post(`/api/charstats/${charId}/delta`, delta),
  /** 获取属性定义列表（全局）*/
  getStatDefs:   ()              => api.get('/api/charstats/defs'),
  /** 更新属性定义 */
  updateStatDefs:(defs)          => api.put('/api/charstats/defs', { defs }),

  // ── 生活日志（CharLifeApp 用）────────────────────────────
  getLogs:       (charId)       => api.get(`/api/characters/${charId}/life`),
  createLog:     (charId, data) => api.post(`/api/characters/${charId}/life`, data),
  generateLog:   (charId, data) => api.post(`/api/characters/${charId}/life/generate`, data),
  deleteLog:     (charId, id)   => api.delete(`/api/characters/${charId}/life/${id}`),
};
