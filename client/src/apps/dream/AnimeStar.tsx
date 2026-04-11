import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { DREAM_TYPES, SKY_RATIO, AnimeStar as StarSVG, getStarSize, hexRgb } from './dreamUtils.jsx';
import { DreamCard } from './DreamCard.jsx';

// ── 调试开关
const SHOW_TRIGGER_DEBUG = false;

// ── 种子哈希（移到顶部，避免 TDZ）
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

// ── 预计算超空间星流线（模块级常量，追逐阶段从目标点辐射的速度线）
const WARP_LINES = Array.from({ length: 72 }, (_, i) => ({
  ang:  (i / 72) * Math.PI * 2 + Math.sin(i * 127.4) * 0.06,
  dist: 0.03 + (Math.sin(i * 73.1) * 0.5 + 0.5) * 0.12,
  spd:  0.22 + (Math.sin(i * 41.3) * 0.5 + 0.5) * 0.78,
  br:   0.28 + (Math.sin(i * 97.7) * 0.5 + 0.5) * 0.62,
  w2:   0.25 + (Math.sin(i * 53.9) * 0.5 + 0.5) * 0.65,
}));

// ── FlashLines：白光爆闪时的放射速度线（从容器中心向外扩散）
const FlashLines = ({ dur }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx   = canvas.getContext('2d');
    const cx    = canvas.width  / 2;
    const cy    = canvas.height / 2;
    const diag  = Math.sqrt(cx * cx + cy * cy);
    const N     = 22;
    const startTime = performance.now();
    let rafId;

    const lines = Array.from({ length: N }, (_, i) => ({
      angle: (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.2,
      len:   0.5 + Math.random() * 0.5,
      thick: 0.5 + Math.random() * 1.6,
      delay: Math.random() * 0.1,
    }));

    const draw = (now) => {
      const t = Math.min((now - startTime) / (dur * 1000), 1);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      lines.forEach(ln => {
        const lt = Math.max(0, (t - ln.delay) / (1 - ln.delay + 1e-6));
        if (lt <= 0) return;
        const appear = Math.min(lt / 0.3, 1);
        const fade   = lt > 0.3 ? 1 - (lt - 0.3) / 0.7 : 1;
        const alpha  = appear * fade * 0.95;
        const maxLen = diag * ln.len * appear;
        const minLen = maxLen * 0.25;
        const cos = Math.cos(ln.angle), sin = Math.sin(ln.angle);
        const x1  = cx + cos * minLen, y1 = cy + sin * minLen;
        const x2  = cx + cos * maxLen, y2 = cy + sin * maxLen;
        const grd = ctx.createLinearGradient(x1, y1, x2, y2);
        grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grd.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.save();
        ctx.shadowBlur  = 5;
        ctx.shadowColor = 'rgba(200,220,255,0.8)';
        ctx.lineWidth   = ln.thick;
        ctx.strokeStyle = grd;
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      });

      if (t < 1) rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 97,
      }}
    />
  );
};

// ── ApproachTrail 已移除；拖尾现在由统一 RAF 循环在 doApproach 中直接绘制 ──

// ── FlashWhiteScreen：纯白全屏闪白 → 停留 → 褪白
// 使用 CSS @keyframes 而非 Framer Motion（FM 不支持 clipPath 数组动画）
const FLASH_ID = 'drm-flash-white';
const FlashWhiteScreen = ({ onDone }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => { if (onDone) onDone(); };
    el.addEventListener('animationend', handler);
    return () => el.removeEventListener('animationend', handler);
  }, [onDone]);
  return (
    <>
      <style>{`
        @keyframes ${FLASH_ID} {
          0%   { opacity: 1; background: white; }
          30%  { opacity: 1; background: white; }
          100% { opacity: 0; background: white; }
        }
      `}</style>
      <div
        ref={ref}
        style={{
          position: 'absolute', inset: 0, zIndex: 95,
          pointerEvents: 'none', background: 'white',
          animation: `${FLASH_ID} 0.7s ease-out forwards`,
        }}
      />
    </>
  );
};

