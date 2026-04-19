/**
 * 流场编辑器
 *
 * 功能：
 *   1. 载入溪流轮廓图 → 测地距离 BFS → 自动生成流场向量
 *   2. Canvas 画布：颜色编码方向 + 箭头，点击选中格子
 *   3. 旋转拨盘：拖拽或 ±15° 按钮调整选中格子方向
 *   4. 文件管理：保存（名称重复检测）、预览、启用、删除
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from './types';

// ── 网格常量 ──────────────────────────────────────────────────────────────────
const GRID_W = 20;
const GRID_H = 45;

// 画布在手机 UI 中的显示尺寸（与手机宽度一致，高度保持原图比例）
const CANVAS_W = 375;
const CANVAS_H = 812;          // 原始手机高度
const CW = CANVAS_W / GRID_W; // 每格像素宽 = 18.75
const CH = CANVAS_H / GRID_H; // 每格像素高 ≈ 18.04

// angle 约定：0° = 右, 90° = 下, 180° = 左, 270° = 上（canvas 坐标系）
export type FlowCell = { water: boolean; angle: number };
export type FlowField = { name: string; gridW: number; gridH: number; cells: FlowCell[] };

interface SavedFile { name: string; active: boolean }

// ══════════════════════════════════════════════════════════════════════════════
// 算法：测地距离 BFS + 梯度 → 流向
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 从图像数据计算流场。
 * 使用 Laplace 势场（物理势流）：
 *   1. 亮色像素判定为水域
 *   2. 顶部水格 phi=0（入流），底部水格 phi=1（出流）
 *   3. Gauss-Seidel 迭代求解 ∇²φ = 0
 *   4. 势场梯度（Sobel 3×3）→ 流向角
 * 弯道处等势线自然弯曲，流向随之旋转，比 BFS 梯度更真实。
 */
function computeFlow(imgData: ImageData): FlowCell[] {
  const { width, height, data } = imgData;
  const pw = width / GRID_W, ph = height / GRID_H;
  const N = GRID_W * GRID_H;

  // ── Step 1: 水域掩码 ─────────────────────────────────────────────────────
  const water = new Uint8Array(N);
  for (let row = 0; row < GRID_H; row++) {
    for (let col = 0; col < GRID_W; col++) {
      let light = 0, total = 0;
      const x0 = Math.floor(col * pw), x1 = Math.min(Math.ceil((col + 1) * pw), width);
      const y0 = Math.floor(row * ph), y1 = Math.min(Math.ceil((row + 1) * ph), height);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i4 = (y * width + x) * 4;
          if (data[i4 + 3] < 64) continue;           // 透明像素跳过
          const bright = (data[i4] + data[i4 + 1] + data[i4 + 2]) / 3;
          if (bright > 128) light++;                  // 亮 = 水（河道为白色区域）
          total++;
        }
      }
      water[row * GRID_W + col] = total > 0 && light / total > 0.35 ? 1 : 0;
    }
  }

  // ── Step 2: 确定入流/出流边界 ────────────────────────────────────────────
  // 逐列找最顶部 / 最底部水格，分别设 phi=0 / phi=1
  const phi   = new Float32Array(N).fill(0.5);
  const fixed = new Uint8Array(N);

  for (let col = 0; col < GRID_W; col++) {
    // 最顶部水格 → phi=0（入流）
    for (let row = 0; row < GRID_H; row++) {
      const i = row * GRID_W + col;
      if (water[i]) { phi[i] = 0; fixed[i] = 1; break; }
    }
    // 最底部水格 → phi=1（出流）
    for (let row = GRID_H - 1; row >= 0; row--) {
      const i = row * GRID_W + col;
      if (water[i]) {
        // 若与入流重合（整列只有一格），出流优先
        phi[i] = 1; fixed[i] = 1;
        break;
      }
    }
  }

  // ── Step 3: Gauss-Seidel 迭代求解 Laplace 方程 ──────────────────────────
  // 迭代次数：对 40×60 网格约需 600 次收敛
  for (let iter = 0; iter < 700; iter++) {
    for (let i = 0; i < N; i++) {
      if (!water[i] || fixed[i]) continue;
      const row = (i / GRID_W) | 0, col = i % GRID_W;
      let sum = 0, cnt = 0;
      if (row > 0          && water[i - GRID_W]) { sum += phi[i - GRID_W]; cnt++; }
      if (row < GRID_H - 1 && water[i + GRID_W]) { sum += phi[i + GRID_W]; cnt++; }
      if (col > 0          && water[i - 1])       { sum += phi[i - 1];      cnt++; }
      if (col < GRID_W - 1 && water[i + 1])       { sum += phi[i + 1];      cnt++; }
      if (cnt > 0) phi[i] = sum / cnt;
    }
  }

  // ── Step 4: Sobel 3×3 梯度 → 角度 ──────────────────────────────────────
  // Gx 核: [[-1,0,1],[-2,0,2],[-1,0,1]]   Gy 核: [[-1,-2,-1],[0,0,0],[1,2,1]]
  const cells: FlowCell[] = [];
  for (let i = 0; i < N; i++) {
    if (!water[i]) { cells.push({ water: false, angle: 90 }); continue; }
    const row = (i / GRID_W) | 0, col = i % GRID_W;
    let gx = 0, gy = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr, nc = col + dc;
        if (nr < 0 || nr >= GRID_H || nc < 0 || nc >= GRID_W || !water[nr * GRID_W + nc]) continue;
        const w  = (dc === 0 || dr === 0) ? 2 : 1; // 轴向权重 2，对角权重 1
        gx += dc * w * phi[nr * GRID_W + nc];
        gy += dr * w * phi[nr * GRID_W + nc];
      }
    }
    const mag = Math.sqrt(gx * gx + gy * gy);
    let angle = mag < 0.001 ? 90 : Math.atan2(gy, gx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    cells.push({ water: true, angle });
  }
  return cells;
}

