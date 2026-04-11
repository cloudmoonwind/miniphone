/**
 * HallView.jsx — Game lobby
 * Wooden table texture background, 3D-style game box cards (horizontal row)
 * Three modes: 益智, 恋爱, 十八禁
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Settings, Loader2 } from 'lucide-react';
import { THEME, api } from './theme.js';

// City skyline art (CSS/SVG) for 益智
function CitySkyline({ accent }) {
  const buildings = [
    { x: 0, w: 12, h: 28, windows: 3 },
    { x: 14, w: 8, h: 20, windows: 2 },
    { x: 24, w: 15, h: 38, windows: 5 },
    { x: 41, w: 10, h: 25, windows: 3 },
    { x: 53, w: 7, h: 16, windows: 2 },
    { x: 62, w: 14, h: 32, windows: 4 },
    { x: 78, w: 9, h: 22, windows: 3 },
    { x: 89, w: 11, h: 28, windows: 3 },
  ];
  return (
    <svg width="100%" height="48" viewBox="0 0 100 48" preserveAspectRatio="none"
      style={{ position: 'absolute', bottom: 0, left: 0, opacity: 0.18 }}>
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={48 - b.h} width={b.w} height={b.h} fill={accent} />
          {Array.from({ length: b.windows }, (_, wi) => (
            <rect key={wi}
              x={b.x + 2 + (wi % 2) * (b.w / 2 - 1)}
              y={48 - b.h + 4 + Math.floor(wi / 2) * 6}
              width={b.w / 2 - 2}
              height={3}
              fill="rgba(255,255,255,0.6)" />
          ))}
        </g>
      ))}
    </svg>
  );
}

// Ferris wheel + cherry blossom art for 恋爱
function FerrisWheelArt({ accent }) {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60"
      style={{ position: 'absolute', bottom: 4, right: 8, opacity: 0.2 }}>
      {/* Wheel */}
      <circle cx={30} cy={22} r={18} fill="none" stroke={accent} strokeWidth={1.5} />
      {[0, 45, 90, 135].map(angle => {
        const rad = (angle * Math.PI) / 180;
        return (
          <g key={angle}>
            <line
              x1={30} y1={22}
              x2={30 + 18 * Math.cos(rad)} y2={22 + 18 * Math.sin(rad)}
              stroke={accent} strokeWidth={1} />
            <line
              x1={30} y1={22}
              x2={30 - 18 * Math.cos(rad)} y2={22 - 18 * Math.sin(rad)}
              stroke={accent} strokeWidth={1} />
            <rect
              x={30 + 14 * Math.cos(rad) - 3}
              y={22 + 14 * Math.sin(rad) - 3}
              width={6} height={6} rx={1}
              fill={accent} opacity={0.6} />
          </g>
        );
      })}
      {/* Stand */}
      <line x1={24} y1={40} x2={30} y2={22} stroke={accent} strokeWidth={1.5} />
      <line x1={36} y1={40} x2={30} y2={22} stroke={accent} strokeWidth={1.5} />
      <line x1={20} y1={40} x2={40} y2={40} stroke={accent} strokeWidth={2} />
    </svg>
  );
}

// Wine glass for 十八禁
function WineGlassArt({ accent }) {
  return (
    <svg width="40" height="55" viewBox="0 0 40 55"
      style={{ position: 'absolute', bottom: 4, right: 14, opacity: 0.2 }}>
      {/* Glass bowl */}
      <path d="M8,4 Q5,18 12,24 Q16,28 20,28 Q24,28 28,24 Q35,18 32,4 Z"
        fill="none" stroke={accent} strokeWidth={1.5} />
      {/* Stem */}
      <line x1={20} y1={28} x2={20} y2={46} stroke={accent} strokeWidth={1.5} />
      {/* Base */}
      <line x1={12} y1={46} x2={28} y2={46} stroke={accent} strokeWidth={2} />
      {/* Wine fill */}
      <path d="M10,16 Q10,22 13,24 Q16,27 20,27 Q24,27 27,24 Q30,22 30,16 Z"
        fill={accent} opacity={0.3} />
      {/* Moon reflection */}
      <circle cx={25} cy={12} r={3} fill="rgba(255,255,255,0.25)" />
    </svg>
  );
}

