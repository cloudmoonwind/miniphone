import { api } from './api.js';

/**
 * suixiangService — 随想（卡片式随笔）API
 *
 * 结构：卡片（card）→ 条目（entry，随时追写）
 */
export const suixiangService = {
  // ── 卡片 ──────────────────────────────────────────────────
  getCards:    ()        => api.get('/api/suixiang/cards'),
  createCard:  (data)    => api.post('/api/suixiang/cards', data),
  updateCard:  (id, d)   => api.put(`/api/suixiang/cards/${id}`, d),
  deleteCard:  (id)      => api.delete(`/api/suixiang/cards/${id}`),

  // ── 条目 ──────────────────────────────────────────────────
  getEntries:  (cardId)  => api.get(`/api/suixiang/cards/${cardId}/entries`),
  createEntry: (cardId, data) => api.post(`/api/suixiang/cards/${cardId}/entries`, data),
  updateEntry: (id, data)     => api.put(`/api/suixiang/entries/${id}`, data),
  deleteEntry: (id)           => api.delete(`/api/suixiang/entries/${id}`),
};
