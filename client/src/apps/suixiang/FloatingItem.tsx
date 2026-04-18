import { useState, useRef } from 'react';
import {
  ITEM_SIZE, ITEM_SHADOW, FLOAT_DURATION_MIN, FLOAT_DURATION_MAX,
  FLOAT_DRIFT_X, FLOAT_DRIFT_Y, FLOAT_ROTATION,
  TITLE_HOLD_MS, TITLE_FONT_SIZE, TITLE_MAX_CHARS, TITLE_COLOR,
  TITLE_SHADOW, TITLE_FONT_FAMILY, DBLCLICK_MS,
  SEARCH_FADE_OPACITY, FLOW_POSITIONS,
} from './params';
import { seededInt, seededFloat } from './utils';
import { Card } from './types';

// 素材图池（顺序对应 seededInt 的结果）
const ITEM_IMAGES = [
  '/suixiang/嫩叶.png',
  '/suixiang/白花1.png',
  '/suixiang/白花2.png',
  '/suixiang/粉花1.png',
  '/suixiang/粉花2.png',
  '/suixiang/花瓣1.png',
  '/suixiang/花瓣2.png',
];

interface Props {
  card: Card;
  index: number;        // 在当前列表中的序号，用于分配位置
  totalCount: number;   // 列表总数，用于保证位置分散
  visible: boolean;     // 搜索命中时为 true，否则淡出
  onOpenModal: (card: Card) => void;
}

export default function FloatingItem({ card, index, totalCount, visible, onOpenModal }: Props) {
  // 基于 card.id 的确定性属性（素材图、位置、动效参数）
  const imgSrc  = ITEM_IMAGES[seededInt(card.id, 1, ITEM_IMAGES.length)];
  // 位置：优先按 index 分散（避免堆叠），再用 seeded 偏移做细调
  const posIdx  = index % FLOW_POSITIONS.length;
  const pos     = FLOW_POSITIONS[posIdx];
  const dur     = seededFloat(card.id, 2, FLOAT_DURATION_MIN, FLOAT_DURATION_MAX);
  const phase   = seededFloat(card.id, 3, 0, dur);   // 动画初始相位，避免所有图同步摆动
  const animId  = `float-${card.id.replace(/[^a-z0-9]/gi, '').slice(0, 8)}`;

  const [titleVisible, setTitleVisible] = useState(false);
  const titleTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef  = useRef(0);
  const clickTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    clickTimerRef.current = setTimeout(() => {
      const count = clickCountRef.current;
      clickCountRef.current = 0;

      if (count >= 2) {
        // 双击 → 打开弹窗
        setTitleVisible(false);
        if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
        onOpenModal(card);
      } else {
        // 单击 → 显示竖排标题（5秒后自动消失）
        setTitleVisible(true);
        if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
        titleTimerRef.current = setTimeout(() => setTitleVisible(false), TITLE_HOLD_MS);
      }
    }, DBLCLICK_MS);
  };

  // 标题分列：超6字拆成两列（右列先读，符合竖排阅读习惯）
  const text = card.title.slice(0, TITLE_MAX_CHARS);
  const col1 = text.length > 6 ? text.slice(0, Math.ceil(text.length / 2)) : text;
  const col2 = text.length > 6 ? text.slice(Math.ceil(text.length / 2)) : null;

  // CSS keyframes（每个 item 独立 animId 避免冲突）
  const keyframes = `
    @keyframes ${animId} {
      0%   { transform: translate(0px, 0px)               rotate(${-FLOAT_ROTATION / 2}deg); }
      20%  { transform: translate(${FLOAT_DRIFT_X}px,     ${FLOAT_DRIFT_Y * 0.5}px) rotate(${FLOAT_ROTATION * 0.4}deg); }
      45%  { transform: translate(${FLOAT_DRIFT_X * 0.4}px, ${FLOAT_DRIFT_Y}px)    rotate(${FLOAT_ROTATION}deg); }
      70%  { transform: translate(-${FLOAT_DRIFT_X * 0.7}px, ${FLOAT_DRIFT_Y * 0.6}px) rotate(${FLOAT_ROTATION * 0.2}deg); }
      100% { transform: translate(0px, 0px)               rotate(${-FLOAT_ROTATION / 2}deg); }
    }
    @keyframes titleIn {
      from { opacity: 0; transform: translateX(-50%) translateY(4px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;

  const titleTextStyle: React.CSSProperties = {
    writingMode: 'vertical-rl',
    textOrientation: 'mixed',
    fontSize: TITLE_FONT_SIZE,
    color: TITLE_COLOR,
    textShadow: TITLE_SHADOW,
    fontFamily: TITLE_FONT_FAMILY,
    letterSpacing: '0.08em',
    lineHeight: 1.4,
    userSelect: 'none',
    pointerEvents: 'none',
  };

  return (
    <>
      <style>{keyframes}</style>
      <div
        style={{
          position: 'absolute',
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: 'translate(-50%, -50%)',
          opacity: visible ? 1 : SEARCH_FADE_OPACITY,
          transition: 'opacity 0.6s ease',
          zIndex: 10,
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onClick={handleClick}
      >
        {/* 漂浮素材图 */}
        <div
          style={{
            animation: `${animId} ${dur.toFixed(2)}s ease-in-out infinite`,
            animationDelay: `-${phase.toFixed(2)}s`,
            filter: `drop-shadow(${ITEM_SHADOW})`,
            willChange: 'transform',
          }}
        >
          <img
            src={imgSrc}
            alt={card.title}
            draggable={false}
            style={{
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>

        {/* 竖排标题（单击后浮现，TITLE_HOLD_MS 后消失）*/}
        {titleVisible && (
          <div
            style={{
              position: 'absolute',
              bottom: ITEM_SIZE + 6,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'row',   // col2（左） col1（右），右列先读
              gap: 3,
              animation: 'titleIn 0.35s ease',
              pointerEvents: 'none',
            }}
          >
            {/* 若有第二列，放在 col1 左侧 */}
            {col2 && <span style={titleTextStyle}>{col2}</span>}
            <span style={titleTextStyle}>{col1}</span>
          </div>
        )}
      </div>
    </>
  );
}