// Record card component
function RecordCard({ record }) {
  const t = THEME[record.mode] || THEME['恋爱'];
  const winnerName = record.winner === 'user' ? record.userName : record.charName;
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 12,
      marginBottom: 8,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 'bold',
            color: t.accent,
            padding: '1px 6px',
            borderRadius: 4,
            background: `${t.accent}15`,
          }}>
            {record.mode}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            {record.userName} × {record.charName}
          </span>
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
          第{record.round}轮 · {record.playType}
        </p>
      </div>
      {record.winner && (
        <span style={{
          fontSize: 10,
          color: '#fbbf24',
          flexShrink: 0,
          marginLeft: 8,
        }}>
          {winnerName} 胜
        </span>
      )}
    </div>
  );
}

// The game box card
function GameBox({ mode, onSelect, isOpening }) {
  const t = THEME[mode];
  const ArtComponent = mode === '益智' ? CitySkyline : mode === '恋爱' ? FerrisWheelArt : WineGlassArt;

  return (
    <motion.button
      onClick={() => onSelect(mode)}
      animate={isOpening
        ? { scale: 1.06, opacity: 0.7, rotateX: 8 }
        : { scale: 1, opacity: 1, rotateX: 0 }
      }
      whileHover={{ scale: 1.03, y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        flexShrink: 0,
        width: 104,
        height: 148,
        padding: 0,
        border: 'none',
        cursor: 'pointer',
        borderRadius: 16,
        background: t.hallBg,
        boxShadow: `
          0 8px 24px rgba(0,0,0,0.5),
          0 2px 4px rgba(0,0,0,0.3),
          inset 0 1px 0 rgba(255,255,255,0.08),
          0 0 0 1.5px ${t.hallBorder}35
        `,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* 3D depth effect — right edge */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 8,
        bottom: 8,
        width: 5,
        background: `linear-gradient(to right, ${t.hallBorder}08, ${t.hallBorder}25)`,
        borderRadius: '0 4px 4px 0',
      }} />

      {/* Top glow */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 40,
        background: `linear-gradient(to bottom, ${t.hallBorder}18, transparent)`,
        pointerEvents: 'none',
      }} />

      {/* Art component */}
      <ArtComponent accent={t.hallBorder} />

      {/* Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 10px 10px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Tag */}
        <div style={{
          alignSelf: 'flex-start',
          padding: '2px 7px',
          borderRadius: 99,
          background: t.hallTagBg,
          border: `1px solid ${t.hallTagColor}25`,
          marginBottom: 8,
        }}>
          <span style={{ fontSize: 9, color: t.hallTagColor, fontWeight: 'bold' }}>
            {t.hallTag}
          </span>
        </div>

        {/* Title */}
        <div style={{ flex: 1 }}>
          <p style={{
            fontSize: 13,
            fontWeight: 'bold',
            color: 'white',
            lineHeight: 1.3,
            marginBottom: 4,
            letterSpacing: 0.3,
          }}>
            {t.hallTitle}
          </p>
          <p style={{
            fontSize: 8,
            color: `${t.hallBorder}90`,
            lineHeight: 1.5,
          }}>
            {t.hallSub}
          </p>
        </div>

        {/* Mode badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
        }}>
          <span style={{
            fontSize: 9,
            color: `${t.hallBorder}80`,
            padding: '2px 6px',
            background: `${t.hallBorder}10`,
            borderRadius: 99,
            border: `1px solid ${t.hallBorder}20`,
          }}>
            {mode}
          </span>
          <span style={{ fontSize: 9, color: `${t.hallBorder}60` }}>→</span>
        </div>
      </div>

      {/* Bottom spine shadow */}
      <div style={{
        height: 5,
        background: `linear-gradient(to bottom, transparent, rgba(0,0,0,0.4))`,
        flexShrink: 0,
      }} />
    </motion.button>
  );
}

