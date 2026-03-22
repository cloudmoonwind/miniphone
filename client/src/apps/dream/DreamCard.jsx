import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import { DREAM_TYPES, hexRgb } from './dreamUtils.jsx';

/**
 * DreamCard — 从星星展开的梦境卡片
 * 从中心缩放出现（scale 0.08 → 1），背景半透明，边框为梦境颜色
 */
export const DreamCard = ({ dream, color, onClose, onInterpret, onDelete }) => {
  const [text, setText] = useState(dream.interpretation || '');
  const [r, g, b] = hexRgb(color);

  const handleInterpret = async () => {
    await onInterpret(dream.id, text);
  };

  return (
    // 全屏蒙层
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-40 flex items-center justify-center px-5"
      style={{ background: 'rgba(2,4,16,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      {/* 卡片：从中心爆炸出 */}
      <motion.div
        initial={{ scale: 0.06, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        exit={{   scale: 0.04, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22, mass: 0.85 }}
        className="w-full flex flex-col rounded-3xl overflow-hidden"
        style={{
          maxHeight:  '80vh',
          maxWidth:   420,
          background: `linear-gradient(150deg,
            rgba(6,10,32,0.97) 0%,
            rgba(${r},${g},${b},0.11) 100%)`,
          border:    `1px solid rgba(${r},${g},${b},0.4)`,
          boxShadow: `
            0 0 0 1px rgba(${r},${g},${b},0.1) inset,
            0 0 60px rgba(${r},${g},${b},0.18),
            0 30px 90px rgba(0,0,0,0.75)
          `,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 顶部光线 */}
        <div style={{
          height: 2,
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(${r},${g},${b},0.7) 25%,
            rgba(255,255,255,0.9) 50%,
            rgba(${r},${g},${b},0.7) 75%,
            transparent 100%)`,
        }} />

        {/* 标题 */}
        <div className="px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-start gap-3">
            <div style={{
              width: 6, minHeight: 42,
              borderRadius: 3,
              background: `linear-gradient(180deg, ${color} 0%, rgba(${r},${g},${b},0.15) 100%)`,
              boxShadow: `0 0 14px ${color}70`,
              flexShrink: 0, marginTop: 3,
            }} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-lg leading-tight">
                {dream.title || '无标题梦境'}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: `rgba(${r},${g},${b},0.2)`,
                    color, border: `1px solid rgba(${r},${g},${b},0.35)`,
                  }}>
                  {DREAM_TYPES[dream.type]?.label}
                </span>
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {new Date(dream.timestamp).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                </span>
                <span className="text-xs tracking-widest" style={{ color: `rgba(${r},${g},${b},0.75)` }}>
                  {'◆'.repeat(Math.min(Math.ceil(dream.importance / 2), 5))}
                </span>
              </div>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              <X size={17} />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-4">
          {dream.content && (
            <div className="p-4 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'rgba(255,255,255,0.78)' }}>
                {dream.content}
              </p>
            </div>
          )}

          {dream.interpreted ? (
            <div>
              <p className="text-xs font-semibold mb-2"
                style={{ color: `rgba(${r},${g},${b},0.6)` }}>解读</p>
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
                  border: `1px solid rgba(${r},${g},${b},0.22)`,
                  color: 'rgba(255,255,255,0.82)',
                }}
              />
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-5 pt-3 pb-6 shrink-0 flex gap-2">
          <button
            onClick={() => onDelete(dream.id)}
            className="py-2.5 px-4 rounded-xl transition-colors"
            style={{ border: '1px solid rgba(200,70,70,0.25)', color: 'rgba(200,100,100,0.8)' }}>
            <Trash2 size={15} />
          </button>
          {!dream.interpreted ? (
            <button
              onClick={handleInterpret}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-white"
              style={{
                background: `linear-gradient(135deg, rgba(${r},${g},${b},0.75), rgba(${Math.round(r*0.5)},${Math.round(g*0.6)},${Math.min(Math.round(b*1.3),255)},0.85))`,
                boxShadow: `0 4px 24px rgba(${r},${g},${b},0.35)`,
              }}>
              解梦并安放
            </button>
          ) : (
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm rounded-xl"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
              关闭
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
