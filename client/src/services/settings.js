import { api } from './api.js';

export const settingsService = {
  // Presets
  listPresets:   ()          => api.get('/api/settings/presets'),
  createPreset:  (data)      => api.post('/api/settings/presets', data),
  updatePreset:  (id, data)  => api.put(`/api/settings/presets/${id}`, data),
  deletePreset:  (id)        => api.delete(`/api/settings/presets/${id}`),

  // Active preset
  getActivePreset:  ()    => api.get('/api/settings/active-preset'),
  setActivePreset:  (id)  => api.put('/api/settings/active-preset', { id }),
  clearActivePreset: ()   => api.put('/api/settings/active-preset', { id: null }),

  // Feature presets
  getFeaturePresets: ()     => api.get('/api/settings/feature-presets'),
  setFeaturePresets: (data) => api.put('/api/settings/feature-presets', data),

  // AI utilities
  getModels:       (apiKey, baseURL, provider) => api.post('/api/settings/models', { apiKey, baseURL, provider }),
  testConnection:  (apiKey, baseURL, model, provider) => api.post('/api/settings/test-connection', { apiKey, baseURL, model, provider }),
};
