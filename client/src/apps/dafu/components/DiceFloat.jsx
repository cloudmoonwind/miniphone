/**
 * DiceFloat.jsx — floating dice overlay (idle rotation + click to roll)
 * Only shown when waitingFor === 'roll'
 * - Idle: single die, slow continuous rotation
 * - User turn: clickable + glow, "点击掷骰" text
 * - Char turn: "waiting" state, not clickable
 * - After click: rolling animation, then shows two dice with result
 * - After 2s result shown, calls onDone()
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME, PIPS } from '../theme.js';

function DieFace({ value, base, pip, isHeart = false, size = 52 }) {
  const pips = PIPS[Math.max(1, Math.min(6, value || 1))] || PIPS[1];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <linearGradient id={`die-grad-${value}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={base} stopOpacity="1" />
          <stop offset="100%" stopColor={base} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <rect x={4} y={4} width={92} height={92} rx={20}
        fill={`url(#die-grad-${value})`}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={2}
        style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.7))' }} />
      {/* Inner edge highlight */}
      <rect x={8} y={8} width={84} height={84} rx={16}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1} />
      {pips.map(([cx, cy], i) => (
        isHeart ? (
          <text key={i} x={cx} y={cy + 4}
            textAnchor="middle"
            fontSize={11}
            fill={pip}>
            ♥
          </text>
        ) : (
          <circle key={i} cx={cx} cy={cy} r={7.5}
            fill={pip}
            style={{ filter: `drop-shadow(0 0 3px ${pip}80)` }} />
        )
      ))}
    </svg>
  );
}

export default function DiceFloat({ mode, isUserTurn, rolling, diceResult, onRoll, onDone }) {
  const theme = THEME[mode] || THEME['恋爱'];
  const isHeart = mode === '恋爱';
  const [idleValue, setIdleValue] = useState(1);
  const [showResult, setShowResult] = useState(false);
  const doneTimer = useRef(null);

  // Idle: cycle die face slowly
  useEffect(() => {
    if (rolling || showResult) return;
    const interval = setInterval(() => {
      setIdleValue(v => (v % 6) + 1);
    }, 800);
    return () => clearInterval(interval);
  }, [rolling, showResult]);

  // Show result then fade
  useEffect(() => {
    if (diceResult && !rolling) {
      setShowResult(true);
      doneTimer.current = setTimeout(() => {
        setShowResult(false);
        onDone?.();
      }, 2200);
    }
    return () => clearTimeout(doneTimer.current);
  }, [diceResult, rolling]);

  const handleClick = () => {
    if (!isUserTurn || rolling) return;
    onRoll();
  };

  const containerStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 30,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    pointerEvents: isUserTurn ? 'auto' : 'none',
  };

  return (
    <div style={containerStyle}>
      <AnimatePresence mode="wait">
        {showResult && diceResult ? (
          /* Result: two dice */
          <motion.div
            key="result"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <DieFace value={diceResult.die1} base={theme.diceBase} pip={theme.dicePip} isHeart={isHeart} />
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>+</div>
            <DieFace value={diceResult.die2} base={theme.diceBase} pip={theme.dicePip} isHeart={isHeart} />
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                fontSize: 22,
                fontWeight: 'bold',
                color: theme.accent,
                marginLeft: 4,
                textShadow: `0 0 12px ${theme.accent}`,
              }}
            >
              = {diceResult.die1 + diceResult.die2}
            </motion.div>
          </motion.div>
        ) : rolling ? (
          /* Rolling animation */
          <motion.div
            key="rolling"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: 'flex', gap: 8 }}
          >
            {[0, 1].map(i => (
              <motion.div
                key={i}
                animate={{
                  rotate: [0, 180, 360, 540, 720],
                  scale: [1, 1.15, 0.9, 1.1, 1],
                }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.12,
                }}
              >
                <DieFace
                  value={Math.floor(Math.random() * 6) + 1}
                  base={theme.diceBase}
                  pip={theme.dicePip}
                  isHeart={isHeart} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          /* Idle: single die */
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={handleClick}
            style={{ cursor: isUserTurn ? 'pointer' : 'default' }}
          >
            <motion.div
              animate={isUserTurn
                ? {
                    rotate: [0, 5, -5, 3, -3, 0],
                    scale: [1, 1.05, 0.98, 1.02, 1],
                    filter: [
                      `drop-shadow(0 0 8px ${theme.accent}40)`,
                      `drop-shadow(0 0 16px ${theme.accent}70)`,
                      `drop-shadow(0 0 8px ${theme.accent}40)`,
                    ],
                  }
                : {
                    rotate: [0, 360],
                  }
              }
              transition={isUserTurn
                ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 8, repeat: Infinity, ease: 'linear' }
              }
              style={{ display: 'block' }}
            >
              <DieFace
                value={idleValue}
                base={theme.diceBase}
                pip={theme.dicePip}
                isHeart={isHeart}
                size={56} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Label below */}
      <AnimatePresence>
        {!showResult && (
          <motion.div
            key="label"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: 11,
              color: isUserTurn ? theme.accent : 'rgba(255,255,255,0.35)',
              textAlign: 'center',
              padding: '4px 12px',
              borderRadius: 20,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              border: `1px solid ${isUserTurn ? theme.accent + '40' : 'rgba(255,255,255,0.08)'}`,
              whiteSpace: 'nowrap',
            }}
          >
            {rolling ? '掷骰中…' : isUserTurn ? '点击掷骰' : '等待中…'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
