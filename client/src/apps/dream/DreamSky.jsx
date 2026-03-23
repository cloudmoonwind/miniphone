/**
 * DreamSky — 宇宙星云背景
 * 星云：FBM 噪点纹理（一次性生成，每帧 drawImage），有机云状，无几何形状
 * 星场：300颗，bright 星有真实衍射光芒
 */
import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { SKY_RATIO, dreamSeed, hexRgb } from './dreamUtils.jsx';

// ─── 噪点 + FBM ────────────────────────────────────────────────────────────
const hash2 = (x, y, s) => {
  let n = (x * 1619 + y * 31337 + s * 6971) | 0;
  n = ((n << 13) ^ n) | 0;
  return (1.0 - (((n * ((n * n * 15731 + 789221) | 0) + 1376312589) | 0) & 0x7fffffff) / 1073741824.0);
};
const fade = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const vnoise = (x, y, s) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = fade(x - ix), fy = fade(y - iy);
  return lerp(
    lerp(hash2(ix, iy, s),   hash2(ix+1, iy, s),   fx),
    lerp(hash2(ix, iy+1, s), hash2(ix+1, iy+1, s), fx),
    fy,
  );
};
const fbm = (x, y, oct, s) => {
  let v = 0, a = 0.5, f = 1.0, m = 0;
  for (let i = 0; i < oct; i++) {
    v += vnoise(x * f, y * f, s + i * 127) * a;
    m += a; a *= 0.5; f *= 2.07;
  }
  return v / m;
};

// ─── 生成星云纹理（offscreen canvas，启动时一次性渲染）────────────────────
function buildNebulaTexture(w, h) {
  const SCALE = 3;                       // 1/3 分辨率，自然模糊放大后柔和
  const nw = Math.ceil(w / SCALE);
  const nh = Math.ceil(h / SCALE);
  const oc = document.createElement('canvas');
  oc.width = nw; oc.height = nh;
  const octx = oc.getContext('2d');
  const img  = octx.createImageData(nw, nh);
  const d    = img.data;

  for (let py = 0; py < nh; py++) {
    for (let px = 0; px < nw; px++) {
      const nx = px / nw;
      const ny = py / nh;

      // 三层 FBM：大云体 + 中层变化 + 细节
      const n1 = fbm(nx * 2.8,        ny * 2.8,        6, 42);
      const n2 = fbm(nx * 3.6 + 1.3,  ny * 2.4 + 0.8,  5, 137);
      const n3 = fbm(nx * 5.5 + 2.7,  ny * 4.8 + 1.9,  4, 251);

      // 云密度 = 各层加权，做 threshold + 平滑过渡
      const raw  = n1 * 0.52 + n2 * 0.32 + n3 * 0.16;
      const dens = Math.max(0, (raw - 0.34) / 0.55);   // 0.34 以下透明
      if (dens < 0.001) continue;

      const t   = Math.min(1, dens * dens * 2.4);       // 非线性，中心浓边缘淡
      const alpha = Math.round(t * 195);                // max ~195/255

      // 颜色：n2 决定冷暖偏向（深紫 ↔ 冷蓝），n3 添加细节亮度
      const warm  = Math.max(0, Math.min(1, n2 * 1.4 - 0.2));
      const bright = n3 * 0.25;
      const r = Math.round((18  + warm * 55  + bright * 30) );
      const g = Math.round((10  + warm * 30  + bright * 40) );
      const b = Math.round((110 + warm * 90  + bright * 50) );

      const idx = (py * nw + px) * 4;
      d[idx]   = Math.min(255, r);
      d[idx+1] = Math.min(255, g);
      d[idx+2] = Math.min(255, b);
      d[idx+3] = alpha;
    }
  }
  octx.putImageData(img, 0, 0);
  return oc;
}

