import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, RefreshCw, Trash2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';

// ── 类型 ─────────────────────────────────────────────────────────────
interface LogEntry {
  id: string;
  traceId: string | null;
  timestamp: string;
  endpoint: 'chat' | 'chatStream' | 'listModels' | 'testConnection';
  source: string | null;
  provider: string;
  baseURL: string;
  model: string;
  durationMs: number;
  inputMessages: any[] | null;
  output: string | any | null;
  usage: any | null;
  streamChunks: number | null;
  streamAborted: boolean | null;
  streamCompleted: boolean | null;
  streamAbortType: 'none' | 'before-call-error' | 'upstream-error' | 'client-disconnect' | 'server-cancel' | 'consumer-break' | null;
  error: string | null;
  status: number | null;
  errorPhase: 'before-call' | 'mid-stream' | 'after-stream' | null;
}

// ── 工具函数 ─────────────────────────────────────────────────────────
function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function summaryLine(entry: LogEntry, index: number): string {
  const time = formatTime(entry.timestamp);
  const dur = (entry.durationMs / 1000).toFixed(2);
  const tag = entry.endpoint === 'chatStream'
    ? '[STREAM]'
    : entry.endpoint === 'listModels'
      ? '[MODELS]'
      : entry.endpoint === 'testConnection'
        ? '[TEST]  '
        : '[SYNC]  ';
  const status = entry.error
    ? `ERR${entry.status ? ` ${entry.status}` : ''} ${entry.error.slice(0, 40)}`
    : entry.usage
      ? `OK in=${entry.usage.prompt_tokens ?? '?'} out=${entry.usage.completion_tokens ?? '?'}`
      : entry.streamChunks != null
        ? `OK chunks=${entry.streamChunks}${entry.streamAborted ? ' (ABORTED)' : ''}`
        : 'OK';
  const idx = String(index + 1).padStart(2, '0');
  const source = entry.source ? ` ${entry.source}` : '';
  return `#${idx} ${tag} ${time}${source}  ${entry.provider}/${entry.model}  ${dur}s  ${status}`;
}

function detailBlock(entry: LogEntry): string {
  const lines: string[] = [];
  lines.push('──── REQUEST ────────────────────────────────────');
  lines.push(`endpoint: ${entry.endpoint}`);
  if (entry.source) lines.push(`source:   ${entry.source}`);
  lines.push(`baseURL:  ${entry.baseURL}`);
  if (entry.traceId) lines.push(`traceId:  ${entry.traceId}`);
  lines.push('');
  if (entry.inputMessages?.length) {
    lines.push(JSON.stringify(entry.inputMessages, null, 2));
  } else {
    lines.push('(no input messages)');
  }
  lines.push('');
  lines.push('──── RESPONSE ───────────────────────────────────');
  if (entry.error) {
    lines.push(`ERROR${entry.status ? ` [${entry.status}]` : ''} (${entry.errorPhase ?? '?'}): ${entry.error}`);
    if (entry.output) {
      lines.push('');
      lines.push('— partial output before failure —');
      lines.push(typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output, null, 2));
    }
  } else if (entry.output != null) {
    lines.push(typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output, null, 2));
  } else {
    lines.push('(empty)');
  }
  if (entry.streamChunks != null) {
    lines.push('');
    lines.push(`(stream chunks: ${entry.streamChunks}${entry.streamAborted ? ', aborted' : ''})`);
    if (entry.streamCompleted != null) lines.push(`(stream completed: ${entry.streamCompleted ? 'yes' : 'no'})`);
    if (entry.streamAbortType) lines.push(`(stream abort type: ${entry.streamAbortType})`);
  }
  if (entry.usage) {
    lines.push(`(usage: ${JSON.stringify(entry.usage)})`);
  }
  return lines.join('\n');
}

