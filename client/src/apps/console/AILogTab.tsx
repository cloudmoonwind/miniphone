import React from 'react';
import { ChevronRight, Download, Trash2 } from 'lucide-react';
import type { LogEntry } from './types';
import { formatTime, formatMs, aiDetailBlock, downloadJsonl } from './utils';

interface Props {
  entries: LogEntry[];
  date: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (entry: LogEntry) => void;
  filter: string;
}

function EndpointPill({ endpoint }: { endpoint: LogEntry['endpoint'] }) {
  const styles: Record<string, string> = {
    chatStream:     'bg-sky-100 text-sky-700',
    chat:           'bg-blue-100 text-blue-700',
    listModels:     'bg-slate-100 text-slate-500',
    testConnection: 'bg-violet-100 text-violet-700',
  };
  const labels: Record<string, string> = {
    chatStream: 'STREAM',
    chat: 'SYNC',
    listModels: 'MODELS',
    testConnection: 'TEST',
  };
  return (
    <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold tracking-wide ${styles[endpoint] ?? 'bg-slate-100 text-slate-500'}`}>
      {labels[endpoint] ?? endpoint}
    </span>
  );
}

export function AILogTab({ entries, date, expanded, onToggle, onDelete, filter }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="text-4xl mb-3 opacity-40">◈</div>
        <div className="text-sm">{filter ? `没有匹配 "${filter}" 的日志` : `${date} 暂无 AI 日志`}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-indigo-100/60 bg-white/75 divide-y divide-indigo-50/80 shadow-sm">
      {entries.map((entry) => {
        const isExpanded = expanded.has(entry.id);
        const isError = !!entry.error;

        return (
          <React.Fragment key={entry.id}>
            {/* Summary row */}
            <div
              onClick={() => onToggle(entry.id)}
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-indigo-50/50 active:bg-indigo-50/80 transition-colors select-none"
            >
              <ChevronRight
                size={13}
                className={`shrink-0 text-indigo-300 transition-transform duration-150 ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`}
              />

              {/* Main info — two lines */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 tabular-nums text-[11px] text-slate-400 font-mono">
                    {formatTime(entry.timestamp)}
                  </span>
                  <EndpointPill endpoint={entry.endpoint} />
                  <span className="truncate text-xs text-slate-700 font-medium">
                    {entry.source ?? entry.endpoint}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400 truncate">
                    {entry.provider}/{entry.model}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                    {formatMs(entry.durationMs)}
                  </span>
                  {isError ? (
                    <span className="shrink-0 text-[10px] font-semibold text-rose-500">
                      ERR{entry.status ? ` ${entry.status}` : ''}
                    </span>
                  ) : entry.usage ? (
                    <span className="shrink-0 text-[10px] text-emerald-600 tabular-nums">
                      {entry.usage.prompt_tokens ?? '?'}→{entry.usage.completion_tokens ?? '?'}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-emerald-500">✓</span>
                  )}
                </div>
              </div>

              {/* Per-entry actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadJsonl(`ai-${date}-${entry.id}.jsonl`, [entry]);
                  }}
                  title="导出这条日志"
                  className="p-1.5 rounded-md text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
                  title="删除这条日志"
                  className="p-1.5 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Expanded terminal */}
            {isExpanded && (
              <div className="bg-[#15152a] border-t border-[#2a2a50]">
                <pre className="px-4 py-3 text-[11px] leading-relaxed text-slate-200 font-mono whitespace-pre-wrap break-words overflow-auto max-h-96">
                  {aiDetailBlock(entry)}
                </pre>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
