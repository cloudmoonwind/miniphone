import { useRef, useCallback } from 'react';
import { STAGE_PALETTE } from './constants';

// ── 双滑块：视图范围选择器 ────────────────────────────────────

export function DualRangeBar({ value, stages, colorBy, viewLeft, viewRight, onViewChange }: {
  value: any;
  stages: any[];
  colorBy: 'stages' | 'rules';
  viewLeft: number;
  viewRight: number;
  onViewChange: (l: number, r: number) => void;
}) {
  const { minValue, maxValue, currentValue } = value;
  const range = maxValue - minValue || 1;
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = (v: number) => Math.max(0, Math.min(100, ((v - minValue) / range) * 100));

  const getVal = (clientX: number) => {
    if (!trackRef.current) return minValue;
    const rect = trackRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return minValue + p * range;
  };

  const startDrag = useCallback((which: 'left' | 'right') => (e: React.PointerEvent) => {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => {
      const v = getVal(ev.clientX);
      if (which === 'left')  onViewChange(Math.min(v, viewRight - 1), viewRight);
      else                   onViewChange(viewLeft, Math.max(viewLeft + 1, v));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [viewLeft, viewRight, onViewChange]);

  const sortedStages = [...stages].sort((a, b) => a.rangeMin - b.rangeMin);

  return (
    <div className="space-y-2 select-none">
      {/* 端值 */}
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>{minValue}</span>
        <span>{maxValue}</span>
      </div>

      {/* 轨道 */}
      <div ref={trackRef} className="relative h-10 flex items-center cursor-crosshair">

        {/* 轨道底层 */}
        <div className="absolute left-0 right-0 h-2 rounded-full"
          style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)' }}>

          {/* 阶段色块 */}
          {colorBy === 'stages' && sortedStages.map((s, i) => (
            <div key={s.id}
              className="absolute top-0 h-full rounded-full opacity-50"
              style={{
                left:  `${pct(s.rangeMin)}%`,
                width: `${Math.max(0, pct(s.rangeMax) - pct(s.rangeMin))}%`,
                backgroundColor: STAGE_PALETTE[i % STAGE_PALETTE.length],
              }}
            />
          ))}

          {/* 视图范围高亮 */}
          <div className="absolute top-0 h-full rounded-full"
            style={{
              left:  `${pct(viewLeft)}%`,
              width: `${Math.max(0, pct(viewRight) - pct(viewLeft))}%`,
              background: 'rgba(129,140,248,0.25)',
              border: '1px solid rgba(129,140,248,0.3)',
            }}
          />
        </div>

        {/* 当前值标记（细竖线） */}
        <div className="absolute pointer-events-none"
          style={{
            left:      `${pct(currentValue)}%`,
            transform: 'translateX(-50%)',
            width:     '1.5px',
            height:    '20px',
            background: 'linear-gradient(to bottom, rgba(99,102,241,0.8), rgba(99,102,241,0.2))',
            borderRadius: '1px',
          }}
        />

        {/* 当前值气泡 */}
        <div className="absolute pointer-events-none"
          style={{
            left:      `${pct(currentValue)}%`,
            bottom:    '100%',
            transform: 'translateX(-50%)',
            marginBottom: '4px',
          }}>
          <div className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-indigo-600"
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(129,140,248,0.3)' }}>
            {Math.round(currentValue)}
          </div>
        </div>

        {/* 左滑块（空心圆） */}
        <div
          onPointerDown={startDrag('left')}
          className="absolute w-4 h-4 rounded-full cursor-grab active:cursor-grabbing z-10 transition-transform active:scale-110"
          style={{
            left:      `${pct(viewLeft)}%`,
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.85)',
            border:    '2px solid rgba(129,140,248,0.6)',
            boxShadow: '0 1px 6px rgba(99,102,241,0.2)',
          }}
        />

        {/* 右滑块（实心圆） */}
        <div
          onPointerDown={startDrag('right')}
          className="absolute w-4 h-4 rounded-full cursor-grab active:cursor-grabbing z-10 transition-transform active:scale-110"
          style={{
            left:      `${pct(viewRight)}%`,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #a5b4fc, #818cf8)',
            border:    '2px solid rgba(255,255,255,0.6)',
            boxShadow: '0 1px 8px rgba(99,102,241,0.35)',
          }}
        />
      </div>

      {/* 范围文字 */}
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-slate-400">
          视图 <span className="text-indigo-500 font-medium">{Math.round(viewLeft)}</span>
          <span className="text-slate-300 mx-1">—</span>
          <span className="text-indigo-500 font-medium">{Math.round(viewRight)}</span>
        </span>
        <span className="text-slate-300 text-[8px]">拖动手柄调整范围</span>
      </div>
    </div>
  );
}

// ── 离散变量状态选择器 ────────────────────────────────────────

export function DiscreteTokens({ stages, currentValue, onSelect }: {
  stages: any[];
  currentValue: number;
  onSelect: (idx: number) => void;
}) {
  const sorted = [...stages].sort((a, b) => a.rangeMin - b.rangeMin);

  if (sorted.length === 0) {
    return <p className="py-4 text-center text-xs text-slate-400">暂无选项，请在下方添加状态</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((s, i) => {
        const isActive = Math.round(currentValue) === i;
        const color    = STAGE_PALETTE[i % STAGE_PALETTE.length];
        return (
          <button key={s.id} onClick={() => onSelect(i)}
            className="px-3 py-1.5 text-xs font-medium rounded-full transition-all"
            style={{
              background:  isActive ? color : 'rgba(255,255,255,0.35)',
              border:      `1.5px solid ${isActive ? color : 'rgba(255,255,255,0.5)'}`,
              color:       isActive ? 'white' : '#475569',
              boxShadow:   isActive ? `0 2px 8px ${color}50` : 'none',
            }}>
            {s.stageName}
          </button>
        );
      })}
    </div>
  );
}
