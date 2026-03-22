/**
 * NPC管理 — 角色关系网络
 *
 * 管理角色的 NPC 关系：朋友、恋人、家人、对手、同事等。
 * 每个关系包含 emoji、类型、亲密度、备注。
 */
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronDown, Plus, Edit3, Trash2, X, Heart, Users, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar.jsx';
import { api } from '../services/api.js';

/* ── 常量 ──────────────────────────────────────────────────────────── */
const REL_TYPES = [
  { key: 'friend',    label: '朋友', color: '#60a5fa' },
  { key: 'romantic',  label: '恋人', color: '#f472b6' },
  { key: 'family',    label: '家人', color: '#fbbf24' },
  { key: 'rival',     label: '对手', color: '#ef4444' },
  { key: 'colleague', label: '同事', color: '#a78bfa' },
  { key: 'other',     label: '其他', color: '#94a3b8' },
];
const TYPE_MAP = Object.fromEntries(REL_TYPES.map(t => [t.key, t]));

const DEFAULT_FORM = {
  targetName: '',
  type: 'friend',
  closeness: 50,
  notes: '',
};

/* ── 亲密度条 ─────────────────────────────────────────────────────── */
const ClosenessBar = ({ value = 50, color = '#60a5fa', compact = false }) => (
  <div className="flex items-center gap-1.5">
    <Heart size={compact ? 9 : 10} style={{ color }} />
    <div className={`${compact ? 'w-12' : 'w-20'} h-1.5 bg-gray-100 rounded-full overflow-hidden`}>
      <div className="h-full rounded-full transition-all"
        style={{ width: `${value}%`, background: color }} />
    </div>
    <span className="text-[9px] text-gray-400">{value}</span>
  </div>
);

/* ── 类型徽标 ─────────────────────────────────────────────────────── */
const TypeBadge = ({ type }) => {
  const t = TYPE_MAP[type] || TYPE_MAP.other;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: t.color + '18', color: t.color }}>
      {t.label}
    </span>
  );
};

