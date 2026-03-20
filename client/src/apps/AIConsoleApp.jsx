import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, RefreshCw, Trash2 } from 'lucide-react';

// ── 将单条日志渲染为原始文本块 ────────────────────────────────────────
function renderRaw(entry, index) {
  const ts = entry.timestamp
    ? new Date(entry.timestamp).toLocaleString('zh-CN', { hour12: false })
    : '—';
  const dur = entry.durationMs ? (entry.durationMs / 1000).toFixed(2) : '?';
  const usageStr = entry.usage
    ? `in=${entry.usage.prompt_tokens ?? '?'} out=${entry.usage.completion_tokens ?? '?'}`
    : 'tokens=N/A';

  const lines = [];
  lines.push('═'.repeat(52));
  lines.push(`CALL #${index + 1}  ${entry.stream ? '[STREAM]' : '[SYNC]  '}  ${ts}`);
  lines.push(`model=${entry.model || '?'}  ${dur}s  ${usageStr}`);
  if (entry.error) {
    lines.push(`ERROR${entry.status ? ` [${entry.status}]` : ''}: ${entry.error}`);
  }
  lines.push('');
  lines.push('──── REQUEST ────────────────────────────────────');
  if (entry.inputMessages?.length) {
    lines.push(JSON.stringify(entry.inputMessages, null, 2));
  } else {
    lines.push('(empty)');
  }
  lines.push('');
  lines.push('──── RESPONSE ───────────────────────────────────');
  lines.push(entry.output ?? (entry.error ? `[ERROR] ${entry.error}` : '(empty)'));
  lines.push('');
  return lines.join('\n');
}

// ── 主组件 ───────────────────────────────────────────────────────────────
const AIConsoleApp = ({ onBack }) => {
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter]           = useState('');
  const intervalRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/debug/ai-log?limit=30');
      if (res.ok) setLogs(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    try {
      await fetch('/api/debug/ai-log', { method: 'DELETE' });
      setLogs([]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (autoRefresh) intervalRef.current = setInterval(fetchLogs, 3000);
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, fetchLogs]);

  // 构建全文本，最新的 call 在最下面（便于 grep）
  const allText = [...logs].reverse().map((entry, i) => renderRaw(entry, i)).join('\n');
  const filtered = filter.trim()
    ? allText.split('\n')
        .filter(l => l.toLowerCase().includes(filter.toLowerCase()))
        .join('\n')
    : allText;

  return (
    <div className="flex flex-col h-full bg-black text-green-400 font-mono">
      {/* 顶栏 */}
      <div className="h-10 bg-gray-950 border-b border-gray-800 flex items-center px-2 gap-1.5 shrink-0">
        <button onClick={onBack} className="p-1.5 hover:bg-gray-800 rounded">
          <ChevronLeft size={16} className="text-gray-400" />
        </button>
        <span className="text-green-500 text-xs font-bold flex-1">root@ics:~/ai-log$</span>
        <span className="text-gray-600 text-[10px]">{logs.length} calls</span>
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="grep..."
          className="bg-gray-900 border border-gray-700 text-green-300 text-[10px] px-1.5 py-0.5 rounded w-20 placeholder-gray-600 focus:outline-none focus:border-green-700"
        />
        <button
          onClick={() => setAutoRefresh(a => !a)}
          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
            autoRefresh ? 'border-green-700 text-green-400' : 'border-gray-700 text-gray-500'
          }`}
        >
          {autoRefresh ? '■' : '▶'}
        </button>
        <button onClick={fetchLogs} className="p-1 text-gray-500 hover:text-gray-300 rounded">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={clearLogs} className="p-1 text-gray-500 hover:text-red-400 rounded">
          <Trash2 size={12} />
        </button>
      </div>

      {/* 原始文本输出区 */}
      <div className="flex-1 overflow-y-auto px-2 py-2 text-[11px] leading-[1.65] whitespace-pre-wrap break-all">
        {loading && (
          <span className="text-yellow-500 animate-pulse">Loading...</span>
        )}
        {!loading && logs.length === 0 && (
          <span className="text-gray-600">
            {`> no records yet.\n> trigger an AI response and refresh.`}
          </span>
        )}
        {!loading && logs.length > 0 && (
          <span className={filter ? 'text-yellow-300' : 'text-green-300'}>
            {filtered || '(no matches)'}
          </span>
        )}
      </div>

      {/* 状态栏 */}
      <div className="h-5 bg-gray-950 border-t border-gray-800 flex items-center px-2 shrink-0">
        <span className="text-[9px] text-gray-600">
          {autoRefresh ? '● auto 3s' : '○ manual'} · max 30 records
          {filter ? ` · grep: "${filter}"` : ''}
        </span>
      </div>
    </div>
  );
};

export default AIConsoleApp;
