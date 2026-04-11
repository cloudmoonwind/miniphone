import { api } from './api.js';

/**
 * dafuService — 大富翁游戏 API
 *
 * BRIDGE[dafu → charSystem]：大富翁事件（买地、升级、破产等）
 *   目前只影响游戏内数值，未来可联动角色时间线，记录"大富翁游戏"事件。
 *   当前状态：完全独立。
 */
export const dafuService = {
  getState:    ()        => api.get('/api/dafu'),
  resetGame:   ()        => api.post('/api/dafu/reset', {}),
  rollDice:    (data)    => api.post('/api/dafu/roll', data),
  buyProperty: (data)    => api.post('/api/dafu/buy', data),
  getLog:      ()        => api.get('/api/dafu/log'),
};
