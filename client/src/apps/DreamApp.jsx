import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, Plus, X, Moon, ChevronDown, Sparkles, Lock, Loader2, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar.jsx';
import { charactersService } from '../services/characters.js';

import { DREAM_TYPES } from './dream/dreamUtils.jsx';
import { useDreams } from './dream/useDreams.js';
import { DreamSky } from './dream/DreamSky.jsx';
import { DreamStars } from './dream/DreamStars.jsx';
import { DreamCard } from './dream/DreamCard.jsx';
import { DreamAddModal } from './dream/DreamAddModal.jsx';

// ── 角色选择弹窗 ───────────────────────────────────────────────────────────
const CharPicker = ({ open, selected, allChars, onSelect, onClose }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-end"
        style={{ background: 'rgba(4,8,22,0.85)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          className="w-full rounded-t-3xl pt-4 pb-8 max-h-[70%] flex flex-col"
          style={{ background: 'rgba(10,18,50,0.98)', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 mb-3">
            <h3 className="font-bold text-white">选择角色</h3>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
          </div>
          <div className="overflow-y-auto px-4 space-y-1.5">
            <button
              onClick={() => onSelect(null)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: selected === null ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Sparkles size={16} style={{ color: 'rgba(180,160,255,0.7)' }} />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm" style={{ color: selected === null ? 'white' : 'rgba(255,255,255,0.5)' }}>全部角色</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>展示所有梦境</span>
              </div>
              {selected === null && <span className="ml-auto text-xs" style={{ color: 'rgba(180,160,255,0.8)' }}>✓ 当前</span>}
            </button>
            {allChars.length === 0 && (
              <p className="text-center py-6 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>暂无角色，去结缘添加</p>
            )}
            {allChars.map(c => (
              <button key={c.id} onClick={() => onSelect(c)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: selected?.id === c.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Avatar value={c.avatar} name={c.name} size={36} rounded className="shrink-0" />
                <span className="text-sm font-medium flex-1 text-left truncate"
                  style={{ color: selected?.id === c.id ? 'white' : 'rgba(255,255,255,0.75)' }}>{c.name}</span>
                {selected?.id === c.id && <span className="text-xs shrink-0" style={{ color: 'rgba(180,160,255,0.8)' }}>✓ 当前</span>}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ── 简单列表视图 ────────────────────────────────────────────────────────────
const SimpleView = ({ dreams, loading, selectedChar, onInterpret, onDelete }) => {
  const [sortBy, setSortBy] = useState('time');
  const [selected, setSelected] = useState(null);
  const sorted = useMemo(() =>
    [...dreams].sort((a, b) =>
      sortBy === 'importance'
        ? b.importance - a.importance
        : new Date(b.timestamp) - new Date(a.timestamp)
    ), [dreams, sortBy]);

  return (
    <div className="flex-1 relative overflow-hidden" style={{ background: '#0d1b3e' }}>
      <div className="h-full overflow-y-auto px-4 py-3">
        <div className="flex justify-end mb-3 gap-2">
          {[['time', '时间'], ['importance', '重要度']].map(([k, l]) => (
            <button key={k} onClick={() => setSortBy(k)}
              className="text-xs px-2.5 py-1 rounded-full transition-colors"
              style={{ background: sortBy === k ? 'rgba(255,255,255,0.15)' : 'transparent', color: sortBy === k ? 'white' : 'rgba(255,255,255,0.4)' }}>
              {l}
            </button>
          ))}
        </div>
        {!selectedChar && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Moon size={36} style={{ opacity: 0.4 }} />
            <p className="text-sm">点击上方选择角色</p>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: 'rgba(160,180,255,0.4)' }} />
          </div>
        )}
        {!loading && selectedChar && dreams.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Moon size={36} style={{ opacity: 0.4 }} />
            <p className="text-sm">还没有梦境记录</p>
          </div>
        )}
        {sorted.map(dream => (
          <button key={dream.id}
            onClick={() => setSelected(dream)}
            className="w-full text-left mb-2 p-3 rounded-2xl transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <div className="flex items-start gap-2.5">
              <div className="pt-0.5 shrink-0">
                {dream.interpreted
                  ? <Sparkles size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  : <Lock     size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    {dream.title || '无标题梦境'}
                  </span>
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
                    {DREAM_TYPES[dream.type]?.label}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>{dream.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {new Date(dream.timestamp).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,200,60,0.6)' }}>
                    {'★'.repeat(Math.min(dream.importance, 5))}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <AnimatePresence>
        {selected && (
          <DreamCard
            dream={selected}
            color={DREAM_TYPES[selected.type]?.color || '#C0B8D8'}
            onClose={() => setSelected(null)}
            onInterpret={async (id, text) => { await onInterpret(id, text); setSelected(null); }}
            onDelete={(id) => { onDelete(id); setSelected(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── 星空视图 ────────────────────────────────────────────────────────────────
const SkyView = ({ skyRef, containerRef, uninterpreted, interpreted, loading, selectedChar, onInterpret, onDelete }) => (
  <div ref={containerRef} className="flex-1 relative overflow-hidden">
    {/* PixiJS 背景：天空 + 流星 + 水面倒影 */}
    <DreamSky ref={skyRef} interpreted={interpreted} />
    {/* HTML 交互层：动画星星（每颗自管理状态） */}
    <DreamStars
      uninterpreted={uninterpreted}
      interpreted={interpreted}
      loading={loading}
      selectedChar={selectedChar}
      containerRef={containerRef}
      skyRef={skyRef}
      onInterpret={onInterpret}
      onDelete={onDelete}
    />
  </div>
);

// ── 主入口 ─────────────────────────────────────────────────────────────────
const DreamApp = ({ onBack, char: initChar }) => {
  // null = 全部角色模式（默认），object = 单角色
  const [selectedChar, setSelectedChar] = useState(() => {
    if (initChar) return initChar;
    try {
      const saved = localStorage.getItem('ics_dream_char');
      return saved && saved !== 'null' ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [allChars, setAllChars]     = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [mode, setMode]             = useState('beautiful');
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm]   = useState({ title: '', content: '', type: 'emotion', importance: 5 });
  const skyRef       = useRef(null);
  const containerRef = useRef(null);

  const {
    dreams, loading, uninterpreted, interpreted,
    generating, genError,
    addDream, interpretDream, deleteDream, generateDream,
  } = useDreams(selectedChar?.id);

  useEffect(() => {
    charactersService.list()
      .then(d => setAllChars(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const selectChar = (c) => {
    setSelectedChar(c);
    try { localStorage.setItem('ics_dream_char', JSON.stringify(c)); } catch {}
    setShowPicker(false);
  };

  const handleAdd = async () => {
    await addDream(addForm);
    setAddModal(false);
    setAddForm({ title: '', content: '', type: 'emotion', importance: 5 });
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#060818' }}>
      {/* ── 顶栏 ── */}
      <div className="h-14 flex items-center px-3 shrink-0 gap-2 relative"
        style={{ background: 'rgba(8,16,35,0.95)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} style={{ color: 'rgba(255,255,255,0.55)' }} />
        </button>

        <button onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1 rounded-xl hover:bg-white/10 transition-colors">
          {selectedChar ? (
            <>
              <Avatar value={selectedChar.avatar} name={selectedChar.name} size={28} rounded className="shrink-0" />
              <span className="font-bold text-white text-sm truncate">{selectedChar.name} 的梦境</span>
            </>
          ) : (
            <span className="font-bold text-sm" style={{ color: 'rgba(180,160,255,0.85)' }}>全部梦境</span>
          )}
          <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
        </button>

        <div className="flex rounded-full overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.13)' }}>
          {[['simple', '列表'], ['beautiful', '星空']].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)}
              className="text-xs px-3 py-1 transition-colors"
              style={{ background: mode === m ? 'rgba(255,255,255,0.18)' : 'transparent', color: mode === m ? 'white' : 'rgba(255,255,255,0.4)' }}>
              {l}
            </button>
          ))}
        </div>

        {selectedChar && (
          <>
            <button onClick={generateDream} disabled={generating} title="AI生成梦境"
              className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-40">
              {generating
                ? <Loader2 size={18} style={{ color: 'rgba(180,160,255,0.9)' }} className="animate-spin" />
                : <Wand2   size={18} style={{ color: 'rgba(180,160,255,0.9)' }} />}
            </button>
            <button onClick={() => setAddModal(true)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <Plus size={20} style={{ color: 'rgba(255,255,255,0.55)' }} />
            </button>
          </>
        )}

        {/* AI 生成错误提示 */}
        <AnimatePresence>
          {genError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute top-full left-4 right-4 mt-1 z-40 px-3 py-2 rounded-xl text-xs text-center"
              style={{ background: 'rgba(200,80,80,0.9)', color: 'white' }}
            >
              {genError}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 主视图 ── */}
      {mode === 'beautiful' ? (
        <SkyView
          skyRef={skyRef}
          containerRef={containerRef}
          uninterpreted={uninterpreted}
          interpreted={interpreted}
          loading={loading}
          selectedChar={selectedChar}
          onInterpret={interpretDream}
          onDelete={deleteDream}
        />
      ) : (
        <SimpleView
          dreams={dreams}
          loading={loading}
          selectedChar={selectedChar}
          onInterpret={interpretDream}
          onDelete={deleteDream}
        />
      )}

      {/* ── 弹窗层 ── */}
      <DreamAddModal
        open={addModal}
        form={addForm}
        onChange={setAddForm}
        onSubmit={handleAdd}
        onClose={() => setAddModal(false)}
      />
      <CharPicker
        open={showPicker}
        selected={selectedChar}
        allChars={allChars}
        onSelect={selectChar}
        onClose={() => setShowPicker(false)}
      />
    </div>
  );
};

export default DreamApp;
