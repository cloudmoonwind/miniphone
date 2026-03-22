import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as PIXI from 'pixi.js';
import { SKY_RATIO, DREAM_TYPES, dreamSeed, hexToInt } from './dreamUtils.jsx';

const BG_STARS = Array.from({ length: 80 }, (_, i) => ({
  x:     (i * 137.508) % 100 / 100,
  y:     (i * 97.3 + i * i * 0.07) % 100 / 100,
  r:     i % 11 === 0 ? 1.8 : i % 5 === 0 ? 1.1 : 0.55,
  phase: (i * 2.618) % (Math.PI * 2),
  speed: 0.35 + (i % 9) * 0.09,
  color: [0xB4C8FF, 0xC8B4FF, 0xB4E1FF][i % 3],
}));

const createDispCanvas = () => {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      img.data[i]   = Math.round(Math.sin(y * 0.07 + x * 0.024) * 60 + 128);
      img.data[i+1] = Math.round(Math.sin(x * 0.056 + y * 0.036) * 45 + 128);
      img.data[i+2] = 0;
      img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

const makeGradTex = (stops, vertical = true, w = 2, h = 256) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = vertical
    ? ctx.createLinearGradient(0, 0, 0, h)
    : ctx.createLinearGradient(0, 0, w, 0);
  stops.forEach(([pos, color]) => g.addColorStop(pos, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return PIXI.Texture.from(c);
};

const DreamSky = forwardRef(({ interpreted = [] }, ref) => {
  const canvasRef     = useRef(null);
  const interpRef     = useRef(interpreted);
  const burstRef      = useRef([]);
  const shootWaterRef = useRef([]);

  useEffect(() => { interpRef.current = interpreted; }, [interpreted]);

  useImperativeHandle(ref, () => ({
    burst: (skyX, skyY, color = '#ffffff') => {
      burstRef.current.push({ x: skyX, y: skyY, color });
    },
    shootIntoWater: (skyX, skyY, color = '#C8B0C8') => {
      shootWaterRef.current.push({ x: skyX, y: skyY, color });
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let app = null;
    let mounted = true;
    let initDone = false;
    const scene = {};

    const init = async () => {
      try {
        app = new PIXI.Application();
        await app.init({
          canvas,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          resizeTo: canvas.parentElement || canvas,
        });
        if (!mounted) { app.destroy(false); return; }

        const w      = app.screen.width;
        const h      = app.screen.height;
        const skyH   = h * SKY_RATIO;
        const waterY = skyH;
        const waterH = h - skyH;

        // ── skyContainer（只含天空层，用于渲染倒影到 skyRT）──────────────
        const skyContainer = new PIXI.Container();
        app.stage.addChild(skyContainer);
        scene.skyContainer = skyContainer;

        // 天空底色
        const skyBg = new PIXI.Sprite(makeGradTex([
          [0,    '#060818'], [0.22, '#0d1535'],
          [0.55, '#16244a'], [0.85, '#1f3060'], [1, '#2a3a72'],
        ]));
        skyBg.width = w; skyBg.height = skyH;
        skyContainer.addChild(skyBg);

        // 星云（一次性预渲染，避免每帧重复 blur）
        const nebulaRT  = PIXI.RenderTexture.create({ width: w, height: skyH });
        const nebulaOff = new PIXI.Container();
        [
          { x: 0.35, y: 0.35, rx: 0.22, ry: 0.28, color: 0x6050C0, alpha: 0.22 },
          { x: 0.75, y: 0.40, rx: 0.20, ry: 0.22, color: 0x3080DC, alpha: 0.15 },
          { x: 0.55, y: 0.18, rx: 0.18, ry: 0.20, color: 0x803090, alpha: 0.12 },
        ].forEach(nd => {
          const g = new PIXI.Graphics();
          g.ellipse(nd.x * w, nd.y * skyH, nd.rx * w, nd.ry * skyH);
          g.fill({ color: nd.color, alpha: nd.alpha });
          g.filters = [new PIXI.BlurFilter({ strength: 40, quality: 2 })];
          nebulaOff.addChild(g);
        });
        app.renderer.render({ container: nebulaOff, target: nebulaRT });
        nebulaOff.destroy({ children: true });

        const nebulaSpr = new PIXI.Sprite(nebulaRT);
        nebulaSpr.blendMode = 'add';
        skyContainer.addChild(nebulaSpr);
        scene.nebulaSpr = nebulaSpr;

        // 背景星点（每帧重绘）
        const bgStarsG = new PIXI.Graphics();
        skyContainer.addChild(bgStarsG);
        scene.bgStarsG = bgStarsG;

        // bloom 层：渲染星点到 starsRT，再以低质量 blur 叠加
        const starsRT  = PIXI.RenderTexture.create({ width: w, height: skyH });
        const bloomSpr = new PIXI.Sprite(starsRT);
        bloomSpr.filters   = [new PIXI.BlurFilter({ strength: 8, quality: 1 })];
        bloomSpr.blendMode = 'add';
        bloomSpr.alpha     = 0.45;
        skyContainer.addChild(bloomSpr);
        scene.starsRT  = starsRT;

        // bloom 源（离屏容器，不加入 stage）
        const bloomG = new PIXI.Graphics();
        scene.bloomG = bloomG;

        // 流星
        const shootingContainer = new PIXI.Container();
        skyContainer.addChild(shootingContainer);
        scene.shootingContainer = shootingContainer;
        scene.shootingStars     = [];
        scene.lastShoot         = -99999;

        // 地平线光晕
        const horizonSpr = new PIXI.Sprite(makeGradTex([
          [0, 'rgba(80,120,220,0)'], [0.5, 'rgba(100,155,255,0.22)'], [1, 'rgba(80,120,220,0)'],
        ], true, 4, 60));
        horizonSpr.y = waterY - 30; horizonSpr.width = w;
        skyContainer.addChild(horizonSpr);
        scene.horizonSpr = horizonSpr;

        // ── 水面层（直接加 stage，不进 skyContainer）──────────────────────

        // 水面底色
        const waterBg = new PIXI.Sprite(makeGradTex([
          [0, '#0e1f45'], [0.4, '#0a1838'], [0.75, '#060f26'], [1, '#030818'],
        ]));
        waterBg.y = waterY; waterBg.width = w; waterBg.height = waterH;
        app.stage.addChild(waterBg);

        // 水面高光线
        const wlSpr = new PIXI.Sprite(makeGradTex([
          [0, 'rgba(120,180,255,0)'], [0.2, 'rgba(140,200,255,0.5)'],
          [0.5, 'rgba(200,235,255,0.8)'], [0.8, 'rgba(140,200,255,0.5)'],
          [1, 'rgba(120,180,255,0)'],
        ], false, w, 3));
        wlSpr.y = waterY;
        app.stage.addChild(wlSpr);

        // 天空倒影（skyRT 只拍 skyContainer → 不含 reflSpr，无反馈循环）
        const skyRT   = PIXI.RenderTexture.create({ width: w, height: skyH });
        const reflSpr = new PIXI.Sprite(skyRT);
        reflSpr.y       = waterY + skyH;
        reflSpr.scale.y = -1;
        reflSpr.alpha   = 0.14;

        const dispSpr = new PIXI.Sprite(PIXI.Texture.from(createDispCanvas()));
        dispSpr.width = w * 2; dispSpr.height = waterH; dispSpr.y = waterY;
        const dispFilter = new PIXI.DisplacementFilter({ sprite: dispSpr, scale: 22 });
        reflSpr.filters = [dispFilter];

        app.stage.addChild(dispSpr);
        app.stage.addChild(reflSpr);
        scene.skyRT   = skyRT;
        scene.reflSpr = reflSpr;
        scene.dispSpr = dispSpr;
        scene.waterY  = waterY;
        scene.waterH  = waterH;

        // 水底梦境倒影
        const interpG = new PIXI.Graphics();
        app.stage.addChild(interpG);
        scene.interpG = interpG;

        // 点击爆炸粒子
        const burstContainer = new PIXI.Container();
        burstContainer.blendMode = 'add';
        app.stage.addChild(burstContainer);
        scene.burstContainer = burstContainer;
        scene.activeBursts   = [];

        // 流星落水
        const shootWaterContainer = new PIXI.Container();
        app.stage.addChild(shootWaterContainer);
        scene.shootWaterContainer = shootWaterContainer;
        scene.shootWaterItems     = [];

        // ── Ticker ───────────────────────────────────────────────────────────
        app.ticker.add((ticker) => {
          if (!mounted) return;
          const t      = ticker.lastTime;
          const dw     = app.screen.width;
          const dh     = app.screen.height;
          const dSkyH  = dh * SKY_RATIO;
          const dWaterY = dSkyH;
          const dWaterH = dh - dSkyH;

          // 星云呼吸（alpha only，无 blur 重算）
          scene.nebulaSpr.alpha = 0.75 + 0.15 * Math.sin(t * 0.0004);

          // 星点闪烁
          scene.bgStarsG.clear();
          scene.bloomG.clear();
          BG_STARS.forEach(s => {
            const op = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.speed * 0.001 + s.phase));
            const r  = s.r * (0.85 + 0.15 * Math.sin(t * s.speed * 0.0015 + s.phase + 1));
            scene.bgStarsG.circle(s.x * dw, s.y * dSkyH, r);
            scene.bgStarsG.fill({ color: s.color, alpha: op });
            scene.bloomG.circle(s.x * dw, s.y * dSkyH, r * 3);
            scene.bloomG.fill({ color: s.color, alpha: op * 0.5 });
          });
          app.renderer.render({ container: scene.bloomG, target: scene.starsRT });

          // 流星
          if (t - scene.lastShoot > 9000) {
            scene.lastShoot = t + Math.random() * 6000;
            const g = new PIXI.Graphics();
            g.blendMode = 'add';
            scene.shootingContainer.addChild(g);
            scene.shootingStars.push({
              g,
              x0: dw * (0.05 + Math.random() * 0.6),
              y0: dSkyH * (0.05 + Math.random() * 0.35),
              angle: Math.PI / 6 + Math.random() * Math.PI / 8,
              speed: 280 + Math.random() * 200,
              len:   80 + Math.random() * 80,
              born:  t,
            });
          }
          scene.shootingStars = scene.shootingStars.filter(s => {
            const age = (t - s.born) / 1000;
            if (age > 1.0) { scene.shootingContainer.removeChild(s.g); s.g.destroy(); return false; }
            const dist = s.speed * age;
            const x  = s.x0 + Math.cos(s.angle) * dist;
            const y  = s.y0 + Math.sin(s.angle) * dist;
            const tx = x - Math.cos(s.angle) * s.len;
            const ty = y - Math.sin(s.angle) * s.len;
            const a  = Math.max(0, 1 - age * 1.8);
            s.g.clear();
            for (let seg = 0; seg < 6; seg++) {
              const p = seg / 6;
              s.g.moveTo(tx + (x-tx)*p, ty + (y-ty)*p)
                .lineTo(tx + (x-tx)*(p+1/6), ty + (y-ty)*(p+1/6))
                .stroke({ color: 0xffffff, alpha: a * p * p, width: 1.5 });
            }
            s.g.circle(x, y, 2.5 * a).fill({ color: 0xffffff, alpha: a });
            return true;
          });

          // 地平线脉动
          scene.horizonSpr.alpha = 0.75 + 0.25 * Math.sin(t * 0.00038);

          // 位移贴图滚动（水波）
          scene.dispSpr.x = -(t * 0.02 % dw);
          scene.dispSpr.y = dWaterY - (t * 0.01 % dSkyH);

          // skyContainer → skyRT（skyContainer 内无重型滤镜，安全高效）
          app.renderer.render({ container: scene.skyContainer, target: scene.skyRT });

          // 水底梦境倒影
          scene.interpG.clear();
          interpRef.current.slice(-20).forEach(d => {
            const color = DREAM_TYPES[d.type]?.color || '#9090C0';
            const x    = (d.waterX || 50) / 100 * dw;
            const y    = dWaterY + (d.waterY || 50) / 100 * dWaterH;
            const size = d.importance >= 8 ? 14 : d.importance >= 5 ? 10 : 6;
            const seed = dreamSeed(d.id);
            const op   = 0.08 + 0.06 * Math.sin(t * 0.0007 * (0.5 + seed));
            scene.interpG.circle(x, y, size * 4).fill({ color: hexToInt(color), alpha: op * 2 });
            scene.interpG.circle(x, y, size * 1.5).fill({ color: 0xffffff, alpha: op * 1.2 });
          });

          // 点击爆炸
          while (burstRef.current.length > 0) {
            const b = burstRef.current.shift();
            const gfx = new PIXI.Graphics();
            gfx.blendMode = 'add';
            scene.burstContainer.addChild(gfx);
            scene.activeBursts.push({
              gfx,
              px: b.x / 100 * dw,
              py: b.y / 100 * dSkyH,
              cInt: hexToInt(b.color),
              born: t,
              particles: Array.from({ length: 20 }, (_, i) => ({
                angle: (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
                speed: 60 + Math.random() * 90,
                r:     0.8 + Math.random() * 1.6,
              })),
            });
          }
          scene.activeBursts = scene.activeBursts.filter(b => {
            const age = (t - b.born) / 1000;
            if (age > 1.2) { scene.burstContainer.removeChild(b.gfx); b.gfx.destroy(); return false; }
            b.gfx.clear();
            b.particles.forEach(p => {
              const d2 = p.speed * age;
              const a  = Math.max(0, (1 - age * 1.4) * 0.85);
              b.gfx.circle(b.px + Math.cos(p.angle)*d2, b.py + Math.sin(p.angle)*d2, p.r*2.5)
                .fill({ color: 0xffffff, alpha: a });
            });
            const fa = Math.max(0, 0.8 - age * 3);
            if (fa > 0) {
              const fr = 55 * Math.min(age * 4, 1);
              b.gfx.circle(b.px, b.py, fr).fill({ color: b.cInt, alpha: fa * 0.35 });
              b.gfx.circle(b.px, b.py, fr * 0.35).fill({ color: 0xffffff, alpha: fa });
            }
            return true;
          });

          // 流星落水
          while (shootWaterRef.current.length > 0) {
            const s = shootWaterRef.current.shift();
            const gfx = new PIXI.Graphics();
            gfx.blendMode = 'add';
            scene.shootWaterContainer.addChild(gfx);
            scene.shootWaterItems.push({
              ...s, gfx, born: t,
              px: s.x / 100 * dw,
              py: s.y / 100 * dSkyH,
              targetY: dWaterY + dWaterH * 0.15,
              dx: (Math.random() - 0.5) * 40,
            });
          }
          scene.shootWaterItems = scene.shootWaterItems.filter(s => {
            const age = (t - s.born) / 1000;
            if (age > 1.8) { scene.shootWaterContainer.removeChild(s.gfx); s.gfx.destroy(); return false; }
            s.gfx.clear();
            const prog  = Math.min(age / 1.2, 1);
            const ease  = prog * prog;
            const cx    = s.px + s.dx * ease;
            const cy    = s.py + (s.targetY - s.py) * ease;
            const a     = Math.max(0, 1 - age * 0.7);
            const cInt  = hexToInt(s.color);
            const pe    = Math.max(0, ease - 0.05);
            const ddx   = cx - (s.px + s.dx * pe);
            const ddy   = cy - (s.py + (s.targetY - s.py) * pe);
            const tLen  = Math.sqrt(ddx*ddx + ddy*ddy) + 18;
            const nx    = ddx / (tLen || 1);
            const ny    = ddy / (tLen || 1);
            for (let seg = 0; seg < 8; seg++) {
              const p = seg / 8;
              s.gfx.circle(cx - nx*tLen*p, cy - ny*tLen*p, (1-p)*2.5*a)
                .fill({ color: 0xffffff, alpha: a*(1-p)*0.5 });
            }
            s.gfx.circle(cx, cy, 3.5*a).fill({ color: 0xffffff, alpha: a });
            s.gfx.circle(cx, cy, 7*a).fill({ color: cInt, alpha: a*0.5 });
            if (prog > 0.85) {
              const rp = (prog - 0.85) / 0.15;
              s.gfx.circle(cx, dWaterY + dWaterH*0.12, rp*28)
                .stroke({ color: cInt, alpha: (1-rp)*0.65, width: 1.5 });
            }
            return true;
          });
        });

        initDone = true;
      } catch (err) {
        console.error('[DreamSky] init error:', err);
      }
    };

    init();
    return () => {
      mounted = false;
      if (app && initDone) {
        try { app.destroy(false); } catch {}
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: 'block' }}
    />
  );
});

DreamSky.displayName = 'DreamSky';
export { DreamSky };
