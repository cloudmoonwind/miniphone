import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Plus, X, Trash2, Moon, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dreamsService } from '../services/dreams.js';
import { charactersService } from '../services/characters.js';

// --- 常量 ---
const DREAM_TYPES = {
  emotion: { label: '情绪梦', color: '#C8B0C8' },
  omen:    { label: '预示梦', color: '#A898D8' },
  memory:  { label: '回忆梦', color: '#98B0D0' },
  desire:  { label: '欲望梦', color: '#D0B898' },
};

// 用 id 生成稳定的随机种子
const dreamSeed = (id) => {
  let h = 0x811c9dc5;
  for (const c of String(id)) h = (Math.imul(h ^ c.charCodeAt(0), 0x01000193)) >>> 0;
  return h / 0xffffffff;
};

// --- 星星形状 ---
const StarShape = ({ type, color, size }) => {
  const glow = `drop-shadow(0 0 ${size * 0.3}px ${color}) drop-shadow(0 0 ${size * 0.6}px ${color}60)`;
  if (type === 'cross') return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: glow, overflow: 'visible' }}>
      <rect x="42" y="4"  width="16" height="92" rx="8" fill={color} />
      <rect x="4"  y="42" width="92" height="16" rx="8" fill={color} />
      <circle cx="50" cy="50" r="10" fill={color} />
    </svg>
  );
  if (type === 'five') return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: glow, overflow: 'visible' }}>
      <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill={color} />
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: glow, overflow: 'visible' }}>
      <polygon points="50,3 80,22 95,50 80,78 50,97 20,78 5,50 20,22" fill={color} />
      <polygon points="50,22 72,35 72,65 50,78 28,65 28,35" fill={`${color}70`} />
    </svg>
  );
};

