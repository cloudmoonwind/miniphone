import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Edit3, Trash2 } from 'lucide-react';
import { MODAL_BG, MODAL_BLUR, MODAL_BORDER, MODAL_MAX_HEIGHT } from './params';
import { Card, Entry, api } from './types';
import { formatTime } from './utils';

const MOOD_EMOJI: Record<string, { emoji: string; label: string }> = {
  happy: { emoji: '😊', label: '愉快' },
  ok:    { emoji: '😐', label: '平静' },
  sad:   { emoji: '😔', label: '低落' },
  think: { emoji: '🤔', label: '深思' },
  love:  { emoji: '💕', label: '温柔' },
};

interface Props {
  card: Card;
  onClose: () => void;
  onCardUpdate: () => void;
}

export default function EntryModal({ card, onClose, onCardUpdate }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput]     = useState('');
  const [mood, setMood]       = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const data = await api(`/suixiang/cards/${card.id}/entries`);
    setEntries(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load(); }, [card.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [entries.length]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api(`/suixiang/cards/${card.id}/entries`, {
        method: 'POST',
        body: JSON.stringify({ content: input.trim(), mood }),
      });
      setInput(''); setMood(null);
      await load();
      onCardUpdate();
    } finally { setSending(false); }
  };

  const handleDelete = async (id: string) => {
    await api(`/suixiang/entries/${id}`, { method: 'DELETE' });
    await load(); onCardUpdate();
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    await api(`/suixiang/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: editContent.trim() }),
    });
    setEditingId(null);
    await load();
  };

  return (
    // 遮罩层
    <motion.div
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(10,40,20,0.35)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-end',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* 弹窗主体 */}
      <motion.div
        style={{
          width: '100%',
          maxHeight: MODAL_MAX_HEIGHT,
          background: MODAL_BG,
          backdropFilter: `blur(${MODAL_BLUR})`,
          WebkitBackdropFilter: `blur(${MODAL_BLUR})`,
          border: MODAL_BORDER,
          borderBottom: 'none',
          borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 35 }}
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div style={{
          padding: '16px 18px 12px',
          borderBottom: '1px solid rgba(160,140,100,0.2)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          {/* 装饰竖线 */}
          <div style={{
            width: 3, height: 18, borderRadius: 2,
            background: card.color || '#5a9e72', flexShrink: 0,
          }} />
          <span style={{
            flex: 1, fontSize: 15, fontWeight: 700,
            color: '#3a2e1e',
            fontFamily: "'Noto Serif SC', 'Songti SC', serif",
            letterSpacing: '0.04em',
          }}>
            {card.title}
          </span>
          <span style={{ fontSize: 11, color: '#a09070', marginRight: 4 }}>
            {entries.length} 条
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(160,140,100,0.15)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} color="#8a7a60" />
          </button>
        </div>

        {/* 条目列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px' }}>
          {entries.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '32px 0', gap: 8, color: '#c0b090',
            }}>
              <Edit3 size={32} strokeWidth={1} />
              <p style={{ fontSize: 13 }}>写下你的第一个想法</p>
            </div>
          )}
          {entries.map((entry, idx) => (
            <div key={entry.id} style={{ position: 'relative' }}>
              {editingId === entry.id ? (
                // 编辑态
                <div style={{
                  padding: '10px 12px', marginBottom: 2,
                  background: 'rgba(255,255,240,0.7)', borderRadius: 10,
                }}>
                  <textarea
                    autoFocus
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    style={{
                      width: '100%', background: 'transparent',
                      border: 'none', outline: 'none',
                      fontSize: 13, color: '#3a2e1e',
                      lineHeight: 1.8, resize: 'none', minHeight: 56,
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{ fontSize: 12, color: '#a09070', background: 'none', border: 'none', cursor: 'pointer' }}
                    >取消</button>
                    <button
                      onClick={() => handleUpdate(entry.id)}
                      style={{
                        fontSize: 12, fontWeight: 600, color: '#fff',
                        background: card.color || '#5a9e72',
                        border: 'none', borderRadius: 20,
                        padding: '3px 12px', cursor: 'pointer',
                      }}
                    >保存</button>
                  </div>
                </div>
              ) : (
                // 展示态
                <div
                  className="group"
                  style={{ padding: '10px 0', position: 'relative' }}
                >
                  {/* 操作按钮（hover/active 显示）*/}
                  <div style={{
                    position: 'absolute', top: 10, right: 0,
                    display: 'flex', gap: 2, opacity: 0,
                  }}
                    className="entry-actions"
                  >
                    <button
                      onMouseDown={() => { setEditingId(entry.id); setEditContent(entry.content); }}
                      style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Edit3 size={11} color="#a09070" />
                    </button>
                    <button
                      onMouseDown={() => handleDelete(entry.id)}
                      style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Trash2 size={11} color="#c09080" />
                    </button>
                  </div>

                  <p style={{
                    fontSize: 13, color: '#3a2e1e', lineHeight: 1.85,
                    whiteSpace: 'pre-wrap', paddingRight: 32,
                    fontFamily: "'Noto Sans SC', sans-serif",
                  }}>
                    {entry.content}
                  </p>
                  <div style={{
                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                    gap: 6, marginTop: 4, fontSize: 11, color: '#b0a080', fontStyle: 'italic',
                  }}>
                    {entry.mood && MOOD_EMOJI[entry.mood] && (
                      <span style={{ fontStyle: 'normal' }}>{MOOD_EMOJI[entry.mood].emoji}</span>
                    )}
                    <span>—— {formatTime(entry.createdAt)}</span>
                  </div>
                  {/* 分割线 */}
                  {idx < entries.length - 1 && (
                    <div style={{
                      marginTop: 8,
                      borderBottom: '1px solid rgba(160,140,100,0.18)',
                    }} />
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 心情选择 */}
        <div style={{
          padding: '6px 18px 2px',
          display: 'flex', gap: 6, flexShrink: 0,
        }}>
          {Object.entries(MOOD_EMOJI).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setMood(mood === key ? null : key)}
              style={{
                fontSize: 16, padding: '2px 6px', borderRadius: 20,
                background: mood === key ? 'rgba(90,158,114,0.15)' : 'none',
                border: 'none', cursor: 'pointer',
                transform: mood === key ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.15s ease',
                opacity: mood && mood !== key ? 0.45 : 1,
              }}
            >
              {cfg.emoji}
            </button>
          ))}
        </div>

        {/* 输入区 */}
        <div style={{
          padding: '8px 18px 16px',
          display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0,
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend(); }}
            placeholder="写下新的想法…"
            rows={2}
            style={{
              flex: 1,
              background: 'rgba(255,255,240,0.6)',
              border: '1px solid rgba(160,140,100,0.3)',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 13,
              color: '#3a2e1e',
              lineHeight: 1.7,
              outline: 'none',
              resize: 'none',
              fontFamily: "'Noto Sans SC', sans-serif",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: input.trim() ? (card.color || '#5a9e72') : 'rgba(160,140,100,0.2)',
              border: 'none', cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.2s ease',
            }}
          >
            <Check size={15} color="white" />
          </button>
        </div>
      </motion.div>

      {/* 操作按钮 hover 效果（CSS）*/}
      <style>{`
        .entry-actions { opacity: 0; transition: opacity 0.2s; }
        .group:hover .entry-actions { opacity: 1; }
      `}</style>
    </motion.div>
  );
}
