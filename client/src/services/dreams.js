import { api } from './api.js';

// Dreams are currently stored in localStorage by DreamApp.
// This service provides the API interface for future migration.
// Usage: import { dreamsService } from './services/dreams.js'

export const dreamsService = {
  list:     (charId)            => api.get(`/api/characters/${charId}/dreams`),
  create:   (charId, data)      => api.post(`/api/characters/${charId}/dreams`, data),
  update:   (charId, id, data)  => api.put(`/api/characters/${charId}/dreams/${id}`, data),
  delete:   (charId, id)        => api.delete(`/api/characters/${charId}/dreams/${id}`),
  generate: (charId, opts = {}) => api.post(`/api/characters/${charId}/dreams/generate`, opts),
};
