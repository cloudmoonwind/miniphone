import { api } from './api.js';

export const charactersService = {
  list:   ()          => api.get('/api/characters'),
  get:    (id)        => api.get(`/api/characters/${id}`),
  create: (data)      => api.post('/api/characters', data),
  update: (id, data)  => api.put(`/api/characters/${id}`, data),
  delete: (id)        => api.delete(`/api/characters/${id}`),
};
