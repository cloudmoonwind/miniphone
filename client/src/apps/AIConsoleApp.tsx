import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChevronLeft, RefreshCw, Trash2, Calendar, Download,
  Search, Database, Activity, ChevronsDown, ChevronsUp,
} from 'lucide-react';
import type { LogEntry, TraceEntry, TabKey, LevelFilter } from './console/types';
import { todayKey, downloadJsonl } from './console/utils';
import { AILogTab } from './console/AILogTab';
import { TraceTab } from './console/TraceTab';

function stringify(value: any): string {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

const AIConsoleApp = ({ onBack }: { onBack: () => void }) => {
  const [tab, setTab] = useState<TabKey>('ai');

  // AI log state
  const [aiDate, setAiDate] = useState<string>(todayKey());
  const [aiDates, setAiDates] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [aiExpanded, setAiExpanded] = useState<Set<string>>(new Set());

  // Trace state
  const [traceDate, setTraceDate] = useState<string>(todayKey());
  const [traceDates, setTraceDates] = useState<string[]>([]);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [traceExpanded, setTraceExpanded] = useState<Set<string>>(new Set());
  const [eventExpanded, setEventExpanded] = useState<Set<string>>(new Set());
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('summary');
  const [moduleFilter, setModuleFilter] = useState('all');

  // Shared UI state
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter] = useState('');
  const intervalRef = useRef<any>(null);

  const activeDate = tab === 'ai' ? aiDate : traceDate;
  const activeDates = tab === 'ai' ? aiDates : traceDates;
  const isToday = activeDate === todayKey();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchAiLogs = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/debug/ai-log?date=${date}`);
      setLogs(res.ok ? await res.json() : []);
    } catch { setLogs([]); } finally { setLoading(false); }
  }, []);

  const fetchAiDates = useCallback(async () => {
    try {
      const res = await fetch('/api/debug/ai-log/dates');
      if (res.ok) {
        const available: string[] = await res.json();
        setAiDates(available);
        setAiDate(cur => available.length && !available.includes(cur) ? available[0] : cur);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchTraces = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/debug/traces?date=${date}`);
      setTraces(res.ok ? await res.json() : []);
    } catch { setTraces([]); } finally { setLoading(false); }
  }, []);

  const fetchTraceDates = useCallback(async () => {
    try {
      const res = await fetch('/api/debug/traces/dates');
      if (res.ok) {
        const available: string[] = await res.json();
        setTraceDates(available);
        setTraceDate(cur => available.length && !available.includes(cur) ? available[0] : cur);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAiDates(); fetchTraceDates(); }, [fetchAiDates, fetchTraceDates]);

  useEffect(() => {
    setLoading(true);
    if (tab === 'ai') fetchAiLogs(aiDate);
    else fetchTraces(traceDate);
  }, [tab, aiDate, traceDate, fetchAiLogs, fetchTraces]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh && isToday) {
      intervalRef.current = setInterval(() => {
        if (tab === 'ai') fetchAiLogs(aiDate);
        else fetchTraces(traceDate);
      }, 3000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, isToday, tab, aiDate, traceDate, fetchAiLogs, fetchTraces]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)),
    [logs],
  );

  const sortedTraces = useMemo(
    () => [...traces].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)),
    [traces],
  );

  const filteredAi = useMemo(() => {
    if (!filter.trim()) return sortedLogs;
    const q = filter.toLowerCase();
    return sortedLogs.filter(entry =>
      [
        entry.id, entry.traceId ?? '', entry.model, entry.provider,
        entry.baseURL, entry.endpoint, entry.source ?? '', entry.error ?? '',
        stringify(entry.output), JSON.stringify(entry.inputMessages ?? ''),
      ].join(' ').toLowerCase().includes(q)
    );
  }, [sortedLogs, filter]);

  const filteredTraces = useMemo(() => {
    if (!filter.trim()) return sortedTraces;
    const q = filter.toLowerCase();
    return sortedTraces.filter(trace =>
      [
        trace.id, trace.source, trace.characterId ?? '',
        trace.aiCallIds.join(' '), JSON.stringify(trace.metadata ?? {}),
        trace.events.map(ev => `${ev.module} ${ev.type} ${ev.message}`).join(' '),
      ].join(' ').toLowerCase().includes(q)
    );
  }, [sortedTraces, filter]);

  const moduleOptions = useMemo(() => {
    const mods = new Set<string>();
    traces.forEach(trace => trace.events.forEach(ev => mods.add(ev.module)));
    return ['all', ...Array.from(mods).sort()];
  }, [traces]);

  // Auto-expand on filter
  useEffect(() => {
    if (!filter.trim()) return;
    if (tab === 'ai') setAiExpanded(new Set(filteredAi.map(e => e.id)));
    else setTraceExpanded(new Set(filteredTraces.map(t => t.id)));
  }, [filter, tab, filteredAi, filteredTraces]);

  const visibleCount = tab === 'ai' ? filteredAi.length : filteredTraces.length;
  const totalCount = tab === 'ai' ? logs.length : traces.length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const selectDate = (date: string) => {
    if (tab === 'ai') setAiDate(date);
    else setTraceDate(date);
  };

  const refreshActive = () => {
    setLoading(true);
    if (tab === 'ai') fetchAiLogs(aiDate);
    else fetchTraces(traceDate);
  };

  const expandAll = () => {
    if (tab === 'ai') setAiExpanded(new Set(filteredAi.map(e => e.id)));
    else setTraceExpanded(new Set(filteredTraces.map(t => t.id)));
  };

  const collapseAll = () => {
    if (tab === 'ai') {
      setAiExpanded(new Set());
    } else {
      setTraceExpanded(new Set());
      setEventExpanded(new Set());
    }
  };

  const exportActiveDate = () => {
    if (tab === 'ai') downloadJsonl(`ai-log-${aiDate}.jsonl`, logs);
    else downloadJsonl(`trace-log-${traceDate}.jsonl`, traces);
  };

  const clearActiveDate = async () => {
    if (!confirm(`确认删除 ${activeDate} 的全部 ${tab === 'ai' ? 'AI' : 'Trace'} 日志？`)) return;
    const url = tab === 'ai'
      ? `/api/debug/ai-log?date=${aiDate}`
      : `/api/debug/traces?date=${traceDate}`;
    try {
      await fetch(url, { method: 'DELETE' });
      if (tab === 'ai') { setLogs([]); fetchAiDates(); }
      else { setTraces([]); fetchTraceDates(); }
    } catch { /* ignore */ }
  };

  const deleteAiEntry = async (entry: LogEntry) => {
    if (!confirm(`确认删除日志 ${entry.id}？`)) return;
    try {
      const res = await fetch(`/api/debug/ai-log/${encodeURIComponent(entry.id)}?date=${aiDate}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        setLogs(prev => prev.filter(e => e.id !== entry.id));
        setAiExpanded(prev => { const next = new Set(prev); next.delete(entry.id); return next; });
        fetchAiDates();
      }
    } catch { /* ignore */ }
  };

  const deleteTraceEntry = async (trace: TraceEntry) => {
    if (!confirm(`确认删除 trace ${trace.id}？`)) return;
    try {
      const res = await fetch(`/api/debug/traces/${encodeURIComponent(trace.id)}?date=${traceDate}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        setTraces(prev => prev.filter(t => t.id !== trace.id));
        setTraceExpanded(prev => { const next = new Set(prev); next.delete(trace.id); return next; });
        fetchTraceDates();
      }
    } catch { /* ignore */ }
  };

  const toggleAiEntry = (id: string) =>
    setAiExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const toggleTrace = (id: string) =>
    setTraceExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const toggleEvent = (key: string) =>
    setEventExpanded(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-[#ecedf6] text-slate-900">

      {/* ── Header ── */}
      <div className="shrink-0 bg-white/90 backdrop-blur-md border-b border-indigo-100/60 shadow-sm">

        {/* Row 1: Back · Title · Tab switcher */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <button
            onClick={onBack}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Database size={14} className="text-indigo-400" />
              AI 调试日志
            </div>
            <div className="text-[10px] text-slate-400 leading-none">3 天保留</div>
          </div>

          {/* Tab switcher — pill */}
          <div className="flex items-center rounded-full bg-indigo-50 p-0.5 shrink-0">
            <button
              onClick={() => setTab('ai')}
              className={`flex items-center gap-1 rounded-full px-2.5 h-7 text-xs font-semibold transition-all ${
                tab === 'ai'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-400 hover:text-indigo-600'
              }`}
            >
              <Database size={11} />
              AI
            </button>
            <button
              onClick={() => setTab('trace')}
              className={`flex items-center gap-1 rounded-full px-2.5 h-7 text-xs font-semibold transition-all ${
                tab === 'trace'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-400 hover:text-indigo-600'
              }`}
            >
              <Activity size={11} />
              Trace
            </button>
          </div>
        </div>

        {/* Row 2: Date · Search · View controls · Data actions */}
        <div className="flex items-center gap-1.5 px-3 pb-2">

          {/* Date picker */}
          <div className="relative shrink-0">
            <Calendar size={11} className="pointer-events-none absolute left-2 top-[7px] text-slate-400" />
            <select
              value={activeDate}
              onChange={e => selectDate(e.target.value)}
              className="h-7 rounded-lg border border-indigo-100 bg-white pl-6 pr-1 text-[11px] text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
            >
              {activeDates.length === 0 && <option value={activeDate}>{activeDate}</option>}
              {activeDates.map(d => (
                <option key={d} value={d}>{d}{d === todayKey() ? ' · 今' : ''}</option>
              ))}
            </select>
          </div>

          {/* Search — grows to fill space */}
          <div className="relative flex-1 min-w-0">
            <Search size={11} className="pointer-events-none absolute left-2 top-[7px] text-slate-400" />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="搜索..."
              className="h-7 w-full rounded-lg border border-indigo-100 bg-white pl-6 pr-2 text-[11px] outline-none placeholder:text-slate-300 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
            />
          </div>

          {/* View controls: expand / collapse */}
          <div className="flex items-center rounded-lg border border-indigo-100 bg-white overflow-hidden shrink-0">
            <button
              onClick={expandAll}
              title="展开全部"
              className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <ChevronsDown size={13} />
            </button>
            <div className="w-px h-4 bg-indigo-50" />
            <button
              onClick={collapseAll}
              title="折叠全部"
              className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <ChevronsUp size={13} />
            </button>
          </div>

          {/* Auto-refresh + manual refresh */}
          <div className="flex items-center rounded-lg border border-indigo-100 bg-white overflow-hidden shrink-0">
            <button
              onClick={() => isToday && setAutoRefresh(a => !a)}
              disabled={!isToday}
              title={isToday ? (autoRefresh ? '关闭自动刷新' : '开启自动刷新 3s') : '仅今天可自动刷新'}
              className="h-7 w-7 flex items-center justify-center hover:bg-indigo-50 disabled:opacity-40 transition-colors"
            >
              <span className={`w-2 h-2 rounded-full transition-colors ${autoRefresh && isToday ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </button>
            <div className="w-px h-4 bg-indigo-50" />
            <button
              onClick={refreshActive}
              title="刷新"
              className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-indigo-500' : ''} />
            </button>
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-indigo-100 mx-0.5 shrink-0" />

          {/* Export */}
          <button
            onClick={exportActiveDate}
            disabled={!totalCount}
            title="导出当前日期"
            className="h-7 w-7 flex items-center justify-center rounded-lg border border-indigo-100 bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-colors shrink-0"
          >
            <Download size={13} />
          </button>

          {/* Delete date */}
          <button
            onClick={clearActiveDate}
            title="删除当前日期全部日志"
            className="h-7 w-7 flex items-center justify-center rounded-lg border border-rose-100 bg-white text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Row 3 (Trace only): Level + Module filters */}
        {tab === 'trace' && (
          <div className="flex items-center gap-2 px-3 pb-2">
            <span className="text-[10px] text-slate-400 shrink-0">层级</span>
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value as LevelFilter)}
              className="h-6 rounded-md border border-indigo-100 bg-white px-1.5 text-[10px] text-slate-600 outline-none focus:border-indigo-300"
            >
              <option value="summary">摘要</option>
              <option value="detail">摘要 + 详情</option>
              <option value="debug">全部</option>
            </select>
            <span className="text-[10px] text-slate-400 shrink-0">模块</span>
            <select
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
              className="h-6 flex-1 min-w-0 rounded-md border border-indigo-100 bg-white px-1.5 text-[10px] text-slate-600 outline-none focus:border-indigo-300"
            >
              {moduleOptions.map(m => (
                <option key={m} value={m}>{m === 'all' ? '全部模块' : m}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            <RefreshCw size={16} className="animate-spin mr-2 text-indigo-400" />
            加载中…
          </div>
        ) : tab === 'ai' ? (
          <AILogTab
            entries={filteredAi}
            date={aiDate}
            expanded={aiExpanded}
            onToggle={toggleAiEntry}
            onDelete={deleteAiEntry}
            filter={filter}
          />
        ) : (
          <TraceTab
            traces={filteredTraces}
            date={traceDate}
            expanded={traceExpanded}
            eventExpanded={eventExpanded}
            onToggle={toggleTrace}
            onEventToggle={toggleEvent}
            levelFilter={levelFilter}
            moduleFilter={moduleFilter}
            onDelete={deleteTraceEntry}
            filter={filter}
          />
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 h-7 border-t border-indigo-100/50 bg-white/80 text-[10px] text-slate-400">
        <span className="font-semibold text-indigo-400">{tab === 'ai' ? 'AI' : 'Trace'}</span>
        <span>·</span>
        <span>{activeDate}{isToday ? ' · 今天' : ''}</span>
        <span>·</span>
        <span>{visibleCount}/{totalCount}</span>
        {autoRefresh && isToday && (
          <><span>·</span><span className="text-emerald-500">↻ 3s</span></>
        )}
        {filter && (
          <><span>·</span><span className="italic">"{filter}"</span></>
        )}
        {tab === 'trace' && moduleFilter !== 'all' && (
          <><span>·</span><span>{moduleFilter}</span></>
        )}
        <span className="ml-auto text-slate-300">debug workspace</span>
      </div>
    </div>
  );
};

export default AIConsoleApp;
