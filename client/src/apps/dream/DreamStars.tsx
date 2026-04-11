import { useMemo } from 'react';
import { AnimeStar } from './AnimeStar.jsx';
import { Loader2 } from 'lucide-react';
import { SKY_RATIO, dreamSeed } from './dreamUtils.jsx';

// 天空同时最多显示的梦境星星数
const MAX_STARS = 20;

/**
 * 均匀分区选取：把天空分成 COLS×ROWS 网格，每格优先选 importance 最高的；
 * 同 importance 用稳定 seed 决胜（避免每帧乱跳）；超出 maxCount 后从剩余按 seed 补位。
 */
function pickUniform(dreams, maxCount) {
  if (dreams.length <= maxCount) return dreams;
  const COLS = 4, ROWS = 5;
  const cells = Array.from({ length: COLS * ROWS }, () => []);
  dreams.forEach(d => {
    const col = Math.min(COLS - 1, Math.floor((d.skyX ?? 50) / 100 * COLS));
    const row = Math.min(ROWS - 1, Math.floor((d.skyY ?? 50) / 100 * ROWS));
    cells[row * COLS + col].push(d);
  });
  const picked = [];
  cells.forEach(cell => {
    if (!cell.length) return;
    // 格内纯随机选一颗（稳定 seed，不按 importance）
    cell.sort((a, b) => dreamSeed(a.id) - dreamSeed(b.id));
    picked.push(cell[0]);
  });
  if (picked.length < maxCount) {
    const pickedIds = new Set(picked.map(d => d.id));
    const rest = dreams
      .filter(d => !pickedIds.has(d.id))
      .sort((a, b) => dreamSeed(a.id) - dreamSeed(b.id));
    picked.push(...rest.slice(0, maxCount - picked.length));
  }
  return picked.slice(0, maxCount);
}

/**
 * DreamStars — 渲染所有未解读梦境星星 + 空状态
 */
export const DreamStars = ({
  uninterpreted,
  interpreted,
  loading,
  selectedChar,
  containerRef,
  skyRef,
  bgWrapRef,
  onInterpret,
  onDelete,
}) => {
  // 均匀选取最多 MAX_STARS 颗；数据不变则缓存结果
  const visibleStars = useMemo(() => pickUniform(uninterpreted, MAX_STARS), [uninterpreted]);

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>

      {/* 每颗梦境星星 */}
      {visibleStars.map(dream => (
        <AnimeStar
          key={dream.id}
          dream={dream}
          containerRef={containerRef}
          skyRef={skyRef}
          bgWrapRef={bgWrapRef}
          onInterpret={onInterpret}
          onDelete={onDelete}
        />
      ))}

      {/* 空 / 加载状态（天空区域） */}
      {loading && (
        <div className="absolute flex items-center justify-center"
          style={{ top: 0, left: 0, right: 0, height: `${SKY_RATIO * 100}%`, pointerEvents: 'none' }}>
          <Loader2 size={20} className="animate-spin" style={{ color: 'rgba(160,180,255,0.4)' }} />
        </div>
      )}
      {!loading && uninterpreted.length === 0 && (
        <div className="absolute flex flex-col items-center justify-center gap-3"
          style={{ top: 0, left: 0, right: 0, height: `${SKY_RATIO * 100}%`, pointerEvents: 'none' }}>
          <p className="text-sm text-center leading-relaxed tracking-wide"
            style={{ color: 'rgba(180,200,255,0.22)' }}>
            夜空还空着<br />等待第一个梦境…
          </p>
        </div>
      )}
      {!loading && interpreted.length === 0 && (
        <div className="absolute flex items-center justify-center pointer-events-none"
          style={{ bottom: 0, left: 0, right: 0, height: `${(1 - SKY_RATIO) * 100}%` }}>
          <p className="text-[11px] tracking-wider" style={{ color: 'rgba(120,160,255,0.18)' }}>
            解读后的梦境会沉入这里
          </p>
        </div>
      )}
    </div>
  );
};
