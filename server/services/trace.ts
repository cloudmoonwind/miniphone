/**
 * 业务轮次 Trace。
 *
 * 使用 AsyncLocalStorage 在一次请求/任务生命周期中收集事件。
 * 业务模块只调用 traceEvent/traceSummary/traceDetail/traceDebug；
 * 没有活跃 trace 时静默跳过。
 */

import { AsyncLocalStorage } from 'async_hooks';
import { appendTrace, type TraceLogEntry } from './traceStore.js';

export type TraceLevel = 'summary' | 'detail' | 'debug';
export type TraceModule =
  | 'route'
  | 'context'
  | 'worldbook'
  | 'variables'
  | 'placeholders'
  | 'aiProtocol'
  | 'memory'
  | 'eventEngine'
  | 'pending'
  | 'ai'
  | 'trace';

export interface TraceEventInput {
  module: TraceModule;
  type: string;
  level?: TraceLevel;
  message: string;
  data?: Record<string, any> | null;
  parentId?: string | null;
}

export interface TraceRunOptions {
  source: string;
  characterId?: string | null;
  metadata?: Record<string, any>;
}

interface StoredTraceEvent {
  id: string;
  parentId: string | null;
  ts: string;
  offsetMs: number;
  module: TraceModule;
  type: string;
  level: TraceLevel;
  message: string;
  data: Record<string, any> | null;
  truncated?: boolean;
  originalBytes?: number;
  keptBytes?: number;
}

const storage = new AsyncLocalStorage<TurnTrace>();

const MAX_EVENTS_PER_TURN = Number.parseInt(process.env.TRACE_MAX_EVENTS_PER_TURN || '1000', 10) || 1000;
const MAX_EVENT_BYTES = Number.parseInt(process.env.TRACE_MAX_EVENT_BYTES || '8192', 10) || 8192;
const MAX_TRACE_BYTES = Number.parseInt(process.env.TRACE_MAX_TRACE_BYTES || String(2 * 1024 * 1024), 10) || (2 * 1024 * 1024);

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function truncateString(value: string, maxBytes: number): string {
  if (byteLength(value) <= maxBytes) return value;
  let result = value;
  while (byteLength(result) > maxBytes && result.length > 0) {
    result = result.slice(0, Math.floor(result.length * 0.9));
  }
  return result + '…';
}

function trimData(data: Record<string, any> | null | undefined): {
  data: Record<string, any> | null;
  truncated: boolean;
  originalBytes?: number;
  keptBytes?: number;
} {
  if (data == null) return { data: null, truncated: false };
  const raw = JSON.stringify(data);
  const originalBytes = byteLength(raw);
  if (originalBytes <= MAX_EVENT_BYTES) return { data, truncated: false };

  const keptText = truncateString(raw, MAX_EVENT_BYTES);
  return {
    data: { truncatedJson: keptText },
    truncated: true,
    originalBytes,
    keptBytes: byteLength(keptText),
  };
}

function buildStats(events: StoredTraceEvent[], aiCallIds: string[]): Record<string, any> {
  const byModule: Record<string, number> = {};
  const byLevel: Record<string, number> = {};
  for (const event of events) {
    byModule[event.module] = (byModule[event.module] || 0) + 1;
    byLevel[event.level] = (byLevel[event.level] || 0) + 1;
  }
  return {
    aiCallCount: aiCallIds.length,
    byModule,
    byLevel,
  };
}

export class TurnTrace {
  readonly id: string;
  readonly source: string;
  readonly startedAt: string;
  readonly startMs: number;
  readonly characterId: string | null;
  readonly metadata: Record<string, any>;
  readonly events: StoredTraceEvent[] = [];
  readonly aiCallIds: string[] = [];
  incomplete = false;
  truncationReason: string | null = null;
  droppedEventCount = 0;
  truncatedEventCount = 0;
  private closed = false;

  constructor(options: TraceRunOptions) {
    this.id = genId('trace');
    this.source = options.source;
    this.startedAt = new Date().toISOString();
    this.startMs = Date.now();
    this.characterId = options.characterId ?? null;
    this.metadata = options.metadata ?? {};
  }

  event(input: TraceEventInput): string | null {
    if (this.closed) return null;
    if (this.events.length >= MAX_EVENTS_PER_TURN) {
      this.markIncomplete('max-events');
      this.droppedEventCount++;
      return null;
    }

    const trimmed = trimData(input.data);
    if (trimmed.truncated) {
      this.markIncomplete('max-event-bytes');
      this.truncatedEventCount++;
    }

    const event: StoredTraceEvent = {
      id: genId('tev'),
      parentId: input.parentId ?? null,
      ts: new Date().toISOString(),
      offsetMs: Date.now() - this.startMs,
      module: input.module,
      type: input.type,
      level: input.level ?? 'summary',
      message: input.message,
      data: trimmed.data,
      ...(trimmed.truncated ? {
        truncated: true,
        originalBytes: trimmed.originalBytes,
        keptBytes: trimmed.keptBytes,
      } : {}),
    };
    this.events.push(event);
    return event.id;
  }