// ── 主组件 ───────────────────────────────────────────────────────────────
const AIConsoleApp = ({ onBack }) => {
  const [date, setDate] = useState<string>(todayKey());
  const [dates, setDates] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const intervalRef = useRef<any>(null);

  const isToday = date === todayKey();

  // ── 数据获取 ──────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (targetDate: string) => {
    try {
      const res = await fetch(`/api/debug/ai-log?date=${targetDate}`);
      if (res.ok) setLogs(await res.json());
      else setLogs([]);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, []);

  const fetchDates = useCallback(async () => {
    try {
      const res = await fetch('/api/debug/ai-log/dates');
      if (res.ok) {
        const availableDates = await res.json();
        setDates(availableDates);
        setDate(current => {
          if (!availableDates.length) return current;
          return availableDates.includes(current) ? current : availableDates[0];
        });
      }
    } catch { /* ignore */ }
  }, []);

  const clearLogs = useCallback(async () => {
    if (!confirm(`确认删除 ${date} 的全部日志？`)) return;
    try {
      await fetch(`/api/debug/ai-log?date=${date}`, { method: 'DELETE' });
      setLogs([]);
      await fetchDates();
    } catch { /* ignore */ }
  }, [date, fetchDates]);

  // ── 副作用 ──────────────────────────────────────────────────────────
  useEffect(() => { fetchDates(); }, [fetchDates]);
  useEffect(() => { setLoading(true); fetchLogs(date); }, [date, fetchLogs]);

  // 自动刷新仅在"今天"时生效
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh && isToday) {
      intervalRef.current = setInterval(() => fetchLogs(date), 3000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, isToday, date, fetchLogs]);

  // ── 折叠/展开 ─────────────────────────────────────────────────────────
  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const expandAll = () => setExpanded(new Set(logs.map(l => l.id)));
  const collapseAll = () => setExpanded(new Set());

  // ── 过滤 ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!filter.trim()) return logs;
    const q = filter.toLowerCase();
    return logs.filter(entry => {
      const haystack = [
        entry.model, entry.provider, entry.baseURL, entry.endpoint,
        entry.source ?? '',
        entry.error ?? '',
        typeof entry.output === 'string' ? entry.output : JSON.stringify(entry.output ?? ''),
        JSON.stringify(entry.inputMessages ?? ''),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, filter]);

  // grep 命中时自动展开
  useEffect(() => {
    if (filter.trim()) setExpanded(new Set(filtered.map(e => e.id)));
  }, [filter, filtered]);

  return (
    <div className="flex flex-col h-full bg-black text-green-400 font-mono">
      {/* 顶栏 */}
      <div className="h-10 bg-gray-950 border-b border-gray-800 flex items-center px-2 gap-1 shrink-0">
        <button onClick={onBack} className="p-1.5 hover:bg-gray-800 rounded">
          <ChevronLeft size={16} className="text-gray-400" />
        </button>
        <span className="text-green-500 text-xs font-bold">root@ics:~/ai-log$</span>

        {/* 日期切换器 */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={() => setShowDatePicker(s => !s)}
            className="px-2 py-0.5 bg-gray-900 border border-gray-700 rounded text-green-300 text-[10px] flex items-center gap-1"
          >
            <Calendar size={11} />
            {date}{isToday ? ' (today)' : ''}
          </button>
        </div>

        <span className="text-gray-600 text-[10px] ml-1">{filtered.length}/{logs.length}</span>

        <div className="flex-1" />

        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="grep..."
          className="bg-gray-900 border border-gray-700 text-green-300 text-[10px] px-1.5 py-0.5 rounded w-20 placeholder-gray-600 focus:outline-none focus:border-green-700"
        />
        <button
          onClick={expandAll}
          className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-green-300"
          title="全部展开"
        >
          <ChevronDown size={12} />
        </button>
        <button
          onClick={collapseAll}
          className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-green-300"
          title="全部折叠"
        >
          <ChevronUp size={12} />
        </button>
        <button
          onClick={() => setAutoRefresh(a => !a)}
          disabled={!isToday}
          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
            autoRefresh && isToday ? 'border-green-700 text-green-400' : 'border-gray-700 text-gray-500'
          } disabled:opacity-30`}
          title={isToday ? '自动刷新' : '只有今天才能自动刷新'}
        >
          {autoRefresh && isToday ? '■' : '▶'}
        </button>
        <button onClick={() => fetchLogs(date)} className="p-1 text-gray-500 hover:text-gray-300 rounded">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={clearLogs} className="p-1 text-gray-500 hover:text-red-400 rounded">
          <Trash2 size={12} />
        </button>
      </div>

      {/* 日期选择浮层 */}
      {showDatePicker && (
        <div className="absolute top-10 left-12 z-10 bg-gray-950 border border-gray-700 rounded shadow-lg max-h-60 overflow-y-auto min-w-32">
          {dates.length === 0 && (
            <div className="px-3 py-2 text-gray-500 text-[10px]">no logs yet</div>
          )}
          {dates.map(d => (
            <button
              key={d}
              onClick={() => { setDate(d); setShowDatePicker(false); }}
              className={`block w-full text-left px-3 py-1 text-[10px] hover:bg-gray-800 ${
                d === date ? 'text-green-400 bg-gray-900' : 'text-gray-400'
              }`}
            >
              {d}{d === todayKey() ? ' · today' : ''}
            </button>
          ))}
        </div>
      )}

      {/* 主区域：可折叠列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-2 text-[11px] leading-[1.55]">
        {loading && (
          <span className="text-yellow-500 animate-pulse">Loading...</span>
        )}
        {!loading && filtered.length === 0 && (
          <span className="text-gray-600 whitespace-pre-wrap">
            {filter
              ? `> no entries match "${filter}".`
              : `> no records on ${date}.\n> trigger an AI response and refresh.`}
          </span>
        )}
        {!loading && filtered.map((entry, i) => {
          const isExpanded = expanded.has(entry.id);
          const isError = !!entry.error;
          return (
            <div key={entry.id} className="mb-0.5">
              <button
                onClick={() => toggle(entry.id)}
                className={`w-full text-left flex items-center gap-1 hover:bg-gray-900 rounded px-1 py-0.5 ${
                  isError ? 'text-red-400' : 'text-green-300'
                }`}
              >
                <span className="text-gray-600 w-3 inline-block">{isExpanded ? '▾' : '▸'}</span>
                <span className="font-mono">{summaryLine(entry, i)}</span>
              </button>
              {isExpanded && (
                <pre className={`pl-5 pr-2 py-1 border-l border-gray-800 ml-1.5 my-1 whitespace-pre-wrap break-all ${
                  isError ? 'text-red-300' : 'text-green-200'
                }`}>
                  {detailBlock(entry)}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      {/* 状态栏 */}
      <div className="h-5 bg-gray-950 border-t border-gray-800 flex items-center px-2 shrink-0">
        <span className="text-[9px] text-gray-600">
          {date}{isToday ? ' · today' : ''} · {filtered.length}/{logs.length} entries
          {autoRefresh && isToday ? ' · ● auto 3s' : ''}
          {filter ? ` · grep: "${filter}"` : ''}
          {' · 14d retention'}
        </span>
      </div>
    </div>
  );
};

export default AIConsoleApp;
