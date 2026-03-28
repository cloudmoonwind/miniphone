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

  const q   = 0.6;  // 等亮度线曲度（<1 内凹；=1 直线弦）
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

export const AnimeStar = ({ size, color, opacity = 1, className, style, rays = 4 }) => {
  const canvasRef = useRef(null);
  const [r, g, b] = hexRgb(color);
  const DISPLAY = size * (rays === 5 ? 16 : 8);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const S = 400;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');

    const Lh = 0.25;   // 4角横轴（短臂），同时作为 5角等长臂、8角中等臂的基准
    const Lv = 0.38;   // 4角纵轴（长臂）

    const Ll = 0.55;   // 6角长臂
    const Ls = 0.40;   // 6角短臂

    const sig0   = 0.08;  // 臂根部宽度（越大臂越粗，与核应视觉相切）
    const tapS   = 2.5;   // 臂收窄速率（越大越快变细，越小越均匀）
    const wPow   = 4.0;   // 白化衰减指数（越大白色区域越小，越集中在中心）

    // 臂长数组（0° 起顺序排列）
    // 4角：右/上/左/下
    // 5角：5臂等长 = Lh
    // 6角：长短交替
    // 8角：3:2:1，单位=0.125；右/斜/上/斜/左/斜/下/斜 = 0.25/0.125/0.375/0.125/...用户觉得最短臂太短了，手动加长了一点，cc克不用在意
    const RAY_LENGTHS = {
      4: [Lh, Lv, Lh, Lv],
      5: [Lh, Lh, Lh, Lh, Lh],
      6: [Ll, Ls, Ll, Ls, Ll, Ls],
      8: [0.25, 0.2, 0.375, 0.2, 0.25, 0.2, 0.375, 0.2],
    };

    const drawFrame = (ts) => {
      const img = ctx.createImageData(S, S);
      const d   = img.data;
      const base = RAY_LENGTHS[rays] || RAY_LENGTHS[4];

      // N>4：整体同步呼吸（所有臂同相位，整个星星一起扩缩）
      const breath = rays === 4 ? 1 : (0.9 + 0.1 * Math.sin(ts * 0.0015));
      const curLen = base.map(L => L * breath);

      for (let px = 0; px < S; px++) {
        for (let py = 0; py < S; py++) {
          const x = (px - S * 0.5) / (S * 0.5);
          const y = (py - S * 0.5) / (S * 0.5);

          const rN   = Math.sqrt(x * x + y * y);
          const field = starField(x, y, curLen);          // 星形光场：填充臂间区域，内凹等亮度线
          const arms  = starLayerN(x, y, curLen, sig0, tapS); // 光臂：沿各臂方向的窄高斯光束
          // 核心：0.004 = sigma²，控制核半径（越小核越紧）；0.5 = 核强度系数（越大核越亮）
          // coreSig2：核心高斯 sigma²，越小核越紧（sigma ≈ √coreSig2）
          // coreK：核心亮度系数，越大核越亮
          const coreSig2 = 0.004; // 核心半径：sigma = √coreSig2，越小核越紧
          const coreK    = 0.5;   // 核心强度系数，越大核越亮
          const core  = Math.exp(-rN * rN / coreSig2);

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