/**
 * 叠加平滑随机噪声：在 Laplace 基础流向上加扰动。
 * - 先生成每格随机偏移（均匀分布在 ±maxDeg 内）
 * - 再做几次 3×3 平均平滑，让相邻格子偏移相关（避免破碎感）
 * - 最后用圆形叠加合入原角度
 * 每次调用结果不同，中间宽阔区域会有随机倾斜。
 */
function addNoise(cells: FlowCell[], maxDeg = 38, smoothPasses = 3): FlowCell[] {
  const n = GRID_W * GRID_H;
  // 随机偏移（弧度）
  const off = new Float32Array(n).map((_, i) =>
    cells[i].water ? (Math.random() * 2 - 1) * maxDeg * Math.PI / 180 : 0
  );
  // 平滑偏移场，使邻近格子协同
  for (let p = 0; p < smoothPasses; p++) {
    const next = off.slice();
    for (let i = 0; i < n; i++) {
      if (!cells[i].water) continue;
      const row = (i / GRID_W) | 0, col = i % GRID_W;
      let sx = 0, sy = 0, cnt = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = row + dr, nc = col + dc;
          if (nr < 0 || nr >= GRID_H || nc < 0 || nc >= GRID_W) continue;
          const ni = nr * GRID_W + nc;
          if (!cells[ni].water) continue;
          sx += Math.cos(off[ni]); sy += Math.sin(off[ni]); cnt++;
        }
      }
      if (cnt > 0) next[i] = Math.atan2(sy / cnt, sx / cnt);
    }
    off.set(next);
  }
  // 叠加到基础角度（圆形加法）
  return cells.map((c, i) => {
    if (!c.water) return c;
    let a = c.angle * Math.PI / 180 + off[i];
    a = ((a * 180 / Math.PI) % 360 + 360) % 360;
    // 反向保护：若合成角指向上方（sin<0，即 180°~360°），翻转竖向分量
    // 溪流应整体向下流，不应出现大量向上箭头
    if (Math.sin(a * Math.PI / 180) < 0) {
      a = (360 - a + 360) % 360; // 保留水平分量，翻转竖向
    }
    return { ...c, angle: a };
  });
}