// ── CrossStar：四角内弧星，随机延迟出现，亮暗闪烁两次后消失
const CrossStar = ({ angle, radius, delay, crossR }) => {
  const canvasRef = useRef(null);
  const S = crossR;
  const canvasSize = S * 4;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvasSize / 2, cy = canvasSize / 2;
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.shadowBlur  = S * 2.5;
    ctx.shadowColor = 'rgba(210,225,255,1)';
    // 四角内弧星：4个尖端在上下左右，扇形弧线向内折
    ctx.beginPath();
    ctx.moveTo(cx + S, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - S);
    ctx.quadraticCurveTo(cx, cy, cx - S, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + S);
    ctx.quadraticCurveTo(cx, cy, cx + S, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [canvasSize, S]); // eslint-disable-line react-hooks/exhaustive-deps

  const rad = angle * Math.PI / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: x - canvasSize / 2,
        top:  y - canvasSize / 2,
        width: canvasSize, height: canvasSize,
        pointerEvents: 'none',
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 0.12, 1, 0.12, 0],
        scale:   [0.2, 1, 0.65, 1.15, 0.55, 0],
      }}
      transition={{
        delay,
        duration: 0.72,
        times: [0, 0.14, 0.36, 0.56, 0.76, 1.0],
        ease: 'easeOut',
      }}
    >
      <canvas ref={canvasRef} width={canvasSize} height={canvasSize} style={{ display: 'block' }} />
    </motion.div>
  );
};

// ── 蓄力阶段时序常量
const IMPACT_DUR   = 0.20;
const CHARGE_DUR   = 1.68;
const CHARGE_TIMES = [0, 0.08, 0.28, 0.40, 0.57, 0.69, 0.81, 0.90, 1.0];

// ── ChargingGlow：容器中心的光晕脉冲（随蓄力节奏明暗）
const ChargingGlow = ({ r, g, b }) => (
  <>
    {/* 白色核心 */}
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.55, 0, 0.75, 0, 0.88, 0, 1.0, 1.0],
        scale:   [0, 0.4, 0.2, 0.8, 0.25, 1.2, 0.3, 2.0, 8],
      }}
      transition={{ delay: IMPACT_DUR, duration: CHARGE_DUR, times: CHARGE_TIMES, ease: 'linear' }}
      style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 90, height: 90, marginLeft: -45, marginTop: -45,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(255,255,255,0.98) 0%, rgba(${r},${g},${b},0.8) 35%, transparent 65%)`,
        filter: 'blur(5px)',
        pointerEvents: 'none', zIndex: 94,
      }}
    />
    {/* 外晕扩散环 */}
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.14, 0, 0.26, 0, 0.42, 0, 0.60, 0],
        scale:   [0, 0.7, 0.35, 1.1, 0.45, 1.7, 0.5, 2.5, 0.5],
      }}
      transition={{ delay: IMPACT_DUR, duration: CHARGE_DUR, times: CHARGE_TIMES, ease: 'linear' }}
      style={{
        position: 'absolute', left: '50%', top: '50%',
        width: 220, height: 220, marginLeft: -110, marginTop: -110,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(${r},${g},${b},0.6) 0%, rgba(${r},${g},${b},0.2) 50%, transparent 75%)`,
        filter: 'blur(26px)',
        pointerEvents: 'none', zIndex: 93,
      }}
    />
  </>
);

const L_BASE = 0.25;

