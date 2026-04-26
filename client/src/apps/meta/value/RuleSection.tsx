import { useState } from 'react';
import { Edit3, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { TRIGGER_OPTIONS, OP_OPTIONS, inputCls, selectCls } from './constants';

const btnPrimary = 'transition-all rounded-xl text-xs font-medium py-1.5 text-white';
const btnGhost   = 'transition-all rounded-xl text-xs font-medium px-3 py-1.5 text-slate-500';

function triggerLabel(val: string) { return TRIGGER_OPTIONS.find(t => t.value === val)?.label ?? val; }
function opLabel(val: string)      { return OP_OPTIONS.find(o => o.value === val)?.label ?? val; }
function rangeText(r: any)         { return r.rangeMin != null && r.rangeMax != null ? `${r.rangeMin}–${r.rangeMax}` : '全范围'; }

// ── 规则行（折叠/展开/编辑） ─────────────────────────────────

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
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">触发时机</span>
            <select value={form.triggerOn}
              onChange={e => setForm({ ...form, triggerOn: e.target.value })} className={selectCls}>
              {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">操作</span>
            <select value={form.operation}
              onChange={e => setForm({ ...form, operation: e.target.value })} className={selectCls}>
              {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['rangeMin', 'rangeMax'] as const).map((k, i) => (
            <div key={k} className="space-y-1">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">{['范围下限', '范围上限'][i]}</span>
              <input type="number" value={form[k] ?? ''} placeholder="全范围"
                onChange={e => setForm({ ...form, [k]: e.target.value === '' ? null : +e.target.value })}
                className={inputCls} />
            </div>
          ))}
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">数值</span>
            <input type="number" value={form.amount} step="0.5"
              onChange={e => setForm({ ...form, amount: +e.target.value })} className={inputCls} />
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">说明</span>
          <input value={form.description ?? ''} placeholder="如：亲密接触减少 3-8"
            onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
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
          <button onClick={() => setEditing(false)}
            className={btnGhost}
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.5)' }}>
            取消
          </button>
        </div>
      </div>
    );
  }

  const hasDetail = !!rule.description;

  return (
    <div className={`mb-0.5 ${rule.enabled === 0 ? 'opacity-40' : ''}`}>
      <div
        className="flex items-center gap-2 py-2 px-2 rounded-xl cursor-pointer group transition-colors hover:bg-white/20"
        onClick={() => hasDetail && setExpanded(v => !v)}>
        <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: 'rgba(196,181,253,0.25)', color: '#7c3aed', border: '1px solid rgba(196,181,253,0.4)' }}>
            {triggerLabel(rule.triggerOn)}
          </span>
          <span className="text-[9px] text-slate-400 font-mono shrink-0">{rangeText(rule)}</span>
          <span className="text-xs font-semibold text-slate-700 shrink-0">
            {opLabel(rule.operation)} {rule.operation === 'add' && rule.amount >= 0 ? '+' : ''}{rule.amount}
          </span>
          {rule.enabled === 0 && (
            <span className="text-[8px] text-slate-400">已禁用</span>
          )}
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => setEditing(true)} className="p-1 hover:bg-white/40 rounded-lg">
            <Edit3 size={10} className="text-slate-400" />
          </button>
          <button onClick={() => onDelete(rule.id)} className="p-1 hover:bg-red-100/30 rounded-lg">
            <Trash2 size={10} className="text-red-400/70" />
          </button>
        </div>
        {hasDetail && (
          expanded
            ? <ChevronDown size={10} className="text-slate-300 shrink-0" />
            : <ChevronRight size={10} className="text-slate-300 shrink-0" />
        )}
      </div>

      {expanded && hasDetail && (
        <div className="ml-3 mb-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)' }}>
          <p className="text-[10px] text-slate-600 leading-relaxed">{rule.description}</p>
        </div>
      )}
    </div>
  );
}

// ── 添加规则表单 ─────────────────────────────────────────────

export function AddRuleForm({ onAdd, onCancel }: {
  onAdd: (d: any) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    triggerOn: 'chat_end', operation: 'add', amount: 1,
    rangeMin: '' as any, rangeMax: '' as any, description: '',
  });

  return (
    <div className="rounded-xl p-3 space-y-2.5 mt-1"
      style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)' }}>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">触发时机</span>
          <select value={form.triggerOn}
            onChange={e => setForm({ ...form, triggerOn: e.target.value })} className={selectCls}>
            {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">操作</span>
          <select value={form.operation}
            onChange={e => setForm({ ...form, operation: e.target.value })} className={selectCls}>
            {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(['rangeMin', 'rangeMax'] as const).map((k, i) => (
          <div key={k} className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">{['范围下限', '范围上限'][i]}</span>
            <input type="number" value={form[k]} placeholder="全范围"
              onChange={e => setForm({ ...form, [k]: e.target.value })} className={inputCls} />
          </div>
        ))}
        <div className="space-y-1">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">数值</span>
          <input type="number" value={form.amount} step="0.5"
            onChange={e => setForm({ ...form, amount: +e.target.value })} className={inputCls} />
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-[9px] text-slate-400 uppercase tracking-wider">说明</span>
        <input value={form.description} placeholder="如：亲密接触减少 3-8"
          onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAdd({
            ...form,
            rangeMin: form.rangeMin === '' ? undefined : +form.rangeMin,
            rangeMax: form.rangeMax === '' ? undefined : +form.rangeMax,
            description: form.description || undefined,
          })}
          className={`flex-1 ${btnPrimary}`}
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

// ── 规则区块 ─────────────────────────────────────────────────

export function RuleManager({ rules, viewFilter, onAdd, onUpdate, onDelete }: {
  rules: any[];
  viewFilter?: { min: number; max: number };
  onAdd: (d: any) => void;
  onUpdate: (d: any) => void;
  onDelete: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);

  // 按范围过滤：无范围限定（全范围）的规则始终显示
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
