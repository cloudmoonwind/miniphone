import { api } from './api.js';

/**
 * chatService — 聊天相关 API
 *
 * 两阶段发送流程：
 *   1. saveMessage — 保存用户消息（支持5分钟内合并），不触发AI
 *   2. respond / respondStream — 用已保存的消息触发AI回复
 *
 * 老接口 send() 保留用于兼容，但新流程推荐两阶段。
 */
export const chatService = {
  // ── 老接口（兼容）─────────────────────────────────────────
  send: (payload) => api.post('/api/chat', payload),

  // ── 两阶段新接口 ──────────────────────────────────────────
  /** 保存用户消息，支持5分钟内自动合并 */
  saveMessage: (payload) => api.post('/api/chat/message', payload),
  // payload: { content, mode, characterId, personaId? }

  /** 触发 AI 非流式回复 */
  respond: (payload) => api.post('/api/chat/respond', payload),
  // payload: { characterId, mode, stream: false, contextMode?, apiKey?, ... }

  /** 触发 AI 流式回复（返回 Response，由调用方处理 SSE）*/
  respondStream: async (payload) => {
    const res = await fetch('/api/chat/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, stream: true }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res; // 返回 Response，body 是 SSE stream
  },

  /**
   * 读取 SSE 流，实时回调 delta
   *
   * @param {Response} res        fetch Response（SSE）
   * @param {Function} onDelta    (accumulated: string) => void  每个 chunk 回调
   * @returns {{ realId, finalTimestamp, accumulated }}
   */
  readSSE: async (res, onDelta) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let realId = null;
    let finalTimestamp = null;
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.error) throw new Error(data.error);
          if (data.delta) {
            accumulated += data.delta;
            onDelta?.(accumulated);
          }
          if (data.done) {
            realId = data.id;
            finalTimestamp = data.timestamp;
          }
        } catch (e) {
          if (e.name !== 'SyntaxError') throw e;
        }
      }
    }

    return { realId, finalTimestamp, accumulated };
  },

  // ── 消息 CRUD ─────────────────────────────────────────────
  getMessages: (charId, opts = {}) => {
    const params = new URLSearchParams();
    if (opts.personaId) params.set('personaId', opts.personaId);
    if (opts.limit)     params.set('limit', String(opts.limit));
    const qs = params.toString();
    return api.get(`/api/characters/${charId}/messages${qs ? '?' + qs : ''}`);
  },
  updateMessage: (id, content)  => api.put(`/api/messages/${id}`, { content }),
  deleteMessage: (id)           => api.delete(`/api/messages/${id}`),
  clearMessages: (charId, personaId) => {
    const qs = personaId ? `?personaId=${personaId}` : '';
    return api.delete(`/api/characters/${charId}/messages${qs}`);
  },

  // ── 摘要 ──────────────────────────────────────────────────
  getSummaries:        (charId, opts = {}) => {
    const qs = new URLSearchParams(opts).toString();
    return api.get(`/api/characters/${charId}/summaries${qs ? '?' + qs : ''}`);
  },
  getSummariesByDate:  (charId, date) => api.get(`/api/characters/${charId}/summaries/by-date?date=${date}`),
  generateSummary:     (charId, data) => api.post(`/api/characters/${charId}/summaries/generate`, data),
  generateDailySummary:(charId, date) => api.post(`/api/characters/${charId}/summaries/generate-daily`, { date }),
  deleteSummary:       (id)           => api.delete(`/api/summaries/${id}`),
  getSummarySettings:  (charId)       => api.get(`/api/characters/${charId}/summaries/settings`),
  updateSummarySettings:(charId, data) => api.put(`/api/characters/${charId}/summaries/settings`, data),

  // ── 时间戳设置 ────────────────────────────────────────────
  getTimestampSettings:  ()     => api.get('/api/settings/timestamp'),
  updateTimestampSettings: (data) => api.put('/api/settings/timestamp', data),

  // ── 记忆 ──────────────────────────────────────────────────
  getMemories:  (charId)       => api.get(`/api/characters/${charId}/memories`),
  addMemory:    (charId, data) => api.post(`/api/characters/${charId}/memories`, data),
  deleteMemory: (id)           => api.delete(`/api/memories/${id}`),

  // ── 摘要（旧方法兼容）────────────────────────────────────
  saveSummary:  (charId, data) => api.post(`/api/characters/${charId}/summaries`, data),
};
