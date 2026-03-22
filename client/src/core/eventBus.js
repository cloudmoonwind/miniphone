/**
 * eventBus.js — 跨 App 事件总线
 *
 * 轻量级 pub/sub，用于跨 App 通知（不经过 prop 层级传递）。
 *
 * 使用示例：
 *   eventBus.emit('char:updated', { id: 'xxx' })
 *   const unsub = eventBus.on('char:updated', ({ id }) => console.log(id))
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
class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (this._listeners[event])
      this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  emit(event, data) {
    (this._listeners[event] || []).slice().forEach(fn => {
      try { fn(data); } catch (e) { console.error(`[EventBus] ${event}:`, e); }
    });
  }

  once(event, fn) {
    const unsub = this.on(event, (data) => { fn(data); unsub(); });
    return unsub;
  }
}

export const eventBus = new EventBus();
