/**
 * 物品库 — 角色的物品世界
 *
 * 独立 app。物品不只是清单，它们是角色生活的痕迹。
 *
 * 数据模型（对齐需求文档）：
 *   - name, category (服饰/文具/食品/饰品/其他)
 *   - emoji, description
 *   - source: { type: gift/found/bought/crafted, from, occasion }
 *   - emotionalValue: 0-100（情感值）
 *   - condition: 0-100（磨损度）
 *   - status: active/stored/trashed
 *   - location: 放置位置（卧室-衣柜）
 *   - linkedTimelineIds: 关联时间线
 *   - characterNotes: 角色对物品的注记
 *   - obtainedAt: 获得时间
 *
 * 系统性行为（遗忘）：
 *   当 linkedTimelineIds 指向的记录被删除后，
 *   物品依然存在但关联断裂 → 触发角色困惑事件（由事件系统处理）
 *   此处只做数据展示，不做 UI hint 伪装系统行为。
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronDown, Plus, Trash2, X, Package,
  RefreshCw, Link2, Clock, Heart, MapPin, Sparkles,
  Archive, RotateCcw, Filter, Gem, Shirt, BookOpen,
  Utensils, Tag, Wrench, Gift, ShoppingBag, Search, Scissors,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar.jsx';
import { api } from '../services/api.js';

/* ── 常量 ──────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { key: 'accessory', label: '饰品', icon: Gem },
  { key: 'clothing',  label: '服饰', icon: Shirt },
  { key: 'stationery',label: '文具', icon: BookOpen },
  { key: 'food',      label: '食品', icon: Utensils },
  { key: 'keepsake',  label: '纪念', icon: Tag },
  { key: 'tool',      label: '工具', icon: Wrench },
  { key: 'other',     label: '其他', icon: Package },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

const ITEM_EMOJIS = [
  '📦','⚔️','🔮','📖','🗝️','💌','🎭','🌸','🍀','💎',
  '🎵','🔑','📸','🧧','🪄','⭐','🌙','☀️','🦋','🌺',
  '💍','🎀','🕯️','🧸','🫧','🪷','📿','🎐','🏮','🪞',
];

const SOURCE_TYPES = [
  { key: 'gift',    label: '收到的礼物', icon: Gift },
  { key: 'bought',  label: '自己买的',  icon: ShoppingBag },
  { key: 'found',   label: '捡到的',    icon: Search },
  { key: 'crafted', label: '亲手做的',  icon: Scissors },
];

const STATUS_FILTERS = [
  { key: 'active',  label: '使用中' },
  { key: 'stored',  label: '收纳中' },
  { key: 'trashed', label: '已丢弃' },
];

/* ── 情感值可视化 ─────────────────────────────────────────────────── */
const EmotionBar = ({ value = 50 }) => {
  const hue = value > 60 ? 340 : value > 30 ? 40 : 200; // 高=粉红 中=暖黄 低=冷蓝
  return (
    <div className="flex items-center gap-1.5">
      <Heart size={10} style={{ color: `hsl(${hue}, 70%, 60%)` }} />
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: `hsl(${hue}, 70%, 60%)` }} />
      </div>
      <span className="text-[9px] text-gray-400">{value}</span>
    </div>
  );
};

