import { useState, useRef, forwardRef } from 'react';
import {
  ITEM_SIZES, ITEM_SHADOW,
  ITEM_SEPIA, ITEM_HUE_ROTATE, ITEM_SATURATE, ITEM_BRIGHTNESS, ITEM_EDGE_BLUR,
  FLOAT_BOB_DURATION_MIN, FLOAT_BOB_DURATION_MAX,
  FLOAT_BOB_X, FLOAT_BOB_Y,
  SPIN_CHANCE, SPIN_MAX_DEG, SPIN_DUR_MIN, SPIN_DUR_MAX,
  TITLE_HOLD_MS, TITLE_FONT_SIZE, TITLE_MAX_CHARS,
  TITLE_COLOR, TITLE_SHADOW, TITLE_FONT_FAMILY, DBLCLICK_MS,
  SEARCH_FADE_OPACITY,
} from './params';
import { seededInt, seededFloat } from './utils';
import { Card } from './types';

// 素材图池（顺序必须与 params.ts ITEM_SIZES 一致）
const ITEM_IMAGES = [
  '/suixiang/嫩叶.png',   // 0 → SMALL
  '/suixiang/白花1.png',  // 1 → FLOWER
  '/suixiang/白花2.png',  // 2 → FLOWER
  '/suixiang/粉花1.png',  // 3 → FLOWER
  '/suixiang/粉花2.png',  // 4 → FLOWER
  '/suixiang/花瓣1.png',  // 5 → SMALL
  '/suixiang/花瓣2.png',  // 6 → SMALL
];

interface Props {
  card: Card;
  index: number;        // 保留供外部使用（WaterScene 传入）
  visible: boolean;     // false → 搜索不匹配，淡出
  onOpenModal: (card: Card) => void;
}

