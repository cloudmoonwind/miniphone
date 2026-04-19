import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import {
  SEARCH_BAR_BG,
  UI_GREEN, UI_BTN_BG, UI_BTN_BORDER,
  REPEL_RADIUS, FLOW_LANES,
  PHYS_SPEED_MIN, PHYS_SPEED_MAX,
  ENTRY_FORCE_ZONE_PX,
  ENTRY_INTERVAL_MIN, ENTRY_INTERVAL_MAX,
} from './params';
import { Card, api } from './types';
import FloatingItem from './FloatingItem';
import EntryModal from './EntryModal';

// ── 流场类型 ──────────────────────────────────────────────────────────────────
interface FlowCell  { w: boolean; a: number; }
interface FlowField { gridW: number; gridH: number; cells: FlowCell[]; }

// ── 物理插槽（每个漂浮位置一份，与具体随想卡片解耦）────────────────────────
interface SlotPhys {
  x: number;
  y: number;
  speed: number;
  np: [number, number, number];
  repelVX: number;
  groundedAt: number | null; // 搁浅时间戳，null = 在水中
}

// ── 物理常量 ─────────────────────────────────────────────────────────────────
const MAX_DISPLAY      = 20;
const NOISE_AMP        = 5;     // px/s 横向噪声
const MAX_REPEL_PUSH   = 14;    // px
const GROUND_TIMEOUT   = 3500;  // ms 搁浅后重生等待时间

// ── 插槽工厂 / 重生（sw/sh 由调用方传入容器实际尺寸，不用 window）────────────
function makeSlot(i: number, sw: number, sh: number): SlotPhys {
  const yBase = sh * (0.20 + (i % 5) * 0.10); // 20% 30% 40% 50% 60%
  return {
    x:          (FLOW_LANES[i % FLOW_LANES.length] / 100) * sw,
    y:          yBase + (Math.random() - 0.5) * sh * 0.04,
    speed:      PHYS_SPEED_MIN + Math.random() * (PHYS_SPEED_MAX - PHYS_SPEED_MIN),
    np:         [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28],
    repelVX:    0,
    groundedAt: null,
  };
}

function respawnSlot(s: SlotPhys, i: number, sw: number) {
  s.x          = (FLOW_LANES[i % FLOW_LANES.length] / 100) * sw;
  s.y          = -(10 + Math.random() * 20);
  s.repelVX    = 0;
  s.speed      = PHYS_SPEED_MIN + Math.random() * (PHYS_SPEED_MAX - PHYS_SPEED_MIN);
  s.np         = [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28];
  s.groundedAt = null;
}

// ── 流场格查询（返回 null = 无流场或 y<0，否则返回 {isWater, angle}）─────────
function queryFlowCell(
  ff: FlowField | null, x: number, y: number, sw: number, sh: number
): { isWater: boolean; angle: number } | null {
  if (!ff || y < 0) return null;
  const col  = Math.min(Math.max(Math.floor((x / sw) * ff.gridW), 0), ff.gridW - 1);
  const row  = Math.min(Math.max(Math.floor((y / sh) * ff.gridH), 0), ff.gridH - 1);
  const cell = ff.cells[row * ff.gridW + col] as any;
  return {
    isWater: !!(cell?.w ?? cell?.water),
    angle:   cell?.a ?? cell?.angle ?? 90,
  };
}

const CARD_COLORS = [
  '#6366f1','#3b82f6','#0ea5e9','#22c55e','#f59e0b',
  '#f97316','#ef4444','#ec4899','#8b5cf6','#14b8a6',
];

interface Props {
  cards: Card[];
  onBack: () => void;
  onSwitchMode: () => void;
  onOpenEditor: () => void;
  onCardUpdate: () => void;
}