/* ── 物品详情 ─────────────────────────────────────────────────────── */
const ItemDetail = ({ item, onClose, onDelete, onUpdate }) => {
  if (!item) return null;
  const cat = CAT_MAP[item.category] || CAT_MAP.other;
  const src = SOURCE_TYPES.find(s => s.key === item.source?.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
      className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
      {/* 顶部氛围条 — 情感值决定颜色 */}
      <div className="h-2 rounded-t-3xl"
        style={{
          background: `linear-gradient(90deg,
            hsl(${(item.emotionalValue || 50) > 60 ? 340 : 200}, 60%, 70%),
            hsl(${(item.emotionalValue || 50) > 60 ? 30 : 220}, 50%, 80%))`,
        }} />

      <div className="p-5 relative">
        <button onClick={onClose}
          className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 rounded-full transition-colors">
          <X size={14} className="text-gray-400" />
        </button>

        {/* 物品头像 + 基本信息 */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 relative">
            {item.emoji
              ? <span className="text-3xl">{item.emoji}</span>
              : (() => { const Ic = cat.icon; return <Ic size={28} className="text-gray-300" />; })()}
            {/* 磨损度指示 */}
            {item.condition != null && item.condition < 50 && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-100 rounded-full flex items-center justify-center"
                title={`磨损 ${100 - item.condition}%`}>
                <AlertTriangle size={8} className="text-amber-500" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 text-base">{item.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {(() => { const Ic = cat.icon; return <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full flex items-center gap-1"><Ic size={9} />{cat.label}</span>; })()}
              {item.status === 'stored' && (
                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-500 rounded-full flex items-center gap-1"><Archive size={9} />收纳中</span>
              )}
              {item.status === 'trashed' && (
                <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-400 rounded-full flex items-center gap-1"><Trash2 size={9} />已丢弃</span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
              <Clock size={9} /> {item.obtainedAt?.slice(0, 10) || '未知'}
            </p>
          </div>
        </div>

        {/* 描述 */}
        {item.description && (
          <p className="text-sm text-gray-600 leading-relaxed mt-4">{item.description}</p>
        )}

        {/* 来源信息 */}
        {item.source && (
          <div className="mt-4 bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-400 mb-1">来源</p>
            <div className="flex items-center gap-2">
              {(() => { const Ic = src?.icon || Package; return <Ic size={14} className="text-gray-400 shrink-0" />; })()}
              <div>
                <p className="text-xs text-gray-700 font-medium">{src?.label || '未知'}</p>
                {item.source.from && <p className="text-[10px] text-gray-500">来自 {item.source.from}</p>}
                {item.source.occasion && <p className="text-[10px] text-gray-400">{item.source.occasion}</p>}
              </div>
            </div>
          </div>
        )}

        {/* 数值面板 */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-400 mb-1">情感值</p>
            <EmotionBar value={item.emotionalValue || 50} />
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-[10px] text-gray-400 mb-1">状态</p>
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${item.condition ?? 100}%`,
                    background: (item.condition ?? 100) > 60 ? '#22c55e' : (item.condition ?? 100) > 30 ? '#fbbf24' : '#ef4444',
                  }} />
              </div>
              <span className="text-[9px] text-gray-400">{item.condition ?? 100}%</span>
            </div>
          </div>
        </div>

        {/* 放置位置 */}
        {item.location && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin size={10} />
            <span>{item.location}</span>
          </div>
        )}

        {/* 关联时间线 */}
        {item.linkedTimelineIds?.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-500">
            <Link2 size={10} />
            <span>{item.linkedTimelineIds.length} 条时间线关联</span>
          </div>
        )}

        {/* 角色笔记 */}
        {item.characterNotes && (
          <div className="mt-3 bg-indigo-50/50 rounded-xl px-3 py-2.5 border border-indigo-100/50">
            <p className="text-[10px] text-indigo-400 mb-1">角色笔记</p>
            <p className="text-xs text-indigo-700/70 italic leading-relaxed">「{item.characterNotes}」</p>
          </div>
        )}

        {/* 操作栏 */}
        <div className="flex items-center gap-2 mt-5">
          {item.status === 'active' && (
            <button onClick={() => onUpdate?.(item.id, { status: 'stored' })}
              className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-blue-500 py-2 rounded-xl hover:bg-blue-50 transition-colors">
              <Archive size={11} /> 收纳
            </button>
          )}
          {item.status === 'stored' && (
            <button onClick={() => onUpdate?.(item.id, { status: 'active' })}
              className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-green-500 py-2 rounded-xl hover:bg-green-50 transition-colors">
              <RotateCcw size={11} /> 取出
            </button>
          )}
          {item.status === 'trashed' && (
            <button onClick={() => onUpdate?.(item.id, { status: 'active' })}
              className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-green-500 py-2 rounded-xl hover:bg-green-50 transition-colors">
              <RotateCcw size={11} /> 恢复
            </button>
          )}
          <button onClick={() => onDelete(item.id)}
            className="flex items-center gap-1 text-xs text-gray-300 hover:text-red-400 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors">
            <Trash2 size={11} /> {item.status === 'trashed' ? '彻底删除' : '丢弃'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

/* ── 主组件 ───────────────────────────────────────────────────────── */
export default function ItemsApp({ onBack }) {
  const [chars, setChars]           = useState([]);
  const [char, setChar]             = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const [form, setForm]             = useState({
    name: '', emoji: '📦', description: '',
    category: 'other',
    source: { type: 'gift', from: '', occasion: '' },
    emotionalValue: 50, condition: 100, location: '',
  });

  useEffect(() => {
    api.get('/api/characters').then(data => {
      const list = Array.isArray(data) ? data : [];
      setChars(list);
      if (list.length > 0) setChar(list[0]);
    }).catch(() => {});
  }, []);

  const loadItems = useCallback(async () => {
    if (!char) return;
    setLoading(true);
    try { setItems(await api.get(`/api/characters/${char.id}/items`)); }
    catch { setItems([]); }
    finally { setLoading(false); }
  }, [char]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filteredItems = items.filter(i => (i.status || 'active') === statusFilter);

  const add = async () => {
    if (!form.name.trim()) return;
    const item = await api.post(`/api/characters/${char.id}/items`, {
      ...form, status: 'active', obtainedAt: new Date().toISOString(),
    });
    setItems(prev => [item, ...prev]);
    setForm({
      name: '', emoji: '📦', description: '',
      category: 'other',
      source: { type: 'gift', from: '', occasion: '' },
      emotionalValue: 50, condition: 100, location: '',
    });
    setAddOpen(false);
  };

  const del = async (id) => {
    const item = items.find(i => i.id === id);
    if (item?.status === 'trashed') {
      // 彻底删除
      await api.delete(`/api/characters/${char.id}/items/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      // 移入丢弃
      try {
        await api.put(`/api/characters/${char.id}/items/${id}`, { status: 'trashed' });
        setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'trashed' } : i));
      } catch {
        await api.delete(`/api/characters/${char.id}/items/${id}`);
        setItems(prev => prev.filter(i => i.id !== id));
      }
    }
    if (selected?.id === id) setSelected(null);
  };

  const updateItem = async (id, patch) => {
    try {
      const updated = await api.put(`/api/characters/${char.id}/items/${id}`, patch);
      setItems(prev => prev.map(i => i.id === id ? (updated || { ...i, ...patch }) : i));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, ...patch } : null);
    } catch {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-50 to-white">
      {/* 顶栏 */}
      <div className="flex items-center px-4 pt-3 pb-2 bg-white border-b border-gray-100 shrink-0 z-10">
        <button onClick={onBack} className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <Package size={18} className="text-indigo-400 ml-1" />
        <span className="font-bold text-gray-800 text-base ml-1.5 flex-1">物品库</span>

        {/* 角色选择器 */}
        <div className="relative">
          <button onClick={() => setPickerOpen(p => !p)}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors text-sm">
            <Avatar value={char?.avatar} name={char?.name} size={20} rounded />
            <span className="font-medium text-gray-700">{char?.name || '选择'}</span>
            <ChevronDown size={12} className="text-gray-400" />
          </button>
          <AnimatePresence>
            {pickerOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-10 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 min-w-[130px]">
                {chars.map(c => (
                  <button key={c.id} onClick={() => { setChar(c); setPickerOpen(false); setSelected(null); }}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-gray-50 ${char?.id === c.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}>
                    <Avatar value={c.avatar} name={c.name} size={20} rounded />
                    <span>{c.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 状态筛选 */}
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs transition-all ${statusFilter === f.key
                ? 'bg-gray-800 text-white font-medium' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
              {f.label}
              <span className="ml-1 text-[10px] opacity-60">
                {items.filter(i => (i.status || 'active') === f.key).length}
              </span>
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setAddOpen(!addOpen)}
            className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 transition-colors shadow-sm">
            <Plus size={16} />
          </button>
        </div>

        {/* 新物品表单 */}
        <AnimatePresence>
          {addOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
                {/* 图标 + 名称 */}
                <div className="flex gap-3">
                  <div className="shrink-0">
                    <p className="text-[10px] text-gray-400 mb-1">图标</p>
                    <div className="grid grid-cols-5 gap-1 w-[120px]">
                      {ITEM_EMOJIS.slice(0, 15).map(e => (
                        <button key={e} onClick={() => setForm(p => ({ ...p, emoji: e }))}
                          className={`aspect-square flex items-center justify-center rounded-lg text-base transition-all ${form.emoji === e ? 'bg-indigo-100 scale-110' : 'hover:bg-gray-50'}`}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="物品名称" className="w-full text-sm font-medium text-gray-800 border-b border-gray-100 pb-2 outline-none placeholder-gray-300" />
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="这东西是什么来着…" rows={2}
                      className="w-full text-sm text-gray-600 outline-none resize-none placeholder-gray-300" />
                  </div>
                </div>

                {/* 分类 */}
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">分类</p>
                  <div className="flex flex-wrap gap-1">
                    {CATEGORIES.map(c => {
                      const Ic = c.icon;
                      return (
                        <button key={c.key} onClick={() => setForm(p => ({ ...p, category: c.key }))}
                          className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 transition-all ${form.category === c.key
                            ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>
                          <Ic size={9} />{c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 来源 */}
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">来源</p>
                  <div className="flex gap-1 mb-2">
                    {SOURCE_TYPES.map(s => {
                      const Ic = s.icon;
                      return (
                        <button key={s.key} onClick={() => setForm(p => ({ ...p, source: { ...p.source, type: s.key } }))}
                          className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 transition-all ${form.source.type === s.key
                            ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-400'}`}>
                          <Ic size={9} />{s.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input value={form.source.from} onChange={e => setForm(p => ({ ...p, source: { ...p.source, from: e.target.value } }))}
                      placeholder="来自谁" className="flex-1 text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1.5 outline-none placeholder-gray-300" />
                    <input value={form.source.occasion} onChange={e => setForm(p => ({ ...p, source: { ...p.source, occasion: e.target.value } }))}
                      placeholder="什么场合" className="flex-1 text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1.5 outline-none placeholder-gray-300" />
                  </div>
                </div>

                {/* 数值 */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-400 mb-1">情感值 {form.emotionalValue}</p>
                    <input type="range" min={0} max={100} value={form.emotionalValue}
                      onChange={e => setForm(p => ({ ...p, emotionalValue: +e.target.value }))}
                      className="w-full accent-pink-400 h-1" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-400 mb-1">放置位置</p>
                    <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                      placeholder="卧室-书架" className="w-full text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1.5 outline-none placeholder-gray-300" />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setAddOpen(false)} className="flex-1 text-sm text-gray-400">取消</button>
                  <button onClick={add} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors">收入</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 物品网格 */}
        {loading && <div className="flex justify-center py-12"><RefreshCw size={18} className="animate-spin text-gray-300" /></div>}

        {!loading && filteredItems.length === 0 && !addOpen && (
          <div className="text-center py-16">
            <Package size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-300 text-sm">
              {statusFilter === 'active' ? '背包空空如也' : statusFilter === 'stored' ? '没有收纳中的物品' : '没有丢弃的物品'}
            </p>
          </div>
        )}

        {!loading && filteredItems.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            {filteredItems.map(item => {
              const cat = CAT_MAP[item.category] || CAT_MAP.other;
              const isSelected = selected?.id === item.id;
              const ev = item.emotionalValue || 50;
              // 情感值影响物品卡片的光晕
              const glowColor = ev > 70 ? 'rgba(244,114,182,0.15)' : ev < 30 ? 'rgba(148,163,184,0.1)' : 'transparent';
              return (
                <button key={item.id} onClick={() => setSelected(item.id === selected?.id ? null : item)}
                  className={`flex flex-col items-center py-3 px-2 rounded-2xl transition-all relative ${
                    isSelected
                      ? 'bg-indigo-50 shadow-md border-2 border-indigo-200 scale-105'
                      : 'bg-white border border-gray-100 hover:shadow-sm hover:border-gray-200'
                  }`}
                  style={{ boxShadow: !isSelected && ev > 70 ? `0 0 16px ${glowColor}` : undefined }}>
                  {/* 磨损标记 */}
                  {(item.condition != null && item.condition < 40) && (
                    <div className="absolute top-1 right-1 w-3 h-3 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="text-[7px]">!</span>
                    </div>
                  )}
                  {item.emoji
                    ? <span className="text-2xl mb-1">{item.emoji}</span>
                    : (() => { const Ic = cat.icon; return <Ic size={22} className="text-gray-300 mb-1" />; })()}
                  <span className="text-[10px] font-medium text-gray-700 leading-tight text-center line-clamp-2 px-1">{item.name}</span>
                  {/* 情感值小指示 */}
                  <div className="flex gap-0.5 mt-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-1 h-1 rounded-full"
                        style={{ background: i < Math.ceil(ev / 34) ? `hsl(${ev > 60 ? 340 : 40}, 60%, 60%)` : '#e5e7eb' }} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 物品详情卡 */}
        <AnimatePresence>
          {selected && (
            <ItemDetail item={selected} onClose={() => setSelected(null)} onDelete={del} onUpdate={updateItem} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
