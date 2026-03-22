/**
 * 道枢 — 规则系统
 *
 * 这是规则的控制器，不是内容编辑器。
 * 事件内容在世界书里；这里只管：
 *   - 什么条件触发什么事件（数值阈值 / 随机权重）
 *   - 哪些事件互斥（同时段只能发生一个）
 *   - 哪些事件有前后依赖（发生A后才能发生B）
 *
 * 两个区域：
 *   数值控制 — 调节角色当前数值，实时观察哪些规则被激活
 *   规则网络 — SVG 可视化图：节点=事件规则，边=逻辑关系
 *              互斥: 红色虚线 ⊗   依赖: 蓝色箭头 →
 *              激活节点: 亮黄色光晕   未激活: 半透明
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ChevronLeft, ChevronDown, RefreshCw, Plus, X, Check,
  Lock, ZapOff, Zap, Info, Edit3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar.jsx';

const api = (path, opts) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

/* ── 常量 ─────────────────────────────────────────────────────────── */
const STAT_CFG = {
  mood:         { color: '#f472b6', label: '心情' },
  energy:       { color: '#4ade80', label: '精力' },
  stress:       { color: '#f87171', label: '压力' },
  relationship: { color: '#a78bfa', label: '好感' },
  trust:        { color: '#60a5fa', label: '信任' },
};
const OP_SYM   = { gte: '≥', lte: '≤', gt: '>', lt: '<', eq: '=' };
const OP_OPTS  = [
  { v: 'gte', l: '≥ 大于等于' }, { v: 'lte', l: '≤ 小于等于' },
  { v: 'gt',  l: '> 大于' },     { v: 'lt',  l: '< 小于' },
  { v: 'eq',  l: '= 等于' },
];
const GROUP_COLORS = [
  '#f472b6','#60a5fa','#4ade80','#fbbf24','#a78bfa','#f87171','#34d399','#fb923c',
];

function moodGrad(m = 50) {
  if (m >= 75) return 'from-amber-400 via-pink-400 to-rose-400';
  if (m >= 50) return 'from-sky-400 via-blue-400 to-indigo-400';
  if (m >= 30) return 'from-slate-400 via-gray-500 to-slate-600';
  return 'from-gray-600 via-slate-700 to-gray-800';
}

function evalCond(c, stats) {
  if (!c) return false;
  const v = stats[c.stat];
  if (v == null) return false;
  switch (c.op) {
    case 'gte': return v >= c.value;
    case 'lte': return v <= c.value;
    case 'gt':  return v >  c.value;
    case 'lt':  return v <  c.value;
    case 'eq':  return v === c.value;
    default: return false;
  }
}

