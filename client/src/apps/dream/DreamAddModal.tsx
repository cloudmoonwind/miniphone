import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { DREAM_TYPES } from './dreamUtils.jsx';

const SHEET = { type: 'spring', stiffness: 360, damping: 36 };

/**
 * DreamAddModal — 手动记录梦境弹窗
 */
export const DreamAddModal = ({ open, form, onChange, onSubmit, onClose }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 z-30 flex items-end"
        style={{ background: 'rgba(4,8,22,0.82)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={SHEET}
          className="w-full rounded-t-3xl p-5 pb-8 max-h-[92%] flex flex-col"
          style={{ background: 'rgba(10,18,50,0.98)', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white">记录梦境</h3>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pb-2">
            <div>
              <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>标题</label>
              <input
                type="text" value={form.title}
                onChange={e => onChange({ ...form, title: e.target.value })}
                placeholder="梦境的名字…" autoFocus
                className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>梦境场景</label>
              <textarea
                value={form.content}
                onChange={e => onChange({ ...form, content: e.target.value })}
                placeholder="描述你的梦境场景…" rows={4}
                className="w-full mt-1.5 px-3 py-2.5 text-sm rounded-xl focus:outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>类型</label>
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {Object.entries(DREAM_TYPES).map(([k, { label, color }]) => (
                  <button key={k}
                    onClick={() => onChange({ ...form, type: k })}
                    className="px-3 py-1.5 text-xs rounded-full transition-all"
                    style={{
                      background: form.type === k ? `${color}40` : 'rgba(255,255,255,0.07)',
                      border: `1px solid ${form.type === k ? color : 'rgba(255,255,255,0.1)'}`,
                      color: form.type === k ? color : 'rgba(255,255,255,0.5)',
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.38)' }}>
                重要度 <span style={{ color: DREAM_TYPES[form.type]?.color }}>{form.importance}</span>
              </label>
              <input
                type="range" min={1} max={10} value={form.importance}
                onChange={e => onChange({ ...form, importance: +e.target.value })}
                className="w-full mt-2 h-1 rounded-full appearance-none outline-none"
                style={{ accentColor: DREAM_TYPES[form.type]?.color || '#9090C0' }}
              />
            </div>
          </div>

          <button
            onClick={onSubmit}
            disabled={!form.title && !form.content}
            className="mt-4 w-full py-3 text-sm font-semibold rounded-xl text-white disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${DREAM_TYPES[form.type]?.color || '#6060A8'}CC, #3848A0CC)` }}
          >
            记录这个梦
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);
