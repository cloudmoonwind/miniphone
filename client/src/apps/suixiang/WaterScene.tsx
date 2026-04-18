import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import {
  SHIMMER_OPACITY, SHIMMER_BLEND, SHIMMER_VIDEO_FILTER,
  DISTORT_SCALE, DISTORT_FREQ_X, DISTORT_FREQ_Y, DISTORT_OCTAVES, DISTORT_DURATION,
  SEARCH_BAR_BG, SEARCH_FADE_OPACITY,
  UI_GREEN, UI_BTN_BG, UI_BTN_BORDER,
} from './params';
import { Card, api } from './types';
import FloatingItem from './FloatingItem';
import EntryModal from './EntryModal';

// 水流路径（SVG 1080×1920 坐标系，evenodd fill-rule 含两块石头孔洞）
const WATER_PATH =
  'M 149 1 L 134 52 L 149 164 L 119 264 L 162 309 L 230 335 L 281 405 L 265 461 L 135 548 ' +
  'L 149 688 L 266 675 L 314 725 L 325 781 L 208 802 L 135 868 L 144 937 L 175 971 L 125 1068 ' +
  'L 205 1122 L 191 1243 L 224 1305 L 153 1364 L 122 1451 L 78 1490 L 78 1528 L 133 1574 ' +
  'L 248 1551 L 294 1585 L 299 1621 L 136 1701 L 132 1868 L 157 1919 ' +
  'L 756 1919 L 685 1858 L 677 1816 L 880 1746 L 938 1695 L 1018 1414 L 1018 1229 ' +
  'L 983 1173 L 965 949 L 1017 883 L 1019 845 L 965 789 L 965 540 L 917 346 L 919 197 ' +
  'L 728 202 L 675 164 L 747 85 L 982 5 Z ' +
  'M 587 1104 L 587 1119 L 567 1140 L 518 1160 L 467 1195 L 431 1210 ' +
  'L 395 1207 L 396 1176 L 418 1155 L 554 1100 Z ' +
  'M 886 791 L 902 815 L 941 846 L 943 878 L 930 895 L 903 903 ' +
  'L 845 902 L 835 890 L 835 876 L 876 796 Z';

