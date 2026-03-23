import { AnimeStar } from './AnimeStar.jsx';
import { Loader2 } from 'lucide-react';
import { SKY_RATIO } from './dreamUtils.jsx';

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
  onInterpret,
  onDelete,
}) => (
  <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>

    {/* 每颗梦境星星 */}
    {uninterpreted.map(dream => (
      <AnimeStar
        key={dream.id}
        dream={dream}
        containerRef={containerRef}
        skyRef={skyRef}
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