// ── forwardRef：外层漂移 div 的 ref 由 WaterScene 收集，直接写 transform ──────
const FloatingItem = forwardRef<HTMLDivElement, Props>(
  function FloatingItem({ card, index, visible, onOpenModal }, ref) {

    // ── 确定性属性（基于 card.id，同一随想永远相同）──────────────────────────
    const imgIdx  = seededInt(card.id, 1, ITEM_IMAGES.length);
    const imgSrc  = ITEM_IMAGES[imgIdx];
    const imgSize = ITEM_SIZES[imgIdx];

    // ── 晃动参数（水面浮动，纯 translate）────────────────────────────────────
    const bobDur   = seededFloat(card.id, 7, FLOAT_BOB_DURATION_MIN, FLOAT_BOB_DURATION_MAX);
    const bobPhase = seededFloat(card.id, 8, 0, bobDur);

    // ── 旋转参数（独立动画层）────────────────────────────────────────────────
    const doesSpin  = seededFloat(card.id, 20, 0, 1) < SPIN_CHANCE;
    const spinDir   = seededInt(card.id, 21, 2) === 0 ? 1 : -1;
    const spinDur   = seededFloat(card.id, 22, SPIN_DUR_MIN, SPIN_DUR_MAX);
    const spinPhase = seededFloat(card.id, 23, 0, spinDur);
    const baseAngle = seededFloat(card.id, 24, -8, 8);
    const spinPeak  = doesSpin
      ? spinDir * SPIN_MAX_DEG
      : spinDir * seededFloat(card.id, 25, 8, 35);

    // ── 安全的 CSS 动画 ID ────────────────────────────────────────────────────
    const uid    = card.id.replace(/[^a-z0-9]/gi, '').slice(0, 10) || `item${index}`;
    const bobId  = `sqxBob_${uid}`;
    const spinId = `sqxSpin_${uid}`;

    // ── 点击状态 ─────────────────────────────────────────────────────────────
    const [titleVisible, setTitleVisible] = useState(false);
    const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clickCount = useRef(0);
    const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleClick = () => {
      clickCount.current += 1;
      if (clickTimer.current) clearTimeout(clickTimer.current);

      clickTimer.current = setTimeout(() => {
        const n = clickCount.current;
        clickCount.current = 0;
        if (n >= 2) {
          setTitleVisible(false);
          if (titleTimer.current) clearTimeout(titleTimer.current);
          onOpenModal(card);
        } else {
          setTitleVisible(true);
          if (titleTimer.current) clearTimeout(titleTimer.current);
          titleTimer.current = setTimeout(() => setTitleVisible(false), TITLE_HOLD_MS);
        }
      }, DBLCLICK_MS);
    };

    // ── 竖排标题（超6字拆两列，右列先读）────────────────────────────────────
    const text = card.title.slice(0, TITLE_MAX_CHARS);
    const col1 = text.length > 6 ? text.slice(0, Math.ceil(text.length / 2)) : text;
    const col2 = text.length > 6 ? text.slice(Math.ceil(text.length / 2)) : null;

    // ── CSS Keyframes（仅 bob 和 spin，drift 由 WaterScene JS 物理控制）────────
    const keyframes = `
      @keyframes ${bobId} {
        0%   { transform: translate(0px, 0px); }
        22%  { transform: translate(${FLOAT_BOB_X}px, ${(FLOAT_BOB_Y * 0.5).toFixed(1)}px); }
        48%  { transform: translate(${(FLOAT_BOB_X * 0.4).toFixed(1)}px, ${FLOAT_BOB_Y}px); }
        73%  { transform: translate(${(-FLOAT_BOB_X * 0.7).toFixed(1)}px, ${(FLOAT_BOB_Y * 0.6).toFixed(1)}px); }
        100% { transform: translate(0px, 0px); }
      }
      @keyframes ${spinId} {
        0%   { transform: rotate(${baseAngle.toFixed(1)}deg); }
        15%  { transform: rotate(${(baseAngle + spinPeak * 0.08).toFixed(1)}deg); }
        42%  { transform: rotate(${(baseAngle + spinPeak * 0.88).toFixed(1)}deg); }
        58%  { transform: rotate(${(baseAngle + spinPeak).toFixed(1)}deg); }
        80%  { transform: rotate(${(baseAngle + spinPeak * 0.92).toFixed(1)}deg); }
        100% { transform: rotate(${baseAngle.toFixed(1)}deg); }
      }
      @keyframes sqxTitleIn {
        from { opacity: 0; transform: translateX(-50%) translateY(5px); }
        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;

    const colStyle: React.CSSProperties = {
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

        {/*
         * 外层 div：位置由 WaterScene RAF 通过 ref 写入 transform: translate(x,y)
         * left/top 固定为 0，WaterScene 负责计算绝对坐标
         */}
        <div
          ref={ref}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            opacity: visible ? 1 : SEARCH_FADE_OPACITY,
            transition: 'opacity 0.6s ease',
            zIndex: 10,
            cursor: 'pointer',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            willChange: 'transform',
          }}
          onClick={handleClick}
        >
          {/*
           * 居中层：静态 translate(-imgSize/2, -imgSize/2)
           * 使外层 div 的 (0,0) 对应图片中心，与 bob 动画互不干扰
           */}
          <div style={{ transform: `translate(-${imgSize / 2}px, -${imgSize / 2}px)` }}>

            {/*
             * 晃动层：水面小幅浮动（translate，不含旋转）
             * position: relative → 标题 absolute 定位参照
             */}
            <div
              style={{
                position: 'relative',
                animation: `${bobId} ${bobDur.toFixed(1)}s ease-in-out infinite`,
                animationDelay: `-${bobPhase.toFixed(1)}s`,
                filter: [
                  ITEM_EDGE_BLUR > 0 ? `blur(${ITEM_EDGE_BLUR}px)` : '',
                  `sepia(${ITEM_SEPIA})`,
                  `hue-rotate(${ITEM_HUE_ROTATE}deg)`,
                  `saturate(${ITEM_SATURATE})`,
                  `brightness(${ITEM_BRIGHTNESS})`,
                  `drop-shadow(${ITEM_SHADOW})`,
                ].filter(Boolean).join(' '),
                willChange: 'transform',
              }}
            >
              {/*
               * 旋转层：有时慢摆，偶尔打旋（独立于晃动）
               * 标题在此层外 → 标题不跟随旋转
               */}
              <div
                style={{
                  animation: `${spinId} ${spinDur.toFixed(1)}s ease-in-out infinite`,
                  animationDelay: `-${spinPhase.toFixed(1)}s`,
                }}
              >
                <img
                  src={imgSrc}
                  alt={card.title}
                  draggable={false}
                  style={{
                    width: imgSize,
                    height: imgSize,
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
                    bottom: imgSize + 5,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 3,
                    animation: 'sqxTitleIn 0.35s ease',
                    pointerEvents: 'none',
                  }}
                >
                  {col2 && <span style={colStyle}>{col2}</span>}
                  <span style={colStyle}>{col1}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }
);

FloatingItem.displayName = 'FloatingItem';
export default FloatingItem;
