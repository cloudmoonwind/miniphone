import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { DREAM_TYPES, SKY_RATIO, AnimeStar as StarSVG, getStarSize, hexRgb } from './dreamUtils.jsx';
import { DreamCard } from './DreamCard.jsx';

/**
 * AnimeStar — 单个梦境星星，完整状态机：
 *
 * idle       → 天空中浮动，等待点击
 * excited    → 被点击，兴奋晃动
 * approaching→ 飞向屏幕中心并放大
 * flash      → 抵达中心，白光爆闪
 * card       → 变成半透明卡片
 * departing  → 卡片关闭，星星从中心缩回原位
 * drunk      → 回到原位，黯淡醉酒闪烁（已解梦）
 * falling    → 像流星一样滑落入水
 * gone       → 消失（已解梦，在水中显示倒影）
 */
export const AnimeStar = ({ dream, containerRef, skyRef, onInterpret, onDelete }) => {
  const [phase, setPhase] = useState('idle');
  const [showCard, setShowCard] = useState(false);
  const [flashVisible, setFlashVisible] = useState(false);
  const [scope, animate] = useAnimate();
  const centerOffset = useRef({ x: 0, y: 0 });

  const color   = DREAM_TYPES[dream.type]?.color || '#C0B8D8';
  const [r, g, b] = hexRgb(color);
  const starSize  = getStarSize(dream.importance);

  // 计算当前星星到容器中心的像素偏移
  const calcOffset = useCallback(() => {
    const el  = scope.current;
    const con = containerRef.current;
    if (!el || !con) return { x: 0, y: 0 };
    const eR = el.getBoundingClientRect();
    const cR = con.getBoundingClientRect();
    return {
      x: (cR.left + cR.width  / 2) - (eR.left + eR.width  / 2),
      y: (cR.top  + cR.height / 2) - (eR.top  + eR.height / 2),
    };
  }, [scope, containerRef]);

  // ── 点击：idle → excited → approaching → flash → card ─────────────────
  const handleClick = useCallback(async () => {
    if (phase !== 'idle') return;

    const offset = calcOffset();
    centerOffset.current = offset;

    // 1. 兴奋晃动
    setPhase('excited');
    await animate(scope.current, {
      rotate: [0, -22, 16, -12, 9, -5, 2, 0],
      scale:  [1, 1.35, 1.1, 1.3, 1.05, 1.25, 1.0, 1.1],
      y:      [0, -6, 3, -5, 2, -3, 0, -2],
    }, { duration: 0.55, ease: 'easeInOut' });

    // 2. 飞向屏幕中心 + 放大
    setPhase('approaching');
    await animate(scope.current, {
      x:     offset.x,
      y:     offset.y,
      scale: 5,
    }, { duration: 0.65, ease: [0.22, 0, 0.1, 1] });

    // 3. 星星收缩消融（不扩大，直接淡出，避免白屏）
    setPhase('flash');
    setFlashVisible(true);
    await animate(scope.current, {
      scale:   [5, 3.5, 2],
      opacity: [1, 0.2, 0],
    }, { duration: 0.3, ease: 'easeIn', times: [0, 0.4, 1] });
    setFlashVisible(false);

    // 4. 展示卡片
    setShowCard(true);
    setPhase('card');
    // 触发 Canvas 爆炸粒子
    skyRef?.current?.burst(dream.skyX, dream.skyY, color);
  }, [phase, calcOffset, animate, scope, dream, color, skyRef]);

  // ── 卡片关闭：card → departing → (idle | drunk) ────────────────────────
  const handleCardClose = useCallback(async (wasInterpreted, waterX, waterY) => {
    setShowCard(false);

    // 立即把星星复位到中心（不可见），然后从中心返回
    await animate(scope.current, {
      opacity: 0, scale: 0.3,
      x: centerOffset.current.x,
      y: centerOffset.current.y,
    }, { duration: 0 }); // 瞬间

    // 星星从中心重现
    setPhase('departing');
    await animate(scope.current, {
      opacity: 1, scale: 1.1,
      x: 0, y: 0,
    }, { duration: 0.55, ease: [0.2, 0, 0.15, 1] });

    await animate(scope.current, { scale: 1 }, { duration: 0.2 });

    if (!wasInterpreted) {
      setPhase('idle');
      return;
    }

    // ── 已解梦：醉酒闪烁 ─────────────────────────────────────
    setPhase('drunk');
    // 先变暗
    await animate(scope.current, { opacity: 0.5, scale: 0.85 }, { duration: 0.4 });
    // 醉酒随机闪烁
    await animate(scope.current, {
      opacity: [0.5, 0.15, 0.7, 0.08, 0.55, 0.12, 0.6, 0.05, 0.4, 0.0],
      scale:   [0.85, 0.7, 1.0, 0.6, 0.9, 0.65, 1.05, 0.5, 0.7, 0.3],
    }, {
      duration: 2.2,
      times:    [0, 0.1, 0.22, 0.35, 0.46, 0.58, 0.68, 0.78, 0.9, 1],
      ease:     'linear',
    });

    // ── 流星滑落 ──────────────────────────────────────────────
    setPhase('falling');
    // 通知 Canvas 播放流星落水动画
    skyRef?.current?.shootIntoWater(dream.skyX, dream.skyY, color);
    // HTML 星星也同步做飞落动画
    await animate(scope.current, {
      opacity: 0,
      scale: 0.15,
      y: [0, -8, 60],
      x: [(Math.random() - 0.5) * 30],
      rotate: [0, 15, -8, 20],
    }, { duration: 0.9, ease: 'easeIn' });

    setPhase('gone');
  }, [animate, scope, dream, color, skyRef]);

  if (phase === 'gone') return null;

  return (
    <>
      {/* ── 光爆 flash overlay（纯色系，无白色，不造成白屏）── */}
      <AnimatePresence>
        {flashVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0.3, 0] }}
            transition={{ duration: 0.35, times: [0, 0.15, 0.5, 1], ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 55,
              pointerEvents: 'none',
              background: `radial-gradient(circle at 50% 55%,
                rgba(${r},${g},${b},0.6) 0%,
                rgba(${r},${g},${b},0.25) 40%,
                transparent 75%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── 天空中的星星 ── */}
      <motion.button
        ref={scope}
        onClick={handleClick}
        style={{
          position:  'absolute',
          left:      `${dream.skyX}%`,
          top:       `${dream.skyY * SKY_RATIO}%`,
          transform: 'translate(-50%, -50%)',
          background: 'none',
          border:     'none',
          padding:    0,
          cursor:     phase === 'idle' ? 'pointer' : 'default',
          zIndex:     phase === 'card' || phase === 'flash' ? 50 : 5,
          pointerEvents: 'auto',
          // 漂浮动画仅在 idle 时生效
          animation: phase === 'idle'
            ? `drm-float-${dream.id} ${11 + dreamSeedFloat(dream.id) * 8}s ease-in-out ${dreamSeedFloat(dream.id) * 5}s infinite`
            : 'none',
        }}
        whileHover={phase === 'idle' ? { scale: 1.3 } : {}}
        initial={{ scale: 1, opacity: 1 }}
      >
        <StarSVG size={starSize} color={color} />
      </motion.button>

      {/* ── 浮动动画 keyframe（每颗星不同） ── */}
      <style>{`
        @keyframes drm-float-${dream.id} {
          0%   { transform: translate(-50%, -50%) translate(0px, 0px) rotate(0deg) }
          25%  { transform: translate(-50%, -50%) translate(${3 + dreamSeedFloat(dream.id)*4}px, ${-5 - dreamSeedFloat(dream.id)*5}px) rotate(${2 + dreamSeedFloat(dream.id)*3}deg) }
          50%  { transform: translate(-50%, -50%) translate(${-2 - dreamSeedFloat(dream.id)*3}px, ${-8 - dreamSeedFloat(dream.id)*4}px) rotate(${-1 - dreamSeedFloat(dream.id)*2}deg) }
          75%  { transform: translate(-50%, -50%) translate(${-4 - dreamSeedFloat(dream.id)*3}px, ${-3 - dreamSeedFloat(dream.id)*3}px) rotate(${1 + dreamSeedFloat(dream.id)*2}deg) }
          100% { transform: translate(-50%, -50%) translate(0px, 0px) rotate(0deg) }
        }
      `}</style>

      {/* ── 卡片弹窗 ── */}
      <AnimatePresence>
        {showCard && (
          <DreamCard
            dream={dream}
            color={color}
            onClose={() => handleCardClose(false)}
            onInterpret={async (id, text) => {
              const result = await onInterpret(id, text);
              handleCardClose(true, result?.waterX, result?.waterY);
            }}
            onDelete={(id) => {
              onDelete(id);
              handleCardClose(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

// 用 id 生成浮动动画用的稳定随机种子
const dreamSeedFloat = (id) => {
  let h = 0x811c9dc5;
  for (const c of String(id)) h = (Math.imul(h ^ c.charCodeAt(0), 0x01000193)) >>> 0;
  return (h / 0xffffffff);
};