/* ── NPC 卡片 ─────────────────────────────────────────────────────── */
const NPCCard = ({ npc, onClick }) => {
  const t = TYPE_MAP[npc.type] || TYPE_MAP.other;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      onClick={() => onClick(npc)}
      className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3
                 cursor-pointer hover:shadow-md hover:border-gray-200 active:scale-[0.98] transition-all"
    >
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white text-base font-bold select-none"
        style={{ background: t.color + 'cc' }}>
        {(npc.targetName || npc.name || '?')[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-800 truncate">
            {npc.targetName || npc.name || '未命名'}
          </span>
          <TypeBadge type={npc.type} />
        </div>
        <div className="mt-1">
          <ClosenessBar value={npc.closeness ?? 50} color={t.color} compact />
        </div>
      </div>
      <ChevronDown size={14} className="text-gray-300 shrink-0 -rotate-90" />
    </motion.div>
  );
};

/* ── 底部弹窗 (详情/编辑) ─────────────────────────────────────────── */
const NPCSheet = ({ npc, isNew, onClose, onSave, onDelete }) => {
  const [form, setForm] = useState(() =>
    isNew ? { ...DEFAULT_FORM } : {
      targetName: npc.targetName || npc.name || '',
      type: npc.type || 'friend',
      closeness: npc.closeness ?? 50,
      notes: npc.notes || '',
    }
  );
  const [editing, setEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);

  const t = TYPE_MAP[form.type] || TYPE_MAP.other;

  const handleSave = async () => {
    if (!form.targetName.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 拖动指示条 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* 头部色带 */}
        <div className="h-1.5 mx-5 rounded-full" style={{ background: t.color }} />

        <div className="p-5">
          {/* 顶部操作栏 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">
              {isNew ? '添加 NPC' : editing ? '编辑 NPC' : 'NPC 详情'}
            </h3>
            <div className="flex items-center gap-1">
              {!isNew && !editing && (
                <button onClick={() => setEditing(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <Edit3 size={14} className="text-gray-500" />
                </button>
              )}
              {!isNew && (
                <button onClick={() => onDelete(npc)}
                  className="p-2 hover:bg-red-50 rounded-full transition-colors">
                  <Trash2 size={14} className="text-gray-300 hover:text-red-400" />
                </button>
              )}
              <button onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={14} className="text-gray-400" />
              </button>
            </div>
          </div>

          {editing ? (
            /* ── 编辑模式 ── */
            <div className="space-y-4">
              {/* 名字 */}
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">名字</label>
                <input
                  value={form.targetName}
                  onChange={e => setForm(f => ({ ...f, targetName: e.target.value }))}
                  placeholder="NPC 名字"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-800
                             placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
                />
              </div>

              {/* 关系类型 */}
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">关系类型</label>
                <div className="flex flex-wrap gap-1.5">
                  {REL_TYPES.map(rt => (
                    <button key={rt.key}
                      onClick={() => setForm(f => ({ ...f, type: rt.key }))}
                      className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                      style={{
                        background: form.type === rt.key ? rt.color : rt.color + '12',
                        color: form.type === rt.key ? '#fff' : rt.color,
                      }}>
                      {rt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 亲密度滑块 */}
              <div>
                <label className="text-[11px] text-gray-400 mb-1 flex items-center justify-between">
                  <span>亲密度</span>
                  <span className="text-gray-500 font-medium">{form.closeness}</span>
                </label>
                <input
                  type="range" min="0" max="100" value={form.closeness}
                  onChange={e => setForm(f => ({ ...f, closeness: parseInt(e.target.value) }))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${t.color} ${form.closeness}%, #e5e7eb ${form.closeness}%)`,
                  }}
                />
                <div className="flex justify-between text-[9px] text-gray-300 mt-0.5">
                  <span>陌生</span><span>亲密</span>
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="text-[11px] text-gray-400 mb-1 block">备注</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="关于这段关系的备注..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-800
                             placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 resize-none"
                />
              </div>

              {/* 保存按钮 */}
              <button
                onClick={handleSave}
                disabled={!form.targetName.trim() || saving}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                style={{ background: t.color }}
              >
                {saving ? '保存中...' : isNew ? '添加' : '保存修改'}
              </button>
            </div>
          ) : (
            /* ── 查看模式 ── */
            <div>
              {/* 头像 + 基本信息 */}
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 text-white text-2xl font-bold select-none"
                  style={{ background: t.color + 'cc' }}>
                  {form.targetName?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 text-base">{form.targetName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <TypeBadge type={form.type} />
                  </div>
                  <div className="mt-2">
                    <ClosenessBar value={form.closeness} color={t.color} />
                  </div>
                </div>
              </div>

              {/* 备注 */}
              {form.notes && (
                <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-1">备注</p>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{form.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ── 角色选择下拉 ─────────────────────────────────────────────────── */
const CharPicker = ({ chars, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const current = chars.find(c => c.id === selected);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-sm text-gray-700">
        <Avatar value={current?.avatar} name={current?.name} size={20} rounded />
        <span className="max-w-[80px] truncate">{current?.name || '选择角色'}</span>
        <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100
                       overflow-hidden z-30 min-w-[160px] max-h-[240px] overflow-y-auto"
          >
            {chars.map(c => (
              <button key={c.id}
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors
                  ${c.id === selected ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}>
                <Avatar value={c.avatar} name={c.name} size={20} rounded />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── 主组件 ───────────────────────────────────────────────────────── */
export default function NPCApp({ onBack, initialChar }) {
  const [chars, setChars]         = useState([]);
  const [charId, setCharId]       = useState(initialChar?.id || null);
  const [npcs, setNpcs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null);   // 当前查看的 NPC
  const [adding, setAdding]       = useState(false);   // 新增模式

  /* ── 加载角色列表 ── */
  useEffect(() => {
    api.get('/api/characters')
      .then(data => {
        const list = Array.isArray(data) ? data : data.characters || [];
        setChars(list);
        if (!charId && list.length > 0) setCharId(list[0].id);
      })
      .catch(err => setError('加载角色失败: ' + err.message));
  }, []);

  /* ── 加载关系列表 ── */
  const loadNpcs = useCallback(async () => {
    if (!charId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/api/characters/${charId}/relations`);
      setNpcs(Array.isArray(data) ? data : data.relations || []);
    } catch (err) {
      setError('加载关系失败: ' + err.message);
      setNpcs([]);
    } finally {
      setLoading(false);
    }
  }, [charId]);

  useEffect(() => { loadNpcs(); }, [loadNpcs]);

  /* ── 创建 NPC ── */
  const handleCreate = async (form) => {
    await api.post(`/api/characters/${charId}/relations`, form);
    setAdding(false);
    loadNpcs();
  };

  /* ── 更新 NPC ── */
  const handleUpdate = async (form) => {
    if (!selected) return;
    await api.put(`/api/characters/${charId}/relations/${selected.id}`, form);
    setSelected(null);
    loadNpcs();
  };

  /* ── 删除 NPC ── */
  const handleDelete = async (npc) => {
    if (!confirm(`确定删除「${npc.targetName || npc.name}」吗？`)) return;
    await api.delete(`/api/characters/${charId}/relations/${npc.id}`);
    setSelected(null);
    loadNpcs();
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* ── 顶部栏 ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onBack}
          className="p-1.5 -ml-1.5 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <Users size={16} className="text-blue-500" />
          <h1 className="font-bold text-gray-800">NPC管理</h1>
        </div>
        {chars.length > 0 && (
          <CharPicker chars={chars} selected={charId} onChange={setCharId} />
        )}
      </div>

      {/* ── 内容区 ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 text-red-500 text-xs rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !charId ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            请先选择一个角色
          </div>
        ) : npcs.length === 0 ? (
          <div className="text-center py-20">
            <Users size={40} className="text-gray-200 mb-3 mx-auto" />
            <p className="text-gray-400 text-sm">还没有 NPC 关系</p>
            <p className="text-gray-300 text-xs mt-1">点击右下角按钮添加</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {npcs.map(npc => (
                <NPCCard key={npc.id} npc={npc} onClick={setSelected} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── FAB 添加按钮 ── */}
      {charId && (
        <button
          onClick={() => setAdding(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full
                     shadow-lg shadow-blue-200 flex items-center justify-center transition-all
                     active:scale-90 z-20"
        >
          <Plus size={24} />
        </button>
      )}

      {/* ── 底部弹窗：查看/编辑 ── */}
      <AnimatePresence>
        {selected && (
          <NPCSheet
            key="detail"
            npc={selected}
            isNew={false}
            onClose={() => setSelected(null)}
            onSave={handleUpdate}
            onDelete={handleDelete}
          />
        )}
        {adding && (
          <NPCSheet
            key="add"
            npc={null}
            isNew={true}
            onClose={() => setAdding(false)}
            onSave={handleCreate}
            onDelete={() => {}}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