// objectBoundingBox 归一化（x/1080, y/1920）——供 CSS clip-path: url(#) 使用
const WATER_PATH_NORM = WATER_PATH.replace(
  /\b(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\b/g,
  (_, x, y) => `${(+x / 1080).toFixed(5)} ${(+y / 1920).toFixed(5)}`
);

const CARD_COLORS = [
  '#6366f1','#3b82f6','#0ea5e9','#22c55e','#f59e0b',
  '#f97316','#ef4444','#ec4899','#8b5cf6','#14b8a6',
];

interface Props {
  cards: Card[];
  onBack: () => void;
  onSwitchMode: () => void;
  onCardUpdate: () => void;
}

export default function WaterScene({ cards, onBack, onSwitchMode, onCardUpdate }: Props) {
  const [searchActive, setSearchActive]   = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [modalCard, setModalCard]         = useState<Card | null>(null);
  const [showNewCard, setShowNewCard]     = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filtered = searchQuery.trim()
    ? cards.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : null; // null = 不过滤（显示全部）

  const isVisible = (card: Card) => !filtered || filtered.some(f => f.id === card.id);

  const openSearch = () => {
    setSearchActive(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };
  const closeSearch = () => { setSearchActive(false); setSearchQuery(''); };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>

      {/* ── SVG defs：水流折射滤镜 + clip path（zero-size，只提供定义）────── */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          {/* 水面折射扭曲滤镜 */}
          <filter id="sqx-waterWave" x="-5%" y="-5%" width="110%" height="110%"
            colorInterpolationFilters="linearRGB">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${DISTORT_FREQ_X} ${DISTORT_FREQ_Y}`}
              numOctaves={DISTORT_OCTAVES}
              seed="1"
              result="turbulence"
            >
              {/* seed 动画：缓慢变换噪声模式，产生流动感 */}
              <animate attributeName="seed"
                values="1;40;1"
                dur={DISTORT_DURATION}
                repeatCount="indefinite"
              />
              {/* baseFrequency 小幅波动：模拟水面呼吸感 */}
              <animate attributeName="baseFrequency"
                values={`${DISTORT_FREQ_X} ${DISTORT_FREQ_Y};${DISTORT_FREQ_X * 1.35} ${DISTORT_FREQ_Y * 1.5};${DISTORT_FREQ_X} ${DISTORT_FREQ_Y}`}
                dur="18s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale={DISTORT_SCALE}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>

          {/* 水流区域 clip path（objectBoundingBox：坐标0~1，自动适配元素尺寸）*/}
          <clipPath id="sqx-waterClip" clipPathUnits="objectBoundingBox">
            <path fillRule="evenodd" d={WATER_PATH_NORM} />
          </clipPath>
        </defs>
      </svg>

      {/* ── 溪流底图（带水面折射扭曲）────────────────────────────────────── */}
      <img
        src="/suixiang/溪流底图.png"
        alt=""
        draggable={false}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          filter: 'url(#sqx-waterWave)',
          pointerEvents: 'none',
        }}
      />

      {/* ── 流光视频（裁剪至水流路径，screen 混合模拟水波光效）──────────── */}
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          clipPath: 'url(#sqx-waterClip)',
          mixBlendMode: SHIMMER_BLEND as React.CSSProperties['mixBlendMode'],
          opacity: SHIMMER_OPACITY,
          filter: SHIMMER_VIDEO_FILTER,
          pointerEvents: 'none',
        }}
      >
        <source src="/suixiang/流光视频.mp4" type="video/mp4" />
      </video>

      {/* ── 漂浮随想 ──────────────────────────────────────────────────────── */}
      {cards.map((card, idx) => (
        <FloatingItem
          key={card.id}
          card={card}
          index={idx}
          totalCount={cards.length}
          visible={isVisible(card)}
          onOpenModal={setModalCard}
        />
      ))}
      {cards.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', gap: 8,
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,254,240,0.7)',
            textShadow: '0 1px 4px rgba(10,50,20,0.8)',
            fontFamily: "'Noto Serif SC', serif" }}>
            点击右下角 ＋ 写下第一个随想
          </span>
        </div>
      )}

      {/* ── 搜索栏（展开态）──────────────────────────────────────────────── */}
      <AnimatePresence>
        {searchActive && (
          <motion.div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 25,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px',
              background: SEARCH_BAR_BG,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
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
              <span style={{ fontSize: 12, color: '#5a9e72' }}>
                {filtered?.length ?? 0} 个
              </span>
            )}
            <button
              onClick={closeSearch}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
            >
              <X size={16} color="#6a9e72" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 浮动 UI 按钮 ─────────────────────────────────────────────────── */}
      {/* 返回按钮（左上角）*/}
      <button
        onClick={onBack}
        style={{
          position: 'absolute', top: 16, left: 16, zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: UI_BTN_BG, border: `1px solid ${UI_BTN_BORDER}`,
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {/* 叶片造型的返回箭头 SVG */}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M11.5 3.5L6 9L11.5 14.5"
            stroke={UI_GREEN} strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"/>
          {/* 小叶片装饰 */}
          <path d="M6 9 C4.5 7.5 4 5.5 6 5"
            stroke={UI_GREEN} strokeWidth="1.3"
            strokeLinecap="round" fill="none" opacity="0.7"/>
        </svg>
      </button>

      {/* 搜索按钮（右上角）*/}
      {!searchActive && (
        <button
          onClick={openSearch}
          style={{
            position: 'absolute', top: 16, right: 56, zIndex: 30,
            width: 36, height: 36, borderRadius: '50%',
            background: UI_BTN_BG, border: `1px solid ${UI_BTN_BORDER}`,
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Search size={16} color={UI_GREEN} />
        </button>
      )}

      {/* 切换卡片模式按钮（右上角）*/}
      <button
        onClick={onSwitchMode}
        style={{
          position: 'absolute', top: 16, right: 14, zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: UI_BTN_BG, border: `1px solid ${UI_BTN_BORDER}`,
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
        title="切换到卡片模式"
      >
        {/* 3×3 网格图标 SVG */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          {[0,5,10].map(ox => [0,5,10].map(oy => (
            <rect key={`${ox}-${oy}`} x={ox} y={oy} width="3.5" height="3.5"
              rx="0.8" fill={UI_GREEN} opacity="0.85"/>
          )))}
        </svg>
      </button>

      {/* 新建随想按钮（右下角）*/}
      <button
        onClick={() => setShowNewCard(true)}
        style={{
          position: 'absolute', bottom: 24, right: 20, zIndex: 30,
          width: 48, height: 48, borderRadius: '50%',
          background: UI_GREEN,
          boxShadow: '0 4px 16px rgba(30,80,40,0.45)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 4V18M4 11H18"
            stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* ── 弹窗层 ────────────────────────────────────────────────────────── */}
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

// ── 新建随想弹窗（内联，仅场景模式使用）─────────────────────────────────────
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
        background: 'rgba(10,40,20,0.4)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-end',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        style={{
          width: '100%',
          background: 'rgba(252,248,236,0.93)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 32px',
        }}
        initial={{ y: 200 }}
        animate={{ y: 0 }}
        exit={{ y: 200 }}
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
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12,
              border: '1px solid rgba(160,140,100,0.3)',
              background: 'transparent', fontSize: 13, color: '#8a7a60',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={() => title.trim() && onCreate(title.trim())}
            disabled={!title.trim()}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 12,
              border: 'none',
              background: title.trim() ? UI_GREEN : 'rgba(160,140,100,0.2)',
              fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: title.trim() ? 'pointer' : 'default',
              transition: 'background 0.2s ease',
            }}
          >
            放入溪流
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
