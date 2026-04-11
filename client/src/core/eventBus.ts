/**
 * eventBus.ts — 跨 App 事件总线（强类型版）
 *
 * 轻量级 pub/sub，用于跨 App 通知（不经过 prop 层级传递）。
 *
 * 使用示例：
 *   eventBus.emit('char:updated', { char })
 *   const unsub = eventBus.on('char:updated', ({ char }) => ...)
 *   unsub() // 取消订阅
 *
 * 事件命名约定：namespace:action
 *   char:updated       — 角色数据更新
 *   char:deleted       — 角色删除
 *   chat:newMessage    — 新聊天消息（含 AI 回复）
 *   charSystem:updated — 角色系统数据更新（时间线/物品/技能/关系）
 *   preset:changed     — 活跃 API 预设改变
 *   recentChat:update  — 最近聊天信息更新（首页 widget 用）
 */
import type { EventMap } from '../types/index.js';

type EventKey = keyof EventMap;
type EventListener<K extends EventKey> = (data: EventMap[K]) => void;

class TypedEventBus {
  private _listeners: { [K in EventKey]?: Array<EventListener<K>> } = {};

  on<K extends EventKey>(event: K, fn: EventListener<K>): () => void {
    if (!this._listeners[event]) {
      (this._listeners[event] as any) = [];
    }
    (this._listeners[event] as any[]).push(fn);
    return () => this.off(event, fn);
  }

  off<K extends EventKey>(event: K, fn: EventListener<K>): void {
    if (this._listeners[event]) {
      (this._listeners[event] as any[]) = (this._listeners[event] as any[]).filter(f => f !== fn);
    }
  }

  emit<K extends EventKey>(event: K, data: EventMap[K]): void {
    ((this._listeners[event] || []) as Array<EventListener<K>>).slice().forEach(fn => {
      try { fn(data); } catch (e) { console.error(`[EventBus] ${event}:`, e); }
    });
  }

  once<K extends EventKey>(event: K, fn: EventListener<K>): () => void {
    const unsub = this.on(event, (data) => { fn(data); unsub(); });
    return unsub;
  }
}

export const eventBus = new TypedEventBus();
