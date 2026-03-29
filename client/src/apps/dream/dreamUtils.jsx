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

export const getStarSize = (imp) => imp >= 8 ? 224 : imp >= 5 ? 176 : 128;

// ── 光场：24日 Lamé 曲线推广到 N 臂 ─────────────────────────────────────────
// 把像素分解到扇区两臂方向：(x,y) = s·Pk + t·Pk+1
// s=1 在臂k尖，t=1 在臂k+1尖，原点 s=t=0
// q：等亮度线内凹程度（<1 越凹，=1 退化为直线弦），boundary 在 s^q + t^q = 1
// p：颜色从中心向边界的衰减速率（沿任意方向的亮度曲线形状，与24日含义相同）
const starField = (x, y, rayLengths) => {
  const r = Math.sqrt(x * x + y * y);
  if (r < 1e-9) return 1;

  const N      = rayLengths.length;
  const dAlpha = 2 * Math.PI / N;

  let theta = Math.atan2(y, x);
  if (theta < 0) theta += 2 * Math.PI;

  const k   = Math.floor(theta / dAlpha) % N;
  const ak  = k * dAlpha;
  const ak1 = (k + 1) * dAlpha;
  const Lk  = rayLengths[k];
  const Lk1 = rayLengths[(k + 1) % N];

  const sinDa = Math.sin(dAlpha);
  const s = (x * Math.sin(ak1) - y * Math.cos(ak1)) / (Lk  * sinDa);
  const t = (y * Math.cos(ak)  - x * Math.sin(ak))  / (Lk1 * sinDa);

  const q   = 0.7;  // 等亮度线曲度（<1 内凹；=1 直线弦）
  const p   = 0.8;  // 颜色衰减速率（越大中心亮区越大）
  const rho = Math.pow(Math.pow(Math.max(0, s), q) + Math.pow(Math.max(0, t), q), 1 / q);
  return Math.max(0, 1 - Math.pow(rho, 1 / p));
};

