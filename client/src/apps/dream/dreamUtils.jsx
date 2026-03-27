// 梦境工具函数和常量
import { useRef, useEffect } from 'react';

export const SKY_RATIO = 0.62; // 天空占整体高度比例

// hex 颜色 → [r, g, b] 整数数组
export const hexRgb = (hex) => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
};

// hex → 0xRRGGBB 整数（PixiJS 用）
export const hexToInt = (hex) => {
  const [r,g,b] = hexRgb(hex);
  return (r << 16) | (g << 8) | b;
};

export const DREAM_TYPES = {
  emotion: { label: '情绪梦', color: '#C8B0C8' },
  omen:    { label: '预示梦', color: '#A898D8' },
  memory:  { label: '回忆梦', color: '#98B0D0' },
  desire:  { label: '欲望梦', color: '#D0B898' },
};

// 用 id 生成 [0,1) 范围内的稳定随机数
export const dreamSeed = (id) => {
  let h = 0x811c9dc5;
  for (const c of String(id)) h = (Math.imul(h ^ c.charCodeAt(0), 0x01000193)) >>> 0;
  return h / 0xffffffff;
};

export const getStarSize = (imp) => imp >= 8 ? 28 : imp >= 5 ? 22 : 16;

// ── 单臂亮度：高斯横截面，sigma 随距离收窄 ──────────────────────────────────
// rpar : 沿臂正方向距离（0~L）
// rperp: 垂直于臂的距离
// L    : 臂长
// sig0 : 根部高斯 sigma（控制根部宽度）
// tapS : sigma 收窄指数（<1 → 越远越快变细）
const armBright = (rpar, rperp, L, sig0, tapS) => {
  const t = rpar / L;
  if (t <= 0 || t >= 1) return 0;
  const sig = sig0 * Math.pow(1 - t, tapS);          // sigma 随距离收窄
  const bAlong  = Math.pow(1 - t, 0.4);              // 沿臂亮度：慢衰减
  const bAcross = Math.exp(-rperp * rperp / (sig * sig)); // 高斯横截面，无硬边
  return bAlong * bAcross;
};

// ── N 射线不等长星：各臂独立计算，取最大值 ─────────────────────────────────
// rayLengths[k]：第 k 条臂（角度 k*2π/N）的长度
// sig0 / tapS  ：传入 armBright 的宽度参数
const starLayerN = (x, y, rayLengths, sig0, tapS) => {
  const r = Math.sqrt(x * x + y * y);
  if (r < 1e-9) return 1;
  const N = rayLengths.length;
  let maxB = 0;
  for (let k = 0; k < N; k++) {
    const alpha = k * 2 * Math.PI / N;
    const rpar  = x * Math.cos(alpha) + y * Math.sin(alpha);
    if (rpar <= 0) continue;
    const rperp = Math.abs(-x * Math.sin(alpha) + y * Math.cos(alpha));
    const b = armBright(rpar, rperp, rayLengths[k], sig0, tapS);
    if (b > maxB) maxB = b;
  }
  return maxB;
};

export const AnimeStar = ({ size, color, opacity = 1, className, style, rays = 4 }) => {
  const canvasRef = useRef(null);
  const [r, g, b] = hexRgb(color);
  const DISPLAY = size * 8;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const S = 400;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // 4射线：短的缩至原来3/4，长:短 = 1.5:1
    const Lh = 0.25;   // 横轴（短）
    const Lv = 0.38;   // 纵轴（长），Lv/Lh ≈ 1.52

    // 5/6/8射线：长臂 / 短臂
    const Ll = 0.55;
    const Ls = 0.40;

    const sig0 = 0.08;   // 臂根部高斯 sigma（根部宽度）
    const tapS = 2.5;    // sigma 收窄指数：>1 → 近端快收、远端慢收
    const wPow = 2.5;    // 白色衰减：越大星色越靠外

    // 各角数的臂长数组（0° 起顺序排列）
    // 4角：右/上/左/下；6角：3长3短交替；8角：4长4短交替
    const RAY_LENGTHS = {
      4: [Lh, Lv, Lh, Lv],
      5: [Ll, Ll, Ls, Ll, Ls],
      6: [Ll, Ls, Ll, Ls, Ll, Ls],
      8: [Ll, Ls, Ll, Ls, Ll, Ls, Ll, Ls],
    };

    const drawFrame = (ts) => {
      const img = ctx.createImageData(S, S);
      const d   = img.data;
      const base = RAY_LENGTHS[rays] || RAY_LENGTHS[4];

      // N>4：各臂独立呼吸（0.9+0.1*sin → 0.8~1.0 范围）
      const curLen = rays === 4 ? base : base.map((L, i) => {
        const phase = (i / base.length) * Math.PI * 2;
        return L * (0.9 + 0.1 * Math.sin(ts * 0.0015 + phase));
      });

      for (let px = 0; px < S; px++) {
        for (let py = 0; py < S; py++) {
          const x = (px - S * 0.5) / (S * 0.5);
          const y = (py - S * 0.5) / (S * 0.5);

          const rN   = Math.sqrt(x * x + y * y);
          const core = Math.exp(-rN * rN / 0.004);           // 紧密高斯核（sigma≈0.045）
          const arms = starLayerN(x, y, curLen, sig0, tapS); // 臂附近的体积光场
          const bright = Math.min(1, arms + core * 0.5);
          if (bright < 0.004) { d[(py * S + px) * 4 + 3] = 0; continue; }

          const w = Math.pow(bright, wPow);
          const i = (py * S + px) * 4;
          d[i]   = Math.round(r * (1 - w) + 255 * w);
          d[i+1] = Math.round(g * (1 - w) + 255 * w);
          d[i+2] = Math.round(b * (1 - w) + 255 * w);
          d[i+3] = Math.min(255, Math.round(bright * 255));
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    if (rays === 4) {
      drawFrame(0);
      return;
    }

    // N>4：RAF 约 6fps 呼吸动画
    let animId;
    let lastDraw = -999;
    const loop = (ts) => {
      if (ts - lastDraw >= 160) { lastDraw = ts; drawFrame(ts); }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [color, r, g, b, rays]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        width: DISPLAY,
        height: DISPLAY,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
};
