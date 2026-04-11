/**
 * 角色系统 — 角色的活世界，不是管理后台
 *
 * 单页滚动设计，所有区域一目了然：
 *   状态肖像 → 数值速览 → 时间线 → 关系星座 → 技能 → 生活日志 → 手机入口
 *
 * 数据来源三层：
 *   1. AI 自动提取（主）— 聊天后异步写入，带 ai-extract 标记
 *   2. 用户编辑/修正（辅）— 所有数据可编辑、可删除
 *   3. 系统事件（补）— 生活系统、世界书事件触发
 *
 * 手机功能不在这里 — 点击手机入口进入独立的 CharPhoneApp 全屏体验。
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import Avatar from '../components/Avatar.jsx';
import {
  ChevronLeft, ChevronDown, Edit3, X, Settings,
  Sparkles, Clock, Users, Smartphone, Zap,
  MapPin, Shirt, MessageCircle, Activity,
  Heart, Briefcase, Coffee, RefreshCw, Star,
  Package, ChevronRight, Trash2, ExternalLink,
  Play, BookOpen, Sun, Moon, Sunset, CloudMoon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api.js';

/* ── 常量 ───────────────────────────────────────────────────────────── */
const PALETTE = [
  '#FF6B6B','#FF8E53','#FFA940','#FFD700','#B8E04A','#6BCB77',
  '#4ECDC4','#45B7D1','#4A90D9','#5C6BC0','#7C4DFF','#AB47BC',
  '#E91E8C','#F06292','#FF8FAB','#FFAB91','#FFCC80','#FFF176',
  '#E6EE9C','#A5D6A7','#80DEEA','#81D4FA','#90CAF9','#9FA8DA',
  '#CE93D8','#F48FB1','#BCAAA4','#B0BEC5','#CFD8DC','#ECEFF1',
  '#8D6E63','#78909C','#546E7A','#37474F','#263238','#1A237E',
];
const gradient = (colors) => {
  if (!colors?.length) return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  if (colors.length === 1) return `linear-gradient(160deg, ${colors[0]}ee, ${colors[0]}55)`;
  const stops = colors.map((c, i) => `${c}${i === 0 ? 'dd' : '88'} ${Math.round(i / (colors.length - 1) * 100)}%`);
  return `linear-gradient(160deg, ${stops.join(', ')})`;
};

const REL_LABELS = { friend: '挚友', romantic: '恋人', family: '家人', rival: '宿敌', colleague: '同僚', other: '其他' };
const REL_COLORS = { friend: '#60a5fa', romantic: '#f472b6', family: '#fbbf24', rival: '#ef4444', colleague: '#a78bfa', other: '#94a3b8' };
const SKILL_CATS = [
  { key: 'work',    label: '工作', icon: Briefcase, accent: '#3b82f6' },
  { key: 'life',    label: '生活', icon: Coffee,    accent: '#22c55e' },
  { key: 'emotion', label: '情感', icon: Heart,     accent: '#ec4899' },
];
const TL_TYPES = {
  event:     { label: '事件',  color: '#818cf8', icon: Zap },
  chat:      { label: '对话',  color: '#f472b6', icon: MessageCircle },
  item:      { label: '物品',  color: '#fbbf24', icon: Package },
  milestone: { label: '里程碑', color: '#34d399', icon: Star },
  custom:    { label: '记录',  color: '#94a3b8', icon: Edit3 },
};

const PERIOD_OPTIONS = [
  { value: 'auto', label: '自动推断' },
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '傍晚' },
  { value: 'latenight', label: '深夜' },
];

const PERIOD_ICONS = {
  morning: Sun,
  afternoon: Sun,
  evening: Sunset,
  latenight: Moon,
};

