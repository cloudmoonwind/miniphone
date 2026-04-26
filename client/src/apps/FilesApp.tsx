/**
 * 上下文 / 文件管理 — Context Assembly Pipeline
 *
 * 每个激活预设的「条目」按顺序决定最终发给 AI 的消息数组。
 * 系统槽（sys-*）从后端自动填充内容，可编辑槽直接在此编写。
 * role 参数决定该槽在 messages 数组中的角色（system/user/assistant）。
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { encode } from 'gpt-tokenizer';
import {
  ChevronLeft, Plus, Trash2, X, Check, Eye, Pencil,
  ToggleLeft, ToggleRight, Loader2, Hash, AlertTriangle,
  ChevronDown, ChevronUp, Layers, Settings2,
  Pin, Wrench, Globe, Star, FileText, Quote, User, Brain,
  BookOpen, MapPin, Leaf, Moon, ScrollText, MessageSquare, Lock,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

// ── 系统槽定义（必须与 server/services/context.js 的 SLOT_DEFS 保持同步）──────
const SYSTEM_SLOTS = {
  'sys-syspre': {
    name: '系统提示_前',
    blockType: 'sys-pre',
    defaultRole: 'system',
    color: 'gray',
    icon: Pin,
    desc: '在所有内容最前面的系统提示',
    editable: true,
    placeholder: '写全局系统提示（最高优先级，如整体行为准则）…',
  },
  'sys-tools': {
    name: '工具',
    blockType: 'tools',
    defaultRole: 'system',
    color: 'orange',
    icon: Wrench,
    desc: 'AI 工具/函数定义（function calling）',
    editable: true,
    placeholder: '定义 AI 可调用的工具（JSON 格式或自然语言描述）…',
  },
  'sys-wbpre': {
    name: '世界书（前置）',
    blockType: 'wb-pre',
    defaultRole: 'system',
    color: 'cyan',
    icon: Globe,
    desc: '世界书 system-top 条目（世界观、全局背景）',
    sourceLabel: '在「世界书」中管理，插入位置选 system-top',
  },
  'sys-char-core': {
    name: 'char角色核心',
    blockType: 'char-core',
    defaultRole: 'system',
    color: 'violet',
    icon: Star,
    desc: '角色的名字与核心性格设定（char.core）',
    sourceLabel: '在「结缘」→ 角色详情中修改',
    required: true,
  },
  'sys-char-desc': {
    name: 'char角色描述',
    blockType: 'char-desc',
    defaultRole: 'system',
    color: 'purple',
    icon: FileText,
    desc: '角色的详细人设描述（char.persona）',
    sourceLabel: '在「结缘」→ 角色详情中修改',
  },
  'sys-char-sample': {
    name: 'char角色语料',
    blockType: 'char-sample',
    defaultRole: 'system',
    color: 'fuchsia',
    icon: Quote,
    desc: '角色的范例对话、语气样本（char.sample）',
    sourceLabel: '在「结缘」→ 角色详情中修改',
  },
  'sys-user-desc': {
    name: 'user角色描述',
    blockType: 'user-desc',
    defaultRole: 'system',
    color: 'pink',
    icon: User,
    desc: '当前激活的命格马甲内容',
    sourceLabel: '在「命格」中管理',
  },
  'sys-memories': {
    name: '对user的记忆',
    blockType: 'memories',
    defaultRole: 'system',
    color: 'amber',
    icon: Brain,
    desc: '忆海中重要性 ≥ 7 的记忆条目',
    sourceLabel: '在「忆海」中管理',
  },
  'sys-wbpost': {
    name: '世界书（后置）',
    blockType: 'wb-post',
    defaultRole: 'system',
    color: 'sky',
    icon: BookOpen,
    desc: '世界书 before-chat / system-bottom 条目',
    sourceLabel: '在「世界书」中管理，插入位置选 before-chat 或 system-bottom',
  },
  'sys-scene': {
    name: '场景',
    blockType: 'scene',
    defaultRole: 'system',
    color: 'emerald',
    icon: MapPin,
    desc: '当前场景描述（时间、地点、氛围）',
    editable: true,
    placeholder: '描述当前的场景，例如：傍晚，图书馆，窗外下着雨…',
  },
  'sys-life': {
    name: '近期生活',
    blockType: 'life',
    defaultRole: 'system',
    color: 'lime',
    icon: Leaf,
    desc: '角色最近 3 条生活日志（由角色系统生成）',
    sourceLabel: '在「角色系统」中生成',
  },
  'sys-dreams': {
    name: '梦境',
    blockType: 'dreams',
    defaultRole: 'system',
    color: 'indigo',
    icon: Moon,
    desc: '角色最近 3 条梦境记录（由梦境 App 记录）',
    sourceLabel: '在「梦境」App 中记录',
  },
  'sys-variables': {
    name: '变量系统',
    blockType: 'variables',
    defaultRole: 'system',
    color: 'purple',
    icon: Brain,
    desc: '当前角色变量状态 + 情绪底色三轴 + 变量更新格式指令',
    sourceLabel: '在「元系统 → 变量系统」中管理',
  },
  'sys-summaries': {
    name: 'chat history摘要',
    blockType: 'summaries',
    defaultRole: 'system',
    color: 'teal',
    icon: ScrollText,
    desc: '最近 5 条对话摘要（从旧到新）',
    sourceLabel: '在「聊天」中生成',
    hasSummaryType: true, // 支持 summaryType 参数
  },
  'sys-history': {
    name: 'chat history',
    blockType: 'history',
    defaultRole: null, // 特殊：展开为 user/assistant 多条消息
    color: 'blue',
    icon: MessageSquare,
    desc: '近 N 条原始对话记录（user/assistant）',
    sourceLabel: '在「聊天」中产生',
    required: true,
    hasDepth: true,
  },
  'sys-syspost': {
    name: '系统提示_后',
    blockType: 'sys-post',
    defaultRole: 'system',
    color: 'gray',
    icon: Lock,
    desc: '在对话历史之后的末尾系统提示',
    editable: true,
    placeholder: '写末尾系统提示（常用于格式要求、输出规范）…',
  },
};

const ALL_SLOT_IDS = Object.keys(SYSTEM_SLOTS);

const ROLE_OPTIONS = [
  { value: 'system',    label: 'system',    badge: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
  { value: 'user',      label: 'user',      badge: 'bg-blue-50 text-blue-600',  dot: 'bg-blue-400' },
  { value: 'assistant', label: 'assistant', badge: 'bg-green-50 text-green-600', dot: 'bg-green-400' },
];
const ROLE_MAP = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r]));

const SLOT_COLOR_CLASSES = {
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-600',  dot: 'bg-violet-400' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-600',  dot: 'bg-purple-400' },
  fuchsia: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-600', dot: 'bg-fuchsia-400' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-600',    dot: 'bg-cyan-400' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-600',   dot: 'bg-amber-400' },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-600',  dot: 'bg-orange-400' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-400' },
  lime:    { bg: 'bg-lime-50',    border: 'border-lime-200',    text: 'text-lime-600',    dot: 'bg-lime-400' },
  pink:    { bg: 'bg-pink-50',    border: 'border-pink-200',    text: 'text-pink-600',    dot: 'bg-pink-400' },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-200',     text: 'text-sky-600',     dot: 'bg-sky-400' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-600',  dot: 'bg-indigo-400' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-600',    dot: 'bg-blue-400' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-600',    dot: 'bg-teal-400' },
  gray:    { bg: 'bg-gray-50',    border: 'border-gray-200',    text: 'text-gray-600',    dot: 'bg-gray-400' },
};

// Precise token count using GPT-4 tokenizer (cl100k_base)
// For GLM/Z.AI models this is an approximation but much more accurate than length/N
function estimateTokens(text) {
  if (!text) return 0;
  try { return encode(text).length; } catch { return Math.ceil(text.length / 2.5); }
}

// ── API helpers ──────────────────────────────────────────────────────────────
const api = {
  listPresets:  () => fetch('/api/prompt/presets').then(r => r.json()),
  createPreset: (d) => fetch('/api/prompt/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
  updatePreset: (id, d) => fetch(`/api/prompt/presets/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
  deletePreset: (id) => fetch(`/api/prompt/presets/${id}`, { method: 'DELETE' }).then(r => r.json()),
  listEntries:  () => fetch('/api/prompt/entries').then(r => r.json()),
  createEntry:  (d) => fetch('/api/prompt/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
  updateEntry:  (id, d) => fetch(`/api/prompt/entries/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
  deleteEntry:  (id) => fetch(`/api/prompt/entries/${id}`, { method: 'DELETE' }).then(r => r.json()),
  getActive:    () => fetch('/api/prompt/active').then(r => r.json()),
  setActive:    (id) => fetch('/api/prompt/active', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(r => r.json()),
  getSummaryPrompts: () => fetch('/api/settings/summary-prompts').then(r => r.ok ? r.json() : {}),
  saveSummaryPrompts: (d) => fetch('/api/settings/summary-prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).then(r => r.json()),
  getContextBudget: () => fetch('/api/settings/context-budget').then(r => r.ok ? r.json() : { maxTokens: 4000 }),
  setContextBudget: (maxTokens) => fetch('/api/settings/context-budget', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxTokens }) }).then(r => r.json()),
  getCharacter: (charId) => fetch(`/api/characters/${charId}`).then(r => r.ok ? r.json() : null),
  getWbEntries: (charId) => fetch(`/api/worldbook/active-entries?charId=${charId}`).then(r => r.ok ? r.json() : []),
  getMemories: (charId) => fetch(`/api/characters/${charId}/memories`).then(r => r.ok ? r.json() : []),
  getSummaries: (charId) => fetch(`/api/characters/${charId}/summaries?limit=5`).then(r => r.ok ? r.json() : []),
  getPersonas: () => fetch('/api/personas').then(r => r.ok ? r.json() : []),
  getActiveChar: () => fetch('/api/characters/active').then(r => r.ok ? r.json() : null),
  getMessages: (charId, limit = 40) => fetch(`/api/characters/${charId}/messages?limit=${limit}`).then(r => r.ok ? r.json() : []),
  getLifeLogs: (charId) => fetch(`/api/characters/${charId}/life?limit=5`).then(r => r.ok ? r.json() : []),
  getDreams: (charId) => fetch(`/api/characters/${charId}/dreams`).then(r => r.ok ? r.json() : []),
};

// ── 默认上下文条目（新建预设时填充）─────────────────────────────────────────

// 默认聊天预设：15 个槽位按用户设计顺序排列
const DEFAULT_CHAT_ITEMS = [
  'sys-syspre', 'sys-tools', 'sys-wbpre',
  'sys-char-core', 'sys-char-desc', 'sys-char-sample',
  'sys-user-desc', 'sys-memories', 'sys-wbpost',
  'sys-scene', 'sys-life', 'sys-dreams',
  'sys-variables',
  'sys-summaries', 'sys-history', 'sys-syspost',
].map(id => ({
  entryId: id,
  // 工具和语料默认关闭（内容为空时无用）
  enabled: id !== 'sys-tools' && id !== 'sys-char-sample',
  roleOverride: null,
  maxTokens: null,
  historyCount: id === 'sys-history' ? 20 : null,
  content: null, // 可编辑槽位的自定义内容
}));

// 默认总结预设：不含工具和梦境，历史深度更大
const DEFAULT_SUMMARY_ITEMS = [
  'sys-syspre', 'sys-wbpre',
  'sys-char-core', 'sys-char-desc', 'sys-char-sample',
  'sys-user-desc', 'sys-memories', 'sys-wbpost',
  'sys-scene', 'sys-life',
  'sys-history', 'sys-syspost',
].map(id => ({
  entryId: id,
  enabled: id !== 'sys-char-sample',
  roleOverride: null,
  maxTokens: null,
  historyCount: id === 'sys-history' ? 100 : null,
  content: null,
}));

// 默认梦境预设：聚焦角色内心，不含对话历史（避免AI复述聊天）
const DEFAULT_DREAM_ITEMS = [
  'sys-syspre',
  'sys-char-core', 'sys-char-desc',
  'sys-memories', 'sys-life',
  'sys-syspost',
].map(id => ({
  entryId: id,
  enabled: true,
  roleOverride: null,
  maxTokens: id === 'sys-memories' ? 800 : null,
  historyCount: null,
  content: id === 'sys-syspost'
    ? '请根据以上角色信息，以第一人称生成一个真实的梦境叙述。内容要折射角色的情绪、恐惧或渴望，150-300字，结尾模糊不完整，像真实梦境一样。最后用JSON单独输出：{"title":"标题","type":"emotion|omen|memory|desire","importance":1-10}'
    : null,
}));

// 向后兼容别名（老预设用 DEFAULT_CONTEXT_ITEMS 填充时仍使用聊天默认）
const DEFAULT_CONTEXT_ITEMS = DEFAULT_CHAT_ITEMS;

// ── 旧版槽位 ID 迁移映射 ────────────────────────────────────────────────────
// v1 → v2：将旧 sys-* ID 重映射到新 ID，避免老预设显示为"条目丢失"
const LEGACY_SLOT_REMAP = {
  'sys-persona':     'sys-char-core',
  'sys-wbtop':       'sys-wbpre',
  'sys-userpersona': 'sys-user-desc',
  'sys-wbbefore':    'sys-wbpost',
  'sys-wbafter':     'sys-wbpost',   // 合并进 wb-post
  'sys-wbbottom':    'sys-wbpost',   // 合并进 wb-post
};

function migrateLegacyContextItems(items) {
  const seen = new Set();
  return items
    .map(item => {
      const newId = LEGACY_SLOT_REMAP[item.entryId] || item.entryId;
      return { ...item, entryId: newId };
    })
    .filter(item => {
      // 去重：多个旧 ID 映射到同一新 ID 时只保留第一个
      if (seen.has(item.entryId)) return false;
      seen.add(item.entryId);
      return true;
    });
}

// 将已有条目与默认模板合并：
// - 按默认顺序展示所有槽位
// - 保留已有条目的配置（enabled/roleOverride 等）
// - 将不在默认模板里的自定义条目（pent_*）追加到末尾
function mergeWithDefaults(existingItems, defaultItems) {
  const existingMap = {};
  existingItems.forEach(item => { existingMap[item.entryId] = item; });
  const result = defaultItems.map(def =>
    existingMap[def.entryId] ? existingMap[def.entryId] : def
  );
  const defaultIds = new Set(defaultItems.map(d => d.entryId));
  existingItems.forEach(item => {
    if (!defaultIds.has(item.entryId)) result.push(item);
  });
  return result;
}

// ── 总结提示词类型 ─────────────────────────────────────────────────────────
const SUMMARY_PROMPT_TYPES = [
  { key: 'segment',  label: '段落总结',   desc: '手动折叠段落时',     placeholder: '你是对话总结助手。用简洁中文总结以下对话段的关键信息，重点记录情感变化、重要事件和关键细节，100字以内。' },
  { key: 'daily',    label: '日总结',     desc: '按日期查询时',       placeholder: '你是对话总结助手。用中文为以下对话生成一份日记式总结，记录当天的重要互动、情感变化和关键事件，200字以内。' },
  { key: 'mode',     label: '模式段总结', desc: '切换线上/线下模式时', placeholder: '你是对话总结助手。用简洁中文总结以下模式段（线上/线下）对话的关键内容，80字以内。' },
  { key: 'periodic', label: '定期总结',   desc: '按条数自动触发',     placeholder: '你是对话总结助手。用简洁中文总结以下对话的核心事件和情感状态，100字以内。' },
];

// ════════════════════════════════════════════════════════════════════════════
// 子组件
// ════════════════════════════════════════════════════════════════════════════

// 角色标签
function RoleBadge({ role }) {
  const r = ROLE_MAP[role];
  if (!r) return null;
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-medium ${r.badge}`}>
      {r.label}
    </span>
  );
}

// token 标签
function TokenBadge({ tokens, warn = false }) {
  return (
    <span className={`text-[10px] flex items-center gap-0.5 ${warn ? 'text-orange-500' : 'text-gray-400'}`}>
      <Hash size={9} />
      {tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens}
    </span>
  );
}

// 拖拽把手（复用）
function DragHandle() {
  return (
    <div className="text-gray-300 cursor-grab active:cursor-grabbing shrink-0 select-none touch-none">
      <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
        <circle cx="2" cy="2.5" r="1.2"/><circle cx="6" cy="2.5" r="1.2"/>
        <circle cx="2" cy="7" r="1.2"/><circle cx="6" cy="7" r="1.2"/>
        <circle cx="2" cy="11.5" r="1.2"/><circle cx="6" cy="11.5" r="1.2"/>
      </svg>
    </div>
  );
}

// 系统槽 — 紧凑单行
function SystemSlotRow({ item, slot, onToggle, onRemove, onEditOpen, resolvedInfo }) {
  const colors = SLOT_COLOR_CLASSES[slot.color] || SLOT_COLOR_CLASSES.indigo;
  const currentRole = item.roleOverride || slot.defaultRole;
  const Ic = slot.icon;

  return (
    <div className={`flex items-center h-9 px-2.5 gap-1.5 rounded-xl border bg-white shadow-sm transition-colors ${item.enabled ? colors.border : 'border-gray-200'} ${item.enabled ? '' : 'opacity-50'}`}>
      <DragHandle />
      {Ic && <Ic size={13} className={`shrink-0 ${colors.text}`} />}
      <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{slot.name}</span>

      {/* history count badge */}
      {slot.blockType === 'history' && (
        <span className="text-[10px] text-blue-400 font-mono bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
          {item.historyCount || 20}条
        </span>
      )}
      {/* role badge */}
      {slot.blockType !== 'history' && currentRole && <RoleBadge role={currentRole} />}
      {/* token for editable slots */}
      {slot.editable && item.content && (
        <TokenBadge tokens={estimateTokens(item.content)} warn={estimateTokens(item.content) > 1000} />
      )}
      {/* token for resolved non-editable slots */}
      {!slot.editable && resolvedInfo?.text && resolvedInfo.text !== '需选择角色' && !resolvedInfo.loading && (
        <span className="text-[10px] text-gray-400 shrink-0">~{estimateTokens(resolvedInfo.text)}tok</span>
      )}

      <button
        onClick={() => onToggle(item.entryId)}
        disabled={slot.required}
        className={`transition-colors shrink-0 ${slot.required ? 'opacity-30 cursor-not-allowed' : ''} ${item.enabled ? 'text-green-500' : 'text-gray-300'}`}
      >
        {item.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
      </button>
      <button onClick={() => onEditOpen(item, slot)} className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors shrink-0">
        <Pencil size={12} />
      </button>
      {!slot.required && (
        <button onClick={() => onRemove(item.entryId)} className="p-0.5 text-gray-200 hover:text-red-400 transition-colors shrink-0">
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// 自定义条目 — 紧凑单行
function CustomEntryRow({ item, entry, onToggle, onRemove, onEdit }) {
  const role = item.roleOverride || entry?.role || 'system';
  const roleInfo = ROLE_MAP[role];
  const tokens = estimateTokens(entry?.content);

  return (
    <div className={`flex items-center h-9 px-2.5 gap-1.5 rounded-xl border bg-white shadow-sm transition-colors ${item.enabled ? 'border-gray-200' : 'border-gray-100'} ${item.enabled ? '' : 'opacity-40'}`}>
      <DragHandle />
      <div className={`w-2 h-2 rounded-full shrink-0 ${roleInfo?.dot || 'bg-gray-400'}`} />
      <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{entry?.name || '(未知条目)'}</span>
      <TokenBadge tokens={tokens} warn={tokens > 2000} />
      <RoleBadge role={role} />
      <button onClick={() => onToggle(item.entryId)} className={`transition-colors shrink-0 ${item.enabled ? 'text-green-500' : 'text-gray-300'}`}>
        {item.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
      </button>
      <button onClick={() => onEdit(entry)} className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors shrink-0">
        <Pencil size={12} />
      </button>
      <button onClick={() => onRemove(item.entryId)} className="p-0.5 text-gray-200 hover:text-red-400 transition-colors shrink-0">
        <X size={12} />
      </button>
    </div>
  );
}

// 系统槽编辑弹窗
function SystemSlotEditModal({ item, slot, resolvedInfo, onSave, onClose }) {
  const [form, setForm] = useState({
    roleOverride: item.roleOverride ?? null,
    maxTokens: item.maxTokens ?? '',
    historyCount: item.historyCount ?? 20,
    content: item.content ?? '',
  });
  const [showFull, setShowFull] = useState(false);
  const colors = SLOT_COLOR_CLASSES[slot.color] || SLOT_COLOR_CLASSES.indigo;
  const Ic = slot.icon;

  const handleSave = () => {
    onSave(item.entryId, {
      roleOverride: form.roleOverride,
      maxTokens: form.maxTokens !== '' ? parseInt(form.maxTokens) : null,
      ...(slot.hasDepth ? { historyCount: Math.max(1, parseInt(form.historyCount) || 20) } : {}),
      ...(slot.editable ? { content: form.content } : {}),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/40 flex items-end z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        className="w-full bg-white rounded-t-2xl px-5 pt-5 pb-6 max-h-[90%] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          {Ic && <Ic size={16} className={colors.text} />}
          <h3 className="font-bold text-gray-800 flex-1">{slot.name}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pb-2">
          {/* 来源提示 */}
          {!slot.editable && slot.sourceLabel && (
            <p className="text-xs text-gray-400 italic">{slot.sourceLabel}</p>
          )}

          {/* 可编辑槽：textarea */}
          {slot.editable && (
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-500">内容</label>
                <span className="text-[10px] text-gray-400">约 {estimateTokens(form.content)} tokens</span>
              </div>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder={slot.placeholder || '输入内容…'}
                rows={6}
                className="w-full px-3 py-2.5 border rounded-xl text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 leading-relaxed placeholder:text-gray-300"
              />
            </div>
          )}

          {/* 非可编辑槽：内容预览 */}
          {!slot.editable && (
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-500">内容预览</label>
                {resolvedInfo?.text && !resolvedInfo.loading && resolvedInfo.text !== '需选择角色' && (
                  <span className="text-[10px] text-gray-400">约 {estimateTokens(resolvedInfo.text)} tokens</span>
                )}
              </div>
              {resolvedInfo?.loading ? (
                <div className="flex items-center gap-2 py-3"><Loader2 size={14} className="animate-spin text-gray-400" /><span className="text-xs text-gray-400">加载中…</span></div>
              ) : resolvedInfo?.text ? (
                <div>
                  <p className={`text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words bg-gray-50 rounded-xl p-3 border border-gray-100 ${!showFull ? 'line-clamp-6' : ''}`}>
                    {showFull || resolvedInfo.text.length <= 300 ? resolvedInfo.text : resolvedInfo.text.slice(0, 300) + '…'}
                  </p>
                  {resolvedInfo.text.length > 300 && (
                    <button onClick={() => setShowFull(v => !v)} className="text-[10px] text-blue-400 hover:text-blue-600 mt-1">
                      {showFull ? '收起' : '展开全文'}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">（暂无内容）</p>
              )}
            </div>
          )}

          {/* 历史深度 */}
          {slot.hasDepth && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-500 shrink-0">消息深度</label>
              <input
                type="number" min={1} max={200}
                value={form.historyCount}
                onChange={e => setForm(f => ({ ...f, historyCount: e.target.value }))}
                className="w-20 px-2 py-2 border rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
              <span className="text-xs text-gray-400">条（默认 20）</span>
            </div>
          )}

          {/* 角色覆盖 */}
          {slot.blockType !== 'history' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">角色覆盖</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setForm(f => ({ ...f, roleOverride: null }))}
                  className={`flex-1 py-2 text-xs rounded-xl border font-medium transition-colors ${!form.roleOverride ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200'}`}
                >
                  默认({slot.defaultRole})
                </button>
                {ROLE_OPTIONS.map(r => (
                  <button key={r.value}
                    onClick={() => setForm(f => ({ ...f, roleOverride: r.value }))}
                    className={`flex-1 py-2 text-xs rounded-xl border font-medium transition-colors ${form.roleOverride === r.value ? `${r.badge} border-current` : 'bg-white text-gray-400 border-gray-200'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Token 上限 */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-500 shrink-0">Token 上限</label>
            <input
              type="number" min={0} max={32000} step={100}
              value={form.maxTokens}
              onChange={e => setForm(f => ({ ...f, maxTokens: e.target.value }))}
              placeholder="不限"
              className="w-24 px-2 py-2 border rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
            <span className="text-xs text-gray-400">留空 = 不限制</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="mt-4 w-full py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 transition-colors"
        >
          保存修改
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Context Budget Slider ────────────────────────────────────────────────────
function ContextBudgetSlider({ maxTokens, onChangeMaxTokens, totalEstimatedTokens }) {
  const PRESETS = [2000, 4000, 8000, 16000, 32000];
  const ratio = maxTokens > 0 ? Math.min(totalEstimatedTokens / maxTokens, 1) : 0;
  const barColor = ratio > 0.9 ? 'bg-red-400' : ratio > 0.7 ? 'bg-yellow-400' : 'bg-green-400';

  return (
    <div className="bg-white border-b px-3 py-2.5 space-y-2 shrink-0">
      <div className="flex items-center gap-2">
        <Settings2 size={12} className="text-gray-400 shrink-0" />
        <span className="text-[11px] font-semibold text-gray-500 flex-1">上下文 Token 预算</span>
        <span className="text-[11px] font-mono text-gray-600">{maxTokens.toLocaleString()}</span>
      </div>
      <input
        type="range"
        min={500}
        max={32000}
        step={500}
        value={maxTokens}
        onChange={e => onChangeMaxTokens(Number(e.target.value))}
        className="w-full h-1.5 rounded-full accent-blue-500"
      />
      <div className="flex gap-1">
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => onChangeMaxTokens(p)}
            className={`flex-1 text-[10px] py-0.5 rounded font-medium transition-colors ${maxTokens === p ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {p >= 1000 ? `${p / 1000}K` : p}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <p className="text-[10px] text-gray-400 text-right">
          约 {totalEstimatedTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 主组件
// ════════════════════════════════════════════════════════════════════════════
const FilesApp = ({ onBack }) => {
  const [presets, setPresets]     = useState([]);
  const [activePresetId, setActivePresetId] = useState(null);
  const [userEntries, setUserEntries] = useState([]);
  const [tab, setTab]             = useState('pipeline'); // 'pipeline' | 'library' | 'summary'
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState('');
  const [showLibrary, setShowLibrary] = useState(false);
  const [showNewPresetModal, setShowNewPresetModal] = useState(false);

  // summary prompts
  const [summaryPrompts, setSummaryPrompts] = useState({ segment: '', daily: '', mode: '', periodic: '' });
  const [spSaving, setSpSaving]   = useState(false);

  // edit entry modal (custom entries)
  const [editEntry, setEditEntry] = useState(null); // null | 'new' | entry object
  const [editForm, setEditForm]   = useState({ name: '', content: '', role: 'system', maxTokens: '' });

  // edit system slot modal
  const [editSlotItem, setEditSlotItem] = useState(null); // null | { item, slot }

  // context budget
  const [maxContextTokens, setMaxContextTokens] = useState(4000);

  // resolved content per slot: { [entryId]: { text: string, loading: bool } }
  const [resolvedContent, setResolvedContent] = useState({});
  // ref-based guard to prevent duplicate in-flight fetches (avoids stale-closure loop)
  const resolvedQueueRef = useRef({});

  // active character id (for fetching slot content)
  const [activeCharId, setActiveCharId] = useState(null);

  // token warning threshold
  const TOKEN_WARN = 6000;

  useEffect(() => {
    (async () => {
      try {
        const [ps, es, act, sp, budget, activeChar] = await Promise.all([
          api.listPresets(), api.listEntries(), api.getActive(), api.getSummaryPrompts(),
          api.getContextBudget(), api.getActiveChar().catch(() => null),
        ]);
        if (budget?.maxTokens) setMaxContextTokens(budget.maxTokens);
        if (activeChar?.id) setActiveCharId(activeChar.id);
        setUserEntries(es);
        setSummaryPrompts(prev => ({ ...prev, ...sp }));

        if (ps.length === 0) {
          // 首次运行：创建聊天、总结、梦境三个默认预设
          const def    = await api.createPreset({ name: '默认聊天预设', presetType: 'chat',    contextItems: DEFAULT_CHAT_ITEMS });
          const defSum = await api.createPreset({ name: '默认总结预设', presetType: 'summary', contextItems: DEFAULT_SUMMARY_ITEMS });
          const defDrm = await api.createPreset({ name: '默认梦境预设', presetType: 'dream',   contextItems: DEFAULT_DREAM_ITEMS });
          setPresets([def, defSum, defDrm]);
          setActivePresetId(def.id);
          await api.setActive(def.id);
        } else {
          // 迁移旧版 ID + 补全缺失槽位（feature 预设保持原样，不自动补全）
          const migrated = [];
          for (const p of ps) {
            // feature 预设（总结/生活/梦境等）有意只包含部分槽位，不做自动合并
            const isFeature = p.presetType === 'feature';
            const defaultItems = p.presetType === 'summary' ? DEFAULT_SUMMARY_ITEMS : DEFAULT_CHAT_ITEMS;
            if (!p.contextItems || p.contextItems.length === 0) {
              if (isFeature) { migrated.push(p); continue; }
              const updated = await api.updatePreset(p.id, { contextItems: defaultItems });
              migrated.push(updated);
            } else {
              // 1. 重映射旧 ID
              const remapped = migrateLegacyContextItems(p.contextItems);
              const hasLegacy = p.contextItems.some(i => LEGACY_SLOT_REMAP[i.entryId]);
              if (isFeature) {
                // feature 预设只做 ID 重映射，不补全槽位
                if (hasLegacy) {
                  const updated = await api.updatePreset(p.id, { contextItems: remapped });
                  migrated.push(updated);
                } else {
                  migrated.push(p);
                }
              } else {
                // 2. 与默认模板合并，补全缺失槽位并保证顺序
                const merged = mergeWithDefaults(remapped, defaultItems);
                const hasMissing = merged.length !== remapped.length;
                if (hasLegacy || hasMissing) {
                  const updated = await api.updatePreset(p.id, { contextItems: merged });
                  migrated.push(updated);
                } else {
                  migrated.push(p);
                }
              }
            }
          }
          setPresets(migrated);
          const activeId = act?.activePromptPresetId || migrated[0]?.id || null;
          setActivePresetId(activeId);
        }
      } catch (err) {
        setMsg(`加载失败：${err.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activePreset = useMemo(() =>
    presets.find(p => p.id === activePresetId) || presets[0],
    [presets, activePresetId]
  );
  const contextItems = activePreset?.contextItems || [];
  const userEntriesMap = useMemo(() =>
    Object.fromEntries(userEntries.map(e => [e.id, e])),
    [userEntries]
  );

  // 估算已启用条目的 token 总量（自定义条目 + 已解析的系统槽）
  const estimatedTotal = useMemo(() => {
    return contextItems
      .filter(item => item.enabled)
      .reduce((sum, item) => {
        const slot = SYSTEM_SLOTS[item.entryId];
        if (slot) {
          // Editable slots: count item.content directly (updates live as user types)
          if (slot.editable) return sum + estimateTokens(item.content || '');
          // Non-editable system slots: use resolved content
          const resolved = resolvedContent[item.entryId];
          if (resolved?.text && resolved.text !== '需选择角色') {
            return sum + estimateTokens(resolved.text);
          }
          return sum;
        }
        const entry = userEntriesMap[item.entryId];
        return sum + estimateTokens(entry?.content || '');
      }, 0);
  }, [contextItems, userEntriesMap, resolvedContent]);

  // ── 预设操作 ──────────────────────────────────────────────────────────
  const patchActivePreset = useCallback(async (updates) => {
    if (!activePreset) return;
    const next = { ...activePreset, ...updates };
    setPresets(prev => prev.map(p => p.id === activePreset.id ? next : p));
    try { await api.updatePreset(activePreset.id, updates); } catch {}
  }, [activePreset]);

  const activatePreset = async (id) => {
    setActivePresetId(id);
    try { await api.setActive(id); } catch {}
  };

  const newPreset = async (type = 'chat') => {
    const defaultItems = type === 'summary' ? DEFAULT_SUMMARY_ITEMS
                       : type === 'dream'   ? DEFAULT_DREAM_ITEMS
                       : DEFAULT_CHAT_ITEMS;
    const label = type === 'summary' ? '总结预设' : type === 'dream' ? '梦境预设' : '聊天预设';
    try {
      const p = await api.createPreset({
        name: `${label} ${presets.length + 1}`,
        presetType: type,
        contextItems: defaultItems,
      });
      setPresets(prev => [...prev, p]);
      await activatePreset(p.id);
    } catch (err) { setMsg(`新建失败：${err.message}`); }
    setShowNewPresetModal(false);
  };

  const deletePreset = async () => {
    if (presets.length <= 1) return;
    try {
      await api.deletePreset(activePreset.id);
      const rest = presets.filter(p => p.id !== activePreset.id);
      setPresets(rest);
      await activatePreset(rest[0].id);
    } catch (err) { setMsg(`删除失败：${err.message}`); }
  };

  // ── 上下文条目操作 ─────────────────────────────────────────────────────
  const addToContext = useCallback((entryId) => {
    if (contextItems.some(i => i.entryId === entryId)) return;
    const isSlot = !!SYSTEM_SLOTS[entryId];
    const slotRole = SYSTEM_SLOTS[entryId]?.defaultRole || null;
    const entry = userEntriesMap[entryId];
    patchActivePreset({
      contextItems: [...contextItems, {
        entryId,
        enabled: true,
        roleOverride: null,
        maxTokens: null,
        historyCount: isSlot && SYSTEM_SLOTS[entryId]?.hasDepth ? 20 : null,
      }],
    });
    setShowLibrary(false);
  }, [contextItems, userEntriesMap, patchActivePreset]);

  const removeFromContext = useCallback((entryId) => {
    patchActivePreset({ contextItems: contextItems.filter(i => i.entryId !== entryId) });
  }, [contextItems, patchActivePreset]);

  const toggleEnabled = useCallback((entryId) => {
    patchActivePreset({
      contextItems: contextItems.map(i =>
        i.entryId === entryId ? { ...i, enabled: !i.enabled } : i
      ),
    });
  }, [contextItems, patchActivePreset]);

  const configItem = useCallback((entryId, patch) => {
    patchActivePreset({
      contextItems: contextItems.map(i =>
        i.entryId === entryId ? { ...i, ...patch } : i
      ),
    });
  }, [contextItems, patchActivePreset]);

  const handleSetMaxContextTokens = useCallback(async (val) => {
    setMaxContextTokens(val);
    try { await api.setContextBudget(val); } catch {}
  }, []);

  // Resolve content for a system slot
  const resolveSlotContent = useCallback(async (entryId, item) => {
    if (resolvedQueueRef.current[entryId]) return; // already queued or resolved
    resolvedQueueRef.current[entryId] = true;
    setResolvedContent(prev => ({ ...prev, [entryId]: { text: null, loading: true } }));
    try {
      let text = null;
      if (entryId === 'sys-char-core' || entryId === 'sys-char-desc' || entryId === 'sys-char-sample') {
        if (!activeCharId) { text = '需选择角色'; }
        else {
          const char = await api.getCharacter(activeCharId).catch(() => null);
          if (!char) { text = '角色加载失败'; }
          else if (entryId === 'sys-char-core') text = char.core || char.name || '';
          else if (entryId === 'sys-char-desc') text = char.persona || char.description || '';
          else text = char.sample || char.sampleDialogue || '';
        }
      } else if (entryId === 'sys-wbpre' || entryId === 'sys-wbpost') {
        if (!activeCharId) { text = '需选择角色'; }
        else {
          const entries = await api.getWbEntries(activeCharId).catch(() => []);
          text = Array.isArray(entries) ? entries.map(e => e.content || '').filter(Boolean).join('\n---\n') : '';
        }
      } else if (entryId === 'sys-memories') {
        if (!activeCharId) { text = '需选择角色'; }
        else {
          const mems = await api.getMemories(activeCharId).catch(() => []);
          text = Array.isArray(mems) ? mems.map(m => m.content || m.text || '').filter(Boolean).join('\n') : '';
        }
      } else if (entryId === 'sys-summaries') {
        if (!activeCharId) { text = '需选择角色'; }
        else {
          const sums = await api.getSummaries(activeCharId).catch(() => []);
          text = Array.isArray(sums) ? sums.map(s => s.content || s.text || '').filter(Boolean).join('\n---\n') : '';
        }
      } else if (entryId === 'sys-user-desc') {
        const data = await api.getPersonas().catch(() => ({}));
        const { personas = [], activePersonaId, userProfile } = Array.isArray(data) ? { personas: data } : data;
        const activePersona = activePersonaId ? personas.find(p => p.id === activePersonaId) : null;
        if (activePersona) {
          text = [activePersona.name, activePersona.description].filter(Boolean).join('\n');
        } else if (userProfile?.name) {
          text = [userProfile.name, userProfile.description].filter(Boolean).join('\n');
        } else {
          text = '（无激活命格）';
        }
      } else if (entryId === 'sys-history') {
        if (!activeCharId) { text = '需选择角色'; }
        else {
          const count = item?.historyCount || 20;
          const msgs = await api.getMessages(activeCharId).catch(() => []);
          const recent = Array.isArray(msgs)
            ? msgs.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)).slice(-count)
            : [];
          text = recent.map(m => `${m.sender === 'user' ? '用户' : '角色'}：${m.content}`).join('\n');
        }
      } else if (entryId === 'sys-life') {
        if (!activeCharId) { text = '需选择角色'; }
        else {
          const logs = await api.getLifeLogs(activeCharId).catch(() => []);
          text = Array.isArray(logs) ? logs.map(l => l.content || '').filter(Boolean).join('\n---\n') : '';
          if (!text) text = '（暂无生活记录）';
        }
      } else if (entryId === 'sys-dreams') {
        if (!activeCharId) { text = '需选择角色'; }
        else {
          const dreams = await api.getDreams(activeCharId).catch(() => []);
          text = Array.isArray(dreams) ? dreams.map(d => d.content || d.title || '').filter(Boolean).join('\n---\n') : '';
          if (!text) text = '（暂无梦境记录）';
        }
      } else if (entryId === 'sys-syspre' || entryId === 'sys-syspost' || entryId === 'sys-tools' || entryId === 'sys-scene') {
        text = item?.content || '（暂无内容）';
      } else {
        text = '（系统自动填充）';
      }
      setResolvedContent(prev => ({ ...prev, [entryId]: { text: text || '', loading: false } }));
    } catch (e) {
      setResolvedContent(prev => ({ ...prev, [entryId]: { text: `加载失败: ${e.message}`, loading: false } }));
    }
  }, [activeCharId]);

  const openSlotEdit = useCallback((item, slot) => {
    setEditSlotItem({ item, slot });
    resolveSlotContent(item.entryId, item);
  }, [resolveSlotContent]);

  const saveSlotEdit = useCallback((entryId, patch) => {
    configItem(entryId, patch);
    setEditSlotItem(null);
  }, [configItem]);

  // When active character or active preset changes, reset resolution cache
  useEffect(() => {
    resolvedQueueRef.current = {};
    setResolvedContent({});
  }, [activeCharId, activePresetId]);

  // Auto-resolve all enabled non-editable system slots (so token total is populated without manual expand)
  useEffect(() => {
    if (!activeCharId) return;
    contextItems
      .filter(item => item.enabled && SYSTEM_SLOTS[item.entryId] && !SYSTEM_SLOTS[item.entryId].editable)
      .forEach(item => resolveSlotContent(item.entryId, item));
  }, [activeCharId, contextItems, resolveSlotContent]);

  // ── 自定义条目 CRUD ────────────────────────────────────────────────────
  const openEdit = (entry) => {
    if (entry) {
      setEditEntry(entry);
      setEditForm({ name: entry.name, content: entry.content || '', role: entry.role || 'system', maxTokens: entry.maxTokens || '' });
    } else {
      setEditEntry('new');
      setEditForm({ name: '', content: '', role: 'system', maxTokens: '' });
    }
  };

  const saveEntry = async () => {
    if (!editForm.name.trim()) return;
    const data = {
      ...editForm,
      maxTokens: editForm.maxTokens ? parseInt(editForm.maxTokens) : null,
    };
    try {
      if (editEntry === 'new') {
        const created = await api.createEntry(data);
        setUserEntries(prev => [...prev, created]);
        // 自动加到当前上下文
        addToContext(created.id);
      } else {
        const updated = await api.updateEntry(editEntry.id, data);
        setUserEntries(prev => prev.map(e => e.id === editEntry.id ? updated : e));
      }
    } catch (err) { setMsg(`保存失败：${err.message}`); }
    setEditEntry(null);
  };

  const deleteEntry = async (id) => {
    try {
      await api.deleteEntry(id);
      setUserEntries(prev => prev.filter(e => e.id !== id));
      removeFromContext(id);
    } catch (err) { setMsg(`删除失败：${err.message}`); }
  };

  // ── 总结提示词 ─────────────────────────────────────────────────────────
  const saveSpKey = async (key, value) => {
    const next = { ...summaryPrompts, [key]: value };
    setSummaryPrompts(next);
    setSpSaving(true);
    try { await api.saveSummaryPrompts({ [key]: value }); } catch {}
    finally { setSpSaving(false); }
  };

  // ── 导出/导入 ──────────────────────────────────────────────────────────
  const exportPreset = () => {
    const ids = new Set(contextItems.map(i => i.entryId));
    const data = {
      preset: activePreset,
      entries: userEntries.filter(e => ids.has(e.id)),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${activePreset?.name || 'preset'}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result as string);
        if (data.preset) {
          const imp = await api.createPreset({ ...data.preset, name: `${data.preset.name}(导入)` });
          setPresets(prev => [...prev, imp]);
          await activatePreset(imp.id);
        }
        if (data.entries?.length) {
          const newEs = await Promise.all(data.entries.map(en => api.createEntry(en).catch(() => null)));
          setUserEntries(prev => [...prev, ...newEs.filter(Boolean)]);
        }
      } catch (err) { setMsg(`导入失败：${err.message}`); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── 渲染 ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col h-full bg-gray-50 items-center justify-center gap-3 text-gray-400">
        <Loader2 size={24} className="animate-spin" />
        <p className="text-sm">加载中…</p>
      </div>
    );
  }

  const usedSlotIds = new Set(contextItems.map(i => i.entryId));
  const unusedSlots = ALL_SLOT_IDS.filter(id => !usedSlotIds.has(id));
  const unusedEntries = userEntries.filter(e => !usedSlotIds.has(e.id));

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* ── Header ── */}
      <div className="h-14 bg-white border-b flex items-center px-3 shadow-sm shrink-0 gap-2">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full shrink-0">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <span className="font-bold text-gray-800">上下文</span>
        <span className="text-xs text-gray-400 ml-1">流水线</span>
        {msg && (
          <span className={`ml-auto text-xs px-2 py-1 rounded shrink-0 ${msg.includes('失败') ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>
            {msg}
          </span>
        )}
      </div>

      {/* ── Preset Bar ── */}
      <div className="bg-white border-b px-3 py-2 flex items-center gap-1.5 shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <select
            value={activePreset?.id || ''}
            onChange={e => activatePreset(e.target.value)}
            className="flex-1 min-w-0 text-sm border rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {activePreset && (
            <span className={`text-[10px] px-2 py-1 rounded-full shrink-0 font-medium ${
              activePreset.presetType === 'summary' ? 'bg-emerald-100 text-emerald-600'
            : activePreset.presetType === 'dream'   ? 'bg-indigo-100 text-indigo-600'
            : 'bg-blue-100 text-blue-600'}`}>
              {activePreset.presetType === 'summary' ? '总结' : activePreset.presetType === 'dream' ? '梦境' : '聊天'}
            </span>
          )}
        </div>
        <button onClick={() => setShowNewPresetModal(true)} title="新建" className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
          <Plus size={16} />
        </button>
        <button onClick={exportPreset} title="导出" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg text-[11px] font-bold">出</button>
        <label title="导入" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg text-[11px] font-bold cursor-pointer">
          入<input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        <button onClick={deletePreset} disabled={presets.length <= 1} title="删除"
          className="w-8 h-8 flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-25">
          <Trash2 size={14} />
        </button>
      </div>

      {/* ── Token 摘要条 ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-3 py-1.5 flex items-center gap-2 shrink-0">
        <Layers size={12} className="text-blue-400 shrink-0" />
        <span className="text-[11px] text-blue-600 flex-1">
          <span className="font-semibold">{contextItems.filter(i => i.enabled).length}</span> 个槽位激活
          &nbsp;·&nbsp;自定义条目约 <span className="font-semibold">{estimatedTotal}</span> tokens
        </span>
        {estimatedTotal > TOKEN_WARN && (
          <span className="flex items-center gap-1 text-[10px] text-orange-500">
            <AlertTriangle size={11} /> 超出建议
          </span>
        )}
      </div>

      {/* ── Context Budget Slider ── */}
      <ContextBudgetSlider
        maxTokens={maxContextTokens}
        onChangeMaxTokens={handleSetMaxContextTokens}
        totalEstimatedTokens={estimatedTotal}
      />

      {/* ── Tabs ── */}
      <div className="flex bg-white border-b shrink-0">
        {[
          ['pipeline', `流水线 (${contextItems.length})`],
          ['library', `条目库 (${userEntries.length})`],
          ['summary', '总结提示词'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Main ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ════ PIPELINE TAB ════ */}
        {tab === 'pipeline' && (
          <div className="p-3 pb-20">
            {/* 序号说明 */}
            <p className="text-[10px] text-gray-400 mb-3 px-1">
              条目按顺序依次注入，组成最终发给 AI 的 messages 数组。拖动可调序。
            </p>

            {contextItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <Layers size={36} className="opacity-30" />
                <p className="text-sm">暂无条目，点击下方添加</p>
              </div>
            ) : (
              <Reorder.Group
                as="div"
                axis="y"
                values={contextItems}
                onReorder={newOrder => patchActivePreset({ contextItems: newOrder })}
                className="space-y-2"
              >
                {contextItems.map((item, idx) => {
                  const slot = SYSTEM_SLOTS[item.entryId];
                  const entry = userEntriesMap[item.entryId];
                  return (
                    <Reorder.Item as="div" key={item.entryId} value={item}>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-gray-300 mt-3.5 w-4 shrink-0 text-right select-none">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          {slot ? (
                            <SystemSlotRow
                              item={item}
                              slot={slot}
                              onToggle={toggleEnabled}
                              onRemove={removeFromContext}
                              onEditOpen={openSlotEdit}
                              resolvedInfo={resolvedContent[item.entryId]}
                            />
                          ) : entry ? (
                            <CustomEntryRow
                              item={item}
                              entry={entry}
                              onToggle={toggleEnabled}
                              onRemove={removeFromContext}
                              onEdit={openEdit}
                            />
                          ) : (
                            <div className="flex items-center justify-between px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-500">
                              <span>条目 {item.entryId} 已丢失</span>
                              <button onClick={() => removeFromContext(item.entryId)} className="hover:text-red-700"><X size={13} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            )}

            {/* 添加条目按钮 */}
            <button
              onClick={() => setShowLibrary(true)}
              className="mt-4 w-full py-3 rounded-xl border-2 border-dashed border-blue-200 text-blue-500 text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={15} />
              添加条目 / 系统槽
            </button>
          </div>
        )}

        {/* ════ LIBRARY TAB ════ */}
        {tab === 'library' && (
          <div className="p-3 space-y-5">
            {/* 系统槽 */}
            <section>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">系统槽</p>
              <div className="space-y-1.5">
                {ALL_SLOT_IDS.map(id => {
                  const slot = SYSTEM_SLOTS[id];
                  const inCtx = usedSlotIds.has(id);
                  const colors = SLOT_COLOR_CLASSES[slot.color] || SLOT_COLOR_CLASSES.indigo;
                  return (
                    <div key={id} className={`flex items-center px-3 py-2.5 bg-white rounded-xl border ${inCtx ? colors.border : 'border-gray-100'} shadow-sm gap-2`}>
                      {slot.icon && (() => { const Ic = slot.icon; return <Ic size={16} className={`shrink-0 ${colors.text}`} />; })()}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700">{slot.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{slot.desc}</p>
                      </div>
                      {slot.defaultRole && <RoleBadge role={slot.defaultRole} />}
                      <button
                        onClick={() => addToContext(id)}
                        disabled={inCtx}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors ${inCtx ? 'bg-gray-100 text-gray-400 cursor-default' : `${colors.bg} ${colors.text} hover:opacity-80`}`}
                      >
                        {inCtx ? '已添加' : '添加'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 自定义条目 */}
            <section>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">自定义条目</p>
                <button onClick={() => openEdit(null)} className="flex items-center gap-1 text-xs text-blue-500 font-semibold hover:text-blue-700">
                  <Plus size={12} /> 新建
                </button>
              </div>
              {userEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">暂无自定义条目，点击上方新建</div>
              ) : (
                <div className="space-y-1.5">
                  {userEntries.map(entry => {
                    const inCtx = usedSlotIds.has(entry.id);
                    const role = entry.role || 'system';
                    const tokens = estimateTokens(entry.content);
                    return (
                      <div key={entry.id} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 flex items-center gap-2 shadow-sm">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${ROLE_MAP[role]?.dot || 'bg-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{entry.name}</p>
                          {entry.content && <p className="text-[10px] text-gray-400 truncate">{entry.content}</p>}
                        </div>
                        <RoleBadge role={role} />
                        <TokenBadge tokens={tokens} />
                        <button onClick={() => openEdit(entry)} className="p-1 text-gray-300 hover:text-blue-500 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteEntry(entry.id)} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                        <button
                          onClick={() => addToContext(entry.id)}
                          disabled={inCtx}
                          className={`text-xs px-2.5 py-1 rounded-lg font-medium shrink-0 transition-colors ${inCtx ? 'bg-gray-100 text-gray-400 cursor-default' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                        >
                          {inCtx ? '已添加' : '添加'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ════ SUMMARY PROMPTS TAB ════ */}
        {tab === 'summary' && (
          <div className="p-3 space-y-4">
            <p className="text-xs text-gray-400 leading-relaxed px-1">
              自定义各类总结的 AI 提示词。留空时使用内置默认提示词。
              {spSaving && <span className="ml-2 text-blue-400">保存中…</span>}
            </p>
            {SUMMARY_PROMPT_TYPES.map(({ key, label, desc, placeholder }) => (
              <div key={key} className="bg-white rounded-xl border shadow-sm p-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                  <span className="text-[10px] text-gray-400">{desc}</span>
                </div>
                <textarea
                  value={summaryPrompts[key] || ''}
                  onChange={e => setSummaryPrompts(prev => ({ ...prev, [key]: e.target.value }))}
                  onBlur={e => saveSpKey(key, e.target.value)}
                  placeholder={placeholder}
                  rows={3}
                  className="w-full text-xs text-gray-700 border rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 leading-relaxed placeholder:text-gray-300"
                />
                {summaryPrompts[key] && (
                  <button onClick={() => saveSpKey(key, '')} className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">
                    恢复默认
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════ 添加槽位底部弹窗 ════ */}
      <AnimatePresence>
        {showLibrary && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 flex items-end z-50"
            onClick={() => setShowLibrary(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="w-full bg-white rounded-t-2xl p-4 max-h-[70%] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">添加到流水线</h3>
                <button onClick={() => setShowLibrary(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4">
                {unusedSlots.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">系统槽</p>
                    <div className="space-y-1.5">
                      {unusedSlots.map(id => {
                        const slot = SYSTEM_SLOTS[id];
                        const colors = SLOT_COLOR_CLASSES[slot.color] || SLOT_COLOR_CLASSES.indigo;
                        return (
                          <button key={id} onClick={() => addToContext(id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${colors.border} ${colors.bg} text-left`}>
                            {slot.icon && (() => { const Ic = slot.icon; return <Ic size={15} className={`shrink-0 ${colors.text}`} />; })()}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${colors.text}`}>{slot.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{slot.desc}</p>
                            </div>
                            <Plus size={14} className={colors.text} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {unusedEntries.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">自定义条目</p>
                    <div className="space-y-1.5">
                      {unusedEntries.map(entry => (
                        <button key={entry.id} onClick={() => addToContext(entry.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-100 bg-white text-left">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${ROLE_MAP[entry.role || 'system']?.dot || 'bg-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700">{entry.name}</p>
                            {entry.content && <p className="text-[10px] text-gray-400 truncate">{entry.content}</p>}
                          </div>
                          <Plus size={14} className="text-gray-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => { setShowLibrary(false); openEdit(null); }}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-500 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> 新建自定义条目
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ 编辑条目弹窗 ════ */}
      <AnimatePresence>
        {editEntry !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 flex items-end z-50"
            onClick={() => setEditEntry(null)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="w-full bg-white rounded-t-2xl px-5 pt-5 pb-6 max-h-[90%] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">{editEntry === 'new' ? '新建条目' : '编辑条目'}</h3>
                <button onClick={() => setEditEntry(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pb-2">
                <div>
                  <label className="text-xs text-gray-500 font-semibold">条目名称</label>
                  <input
                    type="text" value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="为这个条目起个名字…"
                    className="w-full mt-1.5 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    autoFocus
                  />
                </div>

                {/* 角色选择 */}
                <div>
                  <label className="text-xs text-gray-500 font-semibold">发送角色</label>
                  <div className="flex gap-2 mt-1.5">
                    {ROLE_OPTIONS.map(r => (
                      <button key={r.value}
                        onClick={() => setEditForm(f => ({ ...f, role: r.value }))}
                        className={`flex-1 py-2 text-sm rounded-xl border font-medium transition-colors ${editForm.role === r.value ? `${r.badge} border-current` : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 内容 */}
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="text-xs text-gray-500 font-semibold">内容</label>
                    <span className="text-[10px] text-gray-400">
                      约 {estimateTokens(editForm.content)} tokens
                    </span>
                  </div>
                  <textarea
                    value={editForm.content}
                    onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="输入提示词内容…"
                    rows={7}
                    className="w-full mt-1.5 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none leading-relaxed"
                  />
                </div>

                {/* Token 上限 */}
                <div>
                  <label className="text-xs text-gray-500 font-semibold">Token 上限（可选）</label>
                  <input
                    type="number" min={0} max={32000} step={100}
                    value={editForm.maxTokens}
                    onChange={e => setEditForm(f => ({ ...f, maxTokens: e.target.value }))}
                    placeholder="留空 = 不限制"
                    className="w-full mt-1.5 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>
              <button
                onClick={saveEntry}
                disabled={!editForm.name.trim()}
                className="mt-4 w-full py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 disabled:opacity-40 transition-colors"
              >
                {editEntry === 'new' ? '创建条目' : '保存修改'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ 系统槽编辑弹窗 ════ */}
      <AnimatePresence>
        {editSlotItem && (
          <SystemSlotEditModal
            item={editSlotItem.item}
            slot={editSlotItem.slot}
            resolvedInfo={resolvedContent[editSlotItem.item.entryId]}
            onSave={saveSlotEdit}
            onClose={() => setEditSlotItem(null)}
          />
        )}
      </AnimatePresence>

      {/* ════ 新建预设类型选择 ════ */}
      <AnimatePresence>
        {showNewPresetModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 flex items-end z-50"
            onClick={() => setShowNewPresetModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="w-full bg-white rounded-t-2xl px-5 pt-5 pb-8 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">新建预设</h3>
                <button onClick={() => setShowNewPresetModal(false)} className="p-1 text-gray-400"><X size={18} /></button>
              </div>
              <p className="text-xs text-gray-400 mb-4">选择预设类型，将使用对应的默认槽位顺序。</p>
              <div className="space-y-2.5">
                <button
                  onClick={() => newPreset('chat')}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-blue-200 bg-blue-50 text-left hover:bg-blue-100 transition-colors"
                >
                  <MessageSquare size={20} className="text-blue-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-blue-700 text-sm">聊天预设</p>
                    <p className="text-[11px] text-blue-400 mt-0.5">15 个槽位 · 包含梦境、近期生活、历史摘要</p>
                  </div>
                </button>
                <button
                  onClick={() => newPreset('summary')}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-left hover:bg-emerald-100 transition-colors"
                >
                  <ScrollText size={20} className="text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-700 text-sm">总结预设</p>
                    <p className="text-[11px] text-emerald-400 mt-0.5">12 个槽位 · 历史深度 100 · 为 AI 总结优化</p>
                  </div>
                </button>
                <button
                  onClick={() => newPreset('dream')}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-indigo-200 bg-indigo-50 text-left hover:bg-indigo-100 transition-colors"
                >
                  <Moon size={20} className="text-indigo-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-indigo-700 text-sm">梦境预设</p>
                    <p className="text-[11px] text-indigo-400 mt-0.5">6 个槽位 · 聚焦角色内心 · 用于 AI 梦境生成</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FilesApp;