/** 圆形均值平滑（每次 3×3 邻域） */
function smooth(cells: FlowCell[], passes: number): FlowCell[] {
  let cur = cells.slice();
  for (let p = 0; p < passes; p++) {
    cur = cur.map((cell, i) => {
      if (!cell.water) return cell;
      const row = (i / GRID_W) | 0, col = i % GRID_W;
      let sx = 0, sy = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = row + dr, nc = col + dc;
          if (nr < 0 || nr >= GRID_H || nc < 0 || nc >= GRID_W) continue;
          const ni = nr * GRID_W + nc;
          if (!cur[ni].water) continue;
          const rad = cur[ni].angle * Math.PI / 180;
          sx += Math.cos(rad); sy += Math.sin(rad);
        }
      }
      const mag = Math.sqrt(sx * sx + sy * sy);
      if (mag < 0.001) return cell;
      let a = Math.atan2(sy, sx) * 180 / Math.PI;
      if (a < 0) a += 360;
      return { ...cell, angle: a };
    });
  }
  return cur;
}

// ══════════════════════════════════════════════════════════════════════════════
// 旋转拨盘组件
// ══════════════════════════════════════════════════════════════════════════════
function RotDial({ angle, disabled, onChange }: {
  angle: number; disabled: boolean; onChange: (a: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const C = 50, R = 38;
  const rad = angle * Math.PI / 180;
  const hx = C + R * Math.cos(rad), hy = C + R * Math.sin(rad);

  const angleFrom = (cx: number, cy: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const dx = cx - (rect.left + rect.width / 2);
    const dy = cy - (rect.top + rect.height / 2);
    let a = Math.atan2(dy, dx) * 180 / Math.PI;
    return a < 0 ? a + 360 : a;
  };

  const startDrag = (cx: number, cy: number) => {
    if (disabled) return;
    onChange(angleFrom(cx, cy));
    const onMove = (e: MouseEvent | TouchEvent) => {
      const pt = 'touches' in e ? e.touches[0] : e as MouseEvent;
      onChange(angleFrom(pt.clientX, pt.clientY));
    };
    const onEnd = () => {
      window.removeEventListener('mousemove', onMove as EventListener);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('mousemove', onMove as EventListener);
    window.addEventListener('touchmove', onMove as EventListener, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
  };

  const alpha = disabled ? 0.35 : 1;
  return (
    <svg ref={svgRef} width={100} height={100}
      style={{ cursor: disabled ? 'default' : 'crosshair', opacity: alpha, flexShrink: 0 }}
      onMouseDown={e => startDrag(e.clientX, e.clientY)}
      onTouchStart={e => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
    >
      {/* 轨道 */}
      <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(90,158,114,0.35)" strokeWidth={2} />
      {/* 四向刻度 */}
      {[0, 90, 180, 270].map(a => {
        const r2 = a * Math.PI / 180;
        return <line key={a}
          x1={C + (R - 5) * Math.cos(r2)} y1={C + (R - 5) * Math.sin(r2)}
          x2={C + R * Math.cos(r2)}        y2={C + R * Math.sin(r2)}
          stroke="rgba(90,158,114,0.55)" strokeWidth={1.5} />;
      })}
      {/* 方向线 */}
      <line x1={C} y1={C} x2={hx} y2={hy}
        stroke="#5a9e72" strokeWidth={2.5} strokeLinecap="round" />
      {/* 手柄 */}
      <circle cx={hx} cy={hy} r={6} fill="#5a9e72" />
      <circle cx={C} cy={C} r={3} fill="#5a9e72" />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 主组件
// ══════════════════════════════════════════════════════════════════════════════
export default function FlowEditor({ onBack }: { onBack: () => void }) {

  // ── 网格状态 ──────────────────────────────────────────────────────────────
  const [cells, setCells] = useState<FlowCell[]>(
    () => Array(GRID_W * GRID_H).fill(null).map(() => ({ water: false, angle: 90 }))
  );
  const [selected, setSelected] = useState<number | null>(null);

  // ── 背景 & 预览 ──────────────────────────────────────────────────────────
  const [bgLoaded, setBgLoaded] = useState(false);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const [previewCells, setPreviewCells] = useState<FlowCell[] | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

  // ── 文件管理 ─────────────────────────────────────────────────────────────
  const [showFiles, setShowFiles] = useState(false);
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [saveName, setSaveName] = useState('');
  const [nameError, setNameError] = useState('');

  // ── 状态提示 ─────────────────────────────────────────────────────────────
  const [status, setStatus] = useState('加载轮廓图中…');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ── 加载背景图（溪流底图，仅用于显示）────────────────────────────────────
  useEffect(() => {
    const img = new Image();
    img.src = '/suixiang/溪流底图.png';
    img.onload = () => { bgImgRef.current = img; setBgLoaded(true); };
    img.onerror = () => setBgLoaded(true); // 没有背景图也能工作
  }, []);

  // ── 分析轮廓图，自动生成初始流场 ─────────────────────────────────────────
  const analyzeImage = useCallback((src: string) => {
    setStatus('分析中…');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 在 GRID 分辨率下采样（让浏览器完成下采样平均）
      const off = document.createElement('canvas');
      off.width = GRID_W * 4; off.height = GRID_H * 4;
      const ctx = off.getContext('2d')!;
      ctx.drawImage(img, 0, 0, off.width, off.height);
      const imgData = ctx.getImageData(0, 0, off.width, off.height);
      // Laplace 势场 → 平滑 → 叠加随机噪声（每次结果不同）
      const result = addNoise(smooth(computeFlow(imgData), 1), 65, 0);
      setCells(result);
      setPreviewCells(null); setPreviewName(null);
      setStatus('自动生成完成（含随机扰动）');
    };
    img.onerror = () => setStatus('图片加载失败，请手动上传');
    img.src = src;
  }, []);

  // 首次加载默认轮廓图
  useEffect(() => { analyzeImage('/suixiang/溪流轮廓.png'); }, [analyzeImage]);

  // ── API ──────────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    try {
      const data = await api('/suixiang/flowfields');
      setFiles(Array.isArray(data) ? data : []);
    } catch { /* 网络错误时静默，不阻断其他操作 */ }
  }, []);
  useEffect(() => { loadFiles(); }, [loadFiles]);

  // ── Canvas 绘制（time 单位：毫秒，用于动态抖动）──────────────────────────
  const draw = useCallback((time = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const t = time / 1000; // 秒

    // 背景图
    if (bgImgRef.current) {
      ctx.drawImage(bgImgRef.current, 0, 0, CANVAS_W, CANVAS_H);
    } else {
      ctx.fillStyle = '#d8ead8';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    const activeCells = previewCells ?? cells;

    for (let i = 0; i < GRID_W * GRID_H; i++) {
      const cell = activeCells[i];
      const row = (i / GRID_W) | 0, col = i % GRID_W;
      const cx = (col + 0.5) * CW, cy = (row + 0.5) * CH;

      if (!cell.water) {
        // 陆地格：半透明遮罩
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.fillRect(col * CW, row * CH, CW, CH);
        continue;
      }

      // 水域格：按角度上色（色相 = 方向，让流场一目了然）
      // 每格叠加一个小幅时变抖动（±12°），使流场看起来持续微微摆动
      const jitter = Math.sin(t * 0.35 + col * 0.41 + row * 0.23) * 12;
      const displayAngle = (cell.angle + jitter + 360) % 360;
      const hue = ((displayAngle | 0) + 120) % 360;
      const rad = displayAngle * Math.PI / 180;
      // 箭头占格子对角线的 40%，尾部占 30%
      const len  = Math.min(CW, CH) * 0.44;
      const tailX = cx - len * 0.35 * Math.cos(rad);
      const tailY = cy - len * 0.35 * Math.sin(rad);
      const tipX  = cx + len * Math.cos(rad);
      const tipY  = cy + len * Math.sin(rad);

      ctx.strokeStyle = `hsla(${hue},80%,44%,0.92)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // 箭头三角（相对格子大小）
      const ah = len * 0.45, aw = len * 0.22;
      const px = -Math.sin(rad) * aw, py = Math.cos(rad) * aw;
      const bx = tipX - Math.cos(rad) * ah, by = tipY - Math.sin(rad) * ah;
      ctx.fillStyle = `hsla(${hue},80%,44%,0.96)`;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(bx + px, by + py);
      ctx.lineTo(bx - px, by - py);
      ctx.closePath();
      ctx.fill();
    }

    // 选中格高亮
    if (selected !== null && !previewCells) {
      const row = (selected / GRID_W) | 0, col = selected % GRID_W;
      ctx.strokeStyle = 'rgba(255, 230, 0, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(col * CW + 0.75, row * CH + 0.75, CW - 1.5, CH - 1.5);
    }
  }, [cells, selected, previewCells, bgLoaded]); // bgLoaded 触发背景加载后重绘

  // 用 ref 持有最新 draw，RAF 回调中始终调用最新版本
  const drawRef = useRef(draw);
  useEffect(() => { drawRef.current = draw; }, [draw]);

  // RAF 持续动画：每帧用 performance.now() 驱动时变抖动
  useEffect(() => {
    let id: number;
    const animate = () => {
      drawRef.current(performance.now());
      id = requestAnimationFrame(animate);
    };
    id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, []); // 只挂载一次，通过 drawRef 追踪 draw 更新

  // ── 画布点击 → 选中格子 ──────────────────────────────────────────────────
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (previewCells) return; // 预览模式不可编辑
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = CANVAS_W / rect.width, sy = CANVAS_H / rect.height;
    const col = Math.floor((e.clientX - rect.left) * sx / CW);
    const row = Math.floor((e.clientY - rect.top)  * sy / CH);
    if (col < 0 || col >= GRID_W || row < 0 || row >= GRID_H) return;
    const idx = row * GRID_W + col;
    setSelected(prev => prev === idx ? null : idx);
  };

  // ── 更新选中格角度 ────────────────────────────────────────────────────────
  const updateAngle = useCallback((raw: number) => {
    if (selected === null) return;
    const angle = ((raw % 360) + 360) % 360;
    setCells(prev => {
      const next = prev.slice();
      next[selected] = { ...next[selected], angle };
      return next;
    });
  }, [selected]);

  // ── 保存 ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const name = saveName.trim();
    if (!name) { setNameError('名称不能为空'); return; }
    setNameError('');
    try {
      const compact = cells.map(c => ({ water: c.water, angle: Math.round(c.angle * 10) / 10 }));
      const resp = await fetch('/api/suixiang/flowfields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, gridW: GRID_W, gridH: GRID_H, cells: compact }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setNameError(body.error ?? `保存失败（${resp.status}）`);
        return;
      }
      setStatus(`已保存：${name}`);
      setSaveName('');
      await loadFiles();
    } catch (e: any) {
      setNameError(`网络错误：${e?.message ?? '请检查服务是否运行'}`);
    }
  };

  // ── 删除 ─────────────────────────────────────────────────────────────────
  const handleDelete = async (name: string) => {
    try {
      await api(`/suixiang/flowfields/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (previewName === name) { setPreviewCells(null); setPreviewName(null); }
      await loadFiles();
    } catch (e: any) { setStatus(`删除失败：${e?.message}`); }
  };

  // ── 设置启用 ─────────────────────────────────────────────────────────────
  const handleSetActive = async (name: string) => {
    try {
      const isActive = files.find(f => f.name === name)?.active;
      await api('/suixiang/flowfields/active', {
        method: 'PUT',
        body: JSON.stringify({ name: isActive ? '' : name }),
      });
      await loadFiles();
    } catch (e: any) { setStatus(`操作失败：${e?.message}`); }
  };

  // ── 预览文件 ─────────────────────────────────────────────────────────────
  const handlePreview = async (name: string) => {
    if (previewName === name) { setPreviewCells(null); setPreviewName(null); return; }
    const data: FlowField | null = await api(`/suixiang/flowfields/${encodeURIComponent(name)}`);
    if (!data?.cells) return;
    // 服务端存储格式可能是 {w, a}，需要转换
    const normalized: FlowCell[] = data.cells.map((c: any) => ({
      water: c.water ?? c.w ?? false,
      angle: c.angle ?? c.a ?? 90,
    }));
    setPreviewCells(normalized);
    setPreviewName(name);
  };

  // ── 派生状态 ─────────────────────────────────────────────────────────────
  const sel     = selected !== null ? cells[selected] : null;
  const selRow  = selected !== null ? ((selected / GRID_W) | 0) + 1 : null;
  const selCol  = selected !== null ? (selected % GRID_W) + 1 : null;
  const noSel   = sel === null;

  // ── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#ecf3ec', overflow: 'hidden',
    }}>

      {/* ── 顶栏 ─────────────────────────────────────────────────────────── */}
      <div style={{
        height: 44, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
        background: 'rgba(236,243,236,0.97)', borderBottom: '1px solid rgba(90,158,114,0.2)',
        flexShrink: 0,
      }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a9e72', fontSize: 14, padding: '4px 6px 4px 0' }}>
          ← 返回
        </button>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#2d5a38', fontFamily: "'Noto Serif SC', serif" }}>
          {previewCells ? `预览：${previewName}` : '流场编辑器'}
        </span>
        {status && (
          <span style={{ fontSize: 10, color: '#5a9e72', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {status}
          </span>
        )}
        {previewCells && (
          <button onClick={() => { setPreviewCells(null); setPreviewName(null); }}
            style={outlineBtn}>退出预览</button>
        )}
        <button onClick={() => setShowFiles(f => !f)}
          style={{ ...outlineBtn, background: showFiles ? 'rgba(90,158,114,0.15)' : 'none' }}>
          📁 文件
        </button>
      </div>

      {/* ── 画布区（可滚动）──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: 'block', width: '100%', cursor: previewCells ? 'default' : 'crosshair' }}
          onClick={handleCanvasClick}
        />
      </div>

      {/* ── 控制区（编辑模式）────────────────────────────────────────────── */}
      {!previewCells && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(90,158,114,0.2)',
          background: 'rgba(236,243,236,0.97)',
          padding: '8px 14px 14px',
        }}>
          {/* 选中提示 */}
          <div style={{ fontSize: 11, color: '#5a9e72', textAlign: 'center', marginBottom: 8 }}>
            {sel
              ? `第 ${selRow} 行  第 ${selCol} 列 · ${Math.round(sel.angle)}°  ${sel.water ? '' : '（陆地格）'}`
              : '点击网格格子可选中并调整流向'}
          </div>

          {/* 拨盘 + 工具 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            {/* 左侧工具 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <button onClick={() => analyzeImage('/suixiang/溪流轮廓.png')} style={toolBtn}>
                自动生成
              </button>
              {/* 导入流场 JSON */}
              <label style={{ ...toolBtn, cursor: 'pointer', textAlign: 'center', lineHeight: 1.3 }}>
                导入<br />流场
                <input type="file" accept="application/json,.json" style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      try {
                        const data = JSON.parse(ev.target!.result as string) as FlowField;
                        if (!Array.isArray(data.cells)) { setStatus('格式错误：缺少 cells'); return; }
                        const normalized: FlowCell[] = data.cells.map((c: any) => ({
                          water: c.water ?? c.w ?? false,
                          angle: c.angle ?? c.a ?? 90,
                        }));
                        setCells(normalized);
                        setPreviewCells(null); setPreviewName(null);
                        setStatus(`已导入：${f.name}`);
                      } catch { setStatus('JSON 解析失败'); }
                    };
                    reader.readAsText(f);
                    e.target.value = '';
                  }} />
              </label>
            </div>

            {/* 旋转拨盘 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <RotDial
                angle={sel?.angle ?? 90}
                disabled={noSel}
                onChange={updateAngle}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => updateAngle((sel?.angle ?? 90) - 15)} disabled={noSel} style={smallBtn}>-15°</button>
                <button onClick={() => updateAngle((sel?.angle ?? 90) + 15)} disabled={noSel} style={smallBtn}>+15°</button>
              </div>
            </div>

            {/* 右侧工具 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <button onClick={() => { setCells(c => smooth(c, 1)); setStatus('平滑完成'); }} style={toolBtn}>
                平滑一次
              </button>
              {/* 导出流场 JSON */}
              <button
                onClick={() => {
                  const compact = cells.map(c => ({
                    water: c.water, angle: Math.round(c.angle * 10) / 10,
                  }));
                  const json = JSON.stringify({ gridW: GRID_W, gridH: GRID_H, cells: compact });
                  const blob = new Blob([json], { type: 'application/json' });
                  const url  = URL.createObjectURL(blob);
                  const a    = document.createElement('a');
                  a.href = url;
                  a.download = `flowfield_${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  setStatus('已导出');
                }}
                style={toolBtn}
              >
                导出<br />流场
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 文件管理面板（底部抽屉）──────────────────────────────────────── */}
      {showFiles && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
          background: 'rgba(236,243,236,0.97)',
          borderTop: '1px solid rgba(90,158,114,0.25)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          maxHeight: '62%', display: 'flex', flexDirection: 'column',
        }}>
          {/* 面板标题栏 */}
          <div style={{
            padding: '10px 14px 8px', borderBottom: '1px solid rgba(90,158,114,0.15)',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#2d5a38' }}>文件管理</span>
            <button onClick={() => setShowFiles(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a9e72', fontSize: 18, lineHeight: 1 }}>
              ×
            </button>
          </div>

          {/* 保存输入区 */}
          <div style={{
            padding: '8px 14px', borderBottom: '1px solid rgba(90,158,114,0.1)',
            display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
          }}>
            <div style={{ flex: 1 }}>
              <input
                value={saveName}
                onChange={e => { setSaveName(e.target.value); setNameError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="命名后保存当前流场…"
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  borderBottom: '1px solid rgba(90,158,114,0.4)',
                  fontSize: 13, color: '#2d5a38', padding: '4px 0', boxSizing: 'border-box',
                }}
              />
              {nameError && (
                <p style={{ margin: '3px 0 0', fontSize: 11, color: '#d44' }}>{nameError}</p>
              )}
            </div>
            <button onClick={handleSave}
              style={{
                background: '#5a9e72', border: 'none', borderRadius: 8,
                padding: '7px 14px', fontSize: 12, color: '#fff', cursor: 'pointer', flexShrink: 0,
              }}>
              保存
            </button>
          </div>

          {/* 文件列表 */}
          <div style={{ overflow: 'auto', flex: 1 }}>
            {files.length === 0 ? (
              <p style={{ textAlign: 'center', fontSize: 12, color: '#8aab90', padding: 24 }}>
                暂无保存文件
              </p>
            ) : files.map(f => (
              <div key={f.name} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderBottom: '1px solid rgba(90,158,114,0.08)',
              }}>
                <span style={{
                  flex: 1, fontSize: 13, color: '#2d5a38',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {f.name}
                </span>
                <button
                  onClick={() => handlePreview(f.name)}
                  style={{
                    ...fileBtn,
                    color: previewName === f.name ? '#fff' : '#5a9e72',
                    background: previewName === f.name ? '#5a9e72' : 'transparent',
                  }}>
                  {previewName === f.name ? '预览中' : '预览'}
                </button>
                <button
                  onClick={() => handleSetActive(f.name)}
                  title={f.active ? '取消启用' : '设为游戏使用的流场'}
                  style={{
                    ...fileBtn,
                    color: f.active ? '#fff' : '#5a9e72',
                    background: f.active ? '#5a9e72' : 'transparent',
                  }}>
                  {f.active ? '✓ 启用' : '启用'}
                </button>
                <button
                  onClick={() => handleDelete(f.name)}
                  style={{ ...fileBtn, color: '#d44', borderColor: 'rgba(200,60,60,0.4)' }}>
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 样式常量 ─────────────────────────────────────────────────────────────────
const outlineBtn: React.CSSProperties = {
  fontSize: 11, color: '#5a9e72', border: '1px solid rgba(90,158,114,0.4)',
  borderRadius: 6, padding: '4px 8px', background: 'none', cursor: 'pointer',
};
const toolBtn: React.CSSProperties = {
  fontSize: 11, color: '#5a9e72', border: '1px solid rgba(90,158,114,0.4)',
  borderRadius: 8, padding: '6px 10px', background: 'none', cursor: 'pointer',
  whiteSpace: 'nowrap', userSelect: 'none',
};
const smallBtn: React.CSSProperties = {
  fontSize: 11, color: '#5a9e72', border: '1px solid rgba(90,158,114,0.3)',
  borderRadius: 6, padding: '3px 10px', background: 'none', cursor: 'pointer',
};
const fileBtn: React.CSSProperties = {
  fontSize: 11, border: '1px solid rgba(90,158,114,0.4)',
  borderRadius: 6, padding: '3px 7px', cursor: 'pointer', flexShrink: 0,
};
