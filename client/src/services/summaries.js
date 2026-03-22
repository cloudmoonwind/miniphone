import { api } from './api.js';

/**
 * summariesService — 摘要 API
 *
 * 摘要由 AI 自动生成（聊天后 triggerAutoSummaries），也可手动触发。
 * 注入到上下文的 sys-summaries 槽（最近5条）。
 *
 * BRIDGE[summaries → charSystem timeline]：服务端 charSystem.js 的
 *   管道1（总结→时间线）已实现，当 importance >= 6 时自动创建时间线事件。
 */
export const summariesService = {
  getAll:        (charId, opts = {}) => {
    const qs = new URLSearchParams(opts).toString();
    return api.get(`/api/characters/${charId}/summaries${qs ? '?' + qs : ''}`);
  },
  getByDate:     (charId, date)  => api.get(`/api/characters/${charId}/summaries/by-date?date=${date}`),
  generate:      (charId, data)  => api.post(`/api/characters/${charId}/summaries/generate`, data),
  generateDaily: (charId, date)  => api.post(`/api/characters/${charId}/summaries/generate-daily`, { date }),
  delete:        (id)            => api.delete(`/api/summaries/${id}`),
  getSettings:   (charId)        => api.get(`/api/characters/${charId}/summaries/settings`),
  updateSettings:(charId, data)  => api.put(`/api/characters/${charId}/summaries/settings`, data),
};