// ─── 预计算稳定背景星场 ───────────────────────────────────────────────────
const BG_STARS = Array.from({ length: 320 }, (_, i) => {
  const s   = dreamSeed(`bsx-${i}`);
  const rv  = dreamSeed(`bsr-${i}`);
  const type = s < 0.04 ? 'bright' : s < 0.20 ? 'medium' : 'small';
  return {
    x: dreamSeed(`bgx-${i}`),
    y: dreamSeed(`bgy-${i}`),
    type,
    r:    type === 'bright' ? 1.6 + rv * 0.7
        : type === 'medium' ? 0.75 + rv * 0.45
        : 0.2 + rv * 0.5,
    baseAlpha: type === 'bright' ? 0.92 + rv * 0.08
             : type === 'medium' ? 0.55 + rv * 0.30
             : 0.20 + rv * 0.50,
    speed: 0.2 + dreamSeed(`bgsp-${i}`) * 0.85,
    phase: dreamSeed(`bgph-${i}`) * Math.PI * 2,
    color: [[215,228,255],[205,218,255],[235,230,255],[255,255,255]][
      Math.floor(dreamSeed(`bgc-${i}`) * 4)],
    // bright 星：随机旋转角 + 两对光芒（长短不一）
    ang:      dreamSeed(`bga-${i}`) * 0.5,
    spike1:   type === 'bright' ? 14 + rv * 18 : type === 'medium' ? 5 + rv * 6 : 0,
    spike2:   type === 'bright' ? (10 + rv * 12) * 0.6 : 0,
  };
});

