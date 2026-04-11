/**
 * 角色系统 App（角色系统）
 * 功能：
 * - 选择角色 → 查看 / 生成生活日志
 * - 道枢数值面板（查看 + 手动调整）
 * - 生成时显示完整 prompt payload（透明度）
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Bot, Sparkles, RefreshCw,
  Sliders, BookOpen, AlignLeft, Sun, Coffee, Moon, Star,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import Avatar from '../components/Avatar.jsx';

const API = async (path, opts = {}) => {
  const r = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' }, ...opts,
  });
  return r.json();
};

// ── 道枢数值面板 ───────────────────────────────────────────────────────────
const StatPanel = ({ charId, stats, statDefs, onStatsChange }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal]     = useState(stats || {});
  const [saving, setSaving]   = useState(false);

  useEffect(() => { setLocal(stats || {}); }, [stats]);

  const save = async () => {
    setSaving(true);
    try {
      await API(`/charstats/${charId}`, { method: 'PUT', body: JSON.stringify({ stats: local }) });
      onStatsChange(local);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const STAT_COLORS = {
    mood: 'bg-pink-400', energy: 'bg-green-400',
    relationship: 'bg-purple-400', trust: 'bg-blue-400', stress: 'bg-red-400',
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center px-4 py-2.5 border-b border-gray-100">
        <Sliders size={14} className="text-indigo-500 mr-2" />
        <span className="text-sm font-semibold text-gray-800 flex-1">道枢数值</span>
        {!editing
          ? <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:text-indigo-800">调整</button>
          : <div className="flex gap-2">
              <button onClick={() => { setLocal(stats); setEditing(false); }} className="text-xs text-gray-500">取消</button>
              <button onClick={save} disabled={saving} className="text-xs text-indigo-600 disabled:opacity-50">
                {saving ? '保存…' : '保存'}
              </button>
            </div>
        }
      </div>
      <div className="px-4 py-3 space-y-3">
        {statDefs.filter(d => local[d.key] != null || true).map(d => {
          const val = local[d.key] ?? d.default ?? 50;
          const pct = Math.max(0, Math.min(100, ((val - (d.min ?? 0)) / ((d.max ?? 100) - (d.min ?? 0))) * 100));
          const barColor = STAT_COLORS[d.key] || 'bg-indigo-400';
          return (
            <div key={d.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">{d.name}</span>
                {editing
                  ? <input
                      type="number" min={d.min ?? 0} max={d.max ?? 100}
                      value={val}
                      onChange={e => setLocal(prev => ({ ...prev, [d.key]: Math.max(d.min ?? 0, Math.min(d.max ?? 100, +e.target.value)) }))}
                      className="w-14 text-right border border-gray-200 rounded px-1 py-0.5 text-xs"
                    />
                  : <span className="text-xs font-mono text-gray-700">{val}/{d.max ?? 100}</span>
                }
              </div>
              {editing
                ? <input
                    type="range" min={d.min ?? 0} max={d.max ?? 100} value={val}
                    onChange={e => setLocal(prev => ({ ...prev, [d.key]: +e.target.value }))}
                    className="w-full accent-indigo-500"
                  />
                : <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 时段选择 ──────────────────────────────────────────────────────────────
const PERIODS = [
  { value: 'morning',   label: '上午',   icon: Coffee },
  { value: 'afternoon', label: '下午',   icon: Sun },
  { value: 'evening',   label: '傍晚',   icon: Star },
  { value: 'night',     label: '深夜',   icon: Moon },
];

// ── 生活日志条目 ──────────────────────────────────────────────────────────
const LogEntry = ({ log }) => {
  const [open, setOpen] = useState(false);
  const periodLabel = PERIODS.find(p => p.value === log.timeOfDay)?.label || '';
  const date = log.period || log.generatedAt?.slice(0, 10) || '';

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-start gap-2 hover:bg-gray-50 transition-colors text-left"
      >
        <BookOpen size={14} className="text-indigo-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] text-gray-400">{date}</span>
            {periodLabel && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">{periodLabel}</span>}
          </div>
          <p className={`text-xs text-gray-700 leading-relaxed ${!open ? 'line-clamp-3' : ''}`}>
            {log.content}
          </p>
          {log.eventsUsed?.length > 0 && open && (
            <div className="flex flex-wrap gap-1 mt-2">
              {log.eventsUsed.map(e => (
                <span key={e.id} className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full border border-purple-200">
                  {e.name || '事件'}
                </span>
              ))}
            </div>
          )}
        </div>
        {open ? <ChevronUp size={12} className="text-gray-400 shrink-0" /> : <ChevronDown size={12} className="text-gray-400 shrink-0" />}
      </button>
    </div>
  );
};

// ── 主组件 ────────────────────────────────────────────────────────────────
const CharLifeApp = ({ onBack, initialChar = null }) => {
  const [chars, setChars]         = useState([]);
  const [char, setChar]           = useState(initialChar);
  const [logs, setLogs]           = useState([]);
  const [stats, setStats]         = useState(null);
  const [statDefs, setStatDefs]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod]       = useState('morning');
  const [eventCount, setEventCount] = useState(2);
  const [lastDebug, setLastDebug] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [tab, setTab]             = useState('logs'); // 'logs' | 'stats'

  // 初始加载角色列表
  useEffect(() => {
    API('/characters').then(d => setChars(Array.isArray(d) ? d : []));
  }, []);

  // 当选中角色时加载数据
  useEffect(() => {
    if (!char) return;
    setLoading(true);
    Promise.all([
      API(`/characters/${char.id}/life?limit=20`),
      API(`/charstats/${char.id}`),
      API(`/charstats/defs?charId=${char.id}`),
    ]).then(([logData, statsData, defsData]) => {
      setLogs(Array.isArray(logData) ? logData : []);
      setStats(statsData?.stats || {});
      setStatDefs(Array.isArray(defsData) ? defsData : []);
    }).finally(() => setLoading(false));
  }, [char]);

  const generate = async () => {
    if (!char) return;
    setGenerating(true);
    setLastDebug(null);
    try {
      const result = await API(`/characters/${char.id}/life/generate`, {
        method: 'POST',
        body: JSON.stringify({ period, eventCount }),
      });
      if (result.error) {
        alert(`生成失败：${result.error}`);
        return;
      }
      setLastDebug(result.debug);
      // 刷新日志
      const freshLogs = await API(`/characters/${char.id}/life?limit=20`);
      setLogs(Array.isArray(freshLogs) ? freshLogs : []);
    } finally { setGenerating(false); }
  };

  // ── 未选角色：选择界面 ──────────────────────────────────────────────────
  if (!char) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="h-14 bg-white border-b flex items-center px-4 gap-2 shrink-0">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={20} className="text-gray-500" />
          </button>
          <Bot size={18} className="text-indigo-500" />
          <span className="font-bold text-gray-800">角色系统</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-xs text-gray-500 mb-3">选择一个角色来查看 / 生成其自主生活记录</p>
          {chars.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-8">暂无角色，请先去「结缘」创建角色</p>
          )}
          {chars.map(c => (
            <button
              key={c.id}
              onClick={() => setChar(c)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 mb-2 hover:bg-indigo-50 transition-colors text-left"
            >
              <Avatar value={c.avatar} name={c.name} size={40} rounded className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                {c.tags?.length > 0 && (
                  <p className="text-xs text-gray-400 truncate">{c.tags.join(' · ')}</p>
                )}
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── 已选角色：主界面 ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 顶栏 */}
      <div className="h-14 bg-white border-b flex items-center px-3 gap-2 shrink-0">
        <button onClick={() => setChar(null)} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <Avatar value={char.avatar} name={char.name} size={32} rounded className="shrink-0" />
        <span className="font-bold text-gray-800 flex-1">{char.name}的生活</span>
      </div>

      {/* Tab */}
      <div className="flex bg-white border-b shrink-0">
        {[
          { id: 'logs',  label: '生活日志' },
          { id: 'stats', label: '道枢数值' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === t.id ? 'text-indigo-600 border-b-2 border-indigo-500' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === 'stats' && stats && (
          <StatPanel
            charId={char.id}
            stats={stats}
            statDefs={statDefs}
            onStatsChange={setStats}
          />
        )}

        {tab === 'logs' && (
          <>
            {/* 生成控制面板 */}
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">生成生活记录</p>

              {/* 时段选择 */}
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {PERIODS.map(p => {
                  const Icon = p.icon;
                  const active = period === p.value;
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPeriod(p.value)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition-colors ${
                        active ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={14} className={active ? 'text-indigo-500' : 'text-gray-400'} />
                      <span className={`text-[10px] font-medium ${active ? 'text-indigo-700' : 'text-gray-500'}`}>{p.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* 事件数量 + 生成按钮 */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">随机事件数</span>
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setEventCount(n => Math.max(0, n - 1))}
                      className="px-2 py-1 text-gray-500 hover:bg-gray-100 text-sm"
                    >-</button>
                    <span className="px-3 text-sm font-mono">{eventCount}</span>
                    <button
                      onClick={() => setEventCount(n => Math.min(5, n + 1))}
                      className="px-2 py-1 text-gray-500 hover:bg-gray-100 text-sm"
                    >+</button>
                  </div>
                </div>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 text-white text-xs rounded-xl disabled:opacity-50 font-medium"
                >
                  {generating
                    ? <><RefreshCw size={12} className="animate-spin" /> 生成中…</>
                    : <><Sparkles size={12} /> 生成今日生活</>
                  }
                </button>
              </div>
            </div>

            {/* 上次生成的 debug payload */}
            {lastDebug && (
              <div className="bg-gray-900 rounded-xl overflow-hidden mb-3">
                <button
                  onClick={() => setShowDebug(d => !d)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left"
                >
                  <AlignLeft size={12} className="text-green-400" />
                  <span className="text-[10px] font-mono text-green-400 flex-1">
                    发送给 AI 的 Payload（{lastDebug.eventsSelected?.length || 0} 个事件）
                  </span>
                  {showDebug ? <ChevronUp size={10} className="text-gray-500" /> : <ChevronDown size={10} className="text-gray-500" />}
                </button>
                {showDebug && (
                  <div className="px-3 pb-3 text-[10px] font-mono text-green-300 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                    {JSON.stringify(lastDebug.messagesPayload, null, 2)}
                  </div>
                )}
              </div>
            )}

            {/* 日志列表 */}
            {loading && <p className="text-center text-gray-400 text-sm mt-6">加载中…</p>}
            {!loading && logs.length === 0 && (
              <div className="flex flex-col items-center justify-center mt-10 gap-2 text-gray-400">
                <BookOpen size={36} />
                <p className="text-sm">暂无生活记录</p>
                <p className="text-xs">点击「生成今日生活」让 AI 为角色自动创作</p>
              </div>
            )}
            {logs.map(log => <LogEntry key={log.id} log={log} />)}
          </>
        )}
      </div>
    </div>
  );
};

export default CharLifeApp;
