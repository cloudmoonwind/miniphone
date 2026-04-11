/**
 * TruthSpinner.jsx — 十八禁 mode truth-or-dare spinner
 * Shows when mode==='十八禁' AND waitingFor==='special'
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../theme.js';

const SECTORS = [
  '初吻',
  '最喜欢的部位',
  '最羞耻的事',
  '深夜的幻想',
  '第一次',
  '秘密癖好',
  '最想做的事',
  '身体弱点',
  '告白经历',
  '禁忌话题',
];

const SECTOR_COUNT = SECTORS.length;
const SECTOR_ANGLE = 360 / SECTOR_COUNT;

// Build SVG path for a pie sector
function sectorPath(cx, cy, r, startAngle, endAngle) {
  const toRad = deg => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`;
}

// Colors for sectors
const SECTOR_COLORS = [
  '#7e22ce', '#9333ea', '#a855f7', '#c084fc',
  '#6d28d9', '#8b5cf6', '#7c3aed', '#9333ea',
  '#a855f7', '#c084fc',
];

export default function TruthSpinner({ game, onAction, onClose }) {
  const theme = THEME['十八禁'];
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [landedIndex, setLandedIndex] = useState(null);
  const [actionSent, setActionSent] = useState(false);
  const spinRef = useRef(null);

  const charP = game?.players?.find(p => p.id === 'char');

  const handleSpin = () => {
    if (spinning || landedIndex !== null) return;
    setSpinning(true);

    // Random target sector
    const targetIdx = Math.floor(Math.random() * SECTOR_COUNT);
    // Multiple full rotations + land on target
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const targetAngle = fullSpins * 360 + (SECTOR_COUNT - targetIdx) * SECTOR_ANGLE - SECTOR_ANGLE / 2;
    const newRotation = rotation + targetAngle;

    spinRef.current = setTimeout(() => {
      setLandedIndex(targetIdx);
      setSpinning(false);
    }, 3500);

    setRotation(newRotation);
  };

  const handleAction = async (actionType) => {
    if (actionSent) return;
    setActionSent(true);
    const topic = SECTORS[landedIndex];
    let msg = '';
    if (actionType === 'me_too') msg = `（我也来说说关于"${topic}"的事情…）`;
    else if (actionType === 'ask_more') msg = `（继续问关于"${topic}"的问题）`;
    else msg = `（跳过这个话题）`;
    try {
      await onAction(msg);
    } finally {
      onClose?.();
    }
  };

  const R = 90; // wheel radius
  const CX = 110, CY = 110;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        style={{
          width: '100%',
          maxWidth: 320,
          background: 'linear-gradient(160deg, #0e0516, #1a0828)',
          border: `1.5px solid ${theme.accent}30`,
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: `0 20px 60px rgba(0,0,0,0.9), 0 0 40px ${theme.accent}08`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px 10px',
          borderBottom: `1px solid ${theme.accent}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <p style={{
              fontSize: 9,
              color: theme.accent,
              letterSpacing: 1.5,
              marginBottom: 3,
              opacity: 0.7,
            }}>
              TRUTH OR DARE
            </p>
            <h3 style={{ fontSize: 15, fontWeight: 'bold', color: 'white' }}>
              命运转盘
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Wheel */}
        <div style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{ position: 'relative', width: 220, height: 220 }}>
            {/* Pointer */}
            <div style={{
              position: 'absolute',
              top: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2,
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: `16px solid ${theme.accent}`,
              filter: `drop-shadow(0 0 6px ${theme.accent})`,
            }} />

            {/* SVG Wheel */}
            <motion.svg
              width={220}
              height={220}
              viewBox="0 0 220 220"
              animate={{ rotate: rotation }}
              transition={{
                duration: spinning ? 3.5 : 0,
                ease: spinning
                  ? [0.2, 0.9, 0.3, 1.0]
                  : 'linear',
              }}
              style={{ transformOrigin: '110px 110px' }}
            >
              {/* Wheel sectors */}
              {SECTORS.map((sector, i) => {
                const startAngle = i * SECTOR_ANGLE - 90;
                const endAngle = (i + 1) * SECTOR_ANGLE - 90;
                const midAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
                const textR = R * 0.65;
                const tx = CX + textR * Math.cos(midAngle);
                const ty = CY + textR * Math.sin(midAngle);

                return (
                  <g key={i}>
                    <path
                      d={sectorPath(CX, CY, R, startAngle, endAngle)}
                      fill={SECTOR_COLORS[i % SECTOR_COLORS.length]}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth={1}
                    />
                    <text
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={6.5}
                      fill="rgba(255,255,255,0.9)"
                      fontWeight="bold"
                      transform={`rotate(${(startAngle + endAngle) / 2 + 90}, ${tx}, ${ty})`}
                    >
                      {sector}
                    </text>
                  </g>
                );
              })}

              {/* Center circle */}
              <circle cx={CX} cy={CY} r={18}
                fill="#0e0516"
                stroke={theme.accent}
                strokeWidth={2} />
              <circle cx={CX} cy={CY} r={6}
                fill={theme.accent}
                style={{ filter: `drop-shadow(0 0 4px ${theme.accent})` }} />
            </motion.svg>
          </div>

          {/* Spin button or result */}
          <AnimatePresence mode="wait">
            {landedIndex === null ? (
              <motion.button
                key="spin-btn"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                whileHover={!spinning ? { scale: 1.05 } : {}}
                whileTap={!spinning ? { scale: 0.95 } : {}}
                onClick={handleSpin}
                disabled={spinning}
                style={{
                  marginTop: 14,
                  padding: '12px 36px',
                  borderRadius: 24,
                  fontSize: 15,
                  fontWeight: 'bold',
                  color: '#0e0516',
                  border: 'none',
                  cursor: spinning ? 'not-allowed' : 'pointer',
                  background: `linear-gradient(135deg, ${theme.accent}, #c026d3)`,
                  boxShadow: `0 4px 20px ${theme.accent}30`,
                  opacity: spinning ? 0.7 : 1,
                }}
              >
                {spinning ? '转动中…' : '转动'}
              </motion.button>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                style={{ width: '100%', marginTop: 12 }}
              >
                {/* Landed topic */}
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 14,
                  background: `${theme.accent}12`,
                  border: `1px solid ${theme.accent}35`,
                  textAlign: 'center',
                  marginBottom: 12,
                }}>
                  <p style={{ fontSize: 9, color: theme.accent, marginBottom: 6, opacity: 0.7 }}>
                    话题
                  </p>
                  <p style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: 'white',
                    textShadow: `0 0 12px ${theme.accent}50`,
                  }}>
                    {SECTORS[landedIndex]}
                  </p>
                  <p style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.45)',
                    marginTop: 6,
                  }}>
                    关于这个话题，{charP?.name || '她'}有什么想说的？
                  </p>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'me_too', label: '我也说说我的', accent: true },
                    { key: 'ask_more', label: '继续问你', accent: false },
                    { key: 'skip', label: '跳过', accent: false },
                  ].map(action => (
                    <motion.button
                      key={action.key}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleAction(action.key)}
                      disabled={actionSent}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: action.accent ? 'bold' : 'normal',
                        color: action.accent ? '#0e0516' : 'rgba(255,255,255,0.65)',
                        border: action.accent ? 'none' : '1px solid rgba(255,255,255,0.1)',
                        cursor: actionSent ? 'not-allowed' : 'pointer',
                        background: action.accent
                          ? `linear-gradient(135deg, ${theme.accent}, #c026d3)`
                          : 'rgba(255,255,255,0.05)',
                        opacity: actionSent ? 0.5 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      {action.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
