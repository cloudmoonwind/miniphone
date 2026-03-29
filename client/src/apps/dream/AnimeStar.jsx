import { useState, useRef, useCallback, Fragment } from 'react';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { DREAM_TYPES, SKY_RATIO, AnimeStar as StarSVG, getStarSize, hexRgb } from './dreamUtils.jsx';
import { DreamCard } from './DreamCard.jsx';

// ── 调试开关 ──────────────────────────────────────────────────────────────────
const SHOW_TRIGGER_DEBUG = false;  // ← true 可显示触发圆边框

// 与 dreamUtils.jsx 的 L 保持同步（决定触发圆和摆动基准点）
const L_BASE = 0.25;

/**
 * AnimeStar — 单个梦境星星，状态机：
 * idle → excited（3秒动画）→ idle
 *
 * DOM 分层：
 *   浮动层
 *     ├─ 烟花粒子（与浮动同步，独立于星星动画，和摆动同时起爆）
 *     ├─ outerScope（scale / x / y / opacity，transformOrigin: center）
 *     │     └─ innerScope（rotate，transformOrigin: 最长臂方向 × PIVOT_OFFSET）
 *     │           └─ StarSVG
 *     └─ 触发圆（圆形点击区，独立于动画）
 */
export const AnimeStar = ({ dream, containerRef: _containerRef, skyRef, onInterpret, onDelete }) => {
  const [phase, setPhase] = useState('idle');
  const [showCard, setShowCard] = useState(false);
  const [flashVisible, _setFlashVisible] = useState(false);
  const [particles, setParticles] = useState([]);
  const [outerScope, animateOuter] = useAnimate();  // scale / x / y / opacity
  const [innerScope, animateInner] = useAnimate();  // rotate
  const centerOffset = useRef({ x: 0, y: 0 });

  const color     = DREAM_TYPES[dream.type]?.color || '#C0B8D8';
  const [r, g, b] = hexRgb(color);
  const starSize   = getStarSize(dream.importance);
  const rays       = { emotion: 4, omen: 8, memory: 6, desire: 5 }[dream.type] ?? 4;

  // 触发圆半径 = 1 基准臂长
  const triggerR = Math.round(L_BASE / 2 * starSize);
  const triggerD = triggerR * 2;

  // ── 摆动基准点：沿最长臂的屏幕方向偏移 ─────────────────────────────────────
  // 各类型臂长比例（与 dreamUtils.jsx 的 RAY_LENGTHS 一致）
  const ARM_RATIOS = { 4: [1, 1.52, 1, 1.52], 5: [1,1,1,1,1], 6: [1,1,1,1,1,1], 8: [1, 0.8, 1.5, 0.8, 1, 0.8, 1.5, 0.8] };
  const armRatios  = ARM_RATIOS[rays] || ARM_RATIOS[4];
  const maxArmRatio = Math.max(...armRatios);
  // canvas 旋转角：从 [-15, 0, 15] 离散选取，保证有直着的星星
  const rot_deg = [-15, 0, 15][Math.floor(dreamSeedRot(dream.id) * 3)];
  // 在多个最长臂中，选屏幕 y 分量最大（最朝下）的一条
  let bestSin = -Infinity, swayRad = Math.PI / 2;
  armRatios.forEach((ratio, k) => {
    if (ratio < maxArmRatio - 1e-6) return;
    const screenDeg = k * 360 / armRatios.length + rot_deg;
    const s = Math.sin(screenDeg * Math.PI / 180);
    if (s > bestSin) { bestSin = s; swayRad = screenDeg * Math.PI / 180; }
  });
  // PIVOT_OFFSET: 与旧的 '50% 84%' 保持一致（34% of starSize = 84% - 50%）
  const PIVOT_OFFSET = 34;
  const swayOriginX = (50 + Math.cos(swayRad) * PIVOT_OFFSET).toFixed(1);
  const swayOriginY = (50 + Math.sin(swayRad) * PIVOT_OFFSET).toFixed(1);

  // ── 悬停：scale 从中心 ────────────────────────────────────────────────────
  const handleMouseEnter = useCallback(() => {
    if (phase !== 'idle') return;
    animateOuter(outerScope.current, { scale: 1.15 }, { duration: 0.2, ease: 'easeOut' });
  }, [phase, animateOuter, outerScope]);

  const handleMouseLeave = useCallback(() => {
    if (phase !== 'idle') return;
    animateOuter(outerScope.current, { scale: 1 }, { duration: 0.25, ease: 'easeOut' });
  }, [phase, animateOuter, outerScope]);

  // ── 点击：idle → excited（约 3 秒）→ idle ──────────────────────────────────
  const handleClick = useCallback(async () => {
    if (phase !== 'idle') return;
    setPhase('excited');

    // 1. 爆炸放大（0.12s）→ 快速回弹（0.18s）
    await animateOuter(outerScope.current, { scale: 1.3 }, { duration: 0.12, ease: 'easeOut' });
    await animateOuter(outerScope.current, { scale: 1.0 }, { duration: 0.18, ease: [0.2, 0, 0.0, 1] });

    // 2. 烟花起爆 + 摆动 + 亮度脉冲，同时开始
    setParticles(Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      angle: i * 60 + (dreamSeedFloat(dream.id + 'p' + i) - 0.5) * 20,
      curve: (dreamSeedFloat(dream.id + 'c' + i) - 0.5) * 44,
    })));
    setTimeout(() => setParticles([]), 2000);

    // 亮度脉冲（后台循环）
    // ↓ 调这里的 duration 改变脉冲速度（秒/周期）
    const pulseAnim = animateOuter(outerScope.current, {
      opacity: [1, 0.58, 1],
    }, { duration: 0.8, ease: 'easeInOut', repeat: Infinity });

    // 摆动（前台 await，完成后停脉冲）
    await animateInner(innerScope.current, {
      rotate: [0, -10, 8, -6, 5, -3, 2, -1, 0],
    }, { duration: 2.2, ease: 'easeOut', times: [0, 0.08, 0.22, 0.38, 0.52, 0.65, 0.78, 0.9, 1] });

    pulseAnim.stop();
    await animateOuter(outerScope.current, { opacity: 1 }, { duration: 0.18 });

    // 3. 轻微抖动（0.4s）
    await animateOuter(outerScope.current, {
      x: [0, -4,  3, -2,  2, -1, 0],
      y: [0,  1, -2,  1, -1,  0, 0],
    }, { duration: 0.4, ease: 'linear', times: [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1] });

    // 4. 归位
    await Promise.all([
      animateOuter(outerScope.current, { scale: 1, x: 0, y: 0 }, { duration: 0.12 }),
      animateInner(innerScope.current, { rotate: 0 }, { duration: 0.12 }),
    ]);

    setPhase('idle');
  }, [phase, animateOuter, animateInner, outerScope, innerScope, dream]);

  // ── 卡片关闭（保留供后续阶段设计使用）──────────────────────────────────────
  const handleCardClose = useCallback(async (wasInterpreted, _waterX, _waterY) => {
    setShowCard(false);
    await animateOuter(outerScope.current, {
      opacity: 0, scale: 0.3,
      x: centerOffset.current.x, y: centerOffset.current.y,
    }, { duration: 0 });
    setPhase('departing');
    await animateOuter(outerScope.current, { opacity: 1, scale: 1.1, x: 0, y: 0 }, { duration: 0.55, ease: [0.2, 0, 0.15, 1] });
    await animateOuter(outerScope.current, { scale: 1 }, { duration: 0.2 });
    if (!wasInterpreted) { setPhase('idle'); return; }
    setPhase('drunk');
    await animateOuter(outerScope.current, { opacity: 0.5, scale: 0.85 }, { duration: 0.4 });
    await animateOuter(outerScope.current, {
      opacity: [0.5, 0.15, 0.7, 0.08, 0.55, 0.12, 0.6, 0.05, 0.4, 0.0],
      scale:   [0.85, 0.7, 1.0, 0.6, 0.9, 0.65, 1.05, 0.5, 0.7, 0.3],
    }, { duration: 2.2, times: [0, 0.1, 0.22, 0.35, 0.46, 0.58, 0.68, 0.78, 0.9, 1], ease: 'linear' });
    setPhase('falling');
    skyRef?.current?.shootIntoWater(dream.skyX, dream.skyY, color);
    await animateOuter(outerScope.current, {
      opacity: 0, scale: 0.15,
      y: [0, -8, 60], x: [(Math.random() - 0.5) * 30],
    }, { duration: 0.9, ease: 'easeIn' });
    setPhase('gone');
  }, [animateOuter, outerScope, dream, color, skyRef]);

  if (phase === 'gone') return null;

  return (
    <>
      {/* ── 光爆 overlay（供后续阶段使用）── */}
      <AnimatePresence>
        {flashVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0.3, 0] }}
            transition={{ duration: 0.35, times: [0, 0.15, 0.5, 1], ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: 0, zIndex: 55, pointerEvents: 'none',
              background: `radial-gradient(circle at 50% 55%, rgba(${r},${g},${b},0.6) 0%, rgba(${r},${g},${b},0.25) 40%, transparent 75%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── 位置锚点（零尺寸）── */}
      <div style={{
        position: 'absolute',
        left: `${dream.skyX}%`, top: `${dream.skyY * SKY_RATIO}%`,
        width: 0, height: 0,
        zIndex: phase === 'card' || phase === 'flash' ? 50 : 5,
        pointerEvents: 'none',
      }}>
        {/* ── 漂浮动画层 ── */}
        <div style={{
          position: 'absolute',
          animation: phase === 'idle'
            ? `drm-float-${dream.id} ${16 + dreamSeedFloat(dream.id + 'd') * 10}s ease-in-out ${dreamSeedFloat(dream.id + 'dl') * 8}s infinite`
            : 'none',
        }}>

          {/* ── 烟花粒子 + 拖尾（浮动层直属，独立于 outerScope 的变形）── */}
          {particles.map(p => {
            const cx = Math.cos(p.angle * Math.PI / 180);
            const cy = Math.sin(p.angle * Math.PI / 180);
            const perp_x = -cy, perp_y = cx;

            // 二次贝塞尔曲线：控制点沿初始发射方向（切线正确），终点加重力
            // 向上射出 → 先飞高后落下（抛物线）；向下射出 → 加速下落（e^x形）
            const CP = 58, END = 66, GRAV = 72;
            const cp_x = cx * CP + p.curve * perp_x;
            const cp_y = cy * CP + p.curve * perp_y;
            const ex   = cx * END + p.curve * 0.08 * perp_x;
            const ey   = cy * END + p.curve * 0.08 * perp_y + GRAV;

            // B(t) = 2(1-t)t·P1 + t²·P2，P0=(0,0)
            const bez = t => ({
              x: 2*(1-t)*t*cp_x + t*t*ex,
              y: 2*(1-t)*t*cp_y + t*t*ey,
            });

            const ANIM_DUR = 0.82;
            // 粒子动画：12 帧跟随贝塞尔，easeOut（发射猛、末端减速）
            const N = 12;
            const frames   = Array.from({length: N+1}, (_, i) => bez(i/N));
            const xs       = frames.map(f => f.x);
            const ys       = frames.map(f => f.y);
            // easeOut 时间分布：早期帧密集 → 初速快
            const kfTimes  = Array.from({length: N+1}, (_, i) => 1 - (1 - i/N)**2);

            // 拖尾：6 段，逐段延迟显现，各自独立渐灭（旧的先灭）
            const N_SEG  = 6;
            const SEG_DUR = ANIM_DUR / N_SEG;
            const segPts = Array.from({length: N_SEG+1}, (_, j) => bez(j/N_SEG));
            const FADE_DUR = SEG_DUR + 1.0;           // 每段绘制后亮 0.5s，再 0.5s 渐灭
            const holdR    = (SEG_DUR + 0.5) / FADE_DUR;

            return (
              <Fragment key={p.id}>
                {/* 分段拖尾：各段独立渐灭，最旧的先消失 */}
                <svg style={{ position: 'absolute', overflow: 'visible', pointerEvents: 'none' }}>
                  {Array.from({length: N_SEG}, (_, i) => {
                    const a = segPts[i], b = segPts[i+1];
                    return (
                      <motion.path
                        key={i}
                        d={`M ${a.x.toFixed(1)} ${a.y.toFixed(1)} L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`}
                        stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: [0, 0.65, 0.65, 0] }}
                        transition={{
                          pathLength: { delay: i * SEG_DUR, duration: SEG_DUR, ease: 'linear' },
                          opacity:   { delay: i * SEG_DUR, duration: FADE_DUR, times: [0, 0.005, holdR, 1], ease: 'linear' },
                        }}
                      />
                    );
                  })}
                </svg>

                {/* 主粒子：两个互相垂直的扁椭圆，沿贝塞尔曲线飞行 */}
                <motion.div
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: xs, y: ys, opacity: [1, 1, 0], scale: [1, 1, 0.1] }}
                  transition={{
                    x:       { duration: ANIM_DUR, ease: 'linear', times: kfTimes },
                    y:       { duration: ANIM_DUR, ease: 'linear', times: kfTimes },
                    opacity: { duration: ANIM_DUR, times: [0, 0.55, 1], ease: 'easeIn' },
                    scale:   { duration: ANIM_DUR, times: [0, 0.55, 1], ease: 'easeIn' },
                  }}
                  style={{ position: 'absolute', pointerEvents: 'none' }}
                >
                  <div style={{ position: 'absolute', width: 12, height: 3, background: 'white', top: -1.5, left: -6, borderRadius: '50%' }} />
                  <div style={{ position: 'absolute', width: 3, height: 12, background: 'white', top: -6, left: -1.5, borderRadius: '50%' }} />
                </motion.div>
              </Fragment>
            );
          })}

          {/* ── 外层：scale / x / y / opacity，以中心为基准 ── */}
          <motion.div
            ref={outerScope}
            style={{
              position: 'absolute',
              marginLeft: -starSize / 2,
              marginTop:  -starSize / 2,
              width: starSize, height: starSize,
              transformOrigin: '50% 50%',
              pointerEvents: 'none',
            }}
            initial={{ scale: 1, opacity: 1, x: 0, y: 0 }}
          >
            {/* ── 内层：rotate，以最长臂方向为基准点 ── */}
            <motion.div
              ref={innerScope}
              style={{
                position: 'absolute', inset: 0,
                transformOrigin: `${swayOriginX}% ${swayOriginY}%`,
              }}
              initial={{ rotate: 0 }}
            >
              <StarSVG
                size={starSize} color={color} rays={rays}
                rotation={rot_deg}
                phase={dreamSeedFloat(dream.id + 'ph')}
                style={phase !== 'idle' ? { animationPlayState: 'paused' } : {}}
              />
            </motion.div>
          </motion.div>

          {/* ── 触发圆（独立，随浮动同步）── */}
          <div
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              position: 'absolute',
              width: triggerD, height: triggerD,
              marginLeft: -triggerR, marginTop: -triggerR,
              borderRadius: '50%',
              cursor: phase === 'idle' ? 'pointer' : 'default',
              pointerEvents: 'auto',
              // 调试边框：将 SHOW_TRIGGER_DEBUG 改为 true 可显示
              ...(SHOW_TRIGGER_DEBUG ? { border: '1px dashed rgba(255,255,255,0.35)', boxSizing: 'border-box' } : {}),
            }}
          />
        </div>
      </div>

      {/* ── 漂浮动画 keyframe（每颗星独立）── */}
      <style>{`
        @keyframes drm-float-${dream.id} {
          0%   { transform: none }
          25%  { transform: translate(${((dreamSeedFloat(dream.id+'x1')-0.5)*5).toFixed(1)}px, ${(-1.5-dreamSeedFloat(dream.id+'y1')*4).toFixed(1)}px) rotate(${((dreamSeedFloat(dream.id+'r1')-0.5)*5).toFixed(1)}deg) }
          50%  { transform: translate(${((dreamSeedFloat(dream.id+'x2')-0.5)*4).toFixed(1)}px, ${(-2.5-dreamSeedFloat(dream.id+'y2')*3.5).toFixed(1)}px) rotate(${((dreamSeedFloat(dream.id+'r2')-0.5)*4).toFixed(1)}deg) }
          75%  { transform: translate(${((dreamSeedFloat(dream.id+'x3')-0.5)*4).toFixed(1)}px, ${(-1-dreamSeedFloat(dream.id+'y3')*3.5).toFixed(1)}px) rotate(${((dreamSeedFloat(dream.id+'r3')-0.5)*5).toFixed(1)}deg) }
          100% { transform: none }
        }
      `}</style>

      {/* ── 卡片弹窗（供后续阶段使用）── */}
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

const dreamSeedFloat = (id) => {
  let h = 0x811c9dc5;
  for (const c of String(id)) h = (Math.imul(h ^ c.charCodeAt(0), 0x01000193)) >>> 0;
  return (h / 0xffffffff);
};

const dreamSeedRot = (id) => {
  let h = 0x811c9dc5;
  for (const c of String(id) + 'r') h = (Math.imul(h ^ c.charCodeAt(0), 0x01000193)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
};
