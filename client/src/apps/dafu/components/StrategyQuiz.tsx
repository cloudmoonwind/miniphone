/**
 * StrategyQuiz.jsx — 益智 mode strategy quiz overlay modal
 * Shows when mode==='益智' AND waitingFor==='choice'
 * 30-second countdown, auto-submit first option on timeout
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '../theme.js';

export default function StrategyQuiz({ game, onChoice, onClose }) {
  const theme = THEME['益智'];
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null); // 'correct' | 'wrong'
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef(null);

  const choices = game?.currentChoices || [];
  const narrative = game?.currentNarrative || '';

  // Countdown
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          // Auto-submit first option
          if (!submitted && choices.length > 0) {
            handleSubmit(choices[0].key, true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const handleSubmit = (key, isTimeout = false) => {
    if (submitted) return;
    setSubmitted(true);
    clearInterval(timerRef.current);
    const choiceIndex = choices.findIndex(c => c.key === key);
    // Simulate result: A is usually "correct", others are mixed
    const isCorrect = choiceIndex === 0 || (!isTimeout && choiceIndex === 1 && Math.random() > 0.4);
    setResult(isCorrect ? 'correct' : 'wrong');
    setSelected(key);
    setTimeout(() => {
      onChoice(key);
      onClose?.();
    }, 1600);
  };

  const timeRatio = timeLeft / 30;
  const timerColor = timeLeft > 15
    ? theme.accent
    : timeLeft > 7
    ? '#f59e0b'
    : '#ef4444';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 26 }}
        style={{
          width: '100%',
          maxWidth: 320,
          background: 'linear-gradient(160deg, #0a1830, #0d1f3d)',
          border: `1.5px solid ${theme.accent}40`,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: `0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px ${theme.accent}15`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: `1px solid ${theme.accent}18`,
          background: `${theme.accent}06`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 9, color: theme.accent, letterSpacing: 1.5, marginBottom: 3, opacity: 0.8 }}>
                STRATEGY CHALLENGE
              </p>
              <h3 style={{ fontSize: 15, fontWeight: 'bold', color: 'white' }}>
                策略挑战
              </h3>
            </div>
            {/* Timer circle */}
            <div style={{ position: 'relative', width: 42, height: 42 }}>
              <svg width={42} height={42} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={21} cy={21} r={17}
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth={3} />
                <circle cx={21} cy={21} r={17}
                  fill="none"
                  stroke={timerColor}
                  strokeWidth={3}
                  strokeDasharray={`${107 * timeRatio} 107`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s linear, stroke 0.5s' }} />
              </svg>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 'bold',
                color: timerColor,
                transition: 'color 0.5s',
              }}>
                {timeLeft}
              </div>
            </div>
          </div>
          {/* Timer progress bar */}
          <div style={{
            marginTop: 8,
            height: 3,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${timeRatio * 100}%`,
              background: `linear-gradient(90deg, ${timerColor}, ${timerColor}90)`,
              borderRadius: 2,
              transition: 'width 1s linear, background 0.5s',
            }} />
          </div>
        </div>

        {/* Narrative / question context */}
        <div style={{ padding: '12px 16px', maxHeight: 100, overflowY: 'auto' }}>
          <p style={{
            fontSize: 12,
            color: theme.text,
            lineHeight: 1.7,
            opacity: 0.85,
          }}>
            {narrative || '请根据当前情境做出策略判断…'}
          </p>
        </div>

        {/* Choices */}
        <div style={{ padding: '0 16px 16px' }}>
          <AnimatePresence>
            {submitted && result ? (
              <motion.div
                key="result"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  padding: '14px',
                  borderRadius: 14,
                  textAlign: 'center',
                  background: result === 'correct' ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${result === 'correct' ? '#16a34a' : '#ef4444'}40`,
                }}
              >
                <p style={{
                  fontSize: 18,
                  marginBottom: 4,
                }}>
                  {result === 'correct' ? '✓' : '×'}
                </p>
                <p style={{
                  fontSize: 13,
                  fontWeight: 'bold',
                  color: result === 'correct' ? '#4ade80' : '#f87171',
                }}>
                  {result === 'correct' ? '判断正确！' : '判断有误'}
                </p>
              </motion.div>
            ) : (
              <motion.div key="choices">
                {choices.map((c, i) => (
                  <motion.button
                    key={c.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={!submitted ? { scale: 1.02, x: 4 } : {}}
                    whileTap={!submitted ? { scale: 0.98 } : {}}
                    onClick={() => !submitted && (setSelected(c.key))}
                    onDoubleClick={() => !submitted && handleSubmit(c.key)}
                    style={{
                      width: '100%',
                      marginBottom: 8,
                      padding: '10px 14px',
                      borderRadius: 10,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: selected === c.key
                        ? `${theme.accent}18`
                        : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${selected === c.key ? theme.accent + '70' : 'rgba(255,255,255,0.1)'}`,
                      color: selected === c.key ? 'white' : 'rgba(255,255,255,0.65)',
                      fontSize: 12,
                      cursor: submitted ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Radio indicator */}
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: `2px solid ${selected === c.key ? theme.accent : 'rgba(255,255,255,0.2)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'border-color 0.2s',
                    }}>
                      {selected === c.key && (
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: theme.accent,
                        }} />
                      )}
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 'bold',
                      color: theme.accent,
                      opacity: 0.8,
                      flexShrink: 0,
                    }}>
                      {c.key}
                    </span>
                    <span style={{ flex: 1 }}>{c.text}</span>
                  </motion.button>
                ))}
                {selected && (
                  <motion.button
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleSubmit(selected)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 'bold',
                      color: '#0a1830',
                      border: 'none',
                      cursor: 'pointer',
                      background: `linear-gradient(135deg, ${theme.accent}, #b8860b)`,
                      boxShadow: `0 4px 14px ${theme.accent}30`,
                    }}
                  >
                    确认选择
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
