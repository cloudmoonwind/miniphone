import { api } from './api.js';

export const worldbookService = {
  // ── 书 ────────────────────────────────────────────────────
  getBooks:         (scope?: string, boundId?: string) =>
    api.get(`/api/worldbook/books${scope ? `?scope=${scope}${boundId ? `&boundId=${boundId}` : ''}` : ''}`),
  createBook:       (data: any)    => api.post('/api/worldbook/books', data),
  updateBook:       (id: string, d: any) => api.put(`/api/worldbook/books/${id}`, d),
  deleteBook:       (id: string)   => api.delete(`/api/worldbook/books/${id}`),

  // ── 普通条目 ──────────────────────────────────────────────
  getEntries:       (bookId: string)          => api.get(`/api/worldbook/entries?bookId=${bookId}`),
  createEntry:      (bookId: string, data: any) => api.post('/api/worldbook/entries', { ...data, bookId }),
  updateEntry:      (id: string, data: any)   => api.put(`/api/worldbook/entries/${id}`, data),
  deleteEntry:      (id: string)              => api.delete(`/api/worldbook/entries/${id}`),

  // ── 事件条目 ──────────────────────────────────────────────
  getEventEntries:  (bookId: string)          => api.get(`/api/worldbook/event-entries?bookId=${bookId}`),
  createEventEntry: (bookId: string, data: any) => api.post('/api/worldbook/event-entries', { ...data, bookId }),
  updateEventEntry: (id: string, data: any)   => api.put(`/api/worldbook/event-entries/${id}`, data),
  deleteEventEntry: (id: string)              => api.delete(`/api/worldbook/event-entries/${id}`),

  // ── 激活条目（调试） ──────────────────────────────────────
  getActiveEntries: (charId: string) => api.get(`/api/worldbook/active-entries?charId=${charId}`),
};