const DreamSky = forwardRef(({ interpreted = [] }, ref) => {
  const canvasRef   = useRef(null);
  const nebulaRef   = useRef(null);    // 缓存星云纹理 canvas
  const interpRef   = useRef(interpreted);
  const burstQueRef = useRef([]);
  const waterQueRef = useRef([]);
  const stRef = useRef({
    mounted: false, w: 0, h: 0, dpr: 1,
    lastShoot: -99999, shoots: [], bursts: [], waterItems: [],
  });

  useEffect(() => { interpRef.current = interpreted; }, [interpreted]);

  useImperativeHandle(ref, () => ({
    burst:          (sx, sy, color) => burstQueRef.current.push({ sx, sy, color }),
    shootIntoWater: (sx, sy, color) => waterQueRef.current.push({ sx, sy, color }),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const st = stRef.current;
    st.mounted = true;

    const resize = () => {
      const p = canvas.parentElement;
      if (!p) return;
      const dpr = window.devicePixelRatio || 1;
      st.w = p.clientWidth;
      st.h = p.clientHeight;
      st.dpr = dpr;
      canvas.width  = st.w * dpr;
      canvas.height = st.h * dpr;
      canvas.style.width  = `${st.w}px`;
      canvas.style.height = `${st.h}px`;
      // 尺寸变化时重新生成星云纹理
      const skyH = st.h * SKY_RATIO;
      nebulaRef.current = buildNebulaTexture(st.w, skyH);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // ── 辅助：画衍射光芒（一对，沿给定角度） ──────────────────────────
    const drawSpike = (cx, cy, ang, len, [rc, gc, bc], alpha) => {
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const grd = ctx.createLinearGradient(
        cx - cos * len, cy - sin * len,
        cx + cos * len, cy + sin * len,
      );
      grd.addColorStop(0,    'rgba(0,0,0,0)');
      grd.addColorStop(0.38, `rgba(${rc},${gc},${bc},${alpha * 0.45})`);
      grd.addColorStop(0.5,  `rgba(255,255,255,${alpha * 0.9})`);
      grd.addColorStop(0.62, `rgba(${rc},${gc},${bc},${alpha * 0.45})`);
      grd.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.strokeStyle = grd;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(cx - cos * len, cy - sin * len);
      ctx.lineTo(cx + cos * len, cy + sin * len);
      ctx.stroke();
    };

    let raf;
    const render = (now) => {
      if (!st.mounted) return;
      const { w, h, dpr } = st;
      if (!w || !h) { raf = requestAnimationFrame(render); return; }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const skyH  = h * SKY_RATIO;
      const waterH = h - skyH;

      // ── 底色 ───────────────────────────────────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0,    '#040110');
      bg.addColorStop(0.22, '#0b0620');
      bg.addColorStop(0.50, '#110a32');
      bg.addColorStop(0.72, '#0e0d28');
      bg.addColorStop(1,    '#060410');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // ── FBM 星云纹理 ────────────────────────────────────────────────────
      if (nebulaRef.current) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(nebulaRef.current, 0, 0, w, skyH);
        ctx.restore();
      }

      // ── 背景星场 ────────────────────────────────────────────────────────
      BG_STARS.forEach(s => {
        const twk = 0.5 + 0.5 * Math.sin(now * s.speed * 0.001 + s.phase);
        const a   = s.baseAlpha * (0.48 + 0.52 * twk);
        const r   = s.r * (0.88 + 0.12 * twk);
        const [rc, gc, bc] = s.color;
        const sx2 = s.x * w, sy2 = s.y * skyH;

        // 晕光
        if (s.type !== 'small') {
          const gr  = r * (s.type === 'bright' ? 8 : 3.8);
          const grd = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, gr);
          grd.addColorStop(0,   `rgba(${rc},${gc},${bc},${a * 0.65})`);
          grd.addColorStop(0.3, `rgba(${rc},${gc},${bc},${a * 0.18})`);
          grd.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(sx2, sy2, gr, 0, Math.PI * 2);
          ctx.fill();
        }

        // 星核
        ctx.fillStyle = `rgba(${rc},${gc},${bc},${a})`;
        ctx.beginPath();
        ctx.arc(sx2, sy2, r, 0, Math.PI * 2);
        ctx.fill();

        // 衍射光芒（主光芒 + 次光芒，有旋转角）
        if (s.spike1 > 0) {
          const sl1 = s.spike1 * (0.78 + 0.22 * twk);
          drawSpike(sx2, sy2, s.ang,                    sl1, [rc, gc, bc], a);
          drawSpike(sx2, sy2, s.ang + Math.PI / 2,      sl1, [rc, gc, bc], a);
          if (s.spike2 > 0) {
            const sl2 = s.spike2 * (0.78 + 0.22 * twk);
            drawSpike(sx2, sy2, s.ang + Math.PI / 4,    sl2, [rc, gc, bc], a * 0.55);
            drawSpike(sx2, sy2, s.ang + Math.PI * 3/4,  sl2, [rc, gc, bc], a * 0.55);
          }
        }
      });

      // ── 流星 ────────────────────────────────────────────────────────────
      if (now - st.lastShoot > 7500) {
        st.lastShoot = now + Math.random() * 5500;
        st.shoots.push({
          x0: (0.05 + Math.random() * 0.6) * w,
          y0: (0.03 + Math.random() * 0.28) * skyH,
          ang: Math.PI / 6 + Math.random() * 0.45,
          spd: 270 + Math.random() * 190,
          len: 55  + Math.random() * 75,
          born: now,
        });
      }
      st.shoots = st.shoots.filter(s => {
        const age = (now - s.born) / 1000;
        if (age > 1.0) return false;
        const dist = s.spd * age;
        const x2 = s.x0 + Math.cos(s.ang) * dist;
        const y2 = s.y0 + Math.sin(s.ang) * dist;
        const tx = x2  - Math.cos(s.ang) * s.len;
        const ty = y2  - Math.sin(s.ang) * s.len;
        const a  = Math.max(0, 1 - age * 1.9);
        const grd = ctx.createLinearGradient(tx, ty, x2, y2);
        grd.addColorStop(0, 'rgba(200,215,255,0)');
        grd.addColorStop(1, `rgba(225,235,255,${a * 0.85})`);
        ctx.strokeStyle = grd;
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.fillStyle = `rgba(240,246,255,${a})`;
        ctx.beginPath(); ctx.arc(x2, y2, 1.5 * a, 0, Math.PI * 2); ctx.fill();
        return true;
      });

      // ── 底部深色过渡（无硬线）──────────────────────────────────────────
      const fog = ctx.createLinearGradient(0, skyH * 0.78, 0, h);
      fog.addColorStop(0,    'rgba(4,1,16,0)');
      fog.addColorStop(0.30, 'rgba(4,1,16,0.40)');
      fog.addColorStop(0.62, 'rgba(3,1,12,0.70)');
      fog.addColorStop(1,    'rgba(2,1,8,0.92)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, skyH * 0.78, w, h - skyH * 0.78);

      // 底部保留一层淡紫氛围
      const bNeb = ctx.createRadialGradient(w*0.5, skyH + waterH*0.35, 0, w*0.5, skyH + waterH*0.35, w*0.6);
      bNeb.addColorStop(0,   'rgba(45,25,110,0.28)');
      bNeb.addColorStop(0.5, 'rgba(25,15,75,0.10)');
      bNeb.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = bNeb;
      ctx.fillRect(0, skyH, w, waterH);

      // ── 已解梦：底部发光轮廓（嵌入雾中）─────────────────────────────
      interpRef.current.slice(-20).forEach(d => {
        const cx  = (d.waterX || 50) / 100 * w;
        const cy  = skyH + (d.waterY || 50) / 100 * waterH;
        const sz  = d.importance >= 8 ? 18 : d.importance >= 5 ? 12 : 8;
        const pls = 0.5 + 0.5 * Math.sin(now * 0.0006 + dreamSeed(d.id) * Math.PI * 2);
        const ga  = 0.09 + 0.06 * pls;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 5);
        grd.addColorStop(0,   `rgba(165,185,255,${ga * 3.5})`);
        grd.addColorStop(0.4, `rgba(125,145,235,${ga * 1.5})`);
        grd.addColorStop(1,   'rgba(80,100,200,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(cx, cy, sz * 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(205,218,255,${0.28 + 0.18 * pls})`;
        ctx.beginPath(); ctx.arc(cx, cy, sz * 0.55, 0, Math.PI * 2); ctx.fill();
      });

      // ── 点击爆炸粒子 ────────────────────────────────────────────────────
      while (burstQueRef.current.length) {
        const b = burstQueRef.current.shift();
        const [br, bg2, bb] = hexRgb(b.color);
        st.bursts.push({
          px: b.sx / 100 * w, py: b.sy / 100 * skyH,
          cr: br, cg: bg2, cb: bb, born: now,
          ptcl: Array.from({ length: 20 }, (_, j) => ({
            ang: (j / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.3,
            spd: 50 + Math.random() * 100,
            r:   0.8 + Math.random() * 1.4,
          })),
        });
      }
      st.bursts = st.bursts.filter(b => {
        const age = (now - b.born) / 1000;
        if (age > 1.2) return false;
        b.ptcl.forEach(p => {
          const pa = Math.max(0, (1 - age * 1.4) * 0.8);
          const d2 = p.spd * age;
          ctx.fillStyle = `rgba(255,255,255,${pa})`;
          ctx.beginPath(); ctx.arc(b.px + Math.cos(p.ang)*d2, b.py + Math.sin(p.ang)*d2, p.r*2.2, 0, Math.PI*2); ctx.fill();
        });
        const fa = Math.max(0, 0.8 - age * 3);
        if (fa > 0) {
          const fr  = 50 * Math.min(age * 4, 1);
          const grd = ctx.createRadialGradient(b.px, b.py, 0, b.px, b.py, fr);
          grd.addColorStop(0,   `rgba(${b.cr},${b.cg},${b.cb},${fa*0.45})`);
          grd.addColorStop(0.4, `rgba(${b.cr},${b.cg},${b.cb},${fa*0.12})`);
          grd.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(b.px, b.py, fr, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${fa})`; ctx.beginPath(); ctx.arc(b.px, b.py, fr*0.28, 0, Math.PI*2); ctx.fill();
        }
        return true;
      });

      // ── 解梦落入底部 ────────────────────────────────────────────────────
      while (waterQueRef.current.length) {
        const s = waterQueRef.current.shift();
        const [br, bg2, bb] = hexRgb(s.color);
        st.waterItems.push({
          px: s.sx / 100 * w, py: s.sy / 100 * skyH,
          targetY: skyH + waterH * 0.18,
          cr: br, cg: bg2, cb: bb,
          dx: (Math.random() - 0.5) * 30, born: now,
        });
      }
      st.waterItems = st.waterItems.filter(s => {
        const age  = (now - s.born) / 1000;
        if (age > 1.8) return false;
        const prog = Math.min(age / 1.2, 1);
        const ease = prog * prog;
        const cx2  = s.px + s.dx * ease;
        const cy2  = s.py + (s.targetY - s.py) * ease;
        const a    = Math.max(0, 1 - age * 0.65);
        const pe   = Math.max(0, ease - 0.06);
        const len  = Math.sqrt((cx2 - (s.px+s.dx*pe))**2 + (cy2 - (s.py+(s.targetY-s.py)*pe))**2) + 14;
        const nx2  = (cx2 - (s.px+s.dx*pe)) / len, ny2 = (cy2 - (s.py+(s.targetY-s.py)*pe)) / len;
        for (let seg = 0; seg < 7; seg++) {
          const p2 = seg / 7;
          ctx.fillStyle = `rgba(200,215,255,${a*(1-p2)*0.5})`;
          ctx.beginPath(); ctx.arc(cx2-nx2*len*p2, cy2-ny2*len*p2, (1-p2)*2.2*a, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = `rgba(240,246,255,${a})`;
        ctx.beginPath(); ctx.arc(cx2, cy2, 2.4*a, 0, Math.PI*2); ctx.fill();
        return true;
      });

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => {
      st.mounted = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0" style={{ display: 'block' }} />;
});

DreamSky.displayName = 'DreamSky';
export { DreamSky };
