import { api } from './api.js';

/**
 * personasService — 用户马甲（命格）API
 *
 * 马甲是用户在聊天中的角色扮演身份，注入到上下文的 sys-user-desc 槽。
 *
 * BRIDGE[persona → chat context]：activePersonaId 存于 activeStore，
 *   服务端 context.js 已读取并注入。前端 MinggeApp 激活马甲后，
 *   需要通知 ChatApp 重新加载（目前需手动重载）。
 *   后续改进：激活马甲后发射 eventBus.emit('preset:changed') 触发上下文刷新。
 */
export const personasService = {
  list:     ()         => api.get('/api/personas'),
  create:   (data)     => api.post('/api/personas', data),
  update:   (id, data) => api.put(`/api/personas/${id}`, data),
  delete:   (id)       => api.delete(`/api/personas/${id}`),
  activate: (id)       => api.post(`/api/personas/${id}/activate`, {}),
};
