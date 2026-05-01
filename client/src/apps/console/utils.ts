import type { LogEntry, TraceEvent, LevelFilter } from './types';

export function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function shortId(id?: string | null): string {
  if (!id) return '-';
  const parts = id.split('_');
  return parts.length >= 3 ? `${parts[0]}_${parts[2]}` : id.slice(0, 12);
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return '-';
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

export function stringify(value: any): string {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function downloadJsonl(filename: string, entries: any[]): void {
  const lines = entries.map(entry => JSON.stringify(entry)).join('\n');
  const blob = new Blob([lines ? `${lines}\n` : ''], { type: 'application/x-ndjson;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function aiDetailBlock(entry: LogEntry): string {
  const lines: string[] = [];
  lines.push('── REQUEST ────────────────────────────────────');
  lines.push(`endpoint : ${entry.endpoint}`);
  if (entry.source) lines.push(`source   : ${entry.source}`);
  lines.push(`provider : ${entry.provider}`);
  lines.push(`model    : ${entry.model}`);
  lines.push(`baseURL  : ${entry.baseURL}`);
  if (entry.traceId) lines.push(`traceId  : ${entry.traceId}`);
  lines.push('');
  lines.push(entry.inputMessages?.length
    ? JSON.stringify(entry.inputMessages, null, 2)
    : '(no input messages)');
  lines.push('');
  lines.push('── RESPONSE ───────────────────────────────────');
  if (entry.error) {
    lines.push(`ERROR${entry.status ? ` [${entry.status}]` : ''} (${entry.errorPhase ?? '?'})`);
    lines.push(entry.error);
    if (entry.output) {
      lines.push('');
      lines.push('── partial output ──');
      lines.push(stringify(entry.output));
    }
  } else if (entry.output != null) {
    lines.push(stringify(entry.output));
  } else {
    lines.push('(empty)');
  }
  if (entry.streamChunks != null) {
    lines.push('');
    lines.push(`stream chunks  : ${entry.streamChunks}${entry.streamAborted ? '  (aborted)' : ''}`);
    if (entry.streamCompleted != null)
      lines.push(`completed      : ${entry.streamCompleted ? 'yes' : 'no'}`);
    if (entry.streamAbortType)
      lines.push(`abort type     : ${entry.streamAbortType}`);
  }
  if (entry.usage) {
    lines.push('');
    lines.push('── USAGE ──────────────────────────────────────');
    lines.push(JSON.stringify(entry.usage, null, 2));
  }
  return lines.join('\n');
}

export function levelRank(level: TraceEvent['level']): number {
  if (level === 'summary') return 0;
  if (level === 'detail') return 1;
  return 2;
}

export function canShowLevel(event: TraceEvent, filter: LevelFilter): boolean {
  return levelRank(event.level) <= levelRank(filter);
}

// Module pill color — each module gets its own tint
const MODULE_STYLES: Record<string, string> = {
  ai:          'bg-sky-100 text-sky-700',
  context:     'bg-blue-100 text-blue-700',
  worldbook:   'bg-indigo-100 text-indigo-700',
  variables:   'bg-violet-100 text-violet-700',
  memory:      'bg-purple-100 text-purple-700',
  eventEngine: 'bg-amber-100 text-amber-700',
  pending:     'bg-teal-100 text-teal-700',
  route:       'bg-slate-100 text-slate-500',
  trace:       'bg-slate-100 text-slate-400',
};

export function moduleStyle(module: string): string {
  return MODULE_STYLES[module] ?? 'bg-gray-100 text-gray-600';
}

// Source badge color — keyed on the first segment before '.'
const SOURCE_STYLES: Record<string, string> = {
  chat:      'bg-sky-100 text-sky-700',
  values:    'bg-violet-100 text-violet-700',
  life:      'bg-emerald-100 text-emerald-700',
  dream:     'bg-purple-100 text-purple-700',
  summaries: 'bg-amber-100 text-amber-700',
  event:     'bg-rose-100 text-rose-700',
  pending:   'bg-teal-100 text-teal-700',
  timePass:  'bg-slate-100 text-slate-500',
  dafu:      'bg-orange-100 text-orange-700',
};

export function sourceBadgeStyle(source: string): string {
  const key = source.split('.')[0];
  return SOURCE_STYLES[key] ?? 'bg-slate-100 text-slate-600';
}
