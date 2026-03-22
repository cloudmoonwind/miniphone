/**
 * 时光邮局 — 写给未来自己的信
 *
 * 功能：
 *   - 写一封信，设定"未来某日"才能开封
 *   - 未到期：显示"密封中"，不可查看内容
 *   - 到期后：可以打开读信，看到当时写信时的心情
 *   - 未来可能联动角色：让角色也帮你写一封，或读完后给你回信
 *
 * 数据：localStorage（轻量，不需要后端）
 */
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Plus, Mail, Lock, Unlock, Trash2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'ics_timecapsule_letters';

function loadLetters() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveLetters(letters) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
}
function genId() {
  return 'letter_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

const MOOD_OPTIONS = [
  { key: 'hopeful',  emoji: '🌟', label: '充满希望' },
  { key: 'nostalgic',emoji: '🍂', label: '怀念过去' },
  { key: 'worried',  emoji: '😟', label: '有些担忧' },
  { key: 'happy',    emoji: '😊', label: '心情愉快' },
  { key: 'resolute', emoji: '💪', label: '斗志昂扬' },
  { key: 'peaceful', emoji: '🌸', label: '平静安然' },
];

// ── 写信视图 ──────────────────────────────────────────────────────────────────
const WriteView = ({ onClose, onCreate }) => {
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [mood, setMood]       = useState('hopeful');
  const [sending, setSending] = useState(false);
  const textRef = useRef(null);

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const maxDate  = new Date(Date.now() + 365 * 5 * 86400000).toISOString().slice(0, 10);

  useEffect(() => {
    setOpenDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    setTimeout(() => textRef.current?.focus(), 100);
  }, []);

  const handleSend = async () => {
    if (!content.trim() || !openDate) return;
    setSending(true);
    try {
      const letter = {
        id: genId(),
        title: title.trim() || `写于 ${new Date().toLocaleDateString('zh-CN')}`,
        content: content.trim(),
        openDate,
        mood,
        createdAt: new Date().toISOString(),
        opened: false,
      };
      onCreate(letter);
      onClose();
    } finally { setSending(false); }
  };

  return (
    <motion.div
      className="absolute inset-0 bg-amber-50 flex flex-col z-20"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
    >
      {/* 顶栏 */}
      <div className="flex items-center px-4 py-3 shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <span className="flex-1 text-sm font-bold text-gray-700 text-center">写给未来的信</span>
        <button
          onClick={handleSend}
          disabled={!content.trim() || !openDate || sending}
          className="flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full disabled:opacity-40"
        >
          <Send size={12} /> 封存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
        {/* 心情 */}
        <div>
          <p className="text-xs text-gray-400 mb-2">此刻的心情</p>
          <div className="flex gap-2 flex-wrap">
            {MOOD_OPTIONS.map(m => (
              <button
                key={m.key}
                onClick={() => setMood(m.key)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                  mood === m.key
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 标题 */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="信的标题（可选）"
          className="w-full bg-white/60 rounded-xl px-4 py-2 text-sm text-gray-800 outline-none border border-amber-100 focus:border-amber-300"
        />

        {/* 内容 */}
        <textarea
          ref={textRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={`亲爱的未来的我，\n\n此刻是 ${new Date().toLocaleDateString('zh-CN')}，想告诉你……`}
          rows={8}
          className="w-full bg-white/60 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none border border-amber-100 focus:border-amber-300 resize-none leading-relaxed"
        />

        {/* 开封日期 */}
        <div className="bg-white/60 rounded-xl px-4 py-3 border border-amber-100">
          <label className="text-xs text-gray-500 block mb-1">最早可开封日期</label>
          <input
            type="date"
            value={openDate}
            min={tomorrow}
            max={maxDate}
            onChange={e => setOpenDate(e.target.value)}
            className="w-full text-sm text-gray-800 outline-none bg-transparent"
          />
          {openDate && (
            <p className="text-xs text-amber-500 mt-1">
              距开封还有 {Math.ceil((new Date(openDate) - Date.now()) / 86400000)} 天
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ── 读信视图 ──────────────────────────────────────────────────────────────────
const ReadView = ({ letter, onClose }) => {
  const moodConf = MOOD_OPTIONS.find(m => m.key === letter.mood) || MOOD_OPTIONS[0];
  const writtenDate = new Date(letter.createdAt).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <motion.div
      className="absolute inset-0 bg-amber-50 flex flex-col z-20"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
    >
      <div className="flex items-center px-4 py-3 shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <span className="flex-1 text-sm font-bold text-gray-700 text-center">{letter.title}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-amber-100">
          {/* 信封装饰 */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-amber-100">
            <span className="text-2xl">{moodConf.emoji}</span>
            <div>
              <p className="text-xs font-bold text-amber-600">{moodConf.label}的心情</p>
              <p className="text-xs text-gray-400">写于 {writtenDate}</p>
            </div>
            <div className="ml-auto">
              <Unlock size={16} className="text-amber-400" />
            </div>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{letter.content}</p>

          <div className="mt-4 pt-3 border-t border-amber-100">
            <p className="text-xs text-gray-400 text-right italic">——{writtenDate} 的自己</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          你于 {new Date(letter.openDate).toLocaleDateString('zh-CN')} 拆开了这封信
        </p>
      </div>
    </motion.div>
  );
};

// ── 主视图 ────────────────────────────────────────────────────────────────────
export default function TimeCapsuleApp({ onBack }) {
  const [letters, setLetters]   = useState([]);
  const [showWrite, setShowWrite] = useState(false);
  const [reading, setReading]   = useState(null);

  useEffect(() => { setLetters(loadLetters()); }, []);

  const handleCreate = (letter) => {
    const updated = [letter, ...letters];
    setLetters(updated);
    saveLetters(updated);
  };

  const handleOpen = (letter) => {
    const today = new Date().toISOString().slice(0, 10);
    if (letter.openDate > today) return; // 未到期
    // 标记已开封
    const updated = letters.map(l =>
      l.id === letter.id ? { ...l, opened: true, openedAt: new Date().toISOString() } : l
    );
    setLetters(updated);
    saveLetters(updated);
    setReading(updated.find(l => l.id === letter.id));
  };

  const handleDelete = (id) => {
    if (!confirm('删除这封信？')) return;
    const updated = letters.filter(l => l.id !== id);
    setLetters(updated);
    saveLetters(updated);
  };

  const today = new Date().toISOString().slice(0, 10);

  const pending  = letters.filter(l => !l.opened).sort((a, b) => a.openDate.localeCompare(b.openDate));
  const opened   = letters.filter(l =>  l.opened).sort((a, b) => b.openedAt?.localeCompare(a.openedAt || '') || 0);

  return (
    <div className="flex flex-col h-full bg-amber-50 relative overflow-hidden">
      {/* 顶栏 */}
      <div className="h-14 bg-white border-b flex items-center px-4 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <Mail size={18} className="text-amber-500 mr-2" />
        <span className="font-bold text-gray-800 flex-1">时光邮局</span>
        <button
          onClick={() => setShowWrite(true)}
          className="w-9 h-9 bg-amber-500 rounded-full flex items-center justify-center"
        >
          <Plus size={18} color="white" />
        </button>
      </div>

      {/* 信件列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {letters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-amber-300">
            <Mail size={48} strokeWidth={1} />
            <p className="text-sm text-gray-400">给未来的自己写一封信</p>
            <p className="text-xs text-gray-300 text-center max-w-[200px]">
              设定一个日期，到那天才能打开
            </p>
          </div>
        ) : (
          <>
            {/* 待开封 */}
            {pending.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 mb-2 px-1">密封中 ({pending.length})</p>
                <div className="space-y-2">
                  {pending.map(letter => {
                    const moodConf = MOOD_OPTIONS.find(m => m.key === letter.mood) || MOOD_OPTIONS[0];
                    const daysLeft = Math.ceil((new Date(letter.openDate) - Date.now()) / 86400000);
                    const canOpen = letter.openDate <= today;
                    return (
                      <motion.div
                        key={letter.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${
                          canOpen ? 'border-amber-300' : 'border-gray-100'
                        }`}
                      >
                        <button
                          className="w-full p-4 text-left flex items-start gap-3"
                          onClick={() => canOpen ? handleOpen(letter) : null}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            canOpen ? 'bg-amber-100' : 'bg-gray-100'
                          }`}>
                            {canOpen ? <Unlock size={18} className="text-amber-500" /> : <Lock size={18} className="text-gray-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">{letter.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {canOpen
                                ? '可以打开了！'
                                : `还需等待 ${daysLeft} 天 · ${new Date(letter.openDate).toLocaleDateString('zh-CN')}`}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{moodConf.emoji} {moodConf.label}</p>
                          </div>
                        </button>
                        {!canOpen && (
                          <div className="px-4 pb-3 flex justify-end">
                            <button
                              onClick={() => handleDelete(letter.id)}
                              className="text-xs text-red-400 flex items-center gap-1"
                            >
                              <Trash2 size={11} /> 销毁
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 已开封 */}
            {opened.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 mb-2 px-1">已读 ({opened.length})</p>
                <div className="space-y-2">
                  {opened.map(letter => {
                    const moodConf = MOOD_OPTIONS.find(m => m.key === letter.mood) || MOOD_OPTIONS[0];
                    return (
                      <motion.button
                        key={letter.id}
                        layout
                        className="w-full bg-white/70 rounded-2xl border border-gray-100 p-4 text-left flex items-center gap-3"
                        onClick={() => setReading(letter)}
                      >
                        <span className="text-2xl">{moodConf.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 font-semibold truncate">{letter.title}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {letter.content.slice(0, 50)}…
                          </p>
                        </div>
                        <Unlock size={14} className="text-gray-300 shrink-0" />
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 写信 */}
      <AnimatePresence>
        {showWrite && (
          <WriteView onClose={() => setShowWrite(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>

      {/* 读信 */}
      <AnimatePresence>
        {reading && (
          <ReadView letter={reading} onClose={() => setReading(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
