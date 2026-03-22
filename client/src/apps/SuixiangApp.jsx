/**
 * 随想 — 卡片式随笔
 *
 * 主视图：随想卡片列表（磁贴/卡片样式）
 *   - 每张卡片代表一个"话题"，显示标题、条目数、最新内容预览
 *   - 右上角 + 新建卡片
 *   - 点击卡片 → 卡片详情（条目时间线 + 底部输入框）
 *   - 长按（右键）删除卡片
 */
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Plus, Trash2, Check, Pin, PinOff, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const api = (path, opts) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

const MOOD_EMOJI = {
  happy:  { emoji: '😊', label: '愉快' },
  ok:     { emoji: '😐', label: '平静' },
  sad:    { emoji: '😔', label: '低落' },
  think:  { emoji: '🤔', label: '深思' },
  love:   { emoji: '💕', label: '温柔' },
};

const CARD_COLORS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#22c55e',
  '#f59e0b', '#f97316', '#ef4444', '#ec4899',
  '#8b5cf6', '#14b8a6',
];

// ── 新建卡片弹窗 ──────────────────────────────────────────────────────────────
const NewCardModal = ({ onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(CARD_COLORS[0]);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const handleCreate = async () => {
    const t = title.trim() || '新随想';
    await onCreate({ title: t, color });
    onClose();
  };

  return (
    <motion.div
      className="absolute inset-0 z-30 bg-black/40 flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full bg-white rounded-t-3xl p-5"
        initial={{ y: 200 }}
        animate={{ y: 0 }}
        exit={{ y: 200 }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-800 mb-4">新建随想卡片</h3>
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="给这个想法起个名字…"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 mb-4"
        />
        <p className="text-xs text-gray-400 mb-2">选择颜色</p>
        <div className="flex gap-2 flex-wrap mb-5">
          {CARD_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2' : ''}`}
              style={{ backgroundColor: c, ...(color === c ? { ringColor: c } : {}) }}
            />
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500">取消</button>
          <button
            onClick={handleCreate}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            创建
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── 卡片详情（条目时间线） ──────────────────────────────────────────────────────
const CardDetail = ({ card, onBack, onCardUpdate }) => {
  const [entries, setEntries] = useState([]);
  const [input, setInput] = useState('');
  const [mood, setMood] = useState(null);
  const [sending, setSending] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editContent, setEditContent] = useState('');
  const bottomRef = useRef(null);

  const loadEntries = async () => {
    const data = await api(`/suixiang/cards/${card.id}/entries`);
    setEntries(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadEntries(); }, [card.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [entries.length]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api(`/suixiang/cards/${card.id}/entries`, {
        method: 'POST',
        body: JSON.stringify({ content: input.trim(), mood }),
      });
      setInput('');
      setMood(null);
      await loadEntries();
      onCardUpdate();
    } finally { setSending(false); }
  };

  const handleDeleteEntry = async (id) => {
    await api(`/suixiang/entries/${id}`, { method: 'DELETE' });
    await loadEntries();
    onCardUpdate();
  };

  const handleUpdateEntry = async (id) => {
    if (!editContent.trim()) return;
    await api(`/suixiang/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: editContent.trim() }),
    });
    setEditingEntry(null);
    await loadEntries();
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      className="absolute inset-0 flex flex-col bg-white z-10"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* 顶栏 */}
      <div className="h-14 flex items-center px-4 gap-3 shrink-0 border-b"
        style={{ background: card.color + '15' }}>
        <button onClick={onBack} className="p-2 rounded-full hover:bg-black/5">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: card.color }} />
        <span className="font-bold text-gray-800 flex-1 truncate">{card.title}</span>
        <span className="text-xs text-gray-400">{entries.length} 条</span>
      </div>

      {/* 条目列表 */}
      <div className="flex-1 overflow-y-auto px-5 py-4"
        style={{
          backgroundImage: 'radial-gradient(circle, #d1d5db 0.8px, transparent 0.8px)',
          backgroundSize: '22px 22px',
          backgroundColor: '#fafaf9',
        }}>
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-300">
            <Edit3 size={36} strokeWidth={1} />
            <p className="text-sm mt-3">写下你的第一个想法</p>
          </div>
        )}
        {entries.map((entry, idx) => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative"
          >
            {editingEntry === entry.id ? (
              <div className="py-4 bg-white/80 backdrop-blur rounded-xl px-4 mb-1">
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  autoFocus
                  className="w-full bg-transparent text-sm text-gray-800 outline-none resize-none leading-relaxed min-h-[60px]"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setEditingEntry(null)} className="text-xs text-gray-400 px-2 py-1">取消</button>
                  <button
                    onClick={() => handleUpdateEntry(entry.id)}
                    className="text-xs font-semibold text-white px-3 py-1 rounded-full"
                    style={{ backgroundColor: card.color }}
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 relative">
                {/* 操作按钮 */}
                <div className="absolute top-4 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingEntry(entry.id); setEditContent(entry.content); }}
                    className="p-1 hover:bg-white/80 rounded-full"
                  >
                    <Edit3 size={11} className="text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="p-1 hover:bg-red-50 rounded-full"
                  >
                    <Trash2 size={11} className="text-red-400" />
                  </button>
                </div>
                {/* 内容 */}
                <p className="text-[14px] text-gray-800 leading-[1.9] whitespace-pre-wrap pr-10">{entry.content}</p>
                {/* 右对齐署名行 */}
                <div className="flex justify-end items-center gap-2 mt-1.5 text-[11px] text-gray-400 italic">
                  {entry.mood && MOOD_EMOJI[entry.mood] && (
                    <span className="not-italic text-xs">{MOOD_EMOJI[entry.mood].emoji}</span>
                  )}
                  <span>—— {formatTime(entry.createdAt)}</span>
                </div>
                {/* 分割线（最后一条不显示） */}
                {idx < entries.length - 1 && (
                  <div className="mt-3 border-b border-gray-200/70" />
                )}
              </div>
            )}
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 心情选择 */}
      <div className="px-4 pt-2 flex gap-2 shrink-0">
        {Object.entries(MOOD_EMOJI).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setMood(mood === key ? null : key)}
            className={`text-base px-2 py-1 rounded-full transition-all ${mood === key ? 'bg-indigo-100 scale-110' : 'opacity-50 hover:opacity-80'}`}
          >
            {cfg.emoji}
          </button>
        ))}
      </div>

      {/* 输入框 */}
      <div className="px-4 pb-4 pt-2 shrink-0 flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(); }}
          placeholder="写下新的想法… (Ctrl+Enter 发送)"
          rows={2}
          className="flex-1 border border-gray-200 rounded-2xl px-3 py-2.5 text-sm outline-none focus:border-indigo-300 resize-none leading-relaxed"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-10 h-10 rounded-2xl flex items-center justify-center self-end shrink-0 disabled:opacity-40"
          style={{ backgroundColor: card.color }}
        >
          <Check size={16} color="white" />
        </button>
      </div>
    </motion.div>
  );
};

// ── 主视图 ────────────────────────────────────────────────────────────────────
export default function SuixiangApp({ onBack }) {
  const [cards, setCards] = useState([]);
  const [showNewCard, setShowNewCard] = useState(false);
  const [openCard, setOpenCard] = useState(null);
  const [longPressTarget, setLongPressTarget] = useState(null);

  const loadCards = async () => {
    const data = await api('/suixiang/cards');
    setCards(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadCards(); }, []);

  const handleCreateCard = async (data) => {
    await api('/suixiang/cards', { method: 'POST', body: JSON.stringify(data) });
    await loadCards();
  };

  const handleDeleteCard = async (id) => {
    if (!confirm('删除这张卡片及其所有内容？')) return;
    await api(`/suixiang/cards/${id}`, { method: 'DELETE' });
    setLongPressTarget(null);
    await loadCards();
  };

  const handlePinCard = async (card) => {
    await api(`/suixiang/cards/${card.id}`, {
      method: 'PUT',
      body: JSON.stringify({ pinned: !card.pinned }),
    });
    setLongPressTarget(null);
    await loadCards();
  };

  const formatRelative = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 relative overflow-hidden">
      {/* 顶栏 */}
      <div className="h-14 bg-white border-b flex items-center px-4 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <span className="font-bold text-gray-800 flex-1 ml-1">随想</span>
        <button
          onClick={() => setShowNewCard(true)}
          className="w-9 h-9 bg-indigo-500 rounded-full flex items-center justify-center"
        >
          <Plus size={18} color="white" />
        </button>
      </div>

      {/* 卡片列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300">
            <Edit3 size={48} strokeWidth={1} />
            <p className="text-sm">点击右上角 + 创建你的第一张随想卡片</p>
          </div>
        ) : (
          <div className="columns-2 gap-3 space-y-3">
            {cards.map((card) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="break-inside-avoid mb-3"
              >
                <button
                  className="w-full rounded-2xl overflow-hidden text-left shadow-sm active:scale-95 transition-transform"
                  onClick={() => setOpenCard(card)}
                  onContextMenu={e => { e.preventDefault(); setLongPressTarget(card.id); }}
                >
                  {/* 色条 */}
                  <div className="h-1.5" style={{ backgroundColor: card.color }} />
                  <div className="bg-white p-3">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-sm font-bold text-gray-800 leading-tight flex-1 mr-1">{card.title}</span>
                      {card.pinned && <Pin size={11} className="text-gray-400 shrink-0 mt-0.5" />}
                    </div>
                    {card.latestEntry && (
                      <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed mb-2">
                        {card.latestEntry.content}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-300">{card.entryCount} 条</span>
                      <span className="text-[10px] text-gray-300">
                        {formatRelative(card.updatedAt)}
                      </span>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 长按操作菜单 */}
      <AnimatePresence>
        {longPressTarget && (() => {
          const card = cards.find(c => c.id === longPressTarget);
          if (!card) return null;
          return (
            <motion.div
              className="absolute inset-0 z-20 bg-black/40 flex items-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLongPressTarget(null)}
            >
              <motion.div
                className="w-full bg-white rounded-t-3xl p-5"
                initial={{ y: 200 }}
                animate={{ y: 0 }}
                exit={{ y: 200 }}
                onClick={e => e.stopPropagation()}
              >
                <p className="font-bold text-gray-800 mb-4 text-center">{card.title}</p>
                <button
                  onClick={() => handlePinCard(card)}
                  className="flex items-center gap-3 w-full py-3 px-2 hover:bg-gray-50 rounded-xl"
                >
                  {card.pinned ? <PinOff size={18} className="text-gray-500" /> : <Pin size={18} className="text-gray-500" />}
                  <span className="text-sm text-gray-700">{card.pinned ? '取消置顶' : '置顶'}</span>
                </button>
                <button
                  onClick={() => handleDeleteCard(card.id)}
                  className="flex items-center gap-3 w-full py-3 px-2 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 size={18} className="text-red-400" />
                  <span className="text-sm text-red-500">删除卡片</span>
                </button>
                <button
                  onClick={() => setLongPressTarget(null)}
                  className="w-full py-3 mt-1 text-sm text-gray-400 text-center"
                >
                  取消
                </button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* 新建卡片弹窗 */}
      <AnimatePresence>
        {showNewCard && (
          <NewCardModal onClose={() => setShowNewCard(false)} onCreate={handleCreateCard} />
        )}
      </AnimatePresence>

      {/* 卡片详情 */}
      <AnimatePresence>
        {openCard && (
          <CardDetail
            card={openCard}
            onBack={() => setOpenCard(null)}
            onCardUpdate={loadCards}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
