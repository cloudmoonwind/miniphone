/**
 * 道枢 — 角色数值可视化仪表盘
 *
 * 设计目标：非表单页，直观感受角色当前「状态」
 * - 渐变背景随心情变化（暖/冷/沉）
 * - 中央大圆环显示心情
 * - 各数值可视化进度条，支持快捷 ±5 调节
 * - 底部事件池预览：当前数值下哪些条件事件会触发
 */
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronDown, Zap, Heart, Shield, Wind, Flame, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar.jsx';

const api = (path, opts = {}) => fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

// ── 数值配置 ───────────────────────────────────────────────────────────────
const STAT_CONFIG = {
  mood:         { icon: Heart,  color: '#f472b6', bgColor: 'bg-pink-500',    label: '心情' },
  energy:       { icon: Zap,    color: '#4ade80', bgColor: 'bg-green-400',   label: '精力' },
  stress:       { icon: Flame,  color: '#f87171', bgColor: 'bg-red-400',     label: '压力' },
  relationship: { icon: Heart,  color: '#a78bfa', bgColor: 'bg-violet-400',  label: '好感度' },
  trust:        { icon: Shield, color: '#60a5fa', bgColor: 'bg-blue-400',    label: '信任度' },
};

// 根据心情值返回渐变背景
function moodGradient(mood = 50) {
  if (mood >= 75) return 'from-amber-400 via-pink-400 to-rose-400';
  if (mood >= 50) return 'from-sky-400 via-blue-400 to-indigo-400';
  if (mood >= 30) return 'from-slate-400 via-gray-500 to-slate-600';
  return 'from-gray-600 via-slate-700 to-gray-800';
}

// ── 中央圆环（SVG） ─────────────────────────────────────────────────────────
const MoodRing = ({ value = 50, max = 100, color = '#f472b6', label }) => {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const dash = pct * circ;
  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="text-4xl font-bold text-white drop-shadow-lg leading-none">{value}</span>
        <span className="text-xs text-white/70 mt-1">{label}</span>
      </div>
    </div>
  );
};

// ── 数值条 + 快捷调节 ────────────────────────────────────────────────────────
const StatRow = ({ def, value, onDelta, updating }) => {
  const cfg = STAT_CONFIG[def.key] || {};
  const pct = Math.max(0, Math.min(100, ((value - (def.min ?? 0)) / ((def.max ?? 100) - (def.min ?? 0))) * 100));
  const Icon = cfg.icon || Wind;

  return (
    <div className="flex items-center gap-2">
      <Icon size={13} style={{ color: cfg.color || '#94a3b8' }} className="shrink-0" />
      <span className="text-xs text-white/70 w-12 shrink-0">{def.name}</span>
      <div className="flex-1 h-2 bg-white/15 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: cfg.color || '#94a3b8' }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      </div>
      <span className="text-xs font-mono text-white/80 w-8 text-right shrink-0">{value}</span>
      <div className="flex gap-0.5 shrink-0">
        <button
          onClick={() => onDelta(def.key, -5)}
          disabled={updating}
          className="w-6 h-6 rounded-md bg-white/10 text-white/70 text-xs hover:bg-white/20 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center font-bold"
        >−</button>
        <button
          onClick={() => onDelta(def.key, +5)}
          disabled={updating}
          className="w-6 h-6 rounded-md bg-white/10 text-white/70 text-xs hover:bg-white/20 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center font-bold"
        >+</button>
      </div>
    </div>
  );
};

