/**
 * 日记 — 日历视图 + 沉浸式写作
 *
 * 设计：
 * - 月历视图：有记录的日期显示小点
 * - 点击日期展开当日记录列表
 * - 点击条目进入全屏写作模式
 * - 浮动"+"按钮创建今日新条目
 */
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, BookOpen, ArrowLeft, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const api = (path, opts) => fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const MOOD_EMOJI = {
  high:   { emoji: '😊', color: '#f59e0b', label: '很好' },
  ok:     { emoji: '😐', color: '#6b7280', label: '一般' },
  low:    { emoji: '😔', color: '#6366f1', label: '不好' },
  null:   { emoji: '·',  color: '#d1d5db', label: '不记录' },
};

// ── 月历视图 ────────────────────────────────────────────────────────────────
const MonthCalendar = ({ year, month, entries, selectedDate, onSelectDate }) => {
  const datesWithEntries = new Set(entries.map(e => e.date));
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateStr = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-[10px] text-gray-400 py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} />;
          const ds = dateStr(d);
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          const hasEntry = datesWithEntries.has(ds);
          return (
            <button
              key={ds}
              onClick={() => onSelectDate(isSelected ? null : ds)}
              className={`flex flex-col items-center justify-center h-9 rounded-xl transition-all ${
                isSelected ? 'bg-indigo-500 text-white' :
                isToday    ? 'bg-indigo-50 text-indigo-700 font-bold' :
                             'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className="text-xs leading-none">{d}</span>
              {hasEntry && (
                <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white/80' : 'bg-indigo-400'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── 写作界面 ──────────────────────────────────────────────────────────────────
const WritingView = ({ entry, date, onSave, onClose, onDelete }) => {
  const [title, setTitle]   = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '');
  const [mood, setMood]     = useState(entry?.mood ?? null);
  const [saving, setSaving] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    setTimeout(() => textRef.current?.focus(), 100);
  }, []);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try { await onSave({ title, content, mood, date }); }
    finally { setSaving(false); }
  };

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-amber-50 flex flex-col z-20"
    >
      {/* 顶栏 */}
      <div className="flex items-center px-4 py-3 shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full mr-1">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <span className="text-xs text-gray-400 flex-1">{displayDate}</span>
        {entry && (
          <button onClick={() => onDelete(entry)} className="p-2 hover:bg-red-50 rounded-full mr-1">
            <Trash2 size={16} className="text-gray-400 hover:text-red-400" />
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="flex items-center gap-1 bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-40"
        >
          <Check size={13} /> {saving ? '保存…' : '保存'}
        </button>
      </div>

      {/* 心情选择 */}
      <div className="flex gap-3 px-5 pb-2 shrink-0">
        {Object.entries(MOOD_EMOJI).map(([key, cfg]) => (
          key !== 'null' && (
            <button
              key={key}
              onClick={() => setMood(mood === key ? null : key)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-all ${
                mood === key ? 'ring-2' : 'opacity-50 hover:opacity-80'
              }`}
              style={{ backgroundColor: cfg.color + '22', color: cfg.color, ...(mood === key ? { ringColor: cfg.color } : {}) }}
            >
              {cfg.emoji} {cfg.label}
            </button>
          )
        ))}
      </div>

      {/* 标题 */}
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="标题（可选）"
        className="mx-5 mb-2 bg-transparent text-xl font-bold text-gray-800 outline-none placeholder-gray-300 shrink-0"
      />

      {/* 正文 */}
      <textarea
        ref={textRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="今天发生了什么…"
        className="flex-1 mx-5 bg-transparent text-sm text-gray-700 outline-none resize-none leading-relaxed placeholder-gray-300"
      />
    </motion.div>
  );
};

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function DiaryApp({ onBack }) {
  const today = new Date();
  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth());
  const [entries, setEntries]     = useState([]);
  const [selectedDate, setSelectedDate] = useState(today.toISOString().slice(0, 10));
  const [writingEntry, setWritingEntry] = useState(null); // entry object or 'new'
  const [writingDate, setWritingDate]   = useState(null);

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const load = async () => {
    const data = await api(`/diary?month=${monthStr}`);
    setEntries(Array.isArray(data) ? data : []);
  };

  useEffect(() => { load(); }, [monthStr]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const dayEntries = selectedDate
    ? entries.filter(e => e.date === selectedDate)
    : [];

  const handleSave = async (data) => {
    if (writingEntry && writingEntry !== 'new') {
      await api(`/diary/${writingEntry.id}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      await api('/diary', { method: 'POST', body: JSON.stringify(data) });
    }
    setWritingEntry(null);
    await load();
  };

  const handleDelete = async (entry) => {
    await api(`/diary/${entry.id}`, { method: 'DELETE' });
    setWritingEntry(null);
    await load();
  };

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {/* 顶栏 */}
      <div className="h-14 bg-white border-b flex items-center px-4 gap-2 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <BookOpen size={18} className="text-indigo-500" />
        <span className="font-bold text-gray-800 flex-1">日记</span>
        <button
          onClick={() => { setWritingEntry('new'); setWritingDate(selectedDate || today.toISOString().slice(0, 10)); }}
          className="flex items-center gap-1.5 bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full"
        >
          <Plus size={13} /> 新建
        </button>
      </div>

      {/* 月份导航 */}
      <div className="flex items-center px-4 py-3 shrink-0">
        <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={16} className="text-gray-500" />
        </button>
        <span className="flex-1 text-center text-sm font-bold text-gray-800">
          {year}年 {month + 1}月
        </span>
        <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-full">
          <ChevronRight size={16} className="text-gray-500" />
        </button>
      </div>

      {/* 月历 */}
      <div className="px-4 shrink-0">
        <MonthCalendar
          year={year} month={month}
          entries={entries}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* 分割线 */}
      <div className="mx-4 my-3 h-px bg-gray-100 shrink-0" />

      {/* 当日记录 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {selectedDate ? (
          <>
            <p className="text-xs font-semibold text-gray-400 mb-2">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
            {dayEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-300">
                <BookOpen size={32} />
                <p className="text-sm">这天没有记录</p>
                <button
                  onClick={() => { setWritingEntry('new'); setWritingDate(selectedDate); }}
                  className="text-xs text-indigo-400 underline mt-1"
                >
                  写点什么？
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {dayEntries.map(e => (
                  <button
                    key={e.id}
                    onClick={() => { setWritingEntry(e); setWritingDate(e.date); }}
                    className="w-full bg-amber-50 rounded-2xl px-4 py-3 text-left hover:bg-amber-100 transition-colors border border-amber-100"
                  >
                    {e.title && <p className="text-sm font-bold text-gray-800 mb-1">{e.title}</p>}
                    <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">{e.content}</p>
                    {e.mood && MOOD_EMOJI[e.mood] && (
                      <span className="text-xs mt-1.5 inline-block">{MOOD_EMOJI[e.mood].emoji}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center mt-8">选择日期查看记录</p>
        )}
      </div>

      {/* 写作界面 */}
      <AnimatePresence>
        {writingEntry !== null && (
          <WritingView
            entry={writingEntry === 'new' ? null : writingEntry}
            date={writingDate}
            onSave={handleSave}
            onClose={() => setWritingEntry(null)}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
