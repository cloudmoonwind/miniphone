import React from 'react';
import { ChevronRight, Download, Trash2 } from 'lucide-react';
import type { TraceEntry, TraceEvent, LevelFilter } from './types';
import {
  formatTime, formatMs, shortId, downloadJsonl,
  moduleStyle, sourceBadgeStyle, canShowLevel,
} from './utils';

interface Props {
  traces: TraceEntry[];
  date: string;
  expanded: Set<string>;
  eventExpanded: Set<string>;
  onToggle: (id: string) => void;
  onEventToggle: (key: string) => void;
  levelFilter: LevelFilter;
  moduleFilter: string;
  onDelete: (trace: TraceEntry) => void;
  filter: string;
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold tracking-wide ${sourceBadgeStyle(source)}`}>
      {source}
    </span>
  );
}

function EventRow({
  event,
  openKey,
  isOpen,
  onToggle,
}: {
  event: TraceEvent;
  openKey: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasData = event.data != null || event.truncated;

  const rowBg = {
    summary: 'bg-white',
    detail:  'bg-slate-50/60',
    debug:   'bg-slate-50/25',
  }[event.level];

  const msgStyle = {
    summary: 'text-slate-800 font-medium',
    detail:  'text-slate-600',
    debug:   'text-slate-400',
  }[event.level];

  return (
    <>
      <div
        className={`flex items-start gap-2 px-3 py-1.5 border-b border-indigo-50/60 last:border-0 ${rowBg} ${hasData ? 'cursor-pointer hover:bg-indigo-50/30' : ''} transition-colors`}
        onClick={() => hasData && onToggle()}
      >
        {/* Offset */}
        <span className="w-12 shrink-0 font-mono text-[10px] text-slate-300 tabular-nums pt-0.5 select-none">
          +{event.offsetMs}
        </span>

        {/* Module pill */}
        <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold ${moduleStyle(event.module)}`}>
          {event.module}
        </span>

        {/* Message + type */}
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] leading-snug break-words ${msgStyle}`}>
            {event.message}
            {event.truncated && (
              <span className="ml-1.5 text-[9px] font-semibold text-amber-500 bg-amber-50 rounded px-1 py-0.5">
                ⚠ truncated
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-300 font-mono truncate mt-0.5">{event.type}</div>
        </div>

        {/* Expand data indicator */}
        {hasData && (
          <ChevronRight
            size={11}
            className={`shrink-0 text-indigo-300 mt-0.5 transition-transform duration-150 ${isOpen ? 'rotate-90 text-indigo-500' : ''}`}
          />
        )}
      </div>

      {/* Expanded data block */}
      {isOpen && event.data != null && (
        <div className="bg-[#15152a] border-b border-[#2a2a50]">
          <pre className="px-4 py-2.5 text-[11px] leading-relaxed text-slate-200 font-mono whitespace-pre-wrap break-words overflow-auto max-h-60">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}

export function TraceTab({
  traces, date, expanded, eventExpanded,
  onToggle, onEventToggle, levelFilter, moduleFilter,
  onDelete, filter,
}: Props) {
  if (traces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="text-4xl mb-3 opacity-40">◎</div>
        <div className="text-sm">{filter ? `没有匹配 "${filter}" 的 Trace` : `${date} 暂无 Trace`}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {traces.map((trace) => {
        const isExpanded = expanded.has(trace.id);
        const visibleEvents = trace.events.filter(ev =>
          canShowLevel(ev, levelFilter) &&
          (moduleFilter === 'all' || ev.module === moduleFilter)
        );
        const summaryCount = trace.events.filter(ev => ev.level === 'summary').length;

        return (
          <div
            key={trace.id}
            className="rounded-xl overflow-hidden border border-indigo-100/60 bg-white/75 shadow-sm"
          >
            {/* Trace header row */}
            <div
              onClick={() => onToggle(trace.id)}
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-indigo-50/50 active:bg-indigo-50/80 transition-colors select-none"
            >
              <ChevronRight
                size={13}
                className={`shrink-0 text-indigo-300 transition-transform duration-150 ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="shrink-0 tabular-nums text-[11px] text-slate-400 font-mono">
                    {formatTime(trace.startedAt)}
                  </span>
                  <SourceBadge source={trace.source} />
                  {trace.incomplete && (
                    <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
                      ⚠ 不完整
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400 tabular-nums">{formatMs(trace.durationMs)}</span>
                  <span className="text-[10px] text-slate-400">{trace.eventCount} ev</span>
                  <span className="text-[10px] text-slate-400">{summaryCount} sum</span>
                  {trace.aiCallIds.length > 0 && (
                    <span className="text-[10px] text-sky-500 font-medium">
                      {trace.aiCallIds.length} AI
                    </span>
                  )}
                  <span className="text-[9px] text-slate-300 font-mono" title={trace.id}>
                    {shortId(trace.id)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadJsonl(`trace-${date}-${trace.id}.jsonl`, [trace]);
                  }}
                  title="导出这条 Trace"
                  className="p-1.5 rounded-md text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(trace); }}
                  title="删除这条 Trace"
                  className="p-1.5 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Expanded event timeline */}
            {isExpanded && (
              <div className="border-t border-indigo-50">
                {visibleEvents.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400">
                    当前过滤条件下没有事件
                  </div>
                ) : (
                  visibleEvents.map(ev => {
                    const openKey = `${trace.id}:${ev.id}`;
                    return (
                      <EventRow
                        key={ev.id}
                        event={ev}
                        openKey={openKey}
                        isOpen={eventExpanded.has(openKey)}
                        onToggle={() => onEventToggle(openKey)}
                      />
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
