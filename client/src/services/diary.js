import { api } from './api.js';

/**
 * diaryService — 日记 API
 *
 * 日记结构：{ date, title, content, mood, type }
 *
 * BRIDGE[diary → dreams]：日记和梦境目前独立存储，
 *   未来可以在日记中引用梦境记录（例如"今天早上梦到了..."）。
 *   当前状态：独立，无关联。
 */
export const diaryService = {
  getAll:   ()          => api.get('/api/diary'),
  getByDate:(date)      => api.get(`/api/diary?date=${date}`),
  create:   (data)      => api.post('/api/diary', data),
  update:   (id, data)  => api.put(`/api/diary/${id}`, data),
  delete:   (id)        => api.delete(`/api/diary/${id}`),
};
