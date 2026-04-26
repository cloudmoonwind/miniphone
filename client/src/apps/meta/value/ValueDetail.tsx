import { useState, useEffect } from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import { getCat } from './constants';
import { DualRangeBar, DiscreteTokens } from './RangeBar';
import { StageManager } from './StageSection';
import { RuleManager } from './RuleSection';

const api = (path: string, opts: any = {}) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

const Glass = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl px-4 py-3 ${className}`}
    style={{
      background: 'rgba(255,255,255,0.28)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.5)',
    }}>
    {children}
  </div>
);

export function ValueDetail({ value, onReload, onEdit, onDelete }: {
  value: any;
  onReload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [stages,    setStages]    = useState<any[]>([]);
  const [rules,     setRules]     = useState<any[]>([]);
  const [adjusting, setAdjusting] = useState(false);
  const [colorBy,   setColorBy]   = useState<'stages' | 'rules'>('stages');
  const [viewLeft,  setViewLeft]  = useState(value.minValue);
  const [viewRight, setViewRight] = useState(value.maxValue);

  const isDiscrete = value.valueType === 'discrete';
  const cat = getCat(value.category);
  const sortedStages = [...stages].sort((a, b) => a.rangeMin - b.rangeMin);

  const load = async () => {
    const [s, r] = await Promise.all([
      api(`/values/item/${value.id}/stages`),
      api(`/values/item/${value.id}/rules`),
    ]);
    setStages(Array.isArray(s) ? s : []);
    setRules(Array.isArray(r) ? r : []);
  };

  useEffect(() => {
    load();
    setViewLeft(value.minValue);
    setViewRight(value.maxValue);
  }, [value.id]);

  const handleAdjust = async (delta: number) => {
    if (adjusting) return;
    setAdjusting(true);
    await api(`/values/item/${value.id}/adjust`, { method: 'POST', body: JSON.stringify({ delta }) });
    await onReload();
    setAdjusting(false);
  };

  const handleSetValue = async (newVal: number) => {
    await api(`/values/item/${value.id}`, { method: 'PUT', body: JSON.stringify({ currentValue: newVal }) });
    onReload();
  };

  const handleAddStage    = async (data: any)   => { await api(`/values/item/${value.id}/stages`, { method: 'POST', body: JSON.stringify(data) }); await load(); onReload(); };
  const handleUpdateStage = async (data: any)   => { await api(`/values/stages/${data.id}`, { method: 'PUT', body: JSON.stringify(data) }); await load(); };
  const handleDeleteStage = async (id: number)  => { await api(`/values/stages/${id}`, { method: 'DELETE' }); await load(); onReload(); };
  const handleAddRule     = async (data: any)   => { await api(`/values/item/${value.id}/rules`, { method: 'POST', body: JSON.stringify(data) }); await load(); };
  const handleUpdateRule  = async (data: any)   => { await api(`/values/rules/${data.id}`, { method: 'PUT', body: JSON.stringify(data) }); await load(); };
  const handleDeleteRule  = async (id: number)  => { await api(`/values/rules/${id}`, { method: 'DELETE' }); await load(); };

  const currentStage = isDiscrete
    ? sortedStages[Math.round(value.currentValue)]
    : sortedStages.find((s, i) => {
        if (i === sortedStages.length - 1) return value.currentValue >= s.rangeMin && value.currentValue <= s.rangeMax;
        return value.currentValue >= s.rangeMin && value.currentValue < s.rangeMax;
      });

  const viewFilter = { min: viewLeft, max: viewRight };

  return (
    <div className="h-full overflow-y-auto px-3 py-3 space-y-2.5">

      {/* ── 变量信息头 ── */}
      <Glass>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-base font-semibold text-slate-800">{value.name}</span>
              <span className="text-[10px] text-slate-400 font-mono">{value.variableName}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{
                  color: cat.color,
                  background: cat.color + '18',
                  border: `1px solid ${cat.color}40`,
                }}>
                {cat.label}
              </span>
              <span className="text-[9px] text-slate-400">
                {isDiscrete ? '离散状态' : `${value.minValue} – ${value.maxValue}`}
              </span>
              {value.groupName && (
                <span className="text-[9px] text-slate-400/60">{value.groupName}</span>
              )}
            </div>
          </div>
          <div className="flex gap-0.5 shrink-0">
            <button onClick={onEdit}
              className="p-1.5 hover:bg-white/40 rounded-full transition-colors">
              <Edit3 size={12} className="text-slate-400" />
            </button>
            <button onClick={onDelete}
              className="p-1.5 hover:bg-red-100/30 rounded-full transition-colors">
              <Trash2 size={12} className="text-red-400/70" />
            </button>
          </div>
        </div>
      </Glass>

      {/* ── 连续变量 ── */}
      {!isDiscrete && (
        <>
          {/* 当前值卡 */}
          <Glass>
            <div className="flex items-center gap-3">
              <button onClick={() => handleAdjust(-5)} disabled={adjusting}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-slate-600 disabled:opacity-30 transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)' }}>
                −5
              </button>
              <div className="flex-1 text-center">
                <div className="text-3xl font-light text-slate-800 tracking-wider">
                  {Math.round(value.currentValue)}
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">/ {value.maxValue}</div>
              </div>
              <button onClick={() => handleAdjust(+5)} disabled={adjusting}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs text-slate-600 disabled:opacity-30 transition-all hover:scale-105"
                style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)' }}>
                +5
              </button>
            </div>

            {currentStage && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.4)' }}>
                <div className="text-xs font-semibold text-slate-700">{currentStage.stageName}</div>
                {currentStage.description && (
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                    {currentStage.description}
                  </div>
                )}
              </div>
            )}
          </Glass>

          {/* 轨道 + 双滑块 */}
          <Glass>
            <DualRangeBar
              value={value}
              stages={sortedStages}
              colorBy={colorBy}
              viewLeft={viewLeft}
              viewRight={viewRight}
              onViewChange={(l, r) => { setViewLeft(l); setViewRight(r); }}
            />
            {/* 着色模式切换 */}
            <div className="mt-2.5 flex justify-end">
              <div className="flex rounded-full overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.45)' }}>
                {(['stages', 'rules'] as const).map(mode => (
                  <button key={mode} onClick={() => setColorBy(mode)}
                    className="px-2.5 py-0.5 text-[9px] transition-colors"
                    style={{
                      background: colorBy === mode ? 'rgba(255,255,255,0.5)' : 'transparent',
                      color: colorBy === mode ? '#475569' : '#94a3b8',
                    }}>
                    {mode === 'stages' ? '按阶段' : '按规则'}
                  </button>
                ))}
              </div>
            </div>
          </Glass>

          {/* 阶段（由视图范围过滤） */}
          <Glass>
            <StageManager
              stages={stages}
              isDiscrete={false}
              viewFilter={viewFilter}
              onAdd={handleAddStage}
              onUpdate={handleUpdateStage}
              onDelete={handleDeleteStage}
            />
          </Glass>

          {/* 规则（由视图范围过滤） */}
          <Glass className="mb-4">
            <RuleManager
              rules={rules}
              viewFilter={viewFilter}
              onAdd={handleAddRule}
              onUpdate={handleUpdateRule}
              onDelete={handleDeleteRule}
            />
          </Glass>
        </>
      )}

      {/* ── 离散变量 ── */}
      {isDiscrete && (
        <>
          <Glass>
            <div className="text-[9px] uppercase tracking-widest text-slate-400 mb-3">当前状态</div>
            <DiscreteTokens
              stages={sortedStages}
              currentValue={value.currentValue}
              onSelect={handleSetValue}
            />
            {currentStage && (currentStage.description || currentStage.promptSnippet) && (
              <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.4)' }}>
                {currentStage.description && (
                  <div className="text-xs text-slate-700">{currentStage.description}</div>
                )}
                {currentStage.promptSnippet && (
                  <div className="text-[10px] text-slate-500 leading-relaxed">{currentStage.promptSnippet}</div>
                )}
              </div>
            )}
          </Glass>

          <Glass>
            <StageManager
              stages={stages}
              isDiscrete={true}
              onAdd={handleAddStage}
              onUpdate={handleUpdateStage}
              onDelete={handleDeleteStage}
            />
          </Glass>

          <Glass className="mb-4">
            <RuleManager
              rules={rules}
              onAdd={handleAddRule}
              onUpdate={handleUpdateRule}
              onDelete={handleDeleteRule}
            />
          </Glass>
        </>
      )}
    </div>
  );
}
