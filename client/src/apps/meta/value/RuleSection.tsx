import { useState } from 'react';
import { Edit3, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { inputCls, textareaCls } from './constants';

const btnPrimary = 'transition-all rounded-xl text-xs font-medium py-1.5 text-white';
const btnGhost   = 'transition-all rounded-xl text-xs font-medium px-3 py-1.5 text-slate-500';

function rangeText(r: any) {
  if (r.rangeMin != null && r.rangeMax != null) return `${r.rangeMin}–${r.rangeMax}`;
  if (r.rangeMin != null) return `≥${r.rangeMin}`;
  if (r.rangeMax != null) return `≤${r.rangeMax}`;
  return '全范围';
}

// ── 规则行 ────────────────────────────────────────────────────

export function RuleEditRow({ rule, onUpdate, onDelete }: {
  rule: any; onUpdate: (d: any) => void; onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [form,     setForm]     = useState(rule);

  const save = () => { onUpdate(form); setEditing(false); };

  if (editing) {
    return (
      <div className="rounded-xl p-3 space-y-2.5 mb-1"
        style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)' }}>
        <div className="space-y-1">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">规则描述（告知 AI 如何更新此变量）</span>
          <textarea
            value={form.ruleText ?? ''}
            rows={3}
            placeholder="如：过于亲密接触减3-8，冷淡减1-2，进退有礼加1-3"
            onChange={e => setForm({ ...form, ruleText: e.target.value })}
            className={textareaCls}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['rangeMin', 'rangeMax'] as const).map((k, i) => (
            <div key={k} className="space-y-1">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">{['适用范围下限', '适用范围上限'][i]}</span>
              <input type="number" value={form[k] ?? ''} placeholder="不限"
                onChange={e => setForm({ ...form, [k]: e.target.value === '' ? null : +e.target.value })}
                className={inputCls} />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
          <input type="checkbox" checked={form.enabled !== 0}
            onChange={e => setForm({ ...form, enabled: e.target.checked ? 1 : 0 })}
            className="w-3 h-3 accent-indigo-400" />
          启用规则
        </label>
        <div className="flex gap-2">
          <button onClick={save}
            className={`flex-1 ${btnPrimary}`}
            style={{ background: 'linear-gradient(135deg, #c4b5fd, #a78bfa)' }}>
            保存
          </button>
          <button onClick={() => { setEditing(false); setForm(rule); }}
            className={btnGhost}
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.5)' }}>
            取消
          </button>
        </div>
      </div>
    );
  }

  const preview = rule.ruleText
    ? (rule.ruleText.length > 40 ? rule.ruleText.slice(0, 40) + '…' : rule.ruleText)
    : '（无内容）';
  const hasFullText = rule.ruleText && rule.ruleText.length > 40;

  return (
    <div className={`mb-0.5 ${rule.enabled === 0 ? 'opacity-40' : ''}`}>
      <div
        className="flex items-center gap-2 py-2 px-2 rounded-xl cursor-pointer group transition-colors hover:bg-white/20"
        onClick={() => hasFullText && setExpanded(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: 'rgba(196,181,253,0.25)', color: '#7c3aed', border: '1px solid rgba(196,181,253,0.4)' }}>
              {rangeText(rule)}
            </span>
            {rule.enabled === 0 && (
              <span className="text-[8px] text-slate-400">已禁用</span>
            )}
          </div>
          <p className="text-[10px] text-slate-600 leading-snug truncate">{preview}</p>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => setEditing(true)} className="p-1 hover:bg-white/40 rounded-lg">
            <Edit3 size={10} className="text-slate-400" />
          </button>
          <button onClick={() => onDelete(rule.id)} className="p-1 hover:bg-red-100/30 rounded-lg">
            <Trash2 size={10} className="text-red-400/70" />
          </button>
        </div>
        {hasFullText && (
          expanded
            ? <ChevronDown size={10} className="text-slate-300 shrink-0" />
            : <ChevronRight size={10} className="text-slate-300 shrink-0" />
        )}
      </div>

      {expanded && hasFullText && (
        <div className="ml-3 mb-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)' }}>
          <p className="text-[10px] text-slate-600 leading-relaxed">{rule.ruleText}</p>
        </div>
      )}
    </div>
  );
}

// ── 添加规则表单 ──────────────────────────────────────────────

export function AddRuleForm({ onAdd, onCancel }: {
  onAdd: (d: any) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    ruleText: '',
    rangeMin: '' as any,
    rangeMax: '' as any,
  });

  const canSubmit = form.ruleText.trim().length > 0;

  return (
    <div className="rounded-xl p-3 space-y-2.5 mt-1"
      style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)' }}>
      <div className="space-y-1">
        <span className="text-[9px] text-slate-400 uppercase tracking-wider">规则描述（必填）</span>
        <textarea
          value={form.ruleText}
          rows={3}
          placeholder="如：过于亲密接触减3-8，冷淡减1-2，进退有礼加1-3"
          onChange={e => setForm({ ...form, ruleText: e.target.value })}
          className={textareaCls}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['rangeMin', 'rangeMax'] as const).map((k, i) => (
          <div key={k} className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">{['适用范围下限', '适用范围上限'][i]}（可选）</span>
            <input type="number" value={form[k]} placeholder="不限"
              onChange={e => setForm({ ...form, [k]: e.target.value })} className={inputCls} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          disabled={!canSubmit}
          onClick={() => onAdd({
            ruleText: form.ruleText.trim(),
            rangeMin: form.rangeMin === '' ? undefined : +form.rangeMin,
            rangeMax: form.rangeMax === '' ? undefined : +form.rangeMax,
          })}
          className={`flex-1 ${btnPrimary} disabled:opacity-40`}
          style={{ background: 'linear-gradient(135deg, #c4b5fd, #a78bfa)' }}>
          添加
        </button>
        <button onClick={onCancel}
          className={btnGhost}
          style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.5)' }}>
          取消
        </button>
      </div>
    </div>
  );
}

// ── 规则区块 ──────────────────────────────────────────────────

export function RuleManager({ rules, viewFilter, onAdd, onUpdate, onDelete }: {
  rules: any[];
  viewFilter?: { min: number; max: number };
  onAdd: (d: any) => void;
  onUpdate: (d: any) => void;
  onDelete: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);

  // 按范围过滤：无范围限定的规则始终显示
  const visible = viewFilter
    ? rules.filter(r =>
        (r.rangeMin == null || r.rangeMin <= viewFilter.max) &&
        (r.rangeMax == null || r.rangeMax >= viewFilter.min)
      )
    : rules;

  const isFiltered = viewFilter && visible.length !== rules.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">规则</span>
          {isFiltered && (
            <span className="text-[8px] text-indigo-400/70 font-mono">
              {Math.round(viewFilter!.min)}–{Math.round(viewFilter!.max)}
            </span>
          )}
        </div>
        <button onClick={() => setAdding(v => !v)}
          className="flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-indigo-500 transition-colors">
          <Plus size={11} />添加规则
        </button>
      </div>

      {visible.length === 0 && !adding && (
        <p className="text-[10px] text-slate-400 py-2 text-center">
          {isFiltered ? '此范围内暂无规则' : '暂无规则'}
        </p>
      )}

      {visible.map(r => (
        <RuleEditRow key={r.id} rule={r} onUpdate={onUpdate} onDelete={onDelete} />
      ))}

      {adding && (
        <AddRuleForm
          onAdd={d => { onAdd(d); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
