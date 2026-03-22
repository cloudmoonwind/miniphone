import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { DREAM_TYPES, hexRgb } from './dreamUtils.jsx';

/**
 * DreamModal — 梦境详情弹窗
 *
 * 动画：从画面中心缩放展开（不是底部上滑），
 * 边框颜色和背景微光跟随梦境类型颜色。
 */
export const DreamModal = ({ dream, onClose, onInterpret, onDelete }) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (dream) setText(dream.interpretation || '');
  }, [dream?.id]);

  const color  = dream ? (DREAM_TYPES[dream.type]?.color || '#C0B8D8') : '#C0B8D8';
  const [r, g, b] = dream ? hexRgb(color) : [192, 176, 216];

  const handleInterpret = async () => {
    if (!dream) return;
    await onInterpret(dream.id, text);
    onClose();
  };

  return (
    <AnimatePresence>
      {dream && (
        // 全屏蒙层
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="absolute inset-0 z-30 flex items-center justify-center px-5"
          style={{ background: 'rgba(2,5,18,0.88)', backdropFilter: 'blur(10px)' }}
          onClick={onClose}
        >
          {/* 卡片：从中心缩放展开 */}
          <motion.div
            initial={{ scale: 0.06, opacity: 0, y: 8 }}
            animate={{ scale: 1,    opacity: 1, y: 0 }}
            exit={{   scale: 0.04, opacity: 0, y: 4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.9 }}
            className="w-full flex flex-col rounded-3xl overflow-hidden"
            style={{
              maxHeight: '82vh',
              // 背景：深色 + 梦境颜色微渗透
              background: `linear-gradient(150deg,
                rgba(8,14,40,0.99) 0%,
                rgba(${r},${g},${b},0.09) 100%)`,
              // 发光边框
              border: `1px solid rgba(${r},${g},${b},0.35)`,
              boxShadow: `
                0 0 0 1px rgba(${r},${g},${b},0.08) inset,
                0 0 40px rgba(${r},${g},${b},0.15),
                0 24px 80px rgba(0,0,0,0.7)
              `,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── 顶部星光装饰条 ── */}
            <div style={{
              height: 2,
              background: `linear-gradient(90deg,
                transparent 0%,
                rgba(${r},${g},${b},0.6) 30%,
                rgba(255,255,255,0.8) 50%,
                rgba(${r},${g},${b},0.6) 70%,
                transparent 100%)`,
            }} />

            {/* ── 标题区 ── */}
            <div className="px-5 pt-5 pb-4 shrink-0">
              <div className="flex items-start gap-3">
                {/* 梦境类型色块 */}
                <div style={{
                  width: 8, minHeight: 44, borderRadius: 4,
                  background: `linear-gradient(180deg, ${color}, rgba(${r},${g},${b},0.2))`,
                  boxShadow: `0 0 12px ${color}60`,
                  flexShrink: 0, marginTop: 2,
                }} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-lg leading-tight">
                    {dream.title || '无标题梦境'}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: `rgba(${r},${g},${b},0.18)`,
                        color: color,
                        border: `1px solid rgba(${r},${g},${b},0.3)`,
                      }}>
                      {DREAM_TYPES[dream.type]?.label}
                    </span>
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {new Date(dream.timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                    </span>
                    <span className="text-xs tracking-widest" style={{ color: `rgba(${r},${g},${b},0.7)` }}>
                      {'◆'.repeat(Math.min(Math.ceil(dream.importance / 2), 5))}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full shrink-0 transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* ── 内容区 ── */}
            <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-4">
              {dream.content && (
                <div className="p-4 rounded-2xl"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {dream.content}
                  </p>
                </div>
              )}

              {dream.interpreted ? (
                <div>
                  <p className="text-xs font-semibold mb-2"
                    style={{ color: `rgba(${r},${g},${b},0.6)` }}>
                    解读
                  </p>
                  <div className="p-3 rounded-xl"
                    style={{
                      background: `rgba(${r},${g},${b},0.1)`,
                      border: `1px solid rgba(${r},${g},${b},0.2)`,
                    }}>
                    <p className="text-sm leading-relaxed"
                      style={{ color: 'rgba(255,255,255,0.72)' }}>
                      {dream.interpretation || '（未填写）'}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold mb-2"
                    style={{ color: 'rgba(255,255,255,0.35)' }}>
                    写下你的感受…
                  </p>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="联想、感受、或解读这个梦…"
                    rows={3}
                    className="w-full px-3 py-3 text-sm rounded-xl resize-none focus:outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid rgba(${r},${g},${b},0.2)`,
                      color: 'rgba(255,255,255,0.8)',
                    }}
                  />
                </div>
              )}
            </div>

            {/* ── 底部操作 ── */}
            <div className="px-5 pt-3 pb-6 shrink-0 flex gap-2">
              <button
                onClick={() => { onDelete(dream.id); onClose(); }}
                className="py-2.5 px-4 rounded-xl transition-colors"
                style={{ border: '1px solid rgba(200,70,70,0.25)', color: 'rgba(200,100,100,0.8)' }}
              >
                <Trash2 size={15} />
              </button>

              {!dream.interpreted ? (
                <button
                  onClick={handleInterpret}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white"
                  style={{
                    background: `linear-gradient(135deg,
                      rgba(${r},${g},${b},0.7) 0%,
                      rgba(${Math.round(r*0.6)},${Math.round(g*0.6)},${Math.round(b*1.2) > 255 ? 255 : Math.round(b*1.2)},0.8) 100%)`,
                    boxShadow: `0 4px 20px rgba(${r},${g},${b},0.3)`,
                  }}
                >
                  解梦并安放
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 text-sm rounded-xl"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                >
                  关闭
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