export const AnimeStar = ({ dream, containerRef, skyRef, bgWrapRef, onInterpret, onDelete }) => {
  const [phase, setPhase]               = useState('idle');
  const [showCard, setShowCard]         = useState(false);
  const [particles, setParticles]       = useState([]);
  const [outerScope, animateOuter]      = useAnimate();
  const [innerScope, animateInner]      = useAnimate();

  // refs
  const cancelRef         = useRef(false);
  const pulseAnimRef      = useRef(null);
  const wasInterpretedRef = useRef(false);
  const doApproachRef     = useRef(null);
  const trailCanvasRef    = useRef(null);

  const color     = DREAM_TYPES[dream.type]?.color || '#C0B8D8';
  const [r, g, b] = hexRgb(color);
  const starSize   = getStarSize(dream.importance);
  const rays       = { emotion: 4, omen: 8, memory: 6, desire: 5 }[dream.type] ?? 4;
  const triggerR = Math.round(L_BASE / 2 * starSize);
  const triggerD = triggerR * 2;

  const ARM_RATIOS = { 4: [1, 1.52, 1, 1.52], 5: [1,1,1,1,1], 6: [1,1,1,1,1,1], 8: [1, 0.8, 1.5, 0.8, 1, 0.8, 1.5, 0.8] };
  const armRatios  = ARM_RATIOS[rays] || ARM_RATIOS[4];
  const maxArmRatio = Math.max(...armRatios);
  const rot_deg = [-15, 0, 15][Math.floor(dreamSeedRot(dream.id) * 3)];
  let bestSin = -Infinity, swayRad = Math.PI / 2;
  armRatios.forEach((ratio, k) => {
    if (ratio < maxArmRatio - 1e-6) return;
    const screenDeg = k * 360 / armRatios.length + rot_deg;
    const s = Math.sin(screenDeg * Math.PI / 180);
    if (s > bestSin) { bestSin = s; swayRad = screenDeg * Math.PI / 180; }
  });
  const PIVOT_OFFSET = 34;
  const swayOriginX = (50 + Math.cos(swayRad) * PIVOT_OFFSET).toFixed(1);
  const swayOriginY = (50 + Math.sin(swayRad) * PIVOT_OFFSET).toFixed(1);

  // ── 悬停
  const handleMouseEnter = useCallback(() => {
    if (phase !== 'idle') return;
    animateOuter(outerScope.current, { scale: 1.15 }, { duration: 0.2, ease: 'easeOut' });
  }, [phase, animateOuter, outerScope]);

  const handleMouseLeave = useCallback(() => {
    if (phase !== 'idle') return;
    animateOuter(outerScope.current, { scale: 1 }, { duration: 0.25, ease: 'easeOut' });
  }, [phase, animateOuter, outerScope]);

  // ── doApproach：统一 RAF 驱动飞行 + 拖尾 + 背景缩放
  const doApproach = useCallback(async () => {
    // snap 到初始状态
    await animateOuter(outerScope.current, { scale: 1, x: 0, y: 0, opacity: 1, filter: 'brightness(1)' }, { duration: 0 });
    await animateInner(innerScope.current, { rotate: 0 }, { duration: 0 });
    await new Promise(resolve => requestAnimationFrame(resolve));

    // 当前屏幕坐标
    const el = outerScope.current;
    const rect = el.getBoundingClientRect();
    const startCx = rect.left + rect.width / 2;
    const startCy = rect.top  + rect.height / 2;
    const destX = window.innerWidth  / 2;
    const destY = window.innerHeight / 2;
    const tdx = destX - startCx;
    const tdy = destY - startCy;

    // S 型三次贝塞尔控制点
    const cp1x = tdx * 0.3 + (dreamSeedFloat(dream.id + 'apx') - 0.5) * window.innerWidth * 0.15;
    const cp1y = tdy * 0.1 - 180;
    const cp2x = tdx * 0.7 + (dreamSeedFloat(dream.id + 'apy') - 0.5) * window.innerWidth * 0.1;
    const cp2y = tdy * 0.9 + 120;

    // 三次贝塞尔
    const bezPos = (t) => {
      const u = 1 - t;
      return {
        x: u*u*u*0 + 3*u*u*t*cp1x + 3*u*t*t*cp2x + t*t*t*tdx,
        y: u*u*u*0 + 3*u*u*t*cp1y + 3*u*t*t*cp2y + t*t*t*tdy,
      };
    };
    // 计算法线方向最大臂宽（用于拖尾宽度）
    const L = starSize * 0.115;
    const flyLen  = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
    const normX   = -tdy / flyLen;
    const normY   =  tdx / flyLen;
    let armW = 0;
    armRatios.forEach((ratio, k) => {
      const angle = (k * 360 / armRatios.length + rot_deg) * Math.PI / 180;
      const proj = Math.abs(Math.cos(angle) * L * ratio * normX + Math.sin(angle) * L * ratio * normY);
      if (proj > armW) armW = proj;
    });
    armW = Math.max(armW * 2, 12);

    // 估算弧长
    let arcLen = 0, prevP = bezPos(0);
    for (let i = 1; i <= 40; i++) {
      const cur = bezPos(i / 40);
      arcLen += Math.sqrt((cur.x - prevP.x) ** 2 + (cur.y - prevP.y) ** 2);
      prevP = cur;
    }
    const flyDur = Math.min(Math.max(arcLen / 380, 0.7), 2.0);

    // 准备拖尾 canvas（绝对定位，容器尺寸，容器相对坐标）
    const containerBounds = containerRef?.current?.getBoundingClientRect();
    const canvas = trailCanvasRef.current;
    if (canvas && containerBounds) {
      canvas.width  = containerBounds.width;
      canvas.height = containerBounds.height;
      canvas.style.display = 'block';
    }
    const ctx = canvas?.getContext('2d');
    // 将 viewport 坐标转为容器相对坐标
    const localStartCx = startCx - (containerBounds?.left ?? 0);
    const localStartCy = startCy - (containerBounds?.top  ?? 0);
    const diagLen      = containerBounds
      ? Math.sqrt(containerBounds.width ** 2 + containerBounds.height ** 2)
      : 1200;

    // 背景层
    const bgWrap = bgWrapRef?.current;
    const MAX_BG_SCALE = 4.0;
    if (bgWrap && containerBounds) {
      const ox = ((startCx - containerBounds.left) / containerBounds.width  * 100).toFixed(1);
      const oy = ((startCy - containerBounds.top)  / containerBounds.height * 100).toFixed(1);
      bgWrap.style.transformOrigin = `${ox}% ${oy}%`;
    }

    // ── 统一 RAF 循环：飞行 + 到达后余韵 ──
    cancelRef.current = false;
    const flyStartTime = performance.now();
    const flyDurMs = flyDur * 1000;
    const LINGER_DUR = 0.30;  // 到达后余韵秒数（拖尾消散 + 背景微移）
    const lingerDurMs = LINGER_DUR * 1000;

    await new Promise<void>((resolve) => {
      const tick = (now) => {
        if (cancelRef.current) { resolve(); return; }
        const elapsed = now - flyStartTime;
        const rawT = Math.min(elapsed / flyDurMs, 1);
        // 到达后的余韵进度 (0→1)
        const lingerT = rawT >= 1 ? Math.min((elapsed - flyDurMs) / lingerDurMs, 1) : 0;

        // smoothstep 缓动
        const t = rawT * rawT * (3 - 2 * rawT);

        // ── 背景缩放（余韵阶段继续微推）──
        const bgBase = 1 + rawT * rawT * (MAX_BG_SCALE - 1);
        const bgExtra = lingerT * 0.15; // 到达后再微微推进
        const bgScale = bgWrap ? bgBase + bgExtra : 1;
        if (bgWrap) bgWrap.style.transform = `scale(${bgScale})`;

        // ── 星星位置 ──
        const pos = bezPos(t);
        // 末尾加速放大：t^4 曲线让最后阶段明显变大（"追上"感）
        const visualScale = 1 + t * 0.15 + Math.pow(t, 4) * 0.45;
        el.style.transform = `translate(${pos.x / bgScale}px, ${pos.y / bgScale}px) scale(${visualScale / bgScale})`;
        el.style.filter = `brightness(${1 + t * 2})`;

        // ── 三层追逐视觉效果 ──
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // 星星当前在 canvas 上的坐标（镜头追逐的主体）
          const starCvX = localStartCx + bezPos(t).x;
          const starCvY = localStartCy + bezPos(t).y;

          // ① 深空暗幕：以星星为中心向四周扩散黑暗
          //    越追越暗，最终背景只剩中心一点亮
          const darkT = Math.pow(rawT, 1.8) * 0.92;
          if (darkT > 0.015) {
            const dg = ctx.createRadialGradient(
              starCvX, starCvY, 0,
              starCvX, starCvY, diagLen * 0.68,
            );
            dg.addColorStop(0,    `rgba(0,0,0,${(darkT * 0.18).toFixed(3)})`);
            dg.addColorStop(0.28, `rgba(0,0,0,${(darkT * 0.52).toFixed(3)})`);
            dg.addColorStop(0.60, `rgba(0,0,0,${(darkT * 0.82).toFixed(3)})`);
            dg.addColorStop(1,    `rgba(0,0,0,${darkT.toFixed(3)})`);
            ctx.fillStyle = dg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          // ② 超空间星流：从星星当前位置向外辐射
          //    背景"星场"以星星为锚点被甩向四面八方（相对运动）
          const warpPhase = rawT < 0.06  ? 0
            : rawT < 0.20 ? (rawT - 0.06) / 0.14
            : rawT < 0.65 ? 1.0
            : rawT < 0.84 ? (0.84 - rawT) / 0.19
            : 0;
          if (warpPhase > 0.005) {
            ctx.save();
            WARP_LINES.forEach(ln => {
              const speed  = ln.spd * rawT * rawT * 2.8;
              const startR = ln.dist * diagLen;
              const endR   = Math.min(startR + speed * diagLen * 0.85, diagLen * 1.1);
              const cos = Math.cos(ln.ang), sin = Math.sin(ln.ang);
              const x1 = starCvX + cos * startR, y1 = starCvY + sin * startR;
              const x2 = starCvX + cos * endR,   y2 = starCvY + sin * endR;
              const alpha = ln.br * warpPhase * 0.52;
              const grd = ctx.createLinearGradient(x1, y1, x2, y2);
              grd.addColorStop(0,   'rgba(180,210,255,0)');
              grd.addColorStop(0.4, `rgba(210,228,255,${(alpha * 0.45).toFixed(3)})`);
              grd.addColorStop(1,   `rgba(255,255,255,${alpha.toFixed(3)})`);
              ctx.strokeStyle = grd;
              ctx.lineWidth   = ln.w2;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            });
            ctx.restore();
          }

          // ③ 彗星拖尾：沿贝塞尔路径往回，越远越细越淡
          //    余韵阶段随 lingerT 淡出
          if (rawT > 0.04 && t > 0.01) {
            const tailLen   = 0.28;
            const tailSteps = 24;
            ctx.save();
            ctx.lineCap = 'round';
            for (let i = 0; i < tailSteps; i++) {
              const p1t = t - (i / tailSteps) * tailLen;
              const p2t = t - ((i + 1) / tailSteps) * tailLen;
              if (p1t < 0) break;
              const p1 = bezPos(p1t);
              const p2 = bezPos(Math.max(0, p2t));
              const frac  = 1 - i / tailSteps;
              const alpha = frac * frac * frac * 0.82 * Math.min(rawT * 4, 1) * (1 - lingerT);
              if (alpha < 0.005) break;
              const w2 = Math.max(0.5, frac * (armW * 0.45 + 4));
              ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
              ctx.lineWidth   = w2;
              ctx.beginPath();
              ctx.moveTo(localStartCx + p1.x, localStartCy + p1.y);
              ctx.lineTo(localStartCx + p2.x, localStartCy + p2.y);
              ctx.stroke();
            }
            ctx.restore();
          }
        }

        // 飞行中 或 余韵未结束 → 继续
        if (rawT < 1 || lingerT < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });

    // ── 飞行结束：清拖尾 canvas ──
    if (canvas) { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; }
    if (cancelRef.current) {
      if (bgWrap) { bgWrap.style.transform = ''; bgWrap.style.transformOrigin = ''; }
      return;
    }

    // 重置 el transform 由 Framer Motion 接管
    // 注意：此时 bgWrapRef 已缩放 MAX_BG_SCALE 倍，星星在其内部，
    // 所有 FM 的位移和缩放值都需除以 S 来抵消容器的放大
    el.style.transform = '';
    el.style.filter = '';
    // 实际 bgScale = MAX_BG_SCALE + linger extra
    const S = MAX_BG_SCALE + 0.15;
    await animateOuter(outerScope.current, { x: tdx / S, y: tdy / S, scale: 1.6 / S, filter: 'brightness(3)' }, { duration: 0 });

    setPhase('charging');

    // 撞击弹跳
    await animateOuter(outerScope.current, {
      scale: [1.5 / S, 0.78 / S, 1.08 / S],
      filter: ['brightness(5)', 'brightness(0.6)', 'brightness(1.3)'],
      x: [tdx / S, tdx / S, tdx / S],
      y: [tdy / S, tdy / S, tdy / S],
    }, { duration: IMPACT_DUR, times: [0, 0.45, 1], ease: 'easeOut' });
    if (cancelRef.current) return;

    // 蓄力：暗-亮循环，每轮幅度加大
    const shakeX = [0, -7, 5, -9, 7, -12, 10, -7, 0].map(v => (tdx + v) / S);
    const shakeY = [0, 4, -5, 6, -4, 8, -6, 5, 0].map(v => (tdy + v) / S);
    await animateOuter(outerScope.current, {
      x: shakeX,
      y: shakeY,
      scale:  [1.08, 0.74, 2.2, 0.58, 3.2, 0.48, 4.8, 0.36, 6.5].map(v => v / S),
      filter: [
        'brightness(1.3)', 'brightness(0.14)',
        'brightness(6)',   'brightness(0.10)',
        'brightness(13)',  'brightness(0.07)',
        'brightness(26)',  'brightness(0.03)',
        'brightness(50)',
      ],
    }, { duration: CHARGE_DUR, times: CHARGE_TIMES, ease: 'linear' });
    if (cancelRef.current) return;

    // ── 星星本体膨胀成白光（不是另起一个白色 div）──
    // 星星从蓄力终态(scale 6.5/S) 继续放大到填满屏幕，亮度拉满
    await animateOuter(outerScope.current, {
      scale: 28 / S,
      filter: 'brightness(200)',
    }, { duration: 0.15, ease: [0.8, 0, 1, 0] });
    if (cancelRef.current) return;

    await animateOuter(outerScope.current, { opacity: 0 }, { duration: 0 });
    setPhase('flash');
  }, [animateOuter, animateInner, outerScope, innerScope, dream, starSize, armRatios, rot_deg, r, g, b, bgWrapRef, containerRef]);

  // 保持 doApproachRef 同步
  doApproachRef.current = doApproach;

  // ── 点击处理
  const handleClick = useCallback(async () => {
    // excited 状态下再次点击 → 进入 approaching
    if (phase === 'excited') {
      cancelRef.current = true;
      if (pulseAnimRef.current) { pulseAnimRef.current.stop(); pulseAnimRef.current = null; }
      setParticles([]);
      setPhase('approaching');
      doApproachRef.current();
      return;
    }

    if (phase !== 'idle') return;
    setPhase('excited');
    cancelRef.current = false;

    // 1. 爆炸放大 → 快速回弹
    await animateOuter(outerScope.current, { scale: 1.3 }, { duration: 0.12, ease: 'easeOut' });
    if (cancelRef.current) return;
    await animateOuter(outerScope.current, { scale: 1.0 }, { duration: 0.18, ease: [0.2, 0, 0.0, 1] });
    if (cancelRef.current) return;

    // 2. 粒子：每条臂间隙放一颗，定位在臂端1.1倍距离、错开臂方向
    const armTipLen = starSize * 0.115 * maxArmRatio;
    setParticles(Array.from({ length: rays }, (_, i) => ({
      id:     Date.now() + i,
      angle:  (i + 0.5) * (360 / rays) + rot_deg + (Math.random() - 0.5) * 18,
      radius: armTipLen * (1.08 + Math.random() * 0.22),
      delay:  i * (0.06 + Math.random() * 0.04),
      crossR: Math.max(3, Math.round(starSize * 0.06 + Math.random() * starSize * 0.05)),
    })));
    const particleTimer = setTimeout(() => setParticles([]), 2200);

    // 脉冲
    pulseAnimRef.current = animateOuter(outerScope.current, {
      opacity: [1, 0.7, 1],
    }, { duration: 0.3, ease: 'easeInOut', repeat: Infinity });

    // 摆动
    await animateInner(innerScope.current, {
      rotate: [0, -10, 8, -6, 5, -3, 2, -1, 0],
    }, { duration: 2.2, ease: 'easeOut', times: [0, 0.08, 0.22, 0.38, 0.52, 0.65, 0.78, 0.9, 1] });

    if (cancelRef.current) { clearTimeout(particleTimer); return; }

    if (pulseAnimRef.current) { pulseAnimRef.current.stop(); pulseAnimRef.current = null; }
    await animateOuter(outerScope.current, { opacity: 1 }, { duration: 0.18 });
    if (cancelRef.current) { clearTimeout(particleTimer); return; }

    // 3. 抖动
    await animateOuter(outerScope.current, {
      x: [0, -4, 3, -2, 2, -1, 0],
      y: [0,  1, -2, 1, -1, 0, 0],
    }, { duration: 0.4, ease: 'linear', times: [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1] });
    if (cancelRef.current) { clearTimeout(particleTimer); return; }

    // 4. 归位
    await Promise.all([
      animateOuter(outerScope.current, { scale: 1, x: 0, y: 0 }, { duration: 0.12 }),
      animateInner(innerScope.current, { rotate: 0 }, { duration: 0.12 }),
    ]);

    clearTimeout(particleTimer);
    if (!cancelRef.current) setPhase('idle');
  }, [phase, animateOuter, animateInner, outerScope, innerScope, dream]);

  // ── 卡片开始关闭（记录是否解梦）
  const handleCardStartClose = useCallback((wasInterpreted, _waterX?: any, _waterY?: any) => {
    wasInterpretedRef.current = wasInterpreted;
    setShowCard(false);
    // AnimatePresence onExitComplete 会调用 handleAfterCardClose
  }, []);

  // ── 卡片退出动画完成后
  const handleAfterCardClose = useCallback(async () => {
    const wasInterpreted = wasInterpretedRef.current;

    // 重置背景缩放
    if (bgWrapRef?.current) {
      bgWrapRef.current.style.transition = 'transform 0.5s ease-out';
      bgWrapRef.current.style.transform  = '';
      bgWrapRef.current.style.transformOrigin = '';
      setTimeout(() => { if (bgWrapRef.current) bgWrapRef.current.style.transition = ''; }, 520);
    }

    // snap 回原位
    await animateOuter(outerScope.current, { x: 0, y: 0, scale: 1, filter: 'brightness(1)', opacity: 0 }, { duration: 0 });

    if (!wasInterpreted) {
      setPhase('idle');
      await animateOuter(outerScope.current, { opacity: 1 }, { duration: 0.35 });
      return;
    }

    // 解梦流程：departing → drunk → falling → gone
    setPhase('departing');
    await animateOuter(outerScope.current, { opacity: 1, scale: 1.1 }, { duration: 0.55, ease: [0.2, 0, 0.15, 1] });
    await animateOuter(outerScope.current, { scale: 1 }, { duration: 0.2 });
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

  // 触发圆在 excited/approaching 阶段也允许点击（用于二次触发）
  const triggerClickable = phase === 'idle' || phase === 'excited';

  return (
    <>
      {/* ── 飞行拖尾 + Flash bloom + 卡片弹窗（portal 到 containerRef，在 bgWrapRef 外部）── */}
      {containerRef?.current && createPortal(
        <canvas
          ref={trailCanvasRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 30,
            display: 'none',
          }}
        />,
        containerRef.current
      )}

      {/* ── Flash bloom + 卡片弹窗（portal 到手机容器内）── */}
      {containerRef?.current && createPortal(
        <>
          {/* 蓄力光晕（容器中心脉冲） */}
          {phase === 'charging' && <ChargingGlow r={r} g={g} b={b} />}

          {phase === 'flash' && <FlashWhiteScreen onDone={() => { setShowCard(true); setPhase('card'); }} />}
          <AnimatePresence onExitComplete={handleAfterCardClose}>
            {showCard && (
              <DreamCard
                dream={dream}
                color={color}
                rays={rays}
                rotDeg={rot_deg}
                starPhase={dreamSeedFloat(dream.id + 'ph')}
                onClose={() => handleCardStartClose(false)}
                onInterpret={async (id, text) => {
                  const result = await onInterpret(id, text);
                  handleCardStartClose(true, result?.waterX, result?.waterY);
                }}
                onDelete={(id) => {
                  onDelete(id);
                  handleCardStartClose(false);
                }}
              />
            )}
          </AnimatePresence>
        </>,
        containerRef.current
      )}

      {/* ── 位置锚点 ── */}
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
          {particles.map(p => (
            <CrossStar
              key={p.id}
              angle={p.angle}
              radius={p.radius}
              delay={p.delay}
              crossR={p.crossR}
            />
          ))}

          <motion.div
            ref={outerScope}
            style={{
              position: 'absolute',
              marginLeft: -starSize / 2,
              marginTop:  -starSize / 2,
              width: starSize, height: starSize,
              transformOrigin: '50% 50%',
              pointerEvents: 'none',
              // 卡片/flash 阶段：星星本体不可见
              visibility: (phase === 'card' || phase === 'flash') ? 'hidden' : 'visible',
            }}
            initial={{ scale: 1, opacity: 1, x: 0, y: 0 }}
          >
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
                className=""
                style={phase !== 'idle' ? { animationPlayState: 'paused' } : {}}
              />
            </motion.div>
          </motion.div>

          {/* ── 触发圆 ── */}
          <div
            onClick={handleClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              position: 'absolute',
              width: triggerD, height: triggerD,
              marginLeft: -triggerR, marginTop: -triggerR,
              borderRadius: '50%',
              cursor: triggerClickable ? 'pointer' : 'default',
              pointerEvents: triggerClickable ? 'auto' : 'none',
              ...(SHOW_TRIGGER_DEBUG ? { border: '1px dashed rgba(255,255,255,0.35)', boxSizing: 'border-box' } : {}),
            }}
          />
        </div>
      </div>

      {/* ── 漂浮 keyframe ── */}
      <style>{`
        @keyframes drm-float-${dream.id} {
          0%   { transform: none }
          25%  { transform: translate(${((dreamSeedFloat(dream.id+'x1')-0.5)*5).toFixed(1)}px, ${(-1.5-dreamSeedFloat(dream.id+'y1')*4).toFixed(1)}px) rotate(${((dreamSeedFloat(dream.id+'r1')-0.5)*5).toFixed(1)}deg) }
          50%  { transform: translate(${((dreamSeedFloat(dream.id+'x2')-0.5)*4).toFixed(1)}px, ${(-2.5-dreamSeedFloat(dream.id+'y2')*3.5).toFixed(1)}px) rotate(${((dreamSeedFloat(dream.id+'r2')-0.5)*4).toFixed(1)}deg) }
          75%  { transform: translate(${((dreamSeedFloat(dream.id+'x3')-0.5)*4).toFixed(1)}px, ${(-1-dreamSeedFloat(dream.id+'y3')*3.5).toFixed(1)}px) rotate(${((dreamSeedFloat(dream.id+'r3')-0.5)*5).toFixed(1)}deg) }
          100% { transform: none }
        }
      `}</style>
    </>
  );
};
