import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { CATEGORIES, VALUE_TYPES, inputCls, selectCls } from './constants';

export interface ValueFormData {
  category: string; name: string; variableName: string;
  valueType: string;
  currentValue: number; minValue: number; maxValue: number;
  groupName: string;
}

export const EMPTY_FORM: ValueFormData = {
  category: 'emotion', name: '', variableName: '',
  valueType: 'continuous',
  currentValue: 50, minValue: 0, maxValue: 100,
  groupName: '',
};

export function ValueModal({ initial, groups, onSave, onCancel }: {
  initial?: ValueFormData;
  groups: string[];
  onSave: (data: ValueFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ValueFormData>(initial ?? EMPTY_FORM);
  const set = (k: keyof ValueFormData, v: any) => setForm(p => ({ ...p, [k]: v }));
  const isDiscrete = form.valueType === 'discrete';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(180,190,230,0.25)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        className="w-72 rounded-2xl p-5 space-y-4"
        style={{
          background: 'rgba(240,243,255,0.75)',
          backdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,0.7)',
          boxShadow: '0 8px 40px rgba(120,130,200,0.2)',
        }}>

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700 tracking-wide">
            {initial ? '编辑变量' : '新建变量'}
          </span>
          <button onClick={onCancel}
            className="p-1 hover:bg-white/40 rounded-full transition-colors">
            <X size={14} className="text-slate-400" />
          </button>
        </div>

        {/* 变量类型 */}
        <div className="space-y-1.5">
          <span className="text-[9px] uppercase tracking-widest text-slate-400">变量类型</span>
          <div className="grid grid-cols-2 gap-1.5">
            {VALUE_TYPES.map(t => (
              <button key={t.value} onClick={() => set('valueType', t.value)}
                className="text-left px-2.5 py-2 rounded-xl transition-all"
                style={{
                  background: form.valueType === t.value
                    ? 'rgba(165,180,252,0.3)'
                    : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${form.valueType === t.value ? 'rgba(129,140,248,0.5)' : 'rgba(255,255,255,0.5)'}`,
                }}>
                <div className={`text-[11px] font-semibold ${form.valueType === t.value ? 'text-indigo-600' : 'text-slate-600'}`}>
                  {t.label}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5 leading-tight">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 名称 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-400">显示名</span>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder={isDiscrete ? '心情' : '好感度'} className={inputCls} />
          </div>
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-400">变量名</span>
            <input value={form.variableName} onChange={e => set('variableName', e.target.value)}
              placeholder={isDiscrete ? 'mood' : 'affection'} className={inputCls} />
          </div>
        </div>

        {/* 分类 */}
        <div className="space-y-1">
          <span className="text-[9px] uppercase tracking-widest text-slate-400">分类</span>
          <select value={form.category} onChange={e => set('category', e.target.value)} className={selectCls}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* 分组 */}
        <div className="space-y-1">
          <span className="text-[9px] uppercase tracking-widest text-slate-400">分组（可选）</span>
          <input value={form.groupName} onChange={e => set('groupName', e.target.value)}
            placeholder="如：核心属性" list="group-list-modal" className={inputCls} />
          <datalist id="group-list-modal">
            {groups.map(g => <option key={g} value={g} />)}
          </datalist>
        </div>

        {/* 数值范围（仅连续） */}
        {!isDiscrete && (
          <div className="space-y-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-400">数值范围</span>
            <div className="grid grid-cols-3 gap-2">
              {(['minValue', 'maxValue', 'currentValue'] as const).map((k, i) => (
                <div key={k} className="space-y-0.5">
                  <span className="text-[8px] text-slate-400">{['最小', '最大', '初始'][i]}</span>
                  <input type="number" value={form[k]}
                    onChange={e => set(k, +e.target.value)} className={inputCls} />
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || !form.variableName.trim()}
          className="w-full py-2 rounded-xl text-white text-xs font-medium tracking-wide transition-all disabled:opacity-30 hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #a5b4fc, #818cf8)' }}>
          保存
        </button>
      </motion.div>
    </div>
  );
}