// ── 单臂亮度：高斯横截面，sigma 随距离收窄 ──────────────────────────────────
// rpar : 沿臂正方向距离（0~L）
// rperp: 垂直于臂的距离
// L    : 臂长
// sig0 : 根部高斯 sigma（控制根部宽度）
// tapS : sigma 收窄指数（<1 → 越远越快变细）
const armBright = (rpar, rperp, L, sig0, tapS) => {
  const t = rpar / L;
  if (t <= 0 || t >= 1) return 0;
  const sig = sig0 * Math.pow(1 - t, tapS) + 0.012;  // 快速收窄后保持最小宽度，顶点如圆润针尖
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

// ── 呼吸动画参数（在这里调整效果）──────────────────────────────────────────
export const BREATHE_AMPLITUDE = 0.18; // ← 呼吸幅度（值越大越明显；推荐 0.10~0.28）
const BREATHE_SPEED = 2;            // ← 呼吸周期（秒），越小越快

// 全局注入呼吸 keyframe（只需一次）
if (typeof document !== 'undefined' && !document.getElementById('drm-star-kf')) {
  const s = document.createElement('style');
  s.id = 'drm-star-kf';
  s.textContent = `@keyframes drm-star-breathe{0%,100%{transform:scale(1)}50%{transform:scale(${1 - BREATHE_AMPLITUDE})}}`;
  document.head.appendChild(s);
}

export const AnimeStar = ({ size, color, opacity = 1, className, style, rays = 4, rotation = 0, phase = 0 }) => {
  const canvasRef = useRef(null);
  const [r, g, b] = hexRgb(color);

  const L = 0.25;          // ← 基准参数，改这一个数整体缩放所有尺寸类参数
  const DISPLAY = Math.round(size * L / 0.25);  // CSS 显示尺寸随 L 等比缩放

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const S = 400;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    // ── 尺寸类参数（随 L 缩放） ────────────────────────────────────────────
    const sig0     = L * 0.24;        // 臂根部宽度（L 的固定比例）
    const coreSig2 = L * L * 0.064;   // 核心高斯 sigma²（随 L² 缩放）
    // ── 形状类参数（曲率/渐变，不随尺寸变化） ──────────────────────────────
    const tapS  = 2.5;   // 臂收窄速率
    const wPow  = 5.0;   // 白化衰减指数
    const coreK = 0.5;   // 核心亮度系数

    // 臂长数组（0° 起顺序排列），所有比例相对于 L
    const RAY_LENGTHS = {
      4: [L,      L*1.52, L,      L*1.52],            // 十字：短/长交替
      5: [L,      L,      L,      L,      L     ],    // 五角：等长
      6: [L,  L,  L,  L,  L, L], // 六角
      8: [L,      L*0.8,  L*1.5,  L*0.8,  L,     L*0.8, L*1.5, L*0.8], // 八角：长/中/短
    };

    const drawFrame = (ts) => {
      const img = ctx.createImageData(S, S);
      const d   = img.data;
      const base = RAY_LENGTHS[rays] || RAY_LENGTHS[4];

      // 整体同步呼吸（所有臂同相位，整个星星一起扩缩）
      const breath = 0.9 + 0.1 * Math.sin(ts * 0.0015);
      const curLen = base.map(len => len * breath);

      const cosR = Math.cos(rotation * Math.PI / 180);
      const sinR = Math.sin(rotation * Math.PI / 180);
      for (let px = 0; px < S; px++) {
        for (let py = 0; py < S; py++) {
          const x = (px - S * 0.5) / (S * 0.5);
          const y = (py - S * 0.5) / (S * 0.5);
          const xr = x * cosR + y * sinR;
          const yr = -x * sinR + y * cosR;

          const rN   = Math.sqrt(x * x + y * y);   // 距中心距离，旋转不变
          const field = starField(xr, yr, curLen);
          const arms  = starLayerN(xr, yr, curLen, sig0, tapS);
          const core = Math.exp(-rN * rN / coreSig2);

          // ── 图层合成：臂+核 over 场（Porter-Duff，不相加混合）──────────────
          // 场层：纯星色（w=0），alpha = field
          const fieldA = field;
          // 臂+核层：白化由 wPow 控制，alpha = armVal
          const armVal = Math.min(1, arms + core * coreK);
          const armW   = Math.pow(armVal, wPow); // 白化程度

          // over 合成：臂层在上，场层在下
          // outAlpha = armA + fieldA * (1 - armA)
          const outAlpha = armVal + fieldA * (1 - armVal);
          if (outAlpha < 0.004) { d[(py * S + px) * 4 + 3] = 0; continue; }

          // outW = 臂的白化贡献 / outAlpha（场 w=0 不贡献白化）
          const outW = armW * armVal / outAlpha;
          const i = (py * S + px) * 4;
          d[i]   = Math.round(r * (1 - outW) + 255 * outW);
          d[i+1] = Math.round(g * (1 - outW) + 255 * outW);
          d[i+2] = Math.round(b * (1 - outW) + 255 * outW);
          d[i+3] = Math.min(255, Math.round(outAlpha * 255));
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    // 呼吸由 CSS animation 驱动，canvas 只需渲染一次
    drawFrame(0);
  }, [color, r, g, b, rays, rotation, L]);

  // 外层 div 负责居中定位，canvas 只做呼吸缩放（避免 transform 冲突）
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 0, height: 0, pointerEvents: 'none',
    }}>
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          position: 'absolute',
          width: DISPLAY,
          height: DISPLAY,
          marginLeft: -DISPLAY / 2,
          marginTop:  -DISPLAY / 2,
          animation: `drm-star-breathe ${BREATHE_SPEED}s ease-in-out ${-(phase * BREATHE_SPEED).toFixed(2)}s infinite`,
          opacity,
          pointerEvents: 'none',
          ...style,
        }}
      />
    </div>
  );
};
