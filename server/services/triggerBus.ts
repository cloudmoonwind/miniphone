/**
 * Trigger 总线（阶段 4 准抽出基础设施）。
 *
 * 用途：让 chat / cron / debug 等触发源不再直接依赖 eventEngine.checkAndFireEvents，
 * 而是统一调 dispatchTrigger，由总线分发给所有已注册的 listener。
 *
 * 当前唯一 listener 是 eventEngine.checkAndFireEvents（在启动钩子注册）。
 * 未来后处理规则系统、状态槽系统等成为消费者时，直接 registerTriggerListener 即可。
 *
 * 已知 trigger 类型库见 listKnownTriggerTypes()，由 capabilities 路由用于能力清单页。
 */

import type { TriggerContext } from './eventEngine.js';

// ── 类型 ─────────────────────────────────────────────────────────

export type TriggerListener = (charId: string, ctx: TriggerContext) => void;

export interface TriggerMeta {
  type: string;
  description: string;
  /** 触发上下文中常用字段提示，仅供能力清单页展示 */
  ctxHint?: string;
}

// ── listener 注册表 ──────────────────────────────────────────────

const listeners: TriggerListener[] = [];

/** 注册 trigger 监听器；同一 listener 重复注册会跳过 */
export function registerTriggerListener(listener: TriggerListener): void {
  if (!listeners.includes(listener)) {
    listeners.push(listener);
  }
}

/** 仅供测试使用：清空 listener */
export function __clearTriggerListeners(): void {
  listeners.length = 0;
}

/** 当前注册的 listener 数量（用于健康检查） */
export function getListenerCount(): number {
  return listeners.length;
}

// ── 分发入口 ─────────────────────────────────────────────────────

/**
 * 把 trigger 派发给所有已注册的 listener。
 * 单个 listener 抛错只 console.error 不阻塞其他 listener。
 */
export function dispatchTrigger(charId: string, ctx: TriggerContext): void {
  for (const listener of listeners) {
    try {
      listener(charId, ctx);
    } catch (err: any) {
      console.error('[triggerBus] listener error:', err?.message ?? err);
    }
  }
}

// ── 已知 trigger 类型库（用于能力清单页 UI 展示）──────────────────
// 注：trigger 字符串本身是开放的（消费者可派发任意字符串），下面只是"我们知道的、官方在用的"列表。
// 未列出的 trigger 字符串依然会被 listener 收到——能力清单页只是给作者一个参考。

const KNOWN_TRIGGERS: TriggerMeta[] = [
  { type: 'chat_end',          description: '每轮对话结束（AI 回复处理完后）',           ctxHint: '{ chatContent }' },
  { type: 'value_change',      description: '某个 character_value 发生变化',            ctxHint: '{ changedVariable, newValue }' },
  { type: 'time_pass_hourly',  description: '每现实小时（cron 调度）',                  ctxHint: '—' },
  { type: 'time_pass_daily',   description: '每现实天（cron 调度）',                    ctxHint: '—' },
  { type: 'time_pass_life',    description: '生活模拟触发（/life/generate）',           ctxHint: '—' },
  { type: 'keyword',           description: '关键词检测（消息内容匹配某关键词）',         ctxHint: '{ keyword, chatContent }' },
  { type: 'receive_gift',      description: '收到礼物',                                  ctxHint: '—' },
  { type: 'event_complete',    description: '某事件完成（branch 连接的级联触发）',       ctxHint: '{ completedEventId }' },
];

export function listKnownTriggerTypes(): TriggerMeta[] {
  return [...KNOWN_TRIGGERS];
}
