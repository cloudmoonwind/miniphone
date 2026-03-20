import { api } from './api.js';

export const chatService = {
  // Send a message and get AI response
  send: (payload) => api.post('/api/chat', payload),
  // payload shape:
  // { content, mode, characterId, personaId?, apiKey?, baseURL?, model?, params? }

  // Get message history for a character
  getMessages: (charId, opts = {}) => {
    const params = new URLSearchParams();
    if (opts.personaId) params.set('personaId', opts.personaId);
    if (opts.limit)     params.set('limit', opts.limit);
    const qs = params.toString();
    return api.get(`/api/characters/${charId}/messages${qs ? '?' + qs : ''}`);
  },

  // Clear message history
  clearMessages: (charId, personaId) => {
    const qs = personaId ? `?personaId=${personaId}` : '';
    return api.delete(`/api/characters/${charId}/messages${qs}`);
  },

  // Summaries
  getSummaries: (charId, opts = {}) => {
    const params = new URLSearchParams(opts);
    const qs = params.toString();
    return api.get(`/api/characters/${charId}/summaries${qs ? '?' + qs : ''}`);
  },
  saveSummary: (charId, data)     => api.post(`/api/characters/${charId}/summaries`, data),
  generateSummary: (charId, data) => api.post(`/api/characters/${charId}/summaries/generate`, data),
  deleteSummary: (id)             => api.delete(`/api/summaries/${id}`),

  // Memories
  getMemories:  (charId)       => api.get(`/api/characters/${charId}/memories`),
  addMemory:    (charId, data) => api.post(`/api/characters/${charId}/memories`, data),
  deleteMemory: (id)           => api.delete(`/api/memories/${id}`),
};