// --- DreamApp 入口（管理角色选择状态）---
const DreamApp = ({ onBack, char: initChar }) => {
  // 选中的角色：优先用传入的 char，其次读 localStorage
  const [selectedChar, setSelectedChar] = useState(() => {
    if (initChar) return initChar;
    try { return JSON.parse(localStorage.getItem('ics_dream_char') || 'null'); } catch { return null; }
  });
  const [allChars, setAllChars]         = useState([]);
  const [showPicker, setShowPicker]     = useState(false);

  // 加载所有角色（供选择器使用）
  useEffect(() => {
    charactersService.list()
      .then(data => setAllChars(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const selectChar = (c) => {
    setSelectedChar(c);
    try { localStorage.setItem('ics_dream_char', JSON.stringify(c)); } catch {}
    setShowPicker(false);
  };

  return (
    <React.Fragment key="dream-root">
      <DreamMain
        onBack={onBack}
        selectedChar={selectedChar}
        allChars={allChars}
        onOpenPicker={() => setShowPicker(true)}
      />

      {/* 角色选择器底部弹窗 */}
      <AnimatePresence>
        {showPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end"
            style={{ background: 'rgba(4,8,22,0.85)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowPicker(false)}
          >
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className="w-full rounded-t-3xl pt-4 pb-8 max-h-[70%] flex flex-col"
              style={{ background: 'rgba(10,18,50,0.98)', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 mb-3">
                <h3 className="font-bold text-white">选择角色</h3>
                <button onClick={() => setShowPicker(false)} style={{ color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
              </div>

              <div className="overflow-y-auto px-4 space-y-1.5">
                {/* 清除选择 */}
                <button
                  onClick={() => selectChar(null)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: !selectedChar ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <Moon size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  </div>
                  <span className="text-sm" style={{ color: !selectedChar ? 'white' : 'rgba(255,255,255,0.5)' }}>不选择（空夜空）</span>
                  {!selectedChar && <span className="ml-auto text-xs" style={{ color: 'rgba(180,160,255,0.8)' }}>✓ 当前</span>}
                </button>

                {allChars.length === 0 && (
                  <p className="text-center py-6 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>暂无角色，去结缘添加</p>
                )}

                {allChars.map(c => (
                  <button key={c.id}
                    onClick={() => selectChar(c)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                    style={{ background: selectedChar?.id === c.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0" style={{ background: 'rgba(255,255,255,0.12)' }}>
                      {c.avatar || c.name?.[0] || '?'}
                    </div>
                    <span className="text-sm font-medium flex-1 text-left truncate" style={{ color: selectedChar?.id === c.id ? 'white' : 'rgba(255,255,255,0.75)' }}>
                      {c.name}
                    </span>
                    {selectedChar?.id === c.id && <span className="text-xs shrink-0" style={{ color: 'rgba(180,160,255,0.8)' }}>✓ 当前</span>}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </React.Fragment>
  );
};

// --- 主内容 ---
// 拆成独立组件保证 hooks 不受角色切换影响
const DreamMain = ({ onBack, selectedChar, allChars, onOpenPicker }) => {
  const [dreams, setDreams]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const [mode, setMode]                 = useState('beautiful');
  const [selectedDream, setSelectedDream] = useState(null);
  const [addModal, setAddModal]         = useState(false);
  const [addForm, setAddForm]           = useState({ title: '', content: '', type: 'emotion', importance: 5 });
  const [interpretation, setInterpretation] = useState('');
  const [ripples, setRipples]           = useState([]);
  const [sortBy, setSortBy]             = useState('time');

  // 角色切换时加载梦境
  useEffect(() => {
    if (!selectedChar) { setDreams([]); return; }
    setLoading(true);
    dreamsService.list(selectedChar.id)
      .then(data => { setDreams(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedChar?.id]);

  const uninterpreted = useMemo(() => dreams.filter(d => !d.interpreted), [dreams]);
  const interpreted   = useMemo(() => dreams.filter(d => d.interpreted), [dreams]);

  const getStarType = (imp) => imp >= 8 ? 'hex' : imp >= 5 ? 'five' : 'cross';
  const getStarSize = (imp) => imp >= 8 ? 26 : imp >= 5 ? 21 : 16;

  // 新增梦境（乐观更新）
  const addDream = async () => {
    if (!addForm.title && !addForm.content) return;
    if (!selectedChar) return;
    const tmpId = `tmp-${Date.now()}`;
    const tmpDream = {
      id: tmpId, charId: selectedChar.id,
      ...addForm,
      interpreted: false, interpretation: '',
      timestamp: new Date().toISOString(),
      skyX: 12 + Math.random() * 70,
      skyY: 8  + Math.random() * 55,
    };
    setDreams(prev => [tmpDream, ...prev]);
    setAddModal(false);
    setAddForm({ title: '', content: '', type: 'emotion', importance: 5 });
    try {
      const created = await dreamsService.create(selectedChar.id, addForm);
      setDreams(prev => prev.map(d => d.id === tmpId ? { ...created, skyX: tmpDream.skyX, skyY: tmpDream.skyY } : d));
    } catch {
      setDreams(prev => prev.filter(d => d.id !== tmpId));
    }
  };

  // 解梦（乐观更新）
  const interpretDream = async () => {
    if (!selectedDream || !selectedChar) return;
    const { id } = selectedDream;
    const waterX = 8 + Math.random() * 78;
    const waterY = 12 + Math.random() * 65;
    const patch  = { interpreted: true, interpretation, waterX, waterY };
    setDreams(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    const rId = Date.now();
    setRipples(prev => [...prev, { id: rId, x: waterX }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== rId)), 3500);
    setSelectedDream(null);
    setInterpretation('');
    try {
      await dreamsService.update(selectedChar.id, id, patch);
    } catch {}
  };

  // 删除梦境（乐观更新）
  const deleteDream = async (id) => {
    if (!selectedChar) return;
    setDreams(prev => prev.filter(d => d.id !== id));
    setSelectedDream(null);
    try {
      await dreamsService.delete(selectedChar.id, id);
    } catch {
      dreamsService.list(selectedChar.id).then(d => setDreams(Array.isArray(d) ? d : [])).catch(() => {});
    }
  };

  const renderBeautiful = () => (
    <div className="flex-1 relative overflow-hidden">
      <style>{`
        @keyframes drm-float {
          0%,100%{transform:translate(0,0)}33%{transform:translate(3px,-4px)}66%{transform:translate(-3px,3px)}
        }
        @keyframes drm-glow {
          0%,100%{opacity:.72}50%{opacity:1}
        }
        @keyframes drm-ripple {
          0%{transform:scale(0.1);opacity:.85}100%{transform:scale(7);opacity:0}
        }
        @keyframes drm-ripple2 {
          0%{transform:scale(0.1);opacity:.5}100%{transform:scale(5);opacity:0}
        }
        @keyframes drm-underwater {
          0%,100%{opacity:.28}50%{opacity:.48}
        }
        @keyframes drm-shimmer {
          0%,100%{opacity:.08}50%{opacity:.18}
        }
      `}</style>

      {/* 夜空 */}
      <div className="absolute top-0 left-0 right-0" style={{ height: '62%', background: 'linear-gradient(180deg, #0c1535 0%, #152248 40%, #1a2d65 75%, #1f3578 100%)' }}>
        {/* 装饰星点 */}
        {Array.from({ length: 45 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute', borderRadius: '50%', backgroundColor: 'white',
            left: `${((i * 0.618034) % 1) * 95}%`, top: `${((i * 0.381966) % 1) * 92}%`,
            width: i % 7 === 0 ? 2 : 1, height: i % 7 === 0 ? 2 : 1,
            opacity: 0.18 + (i % 8) * 0.04,
            animation: `drm-glow ${2 + (i % 4) * 0.5}s ease-in-out ${(i % 5) * 0.4}s infinite`,
          }} />
        ))}

        {/* 梦境星星（未解读） */}
        {uninterpreted.map(dream => {
          const seed  = dreamSeed(dream.id);
          const color = DREAM_TYPES[dream.type]?.color || '#C0B8D8';
          const sz    = getStarSize(dream.importance);
          return (
            <motion.button key={dream.id}
              style={{
                position: 'absolute', left: `${dream.skyX}%`, top: `${dream.skyY}%`,
                transform: 'translate(-50%, -50%)',
                animation: `drm-float ${9 + seed * 9}s ease-in-out ${seed * 5}s infinite, drm-glow ${3 + seed * 2}s ease-in-out ${seed * 3}s infinite`,
              }}
              whileHover={{ scale: 1.35 }} whileTap={{ scale: 0.88 }}
              onClick={() => { setSelectedDream(dream); setInterpretation(''); }}
            >
              <StarShape type={getStarType(dream.importance)} color={color} size={sz} />
            </motion.button>
          );
        })}

        {/* 空状态提示 */}
        {!loading && !selectedChar && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-center leading-relaxed" style={{ color: 'rgba(255,255,255,0.22)' }}>
              点击上方选择一位角色<br/>让TA的梦出现在夜空里
            </p>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.22)' }}>正在加载梦境…</p>
          </div>
        )}
        {!loading && selectedChar && uninterpreted.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-center leading-relaxed" style={{ color: 'rgba(255,255,255,0.22)' }}>
              夜空还空着<br/>等待第一个梦境…
            </p>
          </div>
        )}
      </div>

      {/* 水潭 */}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: '38%', background: 'linear-gradient(180deg, #152048 0%, #0e1838 40%, #0a1230 100%)' }}>
        <div className="absolute inset-0" style={{
          background: 'repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(180,200,255,0.055) 28px, rgba(180,200,255,0.055) 29px)',
          animation: 'drm-shimmer 5s ease-in-out infinite',
        }} />
        {ripples.map(rp => (
          <React.Fragment key={rp.id}>
            <div style={{ position: 'absolute', left: `${rp.x}%`, top: '38%', width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: '50%', border: '1.5px solid rgba(160,190,255,0.7)', animation: 'drm-ripple 2.8s ease-out forwards' }} />
            <div style={{ position: 'absolute', left: `${rp.x}%`, top: '38%', width: 16, height: 16, marginLeft: -8, marginTop: -8, borderRadius: '50%', border: '1px solid rgba(160,190,255,0.4)', animation: 'drm-ripple2 3.2s ease-out 0.3s forwards' }} />
          </React.Fragment>
        ))}
        {interpreted.slice(-25).map(dream => {
          const seed  = dreamSeed(dream.id);
          const color = `${DREAM_TYPES[dream.type]?.color || '#9090C0'}55`;
          const sz    = getStarSize(dream.importance) * 0.62;
          return (
            <div key={dream.id} style={{
              position: 'absolute', left: `${dream.waterX || 50}%`, top: `${dream.waterY || 50}%`,
              transform: 'translate(-50%, -50%)', filter: 'blur(1.8px)',
              animation: `drm-underwater ${3.5 + seed * 2.5}s ease-in-out ${seed * 3}s infinite`,
            }}>
              <StarShape type={getStarType(dream.importance)} color={color} size={sz} />
            </div>
          );
        })}
        <div className="absolute top-0 left-0 right-0 h-5" style={{ background: 'linear-gradient(180deg, rgba(100,140,255,0.07) 0%, transparent 100%)' }} />
        {!loading && selectedChar && interpreted.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.18)' }}>解读后的梦境会沉入这里</p>
          </div>
        )}
      </div>

      {/* 地平线 */}
      <div className="absolute" style={{ top: '62%', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(130,170,255,0.18), transparent)' }} />
    </div>
  );

  const renderSimple = () => (
    <div className="flex-1 overflow-y-auto px-4 py-3" style={{ background: '#0d1b3e' }}>
      <div className="flex justify-end mb-3 gap-2">
        {[['time','时间'],['importance','重要度']].map(([k, l]) => (
          <button key={k} onClick={() => setSortBy(k)}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={{ background: sortBy === k ? 'rgba(255,255,255,0.15)' : 'transparent', color: sortBy === k ? 'white' : 'rgba(255,255,255,0.4)' }}
          >{l}</button>
        ))}
      </div>
      {!selectedChar && (
        <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <Moon size={36} style={{ opacity: 0.4 }} />
          <p className="text-sm">点击上方选择角色</p>
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <p className="text-sm">加载中…</p>
        </div>
      )}
      {!loading && selectedChar && dreams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          <Moon size={36} style={{ opacity: 0.4 }} />
          <p className="text-sm">还没有梦境记录</p>
        </div>
      )}
      {[...dreams]
        .sort((a, b) => sortBy === 'importance' ? b.importance - a.importance : new Date(b.timestamp) - new Date(a.timestamp))
        .map(dream => (
          <button key={dream.id}
            onClick={() => { setSelectedDream(dream); setInterpretation(dream.interpretation || ''); }}
            className="w-full text-left mb-2 p-3 rounded-2xl transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <div className="flex items-start gap-2.5">
              <div className="pt-0.5 shrink-0 text-sm">{dream.interpreted ? '✨' : '🔒'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{dream.title || '无标题梦境'}</span>
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
                    {DREAM_TYPES[dream.type]?.label}
                  </span>
                </div>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.38)' }}>{dream.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{new Date(dream.timestamp).toLocaleDateString('zh-CN')}</span>
                  <span className="text-[10px]" style={{ color: 'rgba(255,200,60,0.6)' }}>{'★'.repeat(Math.min(dream.importance, 5))}</span>
                </div>
              </div>
            </div>
          </button>
        ))
      }
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a1225' }}>
      {/* 顶栏 */}
      <div className="h-14 flex items-center px-3 shrink-0 gap-2" style={{ background: 'rgba(8,16,35,0.95)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ChevronLeft size={20} style={{ color: 'rgba(255,255,255,0.55)' }} />
        </button>

        {/* 角色选择器按钮 */}
        <button onClick={onOpenPicker}
          className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1 rounded-xl hover:bg-white/10 transition-colors"
        >
          {selectedChar ? (
            <>
              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm" style={{ background: 'rgba(255,255,255,0.15)' }}>
                {selectedChar.avatar || selectedChar.name?.[0] || '?'}
              </div>
              <span className="font-bold text-white text-sm truncate">{selectedChar.name} 的梦境</span>
            </>
          ) : (
            <span className="font-bold text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>梦境</span>
          )}
          <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
        </button>

        <div className="flex rounded-full overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.13)' }}>
          {[['simple','列表'],['beautiful','星空']].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)}
              className="text-xs px-3 py-1 transition-colors"
              style={{ background: mode === m ? 'rgba(255,255,255,0.18)' : 'transparent', color: mode === m ? 'white' : 'rgba(255,255,255,0.4)' }}
            >{l}</button>
          ))}
        </div>

        {/* 只有选了角色才显示添加按钮 */}
        {selectedChar && (
          <button onClick={() => setAddModal(true)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <Plus size={20} style={{ color: 'rgba(255,255,255,0.55)' }} />
          </button>
        )}
      </div>

      {mode === 'beautiful' ? renderBeautiful() : renderSimple()}

      {/* 梦境详情/解梦弹窗 */}
      <AnimatePresence>
        {selectedDream && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-end"
            style={{ background: 'rgba(4,8,22,0.8)', backdropFilter: 'blur(6px)' }}
            onClick={() => setSelectedDream(null)}
          >
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className="w-full rounded-t-3xl p-5 pb-8 max-h-[88%] flex flex-col"
              style={{ background: 'rgba(10,18,50,0.98)', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="shrink-0">
                  <StarShape type={getStarType(selectedDream.importance)} color={DREAM_TYPES[selectedDream.type]?.color || '#C0B8D8'} size={30} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-base truncate">{selectedDream.title || '无标题梦境'}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {new Date(selectedDream.timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                      {DREAM_TYPES[selectedDream.type]?.label}
                    </span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,200,60,0.55)' }}>
                      {'★'.repeat(Math.min(selectedDream.importance, 5))}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedDream(null)} className="p-1.5 rounded-full hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pb-2">
                {selectedDream.content && (
                  <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.72)' }}>{selectedDream.content}</p>
                  </div>
                )}
                {selectedDream.interpreted ? (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.38)' }}>我的解读</p>
                    <div className="p-3 rounded-xl" style={{ background: `${DREAM_TYPES[selectedDream.type]?.color || '#8080B0'}22` }}>
                      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{selectedDream.interpretation || '（未填写）'}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.38)' }}>你对这个梦的理解…</p>
                    <textarea value={interpretation} onChange={e => setInterpretation(e.target.value)}
                      placeholder="写下你的感受、联想或解读…" rows={4}
                      className="w-full px-3 py-3 text-sm rounded-xl resize-none focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => deleteDream(selectedDream.id)}
                  className="py-2.5 px-4 text-sm rounded-xl"
                  style={{ border: '1px solid rgba(220,80,80,0.3)', color: '#E08080' }}
                ><Trash2 size={15} /></button>
                {!selectedDream.interpreted ? (
                  <button onClick={interpretDream}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white"
                    style={{ background: `linear-gradient(135deg, ${DREAM_TYPES[selectedDream.type]?.color || '#6060A8'}CC, #3848A0CC)` }}
                  >✨ 解梦并安放</button>
                ) : (
                  <button onClick={() => setSelectedDream(null)}
                    className="flex-1 py-2.5 text-sm rounded-xl"
                    style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}
                  >关闭</button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 添加梦境弹窗 */}
      <AnimatePresence>
        {addModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-end"
            style={{ background: 'rgba(4,8,22,0.8)', backdropFilter: 'blur(6px)' }}
            onClick={() => setAddModal(false)}
          >
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              className="w-full rounded-t-3xl p-5 pb-8 max-h-[92%] flex flex-col"
              style={{ background: 'rgba(10,18,50,0.98)', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-white">记录梦境</h3>
                <button onClick={() => setAddModal(false)} style={{ color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pb-2">
                <div>
                  <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>标题</label>
                  <input type="text" value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="梦境的名字…" autoFocus
                    className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>梦境场景</label>
                  <textarea value={addForm.content} onChange={e => setAddForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="描述你的梦境场景…" rows={4}
                    className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl focus:outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>类型</label>
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {Object.entries(DREAM_TYPES).map(([k, { label, color }]) => (
                      <button key={k} onClick={() => setAddForm(f => ({ ...f, type: k }))}
                        className="px-3 py-1.5 text-xs rounded-full transition-all"
                        style={{ border: `1px solid ${addForm.type === k ? color : 'rgba(255,255,255,0.15)'}`, background: addForm.type === k ? `${color}28` : 'transparent', color: addForm.type === k ? color : 'rgba(255,255,255,0.48)' }}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>
                    重要度 <span style={{ color: DREAM_TYPES[addForm.type]?.color }}>{addForm.importance}</span>
                  </label>
                  <input type="range" min={1} max={10} value={addForm.importance}
                    onChange={e => setAddForm(f => ({ ...f, importance: +e.target.value }))}
                    className="w-full mt-2"
                    style={{ accentColor: DREAM_TYPES[addForm.type]?.color }}
                  />
                  <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    <span>一般</span><span>重要</span><span>极重要</span>
                  </div>
                </div>
              </div>
              <button onClick={addDream}
                className="w-full mt-4 py-3 font-semibold text-sm text-white rounded-xl"
                style={{ background: 'linear-gradient(135deg, #3848C0, #6838B0)' }}
              >放入夜空 ✨</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DreamApp;
