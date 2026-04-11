import { api } from './api.js';

/**
 * calendarService — 日历事件 API
 *
 * 事件类型：event（事件）/ todo（待办）/ reminder（提醒）
 *
 * BRIDGE[calendar → charSystem timeline]：日历事件和角色时间线目前独立存储，
 *   未来可以考虑将重要日历事件同步到对应角色的时间线。
 *   当前状态：两者完全独立，无关联。
 */
export const calendarService = {
  getAll:  (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/api/calendar${qs ? '?' + qs : ''}`);
  },
  create:  (data)     => api.post('/api/calendar', data),
  update:  (id, data) => api.put(`/api/calendar/${id}`, data),
  delete:  (id)       => api.delete(`/api/calendar/${id}`),
  toggle:  (id)       => api.post(`/api/calendar/${id}/toggle`, {}),
};