  linkAiCall(logId: string): void {
    if (!logId || this.aiCallIds.includes(logId)) return;
    this.aiCallIds.push(logId);
  }

  markIncomplete(reason: string): void {
    this.incomplete = true;
    if (!this.truncationReason) this.truncationReason = reason;
  }

  async finish(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    if (this.incomplete) {
      this.events.push({
        id: genId('tev'),
        parentId: null,
        ts: new Date().toISOString(),
        offsetMs: Date.now() - this.startMs,
        module: 'trace',
        type: 'trace.truncated',
        level: 'summary',
        message: `trace incomplete: ${this.truncationReason ?? 'unknown'}, dropped=${this.droppedEventCount}, truncated=${this.truncatedEventCount}`,
        data: {
          reason: this.truncationReason,
          droppedEventCount: this.droppedEventCount,
          truncatedEventCount: this.truncatedEventCount,
        },
      });
    }

    let endedAt = new Date().toISOString();
    let trace: TraceLogEntry = {
      id: this.id,
      source: this.source,
      startedAt: this.startedAt,
      endedAt,
      durationMs: Date.now() - this.startMs,
      characterId: this.characterId,
      metadata: this.metadata,
      aiCallIds: this.aiCallIds,
      eventCount: this.events.length,
      summaryStats: buildStats(this.events, this.aiCallIds),
      incomplete: this.incomplete,
      truncationReason: this.truncationReason,
      droppedEventCount: this.droppedEventCount,
      truncatedEventCount: this.truncatedEventCount,
      events: this.events,
    };

    const raw = JSON.stringify(trace);
    if (byteLength(raw) > MAX_TRACE_BYTES) {
      this.markIncomplete('max-trace-bytes');
      const keptEvents: StoredTraceEvent[] = [];
      let dropped = 0;
      for (const event of this.events) {
        const candidate = { ...trace, events: [...keptEvents, event] };
        if (byteLength(JSON.stringify(candidate)) > MAX_TRACE_BYTES) {
          dropped++;
          continue;
        }
        keptEvents.push(event);
      }
      keptEvents.push({
        id: genId('tev'),
        parentId: null,
        ts: new Date().toISOString(),
        offsetMs: Date.now() - this.startMs,
        module: 'trace',
        type: 'trace.truncated',
        level: 'summary',
        message: `trace incomplete: max-trace-bytes, dropped=${dropped}`,
        data: { reason: 'max-trace-bytes', droppedEventCount: dropped },
      });
      endedAt = new Date().toISOString();
      trace = {
        ...trace,
        endedAt,
        durationMs: Date.now() - this.startMs,
        eventCount: keptEvents.length,
        summaryStats: buildStats(keptEvents, this.aiCallIds),
        incomplete: true,
        truncationReason: 'max-trace-bytes',
        droppedEventCount: trace.droppedEventCount + dropped,
        events: keptEvents,
      };
    }

    await appendTrace(trace);
  }
}

export function getCurrentTrace(): TurnTrace | null {
  return storage.getStore() ?? null;
}

export async function runWithTrace<T>(options: TraceRunOptions, fn: () => Promise<T>): Promise<T> {
  const trace = new TurnTrace(options);
  return await storage.run(trace, async () => {
    trace.event({
      module: 'route',
      type: `${options.source}.start`,
      level: 'summary',
      message: `${options.source} start`,
      data: options.metadata ?? null,
    });
    try {
      const result = await fn();
      trace.event({
        module: 'route',
        type: `${options.source}.done`,
        level: 'summary',
        message: `${options.source} done`,
      });
      return result;
    } catch (err: any) {
      trace.event({
        module: 'route',
        type: `${options.source}.error`,
        level: 'summary',
        message: err?.message ?? String(err),
        data: { error: err?.message ?? String(err) },
      });
      throw err;
    } finally {
      await trace.finish();
    }
  });
}

export function traceEvent(input: TraceEventInput): string | null {
  return getCurrentTrace()?.event(input) ?? null;
}

export function traceSummary(module: TraceModule, type: string, message: string, data?: Record<string, any> | null): string | null {
  return traceEvent({ module, type, level: 'summary', message, data });
}

export function traceDetail(module: TraceModule, type: string, message: string, data?: Record<string, any> | null, parentId?: string | null): string | null {
  return traceEvent({ module, type, level: 'detail', message, data, parentId });
}

export function traceDebug(module: TraceModule, type: string, message: string, data?: Record<string, any> | null, parentId?: string | null): string | null {
  return traceEvent({ module, type, level: 'debug', message, data, parentId });
}

export const __testing = {
  MAX_EVENTS_PER_TURN,
  MAX_EVENT_BYTES,
  MAX_TRACE_BYTES,
};
