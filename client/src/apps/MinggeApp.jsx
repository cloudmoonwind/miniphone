/**
 * 命格 — 用户马甲（User Persona）管理
 *
 * 设计：身份卡片网格，非表单页
 * - 卡片式展示每个 persona（avatar emoji + 名称 + 简介 + 色彩标识）
 * - 当前活跃马甲高亮显示（"出戏状态"="无马甲"）
 * - 长按卡片进入编辑/删除
 * - 底部 + 按钮创建新马甲
 */
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Plus, Check, Trash2, Edit3, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AvatarUpload from '../components/AvatarUpload.jsx';
import Avatar from '../components/Avatar.jsx';

const api = (path, opts) => fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

const PRESET_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4',
];

// ── 马甲卡片 ──────────────────────────────────────────────────────────────────
const PersonaCard = ({ persona, isActive, onActivate, onEdit, onDelete }) => {
  const pressTimer = useRef(null);
  const [showActions, setShowActions] = useState(false);

  const handlePressStart = () => {
    pressTimer.current = setTimeout(() => setShowActions(true), 500);
  };
  const handlePressEnd = () => {
    clearTimeout(pressTimer.current);
  };

  return (
    <motion.div
      layout
      className="relative"
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerLeave={handlePressEnd}
    >
      <button
        onClick={() => !showActions && onActivate(persona)}
        className={`w-full rounded-2xl p-4 flex flex-col items-center gap-2 border-2 transition-all active:scale-95 ${
          isActive
            ? 'border-transparent shadow-lg'
            : 'border-transparent bg-white/60 hover:bg-white/80'
        }`}
        style={isActive ? { backgroundColor: persona.color + '22', borderColor: persona.color } : {}}
      >
        <Avatar value={persona.avatar} name={persona.name} size={56} />
        <p className="text-sm font-semibold text-gray-800 text-center leading-tight">{persona.name}</p>
        {persona.description && (
          <p className="text-[10px] text-gray-500 text-center line-clamp-2 leading-relaxed">{persona.description}</p>
        )}
        {isActive && (
          <div
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: persona.color, color: 'white' }}
          >
            <Check size={10} />
            使用中
          </div>
        )}
      </button>

      {/* 长按操作浮层 */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 rounded-2xl bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10"
          >
            <button
              onClick={() => { setShowActions(false); onEdit(persona); }}
              className="flex items-center gap-1.5 bg-white text-gray-800 text-xs font-semibold px-4 py-2 rounded-xl"
            >
              <Edit3 size={13} /> 编辑
            </button>
            <button
              onClick={() => { setShowActions(false); onDelete(persona); }}
              className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-xl"
            >
              <Trash2 size={13} /> 删除
            </button>
            <button
              onClick={() => setShowActions(false)}
              className="text-white/60 text-xs mt-1"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── 用户本体卡片 ──────────────────────────────────────────────────────────────
const UserBaseCard = ({ profile, isActive, onClick, onEdit }) => {
  const pressTimer = useRef(null);
  const hasProfile = profile?.name?.trim();
  const startPress = () => { pressTimer.current = setTimeout(() => onEdit(), 600); };
  const endPress   = () => { clearTimeout(pressTimer.current); };

  return (
    <button
      onClick={onClick}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      className={`w-full rounded-2xl p-4 flex flex-col items-center gap-2 border-2 transition-all active:scale-95 relative ${
        isActive
          ? 'border-gray-500 bg-gray-100 shadow-sm'
          : 'border-dashed border-gray-200 bg-white/40 hover:bg-white/60'
      }`}
    >
      <Avatar value={profile?.avatar} name={profile?.name} size={56} />
      <p className="text-sm font-semibold text-gray-700">{hasProfile ? profile.name : '用户本体'}</p>
      <p className="text-[10px] text-gray-400 text-center line-clamp-2">
        {profile?.description || '长按编辑你的真实身份'}
      </p>
      {isActive && (
        <div className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-400 text-white">
          <Check size={10} /> 使用中
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onEdit(); }}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 text-gray-400"
      >
        <Edit3 size={12} />
      </button>
    </button>
  );
};

// ── 创建/编辑表单 (Sheet Modal) ────────────────────────────────────────────────
const PersonaForm = ({ initial, onSave, onClose, isUserBase = false }) => {
  const [name, setName]         = useState(initial?.name || '');
  const [avatar, setAvatar]     = useState(initial?.avatar || '');
  const [desc, setDesc]         = useState(initial?.description || '');
  const [color, setColor]       = useState(initial?.color || PRESET_COLORS[0]);
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    if (!isUserBase && !name.trim()) return;
    setSaving(true);
    try {
      if (isUserBase) await onSave({ name, avatar, description: desc });
      else await onSave({ name, avatar, description: desc, color });
    }
    finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-30 px-5 pt-4 pb-8"
    >
      <div className="flex items-center mb-4">
        <span className="text-base font-bold text-gray-800 flex-1">{isUserBase ? '编辑用户本体' : (initial ? '编辑马甲' : '新建马甲')}</span>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      {/* 头像上传 */}
      <div className="flex items-center gap-4 mb-4">
        <AvatarUpload value={avatar} onChange={setAvatar} size={64} />
        <p className="text-xs text-gray-400 leading-relaxed">点击头像区域<br />上传图片</p>
      </div>

      {/* 名称 */}
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="马甲名称"
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 outline-none focus:border-indigo-400"
        maxLength={20}
      />

      {/* 简介 */}
      <textarea
        value={desc}
        onChange={e => setDesc(e.target.value)}
        placeholder="简短描述这个身份…（可选）"
        rows={2}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 outline-none focus:border-indigo-400 resize-none"
        maxLength={100}
      />

      {/* 颜色 */}
      <div className="flex gap-2 mb-5">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full py-3 rounded-2xl text-white text-sm font-bold disabled:opacity-40 transition-opacity"
        style={{ backgroundColor: color }}
      >
        {saving ? '保存中…' : '保存'}
      </button>
    </motion.div>
  );
};

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function MinggeApp({ onBack }) {
  const [personas, setPersonas]     = useState([]);
  const [activeId, setActiveId]     = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [editingUserBase, setEditingUserBase] = useState(false);

  const load = async () => {
    const data = await api('/personas');
    setPersonas(data.personas || []);
    setActiveId(data.activePersonaId || null);
    setUserProfile(data.userProfile || { name: '', avatar: '', description: '' });
  };

  useEffect(() => { load(); }, []);

  const handleActivate = async (persona) => {
    if (activeId === persona.id) {
      await api('/personas/deactivate', { method: 'POST' });
      setActiveId(null);
    } else {
      await api(`/personas/${persona.id}/activate`, { method: 'POST' });
      setActiveId(persona.id);
    }
  };

  const handleDeactivateAll = async () => {
    await api('/personas/deactivate', { method: 'POST' });
    setActiveId(null);
  };

  const handleSaveUserProfile = async (data) => {
    await api('/personas/user-profile', { method: 'PUT', body: JSON.stringify(data) });
    setEditingUserBase(false);
    await load();
  };

  const handleSave = async (data) => {
    if (editing) {
      await api(`/personas/${editing.id}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      await api('/personas', { method: 'POST', body: JSON.stringify(data) });
    }
    setShowForm(false);
    setEditing(null);
    await load();
  };

  const handleDelete = async (persona) => {
    await api(`/personas/${persona.id}`, { method: 'DELETE' });
    await load();
  };

  const handleEdit = (persona) => {
    setEditing(persona);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-violet-50 to-indigo-50 relative">
      {/* 顶栏 */}
      <div className="h-14 bg-white/80 backdrop-blur-sm border-b border-white flex items-center px-4 gap-2 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <span className="font-bold text-gray-800 flex-1">命格</span>
        <span className="text-xs text-gray-400">你的角色扮演身份</span>
      </div>

      {/* 当前状态提示 */}
      <div className="mx-4 mt-3 mb-1 bg-white/60 rounded-2xl px-4 py-2.5 flex items-center gap-2">
        {(() => {
          const ap = activeId ? personas.find(p => p.id === activeId) : null;
          return <Avatar value={ap?.avatar} name={ap?.name || userProfile?.name} size={32} rounded />;
        })()}
        <div className="flex-1">
          <p className="text-xs text-gray-500">当前以</p>
          <p className="text-sm font-bold text-gray-800">
            {activeId ? (personas.find(p => p.id === activeId)?.name || '未知') : '真实身份'}
            <span className="font-normal text-gray-500">与角色互动</span>
          </p>
        </div>
      </div>

      {/* 卡片网格 */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <UserBaseCard
            profile={userProfile}
            isActive={!activeId}
            onClick={handleDeactivateAll}
            onEdit={() => setEditingUserBase(true)}
          />
          {personas.map(p => (
            <PersonaCard
              key={p.id}
              persona={p}
              isActive={activeId === p.id}
              onActivate={handleActivate}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
          {/* 新建占位 */}
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 py-6 hover:bg-white/60 transition-colors"
          >
            <Plus size={20} className="text-gray-300" />
            <span className="text-xs text-gray-400">新建马甲</span>
          </button>
        </div>
      </div>

      {/* 用户本体编辑表单 */}
      <AnimatePresence>
        {editingUserBase && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/30 z-20"
              onClick={() => setEditingUserBase(false)} />
            <PersonaForm
              initial={userProfile}
              onSave={handleSaveUserProfile}
              onClose={() => setEditingUserBase(false)}
              isUserBase={true}
            />
          </>
        )}
      </AnimatePresence>

      {/* 创建/编辑马甲表单 */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/30 z-20"
              onClick={() => { setShowForm(false); setEditing(null); }}
            />
            <PersonaForm
              initial={editing}
              onSave={handleSave}
              onClose={() => { setShowForm(false); setEditing(null); }}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