export default function WaterScene({ cards, onBack, onSwitchMode, onOpenEditor, onCardUpdate }: Props) {
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [modalCard, setModalCard]       = useState<Card | null>(null);
  const [showNewCard, setShowNewCard]   = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── 容器 ref（读取实际像素尺寸，不用 window.innerWidth/Height）─────────────
  const containerRef = useRef<HTMLDivElement>(null);

  // ── 素材 ref（RAF 直接写 transform）─────────────────────────────────────────
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 显示列表：同步从 cards prop 计算，不用 state（避免异步延迟导致首帧空白）
  //   ≤ 20：全部显示
  //   > 20：取前 MAX_DISPLAY 张（服务器已按 updatedAt 排序）
  // ═══════════════════════════════════════════════════════════════════════════
  const displayCards = cards.slice(0, MAX_DISPLAY);

  // RAF 通过 ref 读取当前显示列表（避免 stale closure）
  const cardsRef = useRef(displayCards);
  cardsRef.current = displayCards; // 每次渲染同步，不需要 useEffect

  // ═══════════════════════════════════════════════════════════════════════════
  // 物理插槽：与 displayCards 下标对齐
  // cards.length 变化时同步插槽数量（在渲染期间直接操作 ref，安全且即时）
  // ═══════════════════════════════════════════════════════════════════════════
  const slotsRef = useRef<SlotPhys[]>([]);
  // 槽的创建移到 RAF 内，确保使用容器真实尺寸（见 tick 函数）

  // ═══════════════════════════════════════════════════════════════════════════
  // 流场（激活的流场数据，供物理循环读取）
  // ═══════════════════════════════════════════════════════════════════════════
  const flowFieldRef = useRef<FlowField | null>(null);
  useEffect(() => {
    fetch('/api/suixiang/flowfields/active')
      .then(r => r.json())
      .then(d => { if (d) flowFieldRef.current = d as FlowField; })
      .catch(() => {});
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 主 RAF 循环（挂载后永久运行，通过 ref 读取最新数据）
  //
  // 逻辑：流场方向 + 噪声游走 → 积分位置 → 边界重生 → 水域修正 → 排斥 → 写 DOM
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let rafId: number;
    let lastTs = performance.now();

    const tick = (ts: number) => {
      const cards = cardsRef.current;
      const ff    = flowFieldRef.current;
      const dt    = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      const container = containerRef.current;
      if (!container) { rafId = requestAnimationFrame(tick); return; }
      const sw = container.offsetWidth;
      const sh = container.offsetHeight;
      const t  = ts / 1000;
      const n  = cards.length;

      // 补充新增插槽（使用容器真实尺寸，依次错开 0.5~2s 入场）
      while (slotsRef.current.length < n) {
        const i    = slotsRef.current.length;
        const slot = makeSlot(i, sw, sh);
        if (i === 0) {
          slot.y = -(10 + Math.random() * 20);           // 第一个稍微在屏幕上方
        } else {
          const prev     = slotsRef.current[i - 1];
          const interval = ENTRY_INTERVAL_MIN + Math.random() * (ENTRY_INTERVAL_MAX - ENTRY_INTERVAL_MIN);
          slot.y = prev.y - interval * slot.speed;       // 更靠上，晚入场
        }
        slotsRef.current.push(slot);
      }

      // ── 移动 + 搁浅检测 + 边界重生 ──────────────────────────────────────
      for (let i = 0; i < n; i++) {
        const s = slotsRef.current[i];
        if (!s) continue;

        // 边界离开 → 从顶部重新进入（含上方无限飘走的情况）
        if (s.y > sh + 80 || s.x < -80 || s.x > sw + 80 || s.y < -(sh + 200)) {
          respawnSlot(s, i, sw);
          continue;
        }

        // 流场格查询（一次查询同时用于搁浅检测和流向角）
        const fc = queryFlowCell(ff, s.x, s.y, sw, sh);

        // 搁浅检测：流场明确标记为陆地时停住，超时后重生；无流场则不搁浅
        if (fc !== null && !fc.isWater) {
          if (s.groundedAt === null) s.groundedAt = ts;
          if (ts - s.groundedAt > GROUND_TIMEOUT) {
            respawnSlot(s, i, sw);
          } else {
            s.repelVX *= 0.85;
          }
          continue;
        }
        s.groundedAt = null;

        // 流向角：顶部 ENTRY_FORCE_ZONE_PX 内强制向下，之后才跟流场
        let flowAngle = 90;
        if (fc !== null && fc.isWater && s.y >= ENTRY_FORCE_ZONE_PX) {
          flowAngle = fc.angle;
        }

        const rad     = flowAngle * Math.PI / 180;
        const noiseVx = NOISE_AMP       * Math.sin(t * 0.09 + s.np[0])
                      + NOISE_AMP * 0.5 * Math.sin(t * 0.04 + s.np[1]);
        const noiseVy = NOISE_AMP * 0.3 * Math.sin(t * 0.07 + s.np[2]);

        s.x += (Math.cos(rad) * s.speed + noiseVx) * dt;
        s.y += (Math.sin(rad) * s.speed + noiseVy) * dt;
        s.repelVX *= 0.85;
      }

      // ── 排斥力 ────────────────────────────────────────────────────────────
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const si = slotsRef.current[i];
          const sj = slotsRef.current[j];
          if (!si || !sj) continue;
          const dx = si.x - sj.x, dy = si.y - sj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.5 && dist < REPEL_RADIUS) {
            const mag = (REPEL_RADIUS - dist) / REPEL_RADIUS * MAX_REPEL_PUSH * 0.15;
            const nx  = dx / dist;
            si.repelVX += nx * mag;
            sj.repelVX -= nx * mag;
          }
        }
      }

      // ── 写 DOM（统一在此处，每帧一次）──────────────────────────────────────
      for (let i = 0; i < n; i++) {
        const el = itemRefs.current[i];
        const s  = slotsRef.current[i];
        if (!el || !s) continue;
        el.style.transform =
          `translate(${(s.x + s.repelVX).toFixed(1)}px,${s.y.toFixed(1)}px)`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      itemRefs.current.forEach(el => el && (el.style.transform = ''));
    };
  }, []); // 仅挂载时启动

  // ── 搜索过滤（仅在 displayCards 内搜索）──────────────────────────────────
  const filtered = searchQuery.trim()
    ? displayCards.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;
  const isVisible = (card: Card) => !filtered || filtered.some(f => f.id === card.id);

  const openSearch = () => {
    setSearchActive(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };
  const closeSearch = () => { setSearchActive(false); setSearchQuery(''); };

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

      {/* 层1：溪流底图 */}
      <img src="/suixiang/溪流底图.png" alt="" draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', pointerEvents: 'none' }}
      />

      {/* 层2：水面动效（带透明通道的 webm，水道外区域透明，直接叠放）*/}
      <video
        ref={el => { if (el) el.playbackRate = 0.25; }}
        autoPlay muted loop playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', pointerEvents: 'none' }}
      >
        <source src="/suixiang/water_surface_v3.webm" type="video/webm" />
      </video>

      {/* ═══════════════════════════════════════════════════════════════
          漂浮随想（最多 MAX_DISPLAY 个，位置由 RAF 写入 transform）
          ═══════════════════════════════════════════════════════════════ */}
      {displayCards.map((card, idx) => (
        <FloatingItem
          key={card.id}
          ref={el => { itemRefs.current[idx] = el; }}
          card={card}
          index={idx}
          visible={isVisible(card)}
          onOpenModal={setModalCard}
        />
      ))}
      {cards.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: 13, color: 'rgba(255,254,240,0.7)',
            textShadow: '0 1px 4px rgba(10,50,20,0.8)',
            fontFamily: "'Noto Serif SC', serif",
          }}>
            点击右下角 ＋ 写下第一个随想
          </span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          搜索栏
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {searchActive && (
          <motion.div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 25,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px',
              background: SEARCH_BAR_BG,
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(160,180,150,0.3)',
            }}
            initial={{ y: -56, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -56, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <Search size={15} color={UI_GREEN} style={{ flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索随想标题…"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 14, color: '#2d5a38',
              }}
            />
            {searchQuery && (
              <span style={{ fontSize: 12, color: UI_GREEN }}>
                {filtered?.length ?? 0} 个
              </span>
            )}
            <button onClick={closeSearch}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <X size={16} color={UI_GREEN} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════
          浮动 UI 按钮
          ═══════════════════════════════════════════════════════════════ */}

      {/* 返回（左上角）*/}
      <button onClick={onBack} style={{
        position: 'absolute', top: 16, left: 16, zIndex: 30,
        width: 36, height: 36, borderRadius: '50%',
        background: UI_BTN_BG, border: `1px solid ${UI_BTN_BORDER}`,
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M11.5 3.5L6 9L11.5 14.5"
            stroke={UI_GREEN} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M6 9 C4.5 7.5 4 5.5 6 5"
            stroke={UI_GREEN} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.6"/>
        </svg>
      </button>

      {/* 搜索（右上角）*/}
      {!searchActive && (
        <button onClick={openSearch} style={{
          position: 'absolute', top: 16, right: 56, zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: UI_BTN_BG, border: `1px solid ${UI_BTN_BORDER}`,
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}>
          <Search size={16} color={UI_GREEN} />
        </button>
      )}

      {/* 卡片模式切换（右上角）*/}
      <button onClick={onSwitchMode} title="切换到卡片模式" style={{
        position: 'absolute', top: 16, right: 14, zIndex: 30,
        width: 36, height: 36, borderRadius: '50%',
        background: UI_BTN_BG, border: `1px solid ${UI_BTN_BORDER}`,
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          {([0,5,10] as const).map(ox => ([0,5,10] as const).map(oy => (
            <rect key={`${ox}-${oy}`} x={ox} y={oy} width="3.5" height="3.5"
              rx="0.8" fill={UI_GREEN} opacity="0.85"/>
          )))}
        </svg>
      </button>

      {/* 流场编辑器（右下角）*/}
      <button onClick={onOpenEditor} title="流场编辑器" style={{
        position: 'absolute', bottom: 76, right: 20, zIndex: 30,
        width: 36, height: 36, borderRadius: '50%',
        background: UI_BTN_BG, border: `1px solid ${UI_BTN_BORDER}`,
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="1" y="1" width="7" height="7" rx="1" stroke={UI_GREEN} strokeWidth="1.2" opacity="0.7"/>
          <rect x="10" y="1" width="7" height="7" rx="1" stroke={UI_GREEN} strokeWidth="1.2" opacity="0.7"/>
          <rect x="1" y="10" width="7" height="7" rx="1" stroke={UI_GREEN} strokeWidth="1.2" opacity="0.7"/>
          <rect x="10" y="10" width="7" height="7" rx="1" stroke={UI_GREEN} strokeWidth="1.2" opacity="0.7"/>
          <path d="M12.5 13.5 L15.5 13.5 M14 12 L15.5 13.5 L14 15"
            stroke={UI_GREEN} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* 新建随想（右下角）*/}
      <button onClick={() => setShowNewCard(true)} style={{
        position: 'absolute', bottom: 24, right: 20, zIndex: 30,
        width: 44, height: 44, borderRadius: '50%',
        background: UI_BTN_BG, border: `1px solid ${UI_BTN_BORDER}`,
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3.5V16.5M3.5 10H16.5"
            stroke={UI_GREEN} strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      </button>

      {/* ═══════════════════════════════════════════════════════════════
          弹窗层
          ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {modalCard && (
          <EntryModal
            card={modalCard}
            onClose={() => setModalCard(null)}
            onCardUpdate={onCardUpdate}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewCard && (
          <NewCardModal
            onClose={() => setShowNewCard(false)}
            onCreate={async (title) => {
              const color = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
              await api('/suixiang/cards', {
                method: 'POST',
                body: JSON.stringify({ title, color }),
              });
              onCardUpdate();
              setShowNewCard(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 新建随想弹窗 ─────────────────────────────────────────────────────────────
function NewCardModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useState(() => { setTimeout(() => inputRef.current?.focus(), 80); });

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(10,40,20,0.4)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-end',
      }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        style={{
          width: '100%',
          background: 'rgba(252,248,236,0.93)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 32px',
        }}
        initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
      >
        <p style={{
          fontSize: 15, fontWeight: 700, color: '#3a2e1e', marginBottom: 16,
          fontFamily: "'Noto Serif SC', 'Songti SC', serif",
        }}>
          新的随想
        </p>
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && title.trim() && onCreate(title.trim())}
          placeholder="给这个想法起个名字…"
          style={{
            width: '100%', background: 'transparent',
            border: 'none', borderBottom: '1px solid rgba(160,140,100,0.4)',
            outline: 'none', padding: '6px 0', fontSize: 14,
            color: '#3a2e1e', marginBottom: 20, boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 12,
            border: '1px solid rgba(160,140,100,0.3)',
            background: 'transparent', fontSize: 13, color: '#8a7a60', cursor: 'pointer',
          }}>取消</button>
          <button
            onClick={() => title.trim() && onCreate(title.trim())}
            disabled={!title.trim()}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
              background: title.trim() ? UI_GREEN : 'rgba(160,140,100,0.2)',
              fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: title.trim() ? 'pointer' : 'default',
              transition: 'background 0.2s ease',
            }}
          >放入溪流</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