// ── 条件事件预览卡 ────────────────────────────────────────────────────────────
const EventPreview = ({ events, stats }) => {
  const triggered = events.filter(e => {
    if (e.activationMode === 'event-random') return true;
    if (e.activationMode === 'event-conditional' && e.eventConfig?.condition) {
      const { stat, op, value } = e.eventConfig.condition;
      const v = stats[stat];
      if (v == null) return false;
      switch (op) {
        case 'gte': return v >= value;
        case 'lte': return v <= value;
        case 'gt':  return v > value;
        case 'lt':  return v < value;
        case 'eq':  return v === value;
        default:    return false;
      }
    }
    return false;
  });

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/10">
        <span className="text-xs font-semibold text-white/80">当前事件池</span>
        <span className="ml-2 text-xs text-white/40">{triggered.length} 个触发中</span>
      </div>
      {triggered.length === 0 ? (
        <p className="text-xs text-white/40 text-center py-4">暂无触发事件</p>
      ) : (
        <div className="px-4 py-2 space-y-1.5 max-h-40 overflow-y-auto">
          {triggered.map(e => (
            <div key={e.id} className="flex items-start gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${
                e.activationMode === 'event-conditional'
                  ? 'bg-amber-500/30 text-amber-200'
                  : 'bg-white/15 text-white/60'
              }`}>
                {e.activationMode === 'event-conditional' ? '条件' : '随机'}
              </span>
              <p className="text-xs text-white/75 leading-relaxed line-clamp-2">{e.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function DaoshuApp({ onBack }) {
  const [chars, setChars]       = useState([]);
  const [char, setChar]         = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [stats, setStats]       = useState<Record<string, any>>({});
  const [statDefs, setStatDefs] = useState([]);
  const [events, setEvents]     = useState([]);
  const [updating, setUpdating] = useState(false);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    api('/characters').then(d => {
      const list = Array.isArray(d) ? d : [];
      setChars(list);
      if (list.length > 0) setChar(list[0]);
    });
  }, []);

  const loadCharData = useCallback(async (c) => {
    if (!c) return;
    setLoading(true);
    try {
      const [statsData, defsData, booksData, entriesData] = await Promise.all([
        api(`/charstats/${c.id}`),
        api(`/charstats/defs?charId=${c.id}`),
        api(`/worldbook/books?charId=${c.id}`),
        api(`/worldbook/entries`),
      ]);
      setStats(statsData?.stats || {});
      setStatDefs(Array.isArray(defsData) ? defsData : []);

      // 过滤出该角色有效书中的事件条目
      const enabledBookIds = new Set(
        (Array.isArray(booksData) ? booksData : [])
          .filter(b => b.enabled && (b.charId == null || b.charId === c.id))
          .map(b => b.id)
      );
      const eventEntries = (Array.isArray(entriesData) ? entriesData : []).filter(e =>
        e.enabled &&
        enabledBookIds.has(e.bookId) &&
        (e.activationMode === 'event-random' || e.activationMode === 'event-conditional')
      );
      setEvents(eventEntries);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCharData(char); }, [char, loadCharData]);

  const handleDelta = async (key, delta) => {
    if (!char || updating) return;
    setUpdating(true);
    try {
      const result = await api(`/charstats/${char.id}/delta`, {
        method: 'POST',
        body: JSON.stringify({ key, delta }),
      });
      if (result.stats) setStats(result.stats);
      else if (result.changed) {
        setStats(prev => ({ ...prev, [key]: result.changed.next }));
      }
    } finally { setUpdating(false); }
  };

  const mood = stats.mood ?? 50;
  const gradient = moodGradient(mood);
  const moodDef = statDefs.find(d => d.key === 'mood') || { key: 'mood', name: '心情', min: 0, max: 100, default: 70 };
  const otherDefs = statDefs.filter(d => d.key !== 'mood');

  return (
    <div className={`flex flex-col h-full bg-gradient-to-br ${gradient} transition-all duration-1000 relative`}>
      {/* 顶栏 */}
      <div className="flex items-center px-4 pt-3 pb-2 shrink-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-white" />
        </button>
        <span className="text-white font-bold text-base flex-1 ml-1">道枢</span>
        {/* 角色选择器 */}
        <button
          onClick={() => setShowPicker(p => !p)}
          className="flex items-center gap-1.5 bg-white/15 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
        >
          <span className="text-white text-sm font-medium">{char?.name || '选择角色'}</span>
          <ChevronDown size={14} className="text-white/70" />
        </button>
      </div>

      {/* 角色选择下拉 */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-14 right-4 z-30 bg-white/20 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
          >
            {chars.map(c => (
              <button
                key={c.id}
                onClick={() => { setChar(c); setShowPicker(false); }}
                className={`w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/20 transition-colors text-left ${char?.id === c.id ? 'bg-white/15' : ''}`}
              >
                <Avatar value={c.avatar} name={c.name} size={28} rounded className="shrink-0" />
                <span className="text-white text-sm font-medium">{c.name}</span>
              </button>
            ))}
            {chars.length === 0 && (
              <p className="text-white/60 text-xs px-4 py-3">暂无角色</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw size={24} className="text-white/60 animate-spin" />
        </div>
      ) : !char ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/60 text-sm">请选择角色</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 z-10">
          {/* 中央心情环 */}
          <div className="flex flex-col items-center py-2">
            <MoodRing
              value={mood}
              max={moodDef.max ?? 100}
              color={STAT_CONFIG.mood?.color || '#f472b6'}
              label={moodDef.name || '心情'}
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => handleDelta('mood', -5)}
                disabled={updating}
                className="px-4 py-1.5 bg-white/15 hover:bg-white/25 rounded-full text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-30"
              >−5</button>
              <span className="text-white/50 text-xs">{moodDef.name}</span>
              <button
                onClick={() => handleDelta('mood', +5)}
                disabled={updating}
                className="px-4 py-1.5 bg-white/15 hover:bg-white/25 rounded-full text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-30"
              >+5</button>
            </div>
          </div>

          {/* 其他数值 */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 px-4 py-3 space-y-3">
            {otherDefs.map(def => (
              <StatRow
                key={def.key}
                def={def}
                value={stats[def.key] ?? def.default ?? 50}
                onDelta={handleDelta}
                updating={updating}
              />
            ))}
            {otherDefs.length === 0 && (
              <p className="text-white/40 text-xs text-center py-2">暂无其他属性</p>
            )}
          </div>

          {/* 事件池预览 */}
          <EventPreview events={events} stats={stats} />
        </div>
      )}
    </div>
  );
}