/* ── 布局算法：圆形排布，互斥组相邻 ─────────────────────────────── */
function computeLayout(events) {
  if (!events.length) return [];
  const N = events.length;

  // 按互斥组聚集排序
  const placed = new Set();
  const ordered = [];
  const groupMap = {};
  events.forEach(e => {
    const g = e.eventConfig?.exclusionGroup;
    if (g) { if (!groupMap[g]) groupMap[g] = []; groupMap[g].push(e); }
  });
  Object.values(groupMap).forEach(grp =>
    grp.forEach(e => { if (!placed.has(e.id)) { ordered.push(e); placed.add(e.id); } })
  );
  events.forEach(e => { if (!placed.has(e.id)) { ordered.push(e); placed.add(e.id); } });

  const CX = 150, CY = 130;
  const R = N <= 4 ? 72 : N <= 7 ? 90 : N <= 11 ? 105 : 118;
  return ordered.map((e, i) => {
    const angle = (2 * Math.PI * i / N) - Math.PI / 2;
    return { ...e, x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
  });
}

/* ── 构建边 ───────────────────────────────────────────────────────── */
function buildEdges(events) {
  const edges = [];
  const groups = {};
  events.forEach(e => {
    const g = e.eventConfig?.exclusionGroup;
    if (g) { if (!groups[g]) groups[g] = []; groups[g].push(e.id); }
  });
  // 互斥对
  Object.values(groups).forEach(ids => {
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        edges.push({ from: ids[i], to: ids[j], type: 'mutex' });
  });
  // 依赖箭头
  events.forEach(e =>
    (e.eventConfig?.requires || []).forEach(req =>
      edges.push({ from: req, to: e.id, type: 'dep' })
    )
  );
  return edges;
}

/* ═══════════════════════════════════════════════════════════════════
 * 主组件
 * ═══════════════════════════════════════════════════════════════════ */
export default function RuleSystemApp({ onBack }) {
  const [chars, setChars]   = useState([]);
  const [char, setChar]     = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  const [stats, setStats]       = useState({});
  const [statDefs, setStatDefs] = useState([]);
  const [events, setEvents]     = useState([]);
  const [books, setBooks]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [updating, setUpdating] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId]   = useState(null); // null | event.id | 'new'
  const [editDraft, setEditDraft]   = useState({});

  useEffect(() => {
    api('/characters').then(d => {
      const list = Array.isArray(d) ? d : [];
      setChars(list);
      if (list.length) setChar(list[0]);
    });
  }, []);

  const load = useCallback(async (c) => {
    if (!c) return;
    setLoading(true);
    try {
      const [sd, defs, bk, entries] = await Promise.all([
        api(`/charstats/${c.id}`),
        api(`/charstats/defs?charId=${c.id}`),
        api(`/worldbook/books?charId=${c.id}`),
        api('/worldbook/entries'),
      ]);
      setStats(sd?.stats || {});
      setStatDefs(Array.isArray(defs) ? defs : []);
      setBooks(Array.isArray(bk) ? bk : []);
      const enabledBookIds = new Set(
        (Array.isArray(bk) ? bk : [])
          .filter(b => b.enabled && (b.charId == null || b.charId === c.id))
          .map(b => b.id)
      );
      setEvents(
        (Array.isArray(entries) ? entries : []).filter(e =>
          e.enabled !== false &&
          enabledBookIds.has(e.bookId) &&
          (e.activationMode === 'event-random' || e.activationMode === 'event-conditional')
        )
      );
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(char); }, [char, load]);

  const handleDelta = async (key, delta) => {
    if (!char || updating) return;
    setUpdating(true);
    try {
      const r = await api(`/charstats/${char.id}/delta`, {
        method: 'POST', body: JSON.stringify({ key, delta }),
      });
      if (r.stats) setStats(r.stats);
      else if (r.changed) setStats(p => ({ ...p, [key]: r.changed.next }));
    } finally { setUpdating(false); }
  };

  /* ── 触发状态计算 ── */
  const ruleStates = useMemo(() => {
    const depMet = (e) => {
      const reqs = e.eventConfig?.requires || [];
      // 在当前数据中无法判断事件是否"发生过"，只判断数值条件
      return reqs.length === 0; // 简化：有依赖则视为锁定
    };
    return new Map(events.map(e => {
      const cond = e.eventConfig?.condition;
      const isRandom = e.activationMode === 'event-random';
      const condMet = isRandom || evalCond(cond, stats);
      const locked = !depMet(e);
      return [e.id, { triggered: condMet && !locked, locked, isRandom, condMet }];
    }));
  }, [events, stats]);

  /* ── 网络布局 ── */
  const layoutNodes = useMemo(() => computeLayout(events), [events]);
  const edges = useMemo(() => buildEdges(events), [events]);
  const posMap = useMemo(() => new Map(layoutNodes.map(n => [n.id, { x: n.x, y: n.y }])), [layoutNodes]);

  /* ── 互斥组颜色映射 ── */
  const groupColorMap = useMemo(() => {
    const map = {};
    let ci = 0;
    events.forEach(e => {
      const g = e.eventConfig?.exclusionGroup;
      if (g && !map[g]) { map[g] = GROUP_COLORS[ci++ % GROUP_COLORS.length]; }
    });
    return map;
  }, [events]);

  const selectedEvent = events.find(e => e.id === selectedId);

  /* ── 规则保存（只保存触发逻辑，不涉及内容） ── */
  const saveRule = async () => {
    if (!editDraft.name) return;
    const target = events.find(e => e.id === editingId);
    if (!target && editingId !== 'new') return;

    const newEventConfig = {
      ...(target?.eventConfig || {}),
      weight: Number(editDraft.weight) || 1,
      ...(editDraft.activationMode === 'event-conditional' && editDraft.condStat
        ? { condition: { stat: editDraft.condStat, op: editDraft.condOp || 'gte', value: Number(editDraft.condValue) || 50 } }
        : { condition: undefined }),
      exclusionGroup: editDraft.exclusionGroup || undefined,
      requires: editDraft.requires?.length ? editDraft.requires : undefined,
    };
    // 清理 undefined
    Object.keys(newEventConfig).forEach(k => newEventConfig[k] === undefined && delete newEventConfig[k]);

    if (editingId === 'new') {
      const defBook = books.find(b => b.charId === char?.id) || books[0];
      await api('/worldbook/entries', {
        method: 'POST',
        body: JSON.stringify({
          bookId: defBook?.id, name: editDraft.name, content: '',
          keywords: [], enabled: true, priority: 100, position: 'embedded',
          activationMode: editDraft.activationMode || 'event-conditional',
          charId: char.id, eventConfig: newEventConfig,
        }),
      });
    } else {
      await api(`/worldbook/entries/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...target, activationMode: editDraft.activationMode, eventConfig: newEventConfig }),
      });
    }
    setEditingId(null);
    load(char);
  };

  const deleteRule = async (id) => {
    await api(`/worldbook/entries/${id}`, { method: 'DELETE' });
    setSelectedId(null);
    load(char);
  };

  const openEdit = (e) => {
    if (e === 'new') {
      setEditDraft({ activationMode: 'event-conditional', name: '', weight: 1, condStat: 'mood', condOp: 'gte', condValue: 50, exclusionGroup: '', requires: [] });
      setEditingId('new');
    } else {
      const ec = e.eventConfig || {};
      setEditDraft({
        activationMode: e.activationMode, name: e.name, weight: ec.weight || 1,
        condStat: ec.condition?.stat || 'mood', condOp: ec.condition?.op || 'gte',
        condValue: ec.condition?.value ?? 50,
        exclusionGroup: ec.exclusionGroup || '',
        requires: ec.requires || [],
      });
      setEditingId(e.id);
    }
  };

  const mood = stats.mood ?? 50;

  return (
    <div className={`flex flex-col h-full bg-gradient-to-br ${moodGrad(mood)} transition-all duration-1000`}>
      {/* ── 顶栏 ── */}
      <div className="flex items-center px-4 pt-3 pb-2 shrink-0 z-20">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
          <ChevronLeft size={20} className="text-white" />
        </button>
        <span className="text-white font-bold text-base flex-1 ml-1">道枢 · 规则系统</span>
        <button onClick={() => setShowPicker(p => !p)}
          className="flex items-center gap-1.5 bg-white/15 hover:bg-white/20 px-3 py-1.5 rounded-full">
          <span className="text-white text-sm">{char?.name || '选择'}</span>
          <ChevronDown size={13} className="text-white/70" />
        </button>
      </div>

      <AnimatePresence>
        {showPicker && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="absolute top-14 right-4 z-30 bg-white/20 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
            {chars.map(c => (
              <button key={c.id} onClick={() => { setChar(c); setShowPicker(false); setSelectedId(null); }}
                className={`w-full px-4 py-2.5 flex items-center gap-2 hover:bg-white/20 text-left ${char?.id === c.id ? 'bg-white/15' : ''}`}>
                <Avatar value={c.avatar} name={c.name} size={20} rounded />
                <span className="text-white text-sm">{c.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw size={22} className="text-white/60 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-6">

          {/* ═══ 数值控制 ═══ */}
          <div className="mx-4 mt-1 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 px-4 py-3">
            <p className="text-[10px] text-white/40 font-medium mb-2">数值控制 — 调节后实时看触发变化</p>
            <div className="space-y-2.5">
              {statDefs.map(def => {
                const cfg = STAT_CFG[def.key] || {};
                const v = stats[def.key] ?? def.default ?? 50;
                const pct = Math.max(0, Math.min(100, ((v - (def.min ?? 0)) / ((def.max ?? 100) - (def.min ?? 0))) * 100));
                // 该数值关联的条件规则（阈值标记）
                const marks = events.filter(e => e.eventConfig?.condition?.stat === def.key);
                return (
                  <div key={def.key} className="flex items-center gap-2">
                    <span className="text-xs text-white/60 w-9 shrink-0">{cfg.label || def.name}</span>
                    <div className="flex-1 relative h-4">
                      <div className="absolute top-1.5 left-0 right-0 h-1.5 bg-white/15 rounded-full">
                        <motion.div className="h-full rounded-full" style={{ backgroundColor: cfg.color || '#94a3b8' }}
                          animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 180, damping: 22 }} />
                      </div>
                      {marks.map((e, i) => {
                        const mPct = Math.max(0, Math.min(100,
                          ((e.eventConfig.condition.value - (def.min ?? 0)) / ((def.max ?? 100) - (def.min ?? 0))) * 100));
                        const state = ruleStates.get(e.id);
                        return (
                          <button key={e.id} onClick={() => setSelectedId(prev => prev === e.id ? null : e.id)}
                            className="absolute top-0 -translate-x-1/2" style={{ left: `${mPct}%` }}
                            title={`${e.name}: ${STAT_CFG[def.key]?.label || def.name} ${OP_SYM[e.eventConfig.condition.op]}${e.eventConfig.condition.value}`}>
                            <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent transition-colors ${
                              state?.triggered ? 'border-t-yellow-300' : 'border-t-white/30'}`} />
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-xs font-mono text-white/70 w-7 text-right">{v}</span>
                    <button onClick={() => handleDelta(def.key, -5)} disabled={updating}
                      className="w-5 h-5 rounded bg-white/10 text-white/70 text-xs hover:bg-white/20 disabled:opacity-30 flex items-center justify-center font-bold">−</button>
                    <button onClick={() => handleDelta(def.key, +5)} disabled={updating}
                      className="w-5 h-5 rounded bg-white/10 text-white/70 text-xs hover:bg-white/20 disabled:opacity-30 flex items-center justify-center font-bold">+</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ 规则网络 ═══ */}
          <div className="mx-4 mt-3 bg-black/20 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center px-4 pt-3 pb-1 gap-2">
              <span className="text-xs font-semibold text-white/70 flex-1">规则网络</span>
              <div className="flex items-center gap-3 text-[10px] text-white/30">
                <span className="flex items-center gap-1"><span className="w-4 border-t border-dashed border-red-400/60" /> 互斥</span>
                <span className="flex items-center gap-1"><span className="w-4 border-t border-blue-400/60" />→ 依赖</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-300/80" /> 激活</span>
              </div>
              <button onClick={() => openEdit('new')}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                <Plus size={13} className="text-white/70" />
              </button>
            </div>

            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <ZapOff size={24} className="text-white/15" />
                <p className="text-xs text-white/30">暂无事件规则</p>
                <p className="text-[10px] text-white/20">在世界书中添加 event-random 或 event-conditional 条目</p>
              </div>
            ) : (
              <RuleNetwork
                nodes={layoutNodes} edges={edges} posMap={posMap}
                ruleStates={ruleStates} groupColorMap={groupColorMap}
                selectedId={selectedId} onSelect={id => setSelectedId(p => p === id ? null : id)}
              />
            )}
          </div>

          {/* ═══ 选中规则详情 ═══ */}
          <AnimatePresence>
            {selectedEvent && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="mx-4 mt-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <TriggerDot state={ruleStates.get(selectedEvent.id)} />
                      <p className="text-white font-medium text-sm">{selectedEvent.name}</p>
                    </div>
                    {/* 触发条件 */}
                    <p className="text-white/50 text-xs mt-1">
                      {selectedEvent.activationMode === 'event-random'
                        ? `随机触发 · 权重 ×${selectedEvent.eventConfig?.weight || 1}`
                        : (() => {
                            const c = selectedEvent.eventConfig?.condition;
                            if (!c) return '条件触发 · 无条件定义';
                            const sl = STAT_CFG[c.stat]?.label || c.stat;
                            return `条件触发 · ${sl} ${OP_SYM[c.op] || c.op} ${c.value}`;
                          })()
                      }
                    </p>
                    {/* 关系 */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedEvent.eventConfig?.exclusionGroup && (
                        <span className="text-[10px] bg-red-500/20 text-red-200 px-2 py-0.5 rounded-full">
                          互斥组: {selectedEvent.eventConfig.exclusionGroup}
                        </span>
                      )}
                      {(selectedEvent.eventConfig?.requires || []).map(rid => {
                        const dep = events.find(e => e.id === rid);
                        return (
                          <span key={rid} className="text-[10px] bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-full">
                            前置: {dep?.name || rid}
                          </span>
                        );
                      })}
                      {!selectedEvent.eventConfig?.exclusionGroup && !(selectedEvent.eventConfig?.requires?.length) && (
                        <span className="text-[10px] text-white/20">无关系约束</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEdit(selectedEvent)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                      <Edit3 size={14} className="text-white/60" />
                    </button>
                    <button onClick={() => deleteRule(selectedEvent.id)}
                      className="p-2 bg-red-500/15 hover:bg-red-500/25 rounded-xl transition-colors">
                      <X size={14} className="text-red-300/80" />
                    </button>
                  </div>
                </div>
                {/* 当前状态说明 */}
                <StatusExplainer state={ruleStates.get(selectedEvent.id)} event={selectedEvent} stats={stats} statDefs={statDefs} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══ 全部规则索引（供快速跳转） ═══ */}
          {events.length > 0 && (
            <div className="mx-4 mt-3">
              <p className="text-[10px] text-white/30 mb-1.5">全部规则 ({events.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {events.map(e => {
                  const s = ruleStates.get(e.id);
                  return (
                    <button key={e.id} onClick={() => setSelectedId(p => p === e.id ? null : e.id)}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                        selectedId === e.id
                          ? 'bg-white/20 border-white/40 text-white'
                          : s?.triggered
                            ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-200'
                            : 'bg-white/5 border-white/10 text-white/40'
                      }`}>
                      {s?.triggered ? '●' : '○'} {e.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ 规则触发逻辑编辑器 ═══ */}
      <AnimatePresence>
        {editingId && (
          <RuleTriggerEditor
            draft={editDraft} setDraft={setEditDraft}
            statDefs={statDefs} events={events}
            isNew={editingId === 'new'}
            onSave={saveRule} onClose={() => setEditingId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── SVG 网络图 ──────────────────────────────────────────────────────── */
function RuleNetwork({ nodes, edges, posMap, ruleStates, groupColorMap, selectedId, onSelect }) {
  return (
    <div className="w-full overflow-hidden">
      <svg viewBox="0 0 300 270" className="w-full" style={{ height: '270px' }}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,1 L9,5 L0,9 Z" fill="#60a5fa" fillOpacity="0.7" />
          </marker>
          <filter id="glow-yellow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── 互斥组背景晕染 ── */}
        {Object.entries(groupColorMap).map(([g, color]) => {
          const members = nodes.filter(n => n.eventConfig?.exclusionGroup === g);
          if (members.length < 2) return null;
          // 找中心和半径
          const cx = members.reduce((s, n) => s + n.x, 0) / members.length;
          const cy = members.reduce((s, n) => s + n.y, 0) / members.length;
          const r = Math.max(...members.map(n => Math.hypot(n.x - cx, n.y - cy))) + 22;
          return (
            <ellipse key={g} cx={cx} cy={cy} rx={Math.max(r, 28)} ry={Math.max(r * 0.85, 22)}
              fill={color} fillOpacity="0.07" stroke={color} strokeOpacity="0.2" strokeWidth="1" />
          );
        })}

        {/* ── 边 ── */}
        {edges.map((edge, i) => {
          const a = posMap.get(edge.from);
          const b = posMap.get(edge.to);
          if (!a || !b) return null;

          if (edge.type === 'mutex') {
            // 互斥：红色虚线
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="#f87171" strokeWidth="1.2" strokeOpacity="0.4"
                  strokeDasharray="4,3" />
                <text x={mx} y={my} textAnchor="middle" dominantBaseline="central"
                  fontSize="8" fill="#f87171" fillOpacity="0.6">⊗</text>
              </g>
            );
          } else {
            // 依赖：蓝色箭头，缩短端点避免箭头压在圆上
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.hypot(dx, dy);
            const R = 14; // node radius
            const sx = a.x + dx / len * R, sy = a.y + dy / len * R;
            const ex = b.x - dx / len * R, ey = b.y - dy / len * R;
            return (
              <line key={i} x1={sx} y1={sy} x2={ex} y2={ey}
                stroke="#60a5fa" strokeWidth="1.2" strokeOpacity="0.5"
                markerEnd="url(#arrow)" />
            );
          }
        })}

        {/* ── 节点 ── */}
        {nodes.map(node => {
          const s = ruleStates.get(node.id);
          const active = s?.triggered;
          const locked = s?.locked;
          const isSelected = selectedId === node.id;
          const isRandom = node.activationMode === 'event-random';
          const groupColor = node.eventConfig?.exclusionGroup
            ? groupColorMap[node.eventConfig.exclusionGroup]
            : null;

          // 节点颜色
          const fill    = active ? '#fef08a' : locked ? '#374151' : '#e2e8f0';
          const stroke  = isSelected ? '#fff' : active ? '#fde047' : groupColor || 'rgba(255,255,255,0.2)';
          const textFill = active ? '#1a1a1a' : locked ? '#4b5563' : '#1a1a1a';

          // 截断名称：最多5个中文字
          const label = node.name.length > 5 ? node.name.slice(0, 5) + '…' : node.name;

          return (
            <g key={node.id} className="cursor-pointer" onClick={() => onSelect(node.id)}>
              {/* 激活光晕 */}
              {active && (
                <circle cx={node.x} cy={node.y} r="20"
                  fill="#fef08a" fillOpacity="0.15"
                  stroke="#fde047" strokeOpacity="0.3" strokeWidth="1" />
              )}
              {/* 选中光环 */}
              {isSelected && (
                <circle cx={node.x} cy={node.y} r="19"
                  fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="1.5"
                  strokeDasharray="3,2" />
              )}
              {/* 主圆 */}
              <circle cx={node.x} cy={node.y} r="14"
                fill={fill} fillOpacity={locked ? 0.4 : 0.9}
                stroke={stroke} strokeWidth={isSelected ? 2 : 1} />
              {/* 类型点：左上角 */}
              <circle cx={node.x - 8} cy={node.y - 8} r="3.5"
                fill={isRandom ? '#93c5fd' : '#fbbf24'} fillOpacity="0.9" />
              {/* 名称 */}
              <text x={node.x} y={node.y + 1} textAnchor="middle" dominantBaseline="central"
                fontSize="6.5" fontWeight="500" fill={textFill}>
                {label}
              </text>
              {/* 锁定图标 */}
              {locked && (
                <text x={node.x} y={node.y + 22} textAnchor="middle" fontSize="8" fill="white" fillOpacity="0.3">⊘</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── 触发状态圆点 ───────────────────────────────────────────────────── */
function TriggerDot({ state }) {
  if (!state) return <div className="w-2 h-2 rounded-full bg-white/20" />;
  if (state.locked) return <div className="w-2 h-2 rounded-full bg-gray-600" />;
  if (state.triggered) return <div className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />;
  return <div className="w-2 h-2 rounded-full bg-white/20" />;
}

/* ── 状态说明 ───────────────────────────────────────────────────────── */
function StatusExplainer({ state, event, stats, statDefs }) {
  if (!state) return null;
  const cond = event.eventConfig?.condition;
  if (state.locked) {
    return <p className="text-xs text-gray-400 mt-2">前置依赖未满足，规则锁定中</p>;
  }
  if (state.triggered && state.isRandom) {
    return <p className="text-xs text-yellow-200/60 mt-2">✓ 随机规则激活 — 生成生活时按权重参与抽取</p>;
  }
  if (state.triggered && !state.isRandom) {
    const sl = STAT_CFG[cond?.stat]?.label || cond?.stat;
    const cv = stats[cond?.stat];
    return <p className="text-xs text-yellow-200/60 mt-2">✓ 条件满足 — {sl} 当前 {cv}，{OP_SYM[cond?.op]}{cond?.value} 已达成</p>;
  }
  if (!state.triggered && !state.isRandom && cond) {
    const sl = STAT_CFG[cond.stat]?.label || cond.stat;
    const cv = stats[cond.stat] ?? '—';
    const def = statDefs.find(d => d.key === cond.stat);
    const gap = (() => {
      if (cond.op === 'gte') return cond.value - cv;
      if (cond.op === 'lte') return cv - cond.value;
      if (cond.op === 'gt')  return cond.value + 1 - cv;
      if (cond.op === 'lt')  return cv - cond.value + 1;
      return null;
    })();
    return (
      <p className="text-xs text-white/30 mt-2">
        未达成 — {sl} 当前 {cv}，需 {OP_SYM[cond.op]}{cond.value}
        {gap != null && gap > 0 ? `，还差 ${gap}` : ''}
      </p>
    );
  }
  return null;
}

/* ── 触发逻辑编辑器（底部抽屉，只管触发条件和关系，不管内容） ─── */
function RuleTriggerEditor({ draft, setDraft, statDefs, events, isNew, onSave, onClose }) {
  const upd = (k, v) => setDraft(p => ({ ...p, [k]: v }));
  const existingGroups = [...new Set(events.map(e => e.eventConfig?.exclusionGroup).filter(Boolean))];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 z-40" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-3xl z-50 shadow-2xl"
        style={{ maxHeight: '80%', overflowY: 'auto' }}>
        <div className="p-5 space-y-4">
          <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto" />
          <div>
            <p className="text-center font-bold text-white">{isNew ? '新建规则' : '编辑触发逻辑'}</p>
            <p className="text-center text-[10px] text-gray-500 mt-0.5">只编辑触发条件和关系约束。事件描述内容在世界书里修改。</p>
          </div>

          {/* 名称（只有新建时才需要，编辑时是只读显示） */}
          {isNew ? (
            <div>
              <label className="text-[10px] text-gray-400 block mb-1">规则名称（引用世界书事件）</label>
              <input value={draft.name || ''} onChange={e => upd('name', e.target.value)}
                placeholder="对应世界书中的事件名称"
                className="w-full bg-gray-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none border border-gray-700" />
            </div>
          ) : (
            <div className="bg-gray-800/50 rounded-xl px-3 py-2 border border-gray-700/40">
              <p className="text-[10px] text-gray-500">编辑规则</p>
              <p className="text-sm text-white font-medium">{draft.name}</p>
            </div>
          )}

          {/* 激活模式 */}
          <div>
            <label className="text-[10px] text-gray-400 block mb-1.5">触发方式</label>
            <div className="flex gap-2">
              {[
                { v: 'event-conditional', l: '条件触发', sub: '数值达到阈值时激活' },
                { v: 'event-random',      l: '随机触发', sub: '按权重参与抽取' },
              ].map(m => (
                <button key={m.v} onClick={() => upd('activationMode', m.v)}
                  className={`flex-1 px-3 py-2 rounded-xl text-left border transition-colors ${
                    draft.activationMode === m.v
                      ? 'bg-indigo-500/20 border-indigo-400/50 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                  <p className="text-xs font-medium">{m.l}</p>
                  <p className="text-[10px] opacity-50 mt-0.5">{m.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 条件配置 */}
          {draft.activationMode === 'event-conditional' && (
            <div className="bg-gray-800/60 rounded-xl p-3 border border-gray-700/40 space-y-2">
              <p className="text-[10px] text-gray-400 font-medium">触发条件</p>
              <div className="flex gap-2">
                <select value={draft.condStat || 'mood'} onChange={e => upd('condStat', e.target.value)}
                  className="flex-1 bg-gray-800 rounded-lg px-2 py-2 text-xs text-white border border-gray-700">
                  {statDefs.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}
                </select>
                <select value={draft.condOp || 'gte'} onChange={e => upd('condOp', e.target.value)}
                  className="w-24 bg-gray-800 rounded-lg px-2 py-2 text-xs text-white border border-gray-700">
                  {OP_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <input type="number" value={draft.condValue ?? 50} onChange={e => upd('condValue', e.target.value)}
                  className="w-14 bg-gray-800 rounded-lg px-2 py-2 text-xs text-white border border-gray-700 text-center" />
              </div>
              <p className="text-[10px] text-gray-500">
                当 {statDefs.find(d => d.key === draft.condStat)?.name || draft.condStat} {OP_SYM[draft.condOp || 'gte']}{draft.condValue} 时，此规则进入激活状态
              </p>
            </div>
          )}

          {/* 权重 */}
          <div className="flex items-center gap-3">
            <label className="text-[10px] text-gray-400 w-14 shrink-0">
              {draft.activationMode === 'event-random' ? '随机权重' : '优先权重'}
            </label>
            <input type="range" min={1} max={5} value={draft.weight || 1}
              onChange={e => upd('weight', Number(e.target.value))}
              className="flex-1 accent-indigo-500" />
            <span className="text-xs text-white/60 w-5 text-center">×{draft.weight || 1}</span>
          </div>

          {/* 互斥组 */}
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">互斥组（可选）</label>
            <div className="flex gap-2">
              <input value={draft.exclusionGroup || ''} onChange={e => upd('exclusionGroup', e.target.value)}
                placeholder="为空则不互斥"
                className="flex-1 bg-gray-800 rounded-xl px-3 py-2 text-xs text-white border border-gray-700" />
            </div>
            {existingGroups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {existingGroups.map(g => (
                  <button key={g} onClick={() => upd('exclusionGroup', draft.exclusionGroup === g ? '' : g)}
                    className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                      draft.exclusionGroup === g
                        ? 'bg-red-500/30 text-red-200 border border-red-500/40'
                        : 'bg-gray-700 text-gray-400 border border-gray-600'}`}>
                    {g}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-gray-500 mt-1">同组规则同时段只会触发其中一个</p>
          </div>

          {/* 前置依赖 */}
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">前置依赖（可选）</label>
            <select value="" onChange={e => {
              if (e.target.value && !(draft.requires || []).includes(e.target.value))
                upd('requires', [...(draft.requires || []), e.target.value]);
            }} className="w-full bg-gray-800 rounded-xl px-3 py-2 text-xs text-white border border-gray-700">
              <option value="">添加前置事件…</option>
              {events.filter(e => e.id !== editingId && !(draft.requires || []).includes(e.id)).map(e =>
                <option key={e.id} value={e.id}>{e.name}</option>
              )}
            </select>
            {(draft.requires || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {draft.requires.map(rid => {
                  const ev = events.find(e => e.id === rid);
                  return (
                    <span key={rid} className="flex items-center gap-1 bg-blue-500/20 text-blue-200 text-[10px] px-2 py-0.5 rounded-full">
                      {ev?.name || rid}
                      <button onClick={() => upd('requires', draft.requires.filter(r => r !== rid))}><X size={8} /></button>
                    </span>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] text-gray-500 mt-1">这些规则必须先被触发过，本规则才解锁</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-gray-400 text-sm">取消</button>
            <button onClick={onSave} disabled={isNew && !draft.name?.trim()}
              className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium disabled:opacity-30">
              {isNew ? '创建规则' : '保存'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