/* ── AI 标记徽章 ──────────────────────────────────────────────────── */
const AIBadge = ({ source }) => {
  if (!source) return null;
  const label = source === 'ai-extract' ? 'AI' : source === 'seed' ? '演示' : null;
  if (!label) return null;
  return (
    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-500 font-medium ml-1">
      {label}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════════════
 * 主组件
 * ═══════════════════════════════════════════════════════════════════ */
export default function CharSystemApp({ onBack, onOpenApp, initialChar }) {
  const [chars, setChars] = useState([]);
  const [char, setChar]   = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 各区域数据
  const [status, setStatus]     = useState<{ moodColors: any[]; location: string; outfit: string; statusDesc: string; innerThoughts: string; lastUpdated?: string | null }>({ moodColors: [], location: '', outfit: '', statusDesc: '', innerThoughts: '' });
  const [stats, setStats]       = useState(null);
  const [recentItems, setRecentItems] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [rels, setRels]         = useState([]);
  const [skills, setSkills]     = useState([]);
  const [loading, setLoading]   = useState(true);

  // 时间线展开
  const [tlShowAll, setTlShowAll] = useState(false);
  const [tlExpandedId, setTlExpandedId] = useState(null);

  // 技能展开
  const [expandedSkillId, setExpandedSkillId] = useState(null);

  // 生活日志
  const [lifeLogs, setLifeLogs] = useState([]);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [lifeGenerating, setLifeGenerating] = useState(false);

  // 编辑状态
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(status);
  const [saving, setSaving]     = useState(false);
  const [selectedRel, setSelectedRel] = useState(null);

  // 设置面板
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [csSettings, setCsSettings]    = useState({
    extractionEnabled: false,
    summaryToTimelineEnabled: true,
    statEventsEnabled: true,
    lifeToTimelineEnabled: true,
    charSystemPresetId: null,
  });
  const [presets, setPresets] = useState([]);

  // 生活生成设置
  const [lifeGenPeriod, setLifeGenPeriod] = useState('auto');
  const [lifeGenEventCount, setLifeGenEventCount] = useState(2);
  const [lifeGenResult, setLifeGenResult] = useState(null);
  const [lifeGenLoading, setLifeGenLoading] = useState(false);

  // 加载角色列表
  useEffect(() => {
    api.get('/api/characters').then(data => {
      const list = Array.isArray(data) ? data : [];
      setChars(list);
      setChar(initialChar ? (list.find(c => c.id === initialChar.id) || list[0]) : list[0] || null);
    }).catch(() => {});
  }, [initialChar]);

  // 同组角色
  const groupChars = useMemo(() => {
    if (!char?.group) return [];
    return chars.filter(c => c.id !== char.id && c.group === char.group);
  }, [char, chars]);

  // 加载所有数据
  const loadAll = useCallback(async () => {
    if (!char) return;
    setLoading(true);
    try {
      const [statsData, itemsData, tlData, relsData, skillsData, settingsData, presetsData, lifeData] = await Promise.all([
        api.get(`/api/charstats/${char.id}`).catch(() => null),
        api.get(`/api/characters/${char.id}/items`).catch(() => []),
        api.get(`/api/characters/${char.id}/timeline`).catch(() => []),
        api.get(`/api/characters/${char.id}/relations`).catch(() => []),
        api.get(`/api/characters/${char.id}/skills`).catch(() => []),
        api.get('/api/debug/char-system-settings').catch(() => ({})),
        api.get('/api/settings/presets').catch(() => []),
        api.get(`/api/characters/${char.id}/life?limit=3`).catch(() => []),
      ]);
      if (settingsData) setCsSettings(settingsData);
      if (presetsData) setPresets(presetsData);
      // 状态
      const si = statsData?.statusInfo || {};
      const s = {
        moodColors: si.moodColors || [], location: si.location || '',
        outfit: si.outfit || '', statusDesc: si.statusDesc || '',
        innerThoughts: si.innerThoughts || '', lastUpdated: si.lastUpdated || null,
      };
      setStatus(s);
      setDraft(s);
      if (statsData?.stats) setStats(statsData.stats);
      // 物品（最近 5 个 active）
      setRecentItems((itemsData || []).filter(i => i.status !== 'trashed').slice(0, 5));
      // 时间线（全部）
      setTimeline(tlData || []);
      // 关系
      setRels(relsData || []);
      // 技能
      setSkills(skillsData || []);
      // 生活日志
      setLifeLogs(lifeData || []);
    } catch {}
    setLoading(false);
  }, [char]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // 重置展开状态 when char changes
  useEffect(() => {
    setTlShowAll(false);
    setTlExpandedId(null);
    setExpandedSkillId(null);
    setExpandedLogId(null);
    setLifeGenResult(null);
  }, [char]);

  // 状态编辑
  const toggleColor = (c) => setDraft(prev => {
    const arr = prev.moodColors || [];
    return arr.includes(c)
      ? { ...prev, moodColors: arr.filter(x => x !== c) }
      : arr.length >= 3 ? { ...prev, moodColors: [...arr.slice(1), c] } : { ...prev, moodColors: [...arr, c] };
  });
  const saveStatus = async () => {
    setSaving(true);
    try {
      await api.put(`/api/charstats/${char.id}`, { statusInfo: draft });
      setStatus({ ...draft, lastUpdated: new Date().toISOString() });
      setEditing(false);
    } finally { setSaving(false); }
  };

  // 种子数据
  const seedData = async () => {
    await api.post(`/api/debug/seed/${char.id}`, {});
    loadAll();
  };

  // 保存设置
  const saveCsSettings = async (patch) => {
    const next = { ...csSettings, ...patch };
    setCsSettings(next);
    api.put('/api/debug/char-system-settings', next).catch(() => {});
  };

  // 生活生成
  const triggerLifeGeneration = async (period, eventCount) => {
    if (!char) return;
    setLifeGenLoading(true);
    setLifeGenResult(null);
    try {
      const result = await api.post(`/api/characters/${char.id}/life/generate`, {
        period: period === 'auto' ? undefined : period,
        eventCount,
        save: true,
      });
      setLifeGenResult(result);
      // refresh life logs
      const freshLogs = await api.get(`/api/characters/${char.id}/life?limit=3`).catch(() => []);
      setLifeLogs(freshLogs || []);
    } catch (err) {
      setLifeGenResult({ error: err.message || '生成失败' });
    } finally {
      setLifeGenLoading(false);
    }
  };

  // 快捷生活生成（从section header）
  const quickLifeGenerate = async () => {
    if (!char || lifeGenerating) return;
    setLifeGenerating(true);
    try {
      await api.post(`/api/characters/${char.id}/life/generate`, {
        eventCount: 2,
        save: true,
      });
      const freshLogs = await api.get(`/api/characters/${char.id}/life?limit=3`).catch(() => []);
      setLifeLogs(freshLogs || []);
    } catch {}
    setLifeGenerating(false);
  };

  if (!char) return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        <button onClick={onBack} className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-full"><ChevronLeft size={20} className="text-gray-600" /></button>
        <span className="font-bold text-gray-800 text-base ml-1">角色系统</span>
      </div>
      <div className="flex-1 flex items-center justify-center"><p className="text-gray-300 text-sm">选择一个角色开始</p></div>
    </div>
  );

  const isEmpty = !status.moodColors?.length && !timeline.length && !recentItems.length && !rels.length && !skills.length;

  /* ── timeline display ── */
  const tlVisible = tlShowAll ? timeline : timeline.slice(0, 6);

  /* ── 星座布局 ── */
  const CX = 150, CY = 120, R_BASE = 90;

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* ── 顶栏 ── */}
      <div className="flex items-center px-4 pt-3 pb-2 bg-white/80 backdrop-blur-xl border-b border-gray-100 shrink-0 z-30">
        <button onClick={onBack} className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <span className="font-bold text-gray-800 text-base ml-1 flex-1">角色系统</span>
        <button onClick={() => setSettingsOpen(true)}
          className="p-1.5 hover:bg-gray-100 rounded-full transition-colors mr-1">
          <Settings size={16} className="text-gray-500" />
        </button>
        <div className="relative">
          <button onClick={() => setPickerOpen(p => !p)}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors">
            <Avatar value={char?.avatar} name={char?.name} size={20} rounded />
            <span className="text-sm font-medium text-gray-700">{char?.name || '选择'}</span>
            <ChevronDown size={12} className="text-gray-400" />
          </button>
          <AnimatePresence>
            {pickerOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-10 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 min-w-[130px]">
                {chars.map(c => (
                  <button key={c.id} onClick={() => { setChar(c); setPickerOpen(false); setSelectedRel(null); }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50 ${char?.id === c.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}>
                    <Avatar value={c.avatar} name={c.name} size={22} rounded />
                    <span>{c.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── 主内容滚动区 ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-20"><RefreshCw size={18} className="animate-spin text-gray-300" /></div>
        ) : (
          <>
            {/* ═══════ 状态肖像 ═══════ */}
            <div className="relative" style={{ minHeight: '42vh', background: gradient(status.moodColors) }}>
              {/* 光斑 */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {status.moodColors?.length > 0 && [...Array(5)].map((_, i) => (
                  <div key={i} className="absolute rounded-full opacity-20 animate-pulse"
                    style={{
                      background: status.moodColors[i % status.moodColors.length],
                      width: 50 + i * 25, height: 50 + i * 25,
                      top: `${15 + i * 14}%`, left: `${10 + (i * 37) % 70}%`,
                      animationDelay: `${i * 0.8}s`, animationDuration: `${3 + i}s`,
                      filter: 'blur(20px)',
                    }} />
                ))}
              </div>

              <div className="relative flex flex-col items-center px-6 pt-8 pb-6">
                <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-lg border-2 border-white/30 overflow-hidden flex items-center justify-center shadow-xl">
                  <Avatar value={char?.avatar} name={char?.name} size={80} rounded />
                </div>
                <h2 className="text-white font-bold text-xl mt-3 drop-shadow-lg">{char?.name}</h2>

                {status.moodColors?.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {status.moodColors.map(c => (
                      <div key={c} className="w-3.5 h-3.5 rounded-full shadow-lg border border-white/40" style={{ background: c }} />
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {status.location && (
                    <div className="flex items-center gap-1 bg-white/12 backdrop-blur px-3 py-1 rounded-full border border-white/10">
                      <MapPin size={10} className="text-white/70" /><span className="text-white/90 text-xs">{status.location}</span>
                    </div>
                  )}
                  {status.outfit && (
                    <div className="flex items-center gap-1 bg-white/12 backdrop-blur px-3 py-1 rounded-full border border-white/10">
                      <Shirt size={10} className="text-white/70" /><span className="text-white/90 text-xs">{status.outfit}</span>
                    </div>
                  )}
                </div>

                {status.statusDesc && (
                  <p className="text-white/90 text-center text-sm leading-relaxed mt-5 max-w-[260px]">{status.statusDesc}</p>
                )}
                {status.innerThoughts && (
                  <div className="mt-4 bg-white/8 backdrop-blur-sm rounded-xl px-4 py-3 max-w-[280px] border border-white/8">
                    <MessageCircle size={10} className="text-white/30 mb-1" />
                    <p className="text-white/60 text-xs leading-relaxed italic">「{status.innerThoughts}」</p>
                  </div>
                )}

                {/* 空状态 + 种子按钮 */}
                {isEmpty && (
                  <div className="mt-8 text-center">
                    <Sparkles size={24} className="text-white/20 mx-auto mb-2" />
                    <p className="text-white/35 text-sm">TA 的故事还没有开始</p>
                    <button onClick={seedData}
                      className="mt-3 px-4 py-1.5 bg-white/15 backdrop-blur rounded-full text-white/70 text-xs hover:bg-white/25 transition-colors border border-white/10">
                      生成演示数据
                    </button>
                  </div>
                )}
              </div>

              {/* 编辑按钮 */}
              <button onClick={() => { setDraft(status); setEditing(true); }}
                className="absolute bottom-4 right-4 w-9 h-9 bg-white/15 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 active:scale-90 transition-transform">
                <Edit3 size={14} className="text-white/80" />
              </button>
            </div>

            {/* ═══════ 数值速览 ═══════ */}
            {stats && (
              <div className="mx-4 -mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 relative z-10">
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity size={11} className="text-gray-400" />
                  <span className="text-gray-400 text-[10px]">数值概览</span>
                  <span className="text-gray-300 text-[10px] ml-auto">来自道枢</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { k: 'mood', l: '心情', c: '#fbbf24' },
                    { k: 'trust', l: '信任', c: '#60a5fa' },
                    { k: 'relationship', l: '好感', c: '#f472b6' },
                  ].map(s => {
                    const v = stats[s.k] ?? 50;
                    return (
                      <div key={s.k} className="text-center">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mx-1">
                          <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: s.c }} />
                        </div>
                        <span className="text-gray-500 text-[9px] mt-0.5 block">{s.l} {v}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══════ 随身物品 ═══════ */}
            {recentItems.length > 0 && (
              <button onClick={() => onOpenApp?.('物品库')}
                className="mx-4 mt-3 w-[calc(100%-2rem)] bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 text-left">
                <div className="flex items-center gap-1.5 mb-2">
                  <Package size={11} className="text-gray-400" />
                  <span className="text-gray-400 text-[10px]">物品</span>
                  <span className="text-gray-300 text-[10px] ml-auto flex items-center gap-0.5">
                    查看全部 <ChevronRight size={10} />
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {recentItems.map(item => (
                    <div key={item.id} className="flex items-center gap-1 bg-gray-50 rounded-full px-2.5 py-1">
                      <Package size={14} className="text-gray-400 shrink-0" />
                      <span className="text-gray-600 text-xs">{item.name}</span>
                      <AIBadge source={item.extractedSource} />
                    </div>
                  ))}
                </div>
              </button>
            )}

            {/* ═══════ 时间线 ═══════ */}
            {timeline.length > 0 && (
              <div className="mx-4 mt-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Clock size={12} className="text-gray-400" />
                  <span className="text-gray-700 text-sm font-medium">时间线</span>
                  <span className="text-gray-300 text-[10px] ml-auto">{timeline.length} 条</span>
                </div>
                <div className="relative pl-6">
                  <div className="absolute left-[7px] top-1 bottom-1 w-[2px] bg-gradient-to-b from-indigo-200 via-pink-200 to-emerald-200 rounded-full" />
                  {tlVisible.map(e => {
                    const tp = TL_TYPES[e.type] || TL_TYPES.custom;
                    const isExpanded = tlExpandedId === e.id;
                    return (
                      <div key={e.id} className="relative mb-4 last:mb-0">
                        <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 border-white shadow flex items-center justify-center"
                          style={{ background: tp.color }}>
                          {(() => { const Ic = tp.icon; return <Ic size={8} color="white" />; })()}
                        </div>
                        <div
                          className="bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-50 cursor-pointer active:bg-gray-50 transition-colors"
                          onClick={() => setTlExpandedId(isExpanded ? null : e.id)}>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-400">{e.timestamp?.slice(0, 10)}</span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full text-white/90"
                              style={{ background: tp.color + 'cc' }}>{tp.label}</span>
                            <AIBadge source={e.extractedSource} />
                            {e.content && (
                              <ChevronDown size={10} className={`text-gray-300 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-800 mt-1">{e.title}</p>
                          {e.content && !isExpanded && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{e.content}</p>}
                          {e.content && isExpanded && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{e.content}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* 查看全部 / 收起 */}
                {timeline.length > 6 && (
                  <button
                    onClick={() => setTlShowAll(prev => !prev)}
                    className="w-full mt-2 py-2 text-center text-xs text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                    {tlShowAll ? '收起' : `查看全部 (${timeline.length})`}
                  </button>
                )}
              </div>
            )}

            {/* ═══════ 关系星座 ═══════ */}
            {rels.length > 0 && (
              <div className="mx-4 mt-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Users size={12} className="text-gray-400" />
                  <span className="text-gray-700 text-sm font-medium">关系网</span>
                  <span className="text-gray-300 text-[10px] ml-auto">{rels.length} 人</span>
                </div>
                <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, #0f172a, #1e1b4b, #0f172a)' }}>
                  <svg viewBox="0 0 300 240" className="w-full">
                    {/* 连线 */}
                    {rels.map((rel, i) => {
                      const angle = (2 * Math.PI * i) / Math.max(rels.length, 1) - Math.PI / 2;
                      const dist = R_BASE - (rel.closeness / 100) * 40;
                      const x = CX + dist * Math.cos(angle);
                      const y = CY + dist * Math.sin(angle);
                      const color = REL_COLORS[rel.type] || REL_COLORS.other;
                      return <line key={`l-${rel.id}`} x1={CX} y1={CY} x2={x} y2={y}
                        stroke={color} strokeWidth={1.2} strokeOpacity={0.3 + (rel.closeness / 100) * 0.4}
                        strokeDasharray={rel.closeness < 30 ? '3,3' : 'none'} />;
                    })}
                    {/* 中心 */}
                    <defs>
                      <clipPath id="svgAvatarCenter"><circle cx={CX} cy={CY} r={18} /></clipPath>
                    </defs>
                    <circle cx={CX} cy={CY} r={22} fill="white" fillOpacity={0.1} stroke="white" strokeOpacity={0.3} strokeWidth={1} />
                    {char?.avatar && (char.avatar.startsWith('data:') || char.avatar.startsWith('http')) ? (
                      <image href={char.avatar} x={CX - 18} y={CY - 18} width={36} height={36} clipPath="url(#svgAvatarCenter)" preserveAspectRatio="xMidYMid slice" />
                    ) : (
                      <text x={CX} y={CY + 1} textAnchor="middle" dominantBaseline="central" fontSize={14} fill="white" fillOpacity={0.9}>{char?.name?.[0] || '?'}</text>
                    )}
                    <text x={CX} y={CY + 32} textAnchor="middle" fill="white" fillOpacity={0.5} fontSize={9}>{char?.name}</text>
                    {/* 节点 */}
                    {rels.map((rel, i) => {
                      const angle = (2 * Math.PI * i) / Math.max(rels.length, 1) - Math.PI / 2;
                      const dist = R_BASE - (rel.closeness / 100) * 40;
                      const x = CX + dist * Math.cos(angle);
                      const y = CY + dist * Math.sin(angle);
                      const color = REL_COLORS[rel.type] || REL_COLORS.other;
                      const active = selectedRel?.id === rel.id;
                      return (
                        <g key={rel.id} onClick={() => setSelectedRel(active ? null : rel)} className="cursor-pointer">
                          <circle cx={x} cy={y} r={active ? 18 : 13} fill={color} fillOpacity={active ? 0.15 : 0.08} />
                          <circle cx={x} cy={y} r={active ? 14 : 11} fill={color} fillOpacity={0.2}
                            stroke={color} strokeWidth={active ? 1.5 : 0.8} strokeOpacity={0.6} />
                          <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={active ? 13 : 10} fill="white" fontWeight="700">{rel.targetName?.[0]?.toUpperCase() || '?'}</text>
                          <text x={x} y={y + (active ? 22 : 18)} textAnchor="middle" fill="white" fillOpacity={0.6} fontSize={8}>{rel.targetName}</text>
                        </g>
                      );
                    })}
                    {/* 同组未关联 */}
                    {groupChars.filter(gc => !rels.some(r => r.targetName === gc.name)).map((gc, i) => {
                      const total = rels.length + i + 1;
                      const angle = (2 * Math.PI * (rels.length + i)) / Math.max(total + 2, 4) - Math.PI / 2;
                      const x = CX + (R_BASE + 15) * Math.cos(angle);
                      const y = CY + (R_BASE + 15) * Math.sin(angle);
                      return (
                        <g key={gc.id} className="opacity-25">
                          {gc.avatar && (gc.avatar.startsWith('data:') || gc.avatar.startsWith('http')) && (
                            <defs><clipPath id={`svgAvatarGc-${gc.id}`}><circle cx={x} cy={y} r={7} /></clipPath></defs>
                          )}
                          <circle cx={x} cy={y} r={8} fill="white" fillOpacity={0.08} stroke="white" strokeOpacity={0.15} strokeWidth={0.5} />
                          {gc.avatar && (gc.avatar.startsWith('data:') || gc.avatar.startsWith('http')) ? (
                            <image href={gc.avatar} x={x - 7} y={y - 7} width={14} height={14} clipPath={`url(#svgAvatarGc-${gc.id})`} preserveAspectRatio="xMidYMid slice" />
                          ) : (
                            <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={8} fill="white" fillOpacity={0.5}>{gc.name?.[0] || '?'}</text>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* 选中详情 */}
                  <AnimatePresence>
                    {selectedRel && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-xl rounded-xl p-3 border border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 select-none"
                            style={{ background: (REL_COLORS[selectedRel.type] || '#94a3b8') + 'cc' }}>
                            {selectedRel.targetName?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium text-xs">{selectedRel.targetName}
                              <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full text-white/70"
                                style={{ background: REL_COLORS[selectedRel.type] + '88' }}>{REL_LABELS[selectedRel.type]}</span>
                              <AIBadge source={selectedRel.extractedSource} />
                            </p>
                            {selectedRel.notes && <p className="text-white/40 text-[10px] mt-0.5 line-clamp-2">{selectedRel.notes}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-white/40 text-[9px]">亲密度</p>
                            <p className="text-white font-bold text-base">{selectedRel.closeness}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* ═══════ 技能 ═══════ */}
            {skills.length > 0 && (
              <div className="mx-4 mt-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Zap size={12} className="text-gray-400" />
                  <span className="text-gray-700 text-sm font-medium">技能</span>
                </div>
                {SKILL_CATS.map(cat => {
                  const catSkills = skills.filter(s => s.category === cat.key);
                  if (catSkills.length === 0) return null;
                  const Icon = cat.icon;
                  const totalLevels = catSkills.reduce((sum, s) => sum + s.level, 0);
                  return (
                    <div key={cat.key} className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: cat.accent + '18' }}>
                          <Icon size={12} style={{ color: cat.accent }} />
                        </div>
                        <span className="text-xs font-medium text-gray-600">{cat.label}</span>
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden mx-2">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(totalLevels / 15 * 100, 100)}%`, background: cat.accent }} />
                        </div>
                        <span className="text-[10px] text-gray-400">{totalLevels}</span>
                      </div>
                      <div className="space-y-1.5 pl-8">
                        {catSkills.map(sk => {
                          const isExpanded = expandedSkillId === sk.id;
                          const expNeeded = sk.level * 2;
                          const expCurrent = sk.experience ?? 0;
                          const expPercent = expNeeded > 0 ? Math.min((expCurrent / expNeeded) * 100, 100) : 0;
                          return (
                            <div key={sk.id}
                              className="bg-white rounded-xl shadow-sm border border-gray-50 overflow-hidden cursor-pointer active:bg-gray-50 transition-colors"
                              onClick={() => setExpandedSkillId(isExpanded ? null : sk.id)}>
                              <div className="flex items-center gap-2 px-3 py-2">
                                <span className="text-xs text-gray-700 font-medium flex-1">{sk.name}</span>
                                <div className="flex gap-px">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star key={i} size={8} fill={i < sk.level ? cat.accent : 'none'} color={i < sk.level ? cat.accent : '#e5e7eb'} strokeWidth={2} />
                                  ))}
                                </div>
                                <AIBadge source={sk.extractedSource} />
                                <ChevronDown size={10} className={`text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                              {/* Experience bar */}
                              <div className="px-3 pb-1.5">
                                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${expPercent}%`, background: cat.accent + 'aa' }} />
                                </div>
                                <div className="flex justify-between mt-0.5">
                                  <span className="text-[8px] text-gray-400">EXP</span>
                                  <span className="text-[8px] text-gray-400">{expCurrent} / {expNeeded}</span>
                                </div>
                              </div>
                              {/* Expanded description */}
                              <AnimatePresence>
                                {isExpanded && sk.description && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden">
                                    <div className="px-3 pb-2.5 pt-0.5 border-t border-gray-50">
                                      <p className="text-[11px] text-gray-500 leading-relaxed">{sk.description}</p>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ═══════ 生活日志 ═══════ */}
            <div className="mx-4 mt-4">
              <div className="flex items-center gap-1.5 mb-3">
                <BookOpen size={12} className="text-gray-400" />
                <span className="text-gray-700 text-sm font-medium">生活日志</span>
                <span className="text-gray-300 text-[10px] ml-auto">{lifeLogs.length > 0 ? `${lifeLogs.length} 条` : ''}</span>
                <button
                  onClick={quickLifeGenerate}
                  disabled={lifeGenerating}
                  className="ml-1 flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-500 rounded-full text-[10px] font-medium transition-colors disabled:opacity-50">
                  {lifeGenerating ? <RefreshCw size={9} className="animate-spin" /> : <Play size={9} />}
                  <span>生成</span>
                </button>
              </div>
              {lifeLogs.length > 0 ? (
                <div className="space-y-2">
                  {lifeLogs.map(log => {
                    const isExpanded = expandedLogId === log.id;
                    const PeriodIcon = PERIOD_ICONS[log.period] || Sun;
                    return (
                      <div key={log.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-50 overflow-hidden cursor-pointer active:bg-gray-50 transition-colors"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                        <div className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <PeriodIcon size={11} className="text-amber-400" />
                            <span className="text-[9px] text-gray-400">
                              {log.period && PERIOD_OPTIONS.find(p => p.value === log.period)?.label}
                              {log.timeOfDay ? ` ${log.timeOfDay}` : ''}
                            </span>
                            <span className="text-[9px] text-gray-300 ml-auto">{log.createdAt?.slice(0, 10)}</span>
                            <ChevronDown size={10} className={`text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{log.summary || '(无摘要)'}</p>
                        </div>
                        <AnimatePresence>
                          {isExpanded && log.content && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden">
                              <div className="px-3 pb-3 pt-0.5 border-t border-gray-50">
                                <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-50 px-4 py-6 text-center">
                  <BookOpen size={18} className="text-gray-200 mx-auto mb-1.5" />
                  <p className="text-gray-300 text-xs">还没有生活日志</p>
                  <p className="text-gray-300 text-[10px] mt-0.5">点击上方"生成"创建第一条</p>
                </div>
              )}
            </div>

            {/* ═══════ 角色手机入口 ═══════ */}
            <button onClick={() => onOpenApp?.('角色手机')}
              className="mx-4 mt-4 mb-6 w-[calc(100%-2rem)] bg-gray-900 rounded-2xl px-5 py-4 flex items-center gap-4 active:scale-[0.98] transition-transform shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center border border-gray-700">
                <Smartphone size={22} className="text-cyan-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-white font-medium text-sm">{char?.name}的手机</p>
                <p className="text-gray-500 text-xs mt-0.5">查看消息、联系人、朋友圈</p>
              </div>
              <ChevronRight size={16} className="text-gray-600" />
            </button>
          </>
        )}
      </div>

      {/* ═══════ 设置面板 ═══════ */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 z-40" onClick={() => setSettingsOpen(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl"
              style={{ maxHeight: '75%', overflowY: 'auto' }}>
              <div className="p-5 space-y-4">
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
                <p className="text-center font-bold text-gray-800">角色系统设置</p>

                {/* 专用 AI 预设 */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">专用 AI 预设</label>
                  <select value={csSettings.charSystemPresetId || ''}
                    onChange={e => saveCsSettings({ charSystemPresetId: e.target.value || null })}
                    className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none border border-gray-100">
                    <option value="">跟随主预设</option>
                    {presets.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">角色系统引擎使用的 AI 模型（提取、评估、生成）</p>
                </div>

                {/* 管道开关 */}
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-medium">数据管道</p>

                  {[
                    { key: 'extractionEnabled', label: '聊天后自动提取', desc: 'AI 回复后异步提取状态、物品、关系变化' },
                    { key: 'summaryToTimelineEnabled', label: '总结 → 时间线', desc: '生成总结时评估是否值得记入时间线' },
                    { key: 'statEventsEnabled', label: '数值 → 事件', desc: '数值变化触发世界书条件事件和里程碑' },
                    { key: 'lifeToTimelineEnabled', label: '生活 → 时间线', desc: '生活日志中提取事件、物品、技能' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" checked={csSettings[item.key] || false}
                          onChange={e => saveCsSettings({ [item.key]: e.target.checked })}
                          className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 peer-checked:bg-indigo-500 rounded-full transition-colors" />
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{item.label}</p>
                        <p className="text-[10px] text-gray-400">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* ── 生活生成 ── */}
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-medium">生活生成</p>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">生成事件数</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={lifeGenEventCount}
                      onChange={e => setLifeGenEventCount(Math.max(0, Math.min(5, parseInt(e.target.value) || 0)))}
                      className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none border border-gray-100" />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">时段</label>
                    <select
                      value={lifeGenPeriod}
                      onChange={e => setLifeGenPeriod(e.target.value)}
                      className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none border border-gray-100">
                      {PERIOD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => triggerLifeGeneration(lifeGenPeriod, lifeGenEventCount)}
                    disabled={lifeGenLoading || !char}
                    className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 rounded-xl text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    {lifeGenLoading ? (
                      <><RefreshCw size={14} className="animate-spin" /> 生成中...</>
                    ) : (
                      <><Play size={14} /> 立即生成</>
                    )}
                  </button>

                  {/* 生成结果预览 */}
                  {lifeGenResult && (
                    <div className={`rounded-xl px-3 py-2.5 text-xs ${lifeGenResult.error ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                      {lifeGenResult.error ? (
                        <p>{lifeGenResult.error}</p>
                      ) : (
                        <>
                          <p className="font-medium mb-1">生成完成</p>
                          {lifeGenResult.summary && <p className="text-green-600">{lifeGenResult.summary}</p>}
                          {lifeGenResult.period && (
                            <p className="text-green-500 text-[10px] mt-1">
                              时段: {PERIOD_OPTIONS.find(p => p.value === lifeGenResult.period)?.label || lifeGenResult.period}
                              {lifeGenResult.timeOfDay ? ` ${lifeGenResult.timeOfDay}` : ''}
                            </p>
                          )}
                          {lifeGenResult.events && (
                            <p className="text-green-500 text-[10px] mt-0.5">事件: {lifeGenResult.events.length} 条</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* 操作 */}
                <div className="pt-2 space-y-2">
                  <button onClick={() => { seedData(); setSettingsOpen(false); }}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm text-gray-600 transition-colors">
                    生成演示数据
                  </button>
                </div>

                <button onClick={() => setSettingsOpen(false)}
                  className="w-full py-2.5 text-gray-400 text-sm">关闭</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════ 状态编辑面板 ═══════ */}
      <AnimatePresence>
        {editing && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 z-40" onClick={() => setEditing(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-2xl"
              style={{ maxHeight: '78%', overflowY: 'auto' }}>
              <div className="p-5 space-y-4">
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
                <p className="text-center font-bold text-gray-800">编辑角色状态</p>
                <p className="text-center text-[10px] text-gray-400">AI 会在聊天中自动更新状态，你也可以手动修正</p>
                <div>
                  <p className="text-xs text-gray-400 mb-2">心情色调（最多 3 色）</p>
                  <div className="grid grid-cols-9 gap-[5px]">
                    {PALETTE.map(c => (
                      <button key={c} onClick={() => toggleColor(c)}
                        className="aspect-square rounded-full transition-all"
                        style={{
                          background: c,
                          boxShadow: draft.moodColors?.includes(c) ? `0 0 0 2px white, 0 0 0 4px ${c}` : 'none',
                          transform: draft.moodColors?.includes(c) ? 'scale(1.2)' : 'scale(1)',
                        }} />
                    ))}
                  </div>
                </div>
                {[
                  { key: 'location', label: '所在地点', placeholder: '图书馆、街角咖啡店...' },
                  { key: 'outfit',   label: '当前衣着', placeholder: '白衬衫、牛仔裤...' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                    <input value={draft[f.key]} onChange={e => setDraft(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none border border-gray-100" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">状态描述</label>
                  <textarea value={draft.statusDesc} onChange={e => setDraft(p => ({ ...p, statusDesc: e.target.value }))}
                    placeholder="悠闲地翻着一本旧小说..." rows={2}
                    className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none resize-none border border-gray-100" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">心声独白</label>
                  <textarea value={draft.innerThoughts} onChange={e => setDraft(p => ({ ...p, innerThoughts: e.target.value }))}
                    placeholder="如果明天能见到那个人就好了..." rows={2}
                    className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700 outline-none resize-none border border-gray-100 italic" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setEditing(false)} className="flex-1 py-2.5 rounded-xl text-gray-400 text-sm">取消</button>
                  <button onClick={saveStatus} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-medium disabled:opacity-50">
                    {saving ? '...' : '保存'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
