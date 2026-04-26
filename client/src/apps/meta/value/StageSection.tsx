import { useState } from 'react';
import { Edit3, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { STAGE_PALETTE, inputCls, textareaCls } from './constants';

const btnBase = 'transition-all rounded-xl text-xs font-medium';
const btnPrimary = `${btnBase} py-1.5 text-white` ;
const btnGhost = `${btnBase} px-3 py-1.5 text-slate-500`;

// ── 阶段行（折叠/展开/编辑） ─────────────────────────────────

export function StageEditRow({ stage, isDiscrete, color, onUpdate, onDelete }: {
  stage: any; isDiscrete?: boolean; color: string;
  onUpdate: (d: any) => void; onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [form,     setForm]     = useState(stage);

  const save = () => { onUpdate(form); setEditing(false); };

  if (editing) {
    return (
      <div className="rounded-xl p-3 space-y-2.5 mb-1"
        style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)' }}>
        <div className={`grid gap-2 ${isDiscrete ? 'grid-cols-1' : 'grid-cols-3'}`}>
          {!isDiscrete && (
            <>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider">最小</span>
                <input type="number" value={form.rangeMin}
                  onChange={e => setForm({ ...form, rangeMin: +e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider">最大</span>
                <input type="number" value={form.rangeMax}
                  onChange={e => setForm({ ...form, rangeMax: +e.target.value })} className={inputCls} />
              </div>
            </>
          )}
          <div className="space-y-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider">{isDiscrete ? '选项名' : '阶段名'}</span>
            <input value={form.stageName} onChange={e => setForm({ ...form, stageName: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">描述</span>
          <input value={form.description ?? ''} placeholder="简短描述"
            onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
        </div>
        <div className="space-y-1">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">提示词片段</span>
          <textarea value={form.promptSnippet ?? ''} placeholder="此阶段注入给 AI 的上下文" rows={3}
            onChange={e => setForm({ ...form, promptSnippet: e.target.value })} className={textareaCls} />
        </div>
        <div className="flex gap-2">
          <button onClick={save}
            className={`flex-1 ${btnPrimary}`}
            style={{ background: 'linear-gradient(135deg, #a5b4fc, #818cf8)' }}>
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

  return (
    <div className="mb-0.5">
      <div
        className="flex items-center gap-2 py-2 px-2 rounded-xl cursor-pointer group transition-colors hover:bg-white/20"
        onClick={() => setExpanded(v => !v)}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        {!isDiscrete && (
          <span className="text-[9px] text-slate-400 font-mono w-12 shrink-0">{stage.rangeMin}–{stage.rangeMax}</span>
        )}
        <span className="text-xs text-slate-700 font-medium flex-1 truncate">{stage.stageName}</span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={() => setEditing(true)} className="p-1 hover:bg-white/40 rounded-lg">
            <Edit3 size={10} className="text-slate-400" />
          </button>
          <button onClick={() => onDelete(stage.id)} className="p-1 hover:bg-red-100/30 rounded-lg">
            <Trash2 size={10} className="text-red-400/70" />
          </button>
        </div>
        {(stage.description || stage.promptSnippet) && (
          expanded
            ? <ChevronDown size={10} className="text-slate-300 shrink-0" />
            : <ChevronRight size={10} className="text-slate-300 shrink-0" />
        )}
      </div>

      {expanded && (stage.description || stage.promptSnippet) && (
        <div className="ml-5 mb-2 px-3 py-2 rounded-xl space-y-1"
          style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)' }}>
          {stage.description && (
            <p className="text-[10px] text-slate-600 leading-relaxed">{stage.description}</p>
          )}
          {stage.promptSnippet && (
            <p className="text-[10px] text-slate-400 leading-relaxed italic">{stage.promptSnippet}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── 添加阶段表单 ─────────────────────────────────────────────

export function AddStageForm({ isDiscrete, nextIndex, onAdd, onCancel }: {
  isDiscrete?: boolean; nextIndex: number;
  onAdd: (d: any) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    rangeMin: isDiscrete ? nextIndex : 0,
    rangeMax: isDiscrete ? nextIndex : 100,
    stageName: '', description: '', promptSnippet: '',
  });

  return (
    <div className="rounded-xl p-3 space-y-2.5 mt-1"
      style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)' }}>
      <div className={`grid gap-2 ${isDiscrete ? 'grid-cols-1' : 'grid-cols-3'}`}>
        {!isDiscrete && (
          <>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">最小</span>
              <input type="number" value={form.rangeMin}
                onChange={e => setForm({ ...form, rangeMin: +e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">最大</span>
              <input type="number" value={form.rangeMax}
                onChange={e => setForm({ ...form, rangeMax: +e.target.value })} className={inputCls} />
            </div>
          </>
        )}
        <div className="space-y-1">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider">{isDiscrete ? '选项名' : '阶段名'}</span>
          <input value={form.stageName}
            onChange={e => setForm({ ...form, stageName: e.target.value })}
            placeholder={isDiscrete ? '如：喜悦' : '如：陌生期'} className={inputCls} autoFocus />
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-[9px] text-slate-400 uppercase tracking-wider">描述</span>
        <input value={form.description} placeholder="简短描述"
          onChange={e => setForm({ ...form, description: e.target.value })} className={inputCls} />
      </div>
      <div className="space-y-1">
        <span className="text-[9px] text-slate-400 uppercase tracking-wider">提示词片段</span>
        <textarea value={form.promptSnippet} placeholder="此阶段注入给 AI 的上下文" rows={3}
          onChange={e => setForm({ ...form, promptSnippet: e.target.value })} className={textareaCls} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { if (form.stageName.trim()) onAdd(form); }}
          disabled={!form.stageName.trim()}
          className={`flex-1 ${btnPrimary} disabled:opacity-30`}
          style={{ background: 'linear-gradient(135deg, #a5b4fc, #818cf8)' }}>
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

// ── 阶段区块 ─────────────────────────────────────────────────

export function StageManager({ stages, isDiscrete, viewFilter, onAdd, onUpdate, onDelete }: {
  stages: any[];
  isDiscrete?: boolean;
  viewFilter?: { min: number; max: number };
  onAdd: (d: any) => void;
  onUpdate: (d: any) => void;
  onDelete: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false);

  const sorted = [...stages].sort((a, b) => a.rangeMin - b.rangeMin);

  // 视图范围过滤（仅连续变量）
  const visible = viewFilter && !isDiscrete
    ? sorted.filter(s => s.rangeMax >= viewFilter.min && s.rangeMin <= viewFilter.max)
    : sorted;

  const isFiltered = viewFilter && !isDiscrete && visible.length !== sorted.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
            {isDiscrete ? '状态选项' : '阶段'}
          </span>
          {isFiltered && (
            <span className="text-[8px] text-indigo-400/70 font-mono">
              {Math.round(viewFilter!.min)}–{Math.round(viewFilter!.max)}
            </span>
          )}
        </div>
        <button onClick={() => setAdding(v => !v)}
          className="flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-indigo-500 transition-colors">
          <Plus size={11} />
          {isDiscrete ? '添加状态' : '添加阶段'}
        </button>
      </div>

      {visible.length === 0 && !adding && (
        <p className="text-[10px] text-slate-400 py-2 text-center">
          {isFiltered ? '此范围内暂无阶段' : `暂无${isDiscrete ? '状态' : '阶段'}`}
        </p>
      )}

      {visible.map((s, i) => (
        <StageEditRow
          key={s.id}
          stage={s}
          isDiscrete={isDiscrete}
          color={STAGE_PALETTE[sorted.indexOf(s) % STAGE_PALETTE.length]}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}

      {adding && (
        <AddStageForm
          isDiscrete={isDiscrete}
          nextIndex={sorted.length}
          onAdd={d => { onAdd(d); setAdding(false); }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
