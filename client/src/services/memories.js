import { api } from './api.js';

/**
 * memoriesService — 角色记忆 API
 *
 * 记忆是对用户行为/特质的结构化记录，注入到上下文的 sys-memories 槽。
 * importance >= 7 的记忆会被注入到 AI 上下文。
 *
 * BRIDGE[memories → context]：服务端 context.js 已实现注入逻辑。
 *   前端 MemoryApp 目前仅有本地 localStorage 逻辑，未接入此 API。
 *   BRIDGE状态：后端接口完整，前端 MemoryApp 待接入。
 *   接入方式：将 MemoryApp 中的 localStorage 调用替换为此服务。
 */
export const memoriesService = {
  getAll:   (charId)       => api.get(`/api/characters/${charId}/memories`),
  create:   (charId, data) => api.post(`/api/characters/${charId}/memories`, data),
  update:   (id, data)     => api.put(`/api/memories/${id}`, data),
  delete:   (id)           => api.delete(`/api/memories/${id}`),
};
