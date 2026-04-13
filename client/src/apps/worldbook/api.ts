/**
 * worldbook/api.ts — API 请求封装 & localStorage 设置助手
 */

export const WB = (p: string, o: any = {}) =>
  fetch(`/api/worldbook${p}`, { headers: { 'Content-Type': 'application/json' }, ...o }).then(r => r.json());

export const EVT = (p: string, o: any = {}) =>
  fetch(`/api${p}`, { headers: { 'Content-Type': 'application/json' }, ...o }).then(r => r.json());

export const WB_SETTINGS_KEY = 'ics_wb_settings';

export const getWBSettings = (): Record<string, any> => {
  try { return JSON.parse(localStorage.getItem(WB_SETTINGS_KEY) || '{}'); } catch { return {}; }
};

export const saveWBSettings = (s: Record<string, any>) => {
  try { localStorage.setItem(WB_SETTINGS_KEY, JSON.stringify(s)); } catch {}
};
