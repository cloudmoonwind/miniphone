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

// ── ApproachTrail：position:fixed 全屏 canvas，RAF 绘制彗星尾
const ApproachTrail = ({ starX, starY, P1x, P1y, tdx, tdy, armW, dur, startTime, r, g, b, sparkles }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    // 贝塞尔位置（二次）
    const bezPos = (t) => ({
      x: starX + 2 * (1 - t) * t * P1x + t * t * tdx,
      y: starY + 2 * (1 - t) * t * P1y + t * t * tdy,
    });
    // 贝塞尔一阶导数（方向）
    const bezDeriv = (t) => ({
      dx: 2 * (1 - 2 * t) * P1x + 2 * t * tdx,
      dy: 2 * (1 - 2 * t) * P1y + 2 * t * tdy,
    });

    const TRAIL_FRAC = 0.55; // 拖尾追溯的 t 长度
    const N_SEG = 60;
    let rafId;

    const draw = (now) => {
      const rawT = Math.min((now - startTime) / (dur * 1000), 1);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (rawT > 0) {
        const tHead = rawT;
        const tTail = Math.max(0, rawT - TRAIL_FRAC);

        // 采样左右两侧多边形顶点
        const leftPts  = [];
        const rightPts = [];

        for (let i = 0; i <= N_SEG; i++) {
          const t = tTail + (tHead - tTail) * (i / N_SEG);
          const frac = i / N_SEG; // 0=尾，1=头
          const pos = bezPos(t);
          const d   = bezDeriv(t);
          const len = Math.sqrt(d.dx * d.dx + d.dy * d.dy) || 1;
          // 法线
          const nx = -d.dy / len;
          const ny =  d.dx / len;
          const halfW = (armW * frac) / 2;
          leftPts.push({  x: pos.x + nx * halfW, y: pos.y + ny * halfW });
          rightPts.push({ x: pos.x - nx * halfW, y: pos.y - ny * halfW });
        }

        // 尾到头渐变（沿飞行方向）
        const tailPos = bezPos(tTail);
        const headPos = bezPos(tHead);
        const grad = ctx.createLinearGradient(tailPos.x, tailPos.y, headPos.x, headPos.y);
        grad.addColorStop(0,    `rgba(${r},${g},${b},0)`);
        grad.addColorStop(0.45, `rgba(${r},${g},${b},0.35)`);
        grad.addColorStop(0.78, `rgba(${r},${g},${b},0.75)`);
        grad.addColorStop(1,    `rgba(${r},${g},${b},0.95)`);

        const gradW = ctx.createLinearGradient(tailPos.x, tailPos.y, headPos.x, headPos.y);
        gradW.addColorStop(0,    `rgba(255,255,255,0)`);
        gradW.addColorStop(0.55, `rgba(255,255,255,0.08)`);
        gradW.addColorStop(0.85, `rgba(255,255,255,0.35)`);
        gradW.addColorStop(1,    `rgba(255,255,255,0.65)`);

        // 外层扩散晕（加粗多边形，低透明）
        ctx.save();
        ctx.shadowBlur  = 18;
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
        ctx.beginPath();
        for (let i = 0; i <= N_SEG; i++) {
          const t  = tTail + (tHead - tTail) * (i / N_SEG);
          const pos2 = bezPos(t);
          const d2   = bezDeriv(t);
          const len2 = Math.sqrt(d2.dx * d2.dx + d2.dy * d2.dy) || 1;
          const nx2  = -d2.dy / len2, ny2 = d2.dx / len2;
          const hw2  = (armW * (i / N_SEG)) * 0.9;
          if (i === 0) ctx.moveTo(pos2.x + nx2 * hw2, pos2.y + ny2 * hw2);
          else         ctx.lineTo(pos2.x + nx2 * hw2, pos2.y + ny2 * hw2);
        }
        for (let i = N_SEG; i >= 0; i--) {
          const t  = tTail + (tHead - tTail) * (i / N_SEG);
          const pos2 = bezPos(t);
          const d2   = bezDeriv(t);
          const len2 = Math.sqrt(d2.dx * d2.dx + d2.dy * d2.dy) || 1;
          const nx2  = -d2.dy / len2, ny2 = d2.dx / len2;
          const hw2  = (armW * (i / N_SEG)) * 0.9;
          ctx.lineTo(pos2.x - nx2 * hw2, pos2.y - ny2 * hw2);
        }
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // 主体色彩多边形
        ctx.beginPath();
        ctx.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 1; i <= N_SEG; i++) ctx.lineTo(leftPts[i].x, leftPts[i].y);
        for (let i = N_SEG; i >= 0; i--) ctx.lineTo(rightPts[i].x, rightPts[i].y);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // 中央亮线（白色核心）
        ctx.beginPath();
        ctx.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 0; i <= N_SEG; i++) {
          const t   = tTail + (tHead - tTail) * (i / N_SEG);
          const pos2 = bezPos(t);
          if (i === 0) ctx.moveTo(pos2.x, pos2.y);
          else         ctx.lineTo(pos2.x, pos2.y);
        }
        ctx.save();
        ctx.shadowBlur  = 6;
        ctx.shadowColor = 'rgba(255,255,255,0.9)';
        ctx.strokeStyle = gradW;
        ctx.lineWidth   = 2;
        ctx.stroke();
        ctx.restore();

        // 绘制预计算的小亮点
        for (const sp of sparkles) {
          if (sp.tf < tTail || sp.tf > tHead) continue;
          const localFrac = (sp.tf - tTail) / Math.max(tHead - tTail, 1e-6);
          const opacity = 0.4 + localFrac * 0.6;
          const pos = bezPos(sp.tf);
          const d   = bezDeriv(sp.tf);
          const len = Math.sqrt(d.dx * d.dx + d.dy * d.dy) || 1;
          const nx = -d.dy / len;
          const ny =  d.dx / len;
          const halfW = (armW * localFrac) / 2;
          const sx = pos.x + nx * halfW * sp.pf;
          const sy = pos.y + ny * halfW * sp.pf;
          ctx.globalAlpha = opacity;
          ctx.shadowBlur  = sp.size * 4;
          ctx.shadowColor = 'rgba(255,255,255,0.95)';
          ctx.fillStyle   = 'white';
          ctx.beginPath();
          ctx.arc(sx, sy, sp.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }

      if (rawT < 1) {
        rafId = requestAnimationFrame(draw);
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    />
  );
};

// ── 粒子拖尾（保留不动）
const ParticleWithTrail = ({ p, starSize }) => {
  const trailRef = useRef(null);
  const ARM_PX = starSize * 0.115;
  const RANGE  = ARM_PX * 1.5;
  const CP   = RANGE * 0.88;
  const END  = RANGE;
  const GRAV = RANGE * 1.1;
  const crossHalf  = Math.max(4, Math.round(starSize / 60));
  const crossThick = Math.max(2, Math.round(crossHalf * 0.20));
  const TRAIL_SIZE = Math.ceil(starSize * 0.6);
  const TRAIL_HALF = TRAIL_SIZE / 2;
  const dirX  = Math.cos(p.angle * Math.PI / 180);
  const dirY  = Math.sin(p.angle * Math.PI / 180);
  const perpX = -dirY, perpY = dirX;
  const cpX = dirX * CP + p.curve * perpX;
  const cpY = dirY * CP + p.curve * perpY;
  const ex  = dirX * END + p.curve * 0.08 * perpX;
  const ey  = dirY * END + p.curve * 0.08 * perpY + GRAV;
  const bez = u => ({ x: 2*(1-u)*u*cpX + u*u*ex, y: 2*(1-u)*u*cpY + u*u*ey });
  const bezAt = t => bez(1 - Math.sqrt(Math.max(0, 1 - t)));
  const ANIM_DUR = 0.82;
  const N        = 12;
  const frames   = Array.from({ length: N+1 }, (_, i) => bez(i/N));
  const xs       = frames.map(f => f.x);
  const ys       = frames.map(f => f.y);
  const kfTimes  = Array.from({ length: N+1 }, (_, i) => 1 - (1 - i/N)**2);
  useEffect(() => {
    const canvas = trailRef.current;
    if (!canvas) return;
    const ctx       = canvas.getContext('2d');
    const startTime = performance.now();
    const DUR_MS    = ANIM_DUR * 1000;
    const TRAIL_LEN = 0.30;
    const N_SEG     = 40;
    let rafId;
    const draw = (now) => {
      const rawT = Math.min((now - startTime) / DUR_MS, 1);
      ctx.clearRect(0, 0, TRAIL_SIZE, TRAIL_SIZE);
      if (rawT < 1) {
        const tHead = rawT;
        const tTail = Math.max(0, rawT - TRAIL_LEN);
        const partOpacity = rawT < 0.55 ? 1 : 1 - (rawT - 0.55) / 0.45;
        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < N_SEG; i++) {
          const ta   = tTail + (tHead - tTail) * (i / N_SEG);
          const tb   = tTail + (tHead - tTail) * ((i + 1) / N_SEG);
          const frac = (i + 1) / N_SEG;
          const pa   = bezAt(ta);
          const pb   = bezAt(tb);
          ctx.globalAlpha = frac * 0.75 * partOpacity;
          ctx.lineWidth   = 0.5 + frac * 0.9;
          ctx.strokeStyle = 'white';
          ctx.beginPath();
          ctx.moveTo(pa.x + TRAIL_HALF, pa.y + TRAIL_HALF);
          ctx.lineTo(pb.x + TRAIL_HALF, pb.y + TRAIL_HALF);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        rafId = requestAnimationFrame(draw);
      }
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <canvas ref={trailRef} width={TRAIL_SIZE} height={TRAIL_SIZE}
        style={{ position: 'absolute', left: -TRAIL_HALF, top: -TRAIL_HALF, pointerEvents: 'none' }} />
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
        <div style={{ position: 'absolute', width: crossHalf*2, height: crossThick, background: 'white', top: -crossThick/2, left: -crossHalf, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', width: crossThick, height: crossHalf*2, background: 'white', top: -crossHalf, left: -crossThick/2, borderRadius: '50%' }} />
      </motion.div>
    </>
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

export const AnimeStar = ({ dream, containerRef, skyRef, onInterpret, onDelete }) => {
  const [phase, setPhase]               = useState('idle');
  const [showCard, setShowCard]         = useState(false);
  const [particles, setParticles]       = useState([]);
  const [approachTrail, setApproachTrail] = useState(null);
  const [outerScope, animateOuter]      = useAnimate();
  const [innerScope, animateInner]      = useAnimate();

  // refs
  const cancelRef         = useRef(false);
  const pulseAnimRef      = useRef(null);
  const wasInterpretedRef = useRef(false);
  const doApproachRef     = useRef(null);

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

  // ── doApproach：飞向中心
  const doApproach = useCallback(async () => {
    // snap 到初始状态
    await animateOuter(outerScope.current, { scale: 1, x: 0, y: 0, opacity: 1, filter: 'brightness(1)' }, { duration: 0 });
    await animateInner(innerScope.current, { rotate: 0 }, { duration: 0 });

    // 等一帧，让 DOM 更新
    await new Promise(resolve => requestAnimationFrame(resolve));

    // 当前屏幕坐标
    const rect = outerScope.current.getBoundingClientRect();
    const currentCx = rect.left + rect.width / 2;
    const currentCy = rect.top  + rect.height / 2;

    const destX = window.innerWidth  / 2;
    const destY = window.innerHeight / 2;
    const tdx = destX - currentCx;
    const tdy = destY - currentCy;

    // 贝塞尔控制点（偏出一侧，形成弧线感）
    const P1x = tdx * 0.15 + (dreamSeedFloat(dream.id + 'apx') - 0.5) * window.innerWidth  * 0.08;
    const P1y = tdy * 0.10 - dreamSeedFloat(dream.id + 'apy')         * window.innerHeight * 0.06;

    // 计算法线方向最大臂宽（用于拖尾）
    const L = starSize * 0.115;
    const flyDirX = tdx, flyDirY = tdy;
    const flyLen  = Math.sqrt(flyDirX * flyDirX + flyDirY * flyDirY) || 1;
    const normX   = -flyDirY / flyLen;
    const normY   =  flyDirX / flyLen;
    let armW = 0;
    armRatios.forEach((ratio, k) => {
      const angle = (k * 360 / armRatios.length + rot_deg) * Math.PI / 180;
      const ax = Math.cos(angle) * L * ratio;
      const ay = Math.sin(angle) * L * ratio;
      const proj = Math.abs(ax * normX + ay * normY);
      if (proj > armW) armW = proj;
    });
    armW = Math.max(armW * 2, 8); // 全宽（两侧）

    // 估算弧长（N 采样）
    const N_ARC = 32;
    let arcLen = 0;
    const bezPosLocal = (t) => ({
      x: 2 * (1 - t) * t * P1x + t * t * tdx,
      y: 2 * (1 - t) * t * P1y + t * t * tdy,
    });
    let prev = bezPosLocal(0);
    for (let i = 1; i <= N_ARC; i++) {
      const cur = bezPosLocal(i / N_ARC);
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      arcLen += Math.sqrt(dx * dx + dy * dy);
      prev = cur;
    }
    const dur = Math.min(Math.max(arcLen / 250, 0.8), 3.0);

    // 关键帧（N=24 均匀 t）
    const N_KF = 24;
    const xs = [], ys = [];
    for (let i = 0; i <= N_KF; i++) {
      const t   = i / N_KF;
      const pos = bezPosLocal(t);
      xs.push(pos.x);
      ys.push(pos.y);
    }
    const kfTimes = Array.from({ length: N_KF + 1 }, (_, i) => i / N_KF);

    // 预计算 7 个稳定亮点
    const sparkles = Array.from({ length: 7 }, (_, i) => ({
      tf:   dreamSeedFloat(dream.id + 'sp' + i),
      pf:   (dreamSeedFloat(dream.id + 'spf' + i) - 0.5) * 2,
      size: 2.5 + dreamSeedFloat(dream.id + 'sps' + i) * 3.5,
    }));

    // 设置拖尾 state（以屏幕坐标传递起始点）
    setApproachTrail({
      starX: currentCx,
      starY: currentCy,
      P1x, P1y, tdx, tdy, armW, dur,
      startTime: performance.now(),
      r, g, b,
      sparkles,
    });

    // 执行飞行动画（只做位移，蓄力阶段才给戏剧性）
    await Promise.all([
      animateOuter(outerScope.current, { x: xs, y: ys }, {
        duration: dur, ease: 'linear', times: kfTimes,
      }),
      animateOuter(outerScope.current, {
        scale:  [1, 1.08],
        filter: ['brightness(1)', 'brightness(2)'],
      }, {
        duration: dur, ease: 'easeIn', times: [0, 1.0],
      }),
    ]);

    // ── 飞行结束：消除拖尾，进入蓄力 ──
    setApproachTrail(null);
    setPhase('charging');

    // 撞击弹跳（到达中心的冲击感）
    await animateOuter(outerScope.current, {
      scale:  [1.4,  0.78, 1.08],
      filter: ['brightness(4)', 'brightness(0.65)', 'brightness(1.3)'],
      x: [tdx, tdx, tdx],
      y: [tdy, tdy, tdy],
    }, { duration: IMPACT_DUR, times: [0, 0.45, 1], ease: 'easeOut' });
    if (cancelRef.current) return;

    // 蓄力：暗-亮循环，每轮幅度加大、频率加快，最后一脉冲直接爆发不收回
    const shakeX = [0, -7,  5, -9,  7, -12, 10, -7,  0].map(v => tdx + v);
    const shakeY = [0,  4, -5,  6, -4,   8, -6,  5,  0].map(v => tdy + v);
    await animateOuter(outerScope.current, {
      x: shakeX,
      y: shakeY,
      scale:  [1.08, 0.74, 2.2, 0.58, 3.2, 0.48, 4.8, 0.36, 6.5],
      filter: [
        'brightness(1.3)', 'brightness(0.14)',
        'brightness(6)',   'brightness(0.10)',
        'brightness(13)',  'brightness(0.07)',
        'brightness(26)',  'brightness(0.03)',
        'brightness(50)',
      ],
    }, { duration: CHARGE_DUR, times: CHARGE_TIMES, ease: 'linear' });
    if (cancelRef.current) return;

    await animateOuter(outerScope.current, { opacity: 0 }, { duration: 0 });
    setPhase('flash');
  }, [animateOuter, animateInner, outerScope, innerScope, dream, starSize, armRatios, rot_deg, r, g, b]);

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

    // 2. 粒子
    setParticles(Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      angle: i * 60 + (dreamSeedFloat(dream.id + 'p' + i) - 0.5) * 20,
      curve: (dreamSeedFloat(dream.id + 'c' + i) - 0.5) * 44,
    })));
    const particleTimer = setTimeout(() => setParticles([]), 2000);

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
  const handleCardStartClose = useCallback((wasInterpreted) => {
    wasInterpretedRef.current = wasInterpreted;
    setShowCard(false);
    // AnimatePresence onExitComplete 会调用 handleAfterCardClose
  }, []);

  // ── 卡片退出动画完成后
  const handleAfterCardClose = useCallback(async () => {
    const wasInterpreted = wasInterpretedRef.current;

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
      {/* ── 飞行拖尾（全屏 fixed canvas）── */}
      {approachTrail !== null && <ApproachTrail {...approachTrail} />}

      {/* ── Flash bloom + 卡片弹窗（portal 到手机容器内）── */}
      {containerRef?.current && createPortal(
        <>
          {/* 蓄力光晕（容器中心脉冲） */}
          {phase === 'charging' && <ChargingGlow r={r} g={g} b={b} />}

          {phase === 'flash' && (
            <>
              <motion.div
                key="flash-bloom"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.8, times: [0, 0.12, 0.35, 1], ease: 'easeOut' }}
                onAnimationComplete={() => { setShowCard(true); setPhase('card'); }}
                style={{
                  position: 'absolute', inset: 0, zIndex: 95, pointerEvents: 'none',
                  background: 'white',
                }}
              />
              <FlashLines dur={0.8} />
            </>
          )}
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
          {particles.map(p => <ParticleWithTrail key={p.id} p={p} starSize={starSize} />)}

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