export default function HallView({ onSelect, onViewRecords, onSettings }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(null);
  const [showAllRecords, setShowAllRecords] = useState(false);

  useEffect(() => {
    api('/records')
      .then(d => { setRecords(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (mode) => {
    setOpening(mode);
    setTimeout(() => { setOpening(null); onSelect(mode); }, 550);
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      // Wooden table texture using CSS gradients
      background: `
        repeating-linear-gradient(
          92deg,
          transparent,
          transparent 2px,
          rgba(139,90,43,0.04) 2px,
          rgba(139,90,43,0.04) 4px
        ),
        repeating-linear-gradient(
          180deg,
          transparent,
          transparent 20px,
          rgba(101,67,33,0.03) 20px,
          rgba(101,67,33,0.03) 21px
        ),
        linear-gradient(180deg, #1a0d06 0%, #2c1810 40%, #1e1008 100%)
      `,
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 16px 12px',
        textAlign: 'center',
        flexShrink: 0,
        position: 'relative',
      }}>
        {/* Settings button */}
        <button
          onClick={onSettings}
          style={{
            position: 'absolute',
            top: 16,
            right: 14,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: 7,
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          <Settings size={14} />
        </button>

        <p style={{
          fontSize: 10,
          color: 'rgba(255,220,160,0.4)',
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginBottom: 5,
        }}>
          GAME LOUNGE
        </p>
        <h2 style={{
          fontSize: 20,
          fontWeight: 'bold',
          color: 'rgba(255,240,200,0.9)',
          letterSpacing: 1,
          textShadow: '0 2px 12px rgba(180,120,40,0.3)',
        }}>
          选择你的冒险
        </h2>
        <p style={{
          fontSize: 10,
          color: 'rgba(255,220,160,0.3)',
          marginTop: 3,
        }}>
          与 AI 角色共同叙事的棋盘游戏
        </p>
      </div>

      {/* Game boxes — horizontal scrollable row */}
      <div style={{
        flexShrink: 0,
        padding: '6px 16px 16px',
      }}>
        <div style={{
          display: 'flex',
          gap: 14,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          paddingBottom: 4,
          justifyContent: 'center',
        }}>
          {['益智', '恋爱', '十八禁'].map(mode => (
            <GameBox
              key={mode}
              mode={mode}
              onSelect={handleSelect}
              isOpening={opening === mode} />
          ))}
        </div>
      </div>

      {/* Separator */}
      <div style={{
        margin: '0 16px 12px',
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(180,120,40,0.2), transparent)',
        flexShrink: 0,
      }} />

      {/* Recent records / stats */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px 16px',
        scrollbarWidth: 'none',
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
            <Loader2 size={18} className="animate-spin" style={{ color: 'rgba(255,200,100,0.2)' }} />
          </div>
        ) : records.length > 0 ? (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trophy size={12} style={{ color: 'rgba(251,191,36,0.5)' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,220,160,0.35)' }}>
                  历史对局
                </span>
              </div>
              <button
                onClick={onViewRecords}
                style={{
                  fontSize: 10,
                  color: 'rgba(255,220,160,0.25)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                查看全部
              </button>
            </div>
            {records.slice(0, showAllRecords ? undefined : 3).map(r => (
              <RecordCard key={r.id} record={r} />
            ))}
            {records.length > 3 && !showAllRecords && (
              <button
                onClick={() => setShowAllRecords(true)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: 8,
                  fontSize: 11,
                  color: 'rgba(255,220,160,0.25)',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                }}
              >
                展开更多
              </button>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,220,160,0.2)' }}>
              还没有游戏记录
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,220,160,0.12)', marginTop: 4 }}>
              选择一个游戏开始冒险吧
            </p>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        flexShrink: 0,
        padding: '10px 16px',
        borderTop: '1px solid rgba(255,220,160,0.06)',
        display: 'flex',
        justifyContent: 'space-around',
      }}>
        <button
          onClick={onViewRecords}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Trophy size={16} style={{ color: 'rgba(251,191,36,0.45)' }} />
          <span style={{ fontSize: 9, color: 'rgba(255,220,160,0.3)' }}>我的战绩</span>
        </button>
        <button
          onClick={onSettings}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Settings size={16} style={{ color: 'rgba(255,255,255,0.2)' }} />
          <span style={{ fontSize: 9, color: 'rgba(255,220,160,0.3)' }}>设置</span>
        </button>
      </div>
    </div>
  );
}
