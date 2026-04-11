import { api } from './api.js';

/**
 * worldbookService — 世界书 API
 *
 * 书（book）是条目（entry）的容器。
 * 条目分为常规条目和事件条目（activationMode: event-*）。
 *
 * BRIDGE[worldbook → chat context]：服务端 context.js 已实现世界书
 *   条目注入，前端无需手动处理，但 FilesApp 需要知道哪些条目被激活。
 *   当前状态：active-entries 接口存在但前端未实时展示激活状态。
 */
export const worldbookService = {
  // ── 书 ────────────────────────────────────────────────────
  getBooks:    ()        => api.get('/api/worldbook/books'),
  createBook:  (data)    => api.post('/api/worldbook/books', data),
  updateBook:  (id, d)   => api.put(`/api/worldbook/books/${id}`, d),
  deleteBook:  (id)      => api.delete(`/api/worldbook/books/${id}`),

  // ── 条目 ──────────────────────────────────────────────────
  getEntries:  (bookId)  => api.get(`/api/worldbook/books/${bookId}/entries`),
  createEntry: (bookId, data) => api.post(`/api/worldbook/books/${bookId}/entries`, data),
  updateEntry: (id, data)     => api.put(`/api/worldbook/entries/${id}`, data),
  deleteEntry: (id)           => api.delete(`/api/worldbook/entries/${id}`),

  // ── 激活条目（用于上下文调试）──────────────────────────────
  getActiveEntries: (charId) => api.get(`/api/worldbook/active-entries?charId=${charId}`),
};
