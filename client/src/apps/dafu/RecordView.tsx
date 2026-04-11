/**
 * RecordView.jsx — Record replay / game summary
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { THEME } from './theme.js';

export default function RecordView({ record }) {
  const [expandLog, setExpandLog] = useState(false);
  const t = THEME[record.mode] || THEME['恋爱'];
  const winnerName = record.winner === 'user' ? record.userName : record.charName;
  const log = record.log || [];
  const shownLog = expandLog ? log : log.slice(0, 12);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      background: t.bg,
      scrollbarWidth: 'none',
    }}>
      {/* Summary header */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: `1px solid ${t.accent}15`,
        background: `${t.accent}05`,
        flexShrink: 0,
      }}>
        {/* Mode + type badges */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 'bold',
            padding: '3px 10px',
            borderRadius: 99,
            background: `${t.accent}15`,
            color: t.accent,
            border: `1px solid ${t.accent}30`,
          }}>
            {record.mode}
          </span>
          <span style={{
            fontSize: 10,
            padding: '3px 8px',
            borderRadius: 99,
            color: 'rgba(255,255,255,0.35)',
            background: 'rgba(255,255,255,0.05)',
          }}>
            {record.playType}
          </span>
          {record.winner && (
            <span style={{
              marginLeft: 'auto',
              fontSize: 12,
              fontWeight: 'bold',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              {winnerName} 获胜
            </span>
          )}
        </div>

        {/* Players info */}
        <p style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.3)',
          marginBottom: 8,
        }}>
          {record.userName} × {record.charName} · {record.round} 轮 ·{' '}
          {new Date(record.completedAt || record.createdAt).toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>

        {/* Score comparison */}
        {record.players && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}>
            {record.players.map(p => (
              <div key={p.id} style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${p.color}25`,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginBottom: 4,
                }}>
                  <div style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: p.color,
                    boxShadow: `0 0 5px ${p.color}`,
                  }} />
                  <span style={{
                    fontSize: 11,
                    fontWeight: 'bold',
                    color: 'white',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {p.name}
                  </span>
                  {record.winner === p.id && (
                    <span style={{ fontSize: 10, marginLeft: 'auto' }}>🏆</span>
                  )}
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: t.scoreColor,
                }}>
                  {p.score}
                </div>
                <div style={{ fontSize: 9, color: `${t.scoreColor}60` }}>
                  {t.scoreIcon} {t.scoreLabel}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log */}
      <div style={{ padding: '12px 14px 20px', flex: 1 }}>
        <p style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: 0.5,
          marginBottom: 10,
        }}>
          对局记录
        </p>

        {shownLog.map((entry, i) => {
          if (entry.type === 'system' || entry.type === 'event') {
            return (
              <div key={i} style={{ textAlign: 'center', margin: '6px 0' }}>
                <span style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.25)',
                  padding: '2px 12px',
                  borderRadius: 99,
                  background: 'rgba(255,255,255,0.04)',
                }}>
                  {entry.text}
                </span>
              </div>
            );
          }
          if (entry.type === 'roll') {
            return (
              <div key={i} style={{ textAlign: 'center', margin: '5px 0' }}>
                <span style={{
                  fontSize: 11,
                  color: `${t.accent}60`,
                }}>
                  {entry.text}
                </span>
              </div>
            );
          }
          if (entry.type === 'narrative') {
            return (
              <motion.p
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  fontSize: 12,
                  color: t.text,
                  lineHeight: 1.8,
                  margin: '8px 0',
                  fontStyle: 'italic',
                  opacity: 0.7,
                  padding: '0 2px',
                  borderLeft: `2px solid ${t.accent}25`,
                  paddingLeft: 8,
                }}
              >
                {entry.text}
              </motion.p>
            );
          }
          if (entry.type === 'chat') {
            const isUser = entry.playerId === 'user';
            return (
              <div key={i} style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                margin: '6px 0',
              }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: isUser ? `${t.cellProp}28` : `${t.accent}12`,
                  border: `1px solid ${isUser ? t.cellProp : t.accent}22`,
                  fontSize: 12,
                  color: t.text,
                  lineHeight: 1.55,
                }}>
                  {!isUser && (
                    <p style={{
                      fontSize: 9,
                      color: t.accent,
                      marginBottom: 4,
                      fontWeight: 'bold',
                    }}>
                      {record.charName}
                    </p>
                  )}
                  {entry.text}
                </div>
              </div>
            );
          }
          return null;
        })}

        {/* Expand button */}
        {log.length > 12 && !expandLog && (
          <button
            onClick={() => setExpandLog(true)}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '8px',
              borderRadius: 10,
              fontSize: 11,
              color: `${t.accent}60`,
              background: 'rgba(255,255,255,0.03)',
              border: `1px dashed ${t.accent}20`,
              cursor: 'pointer',
            }}
          >
            展开完整记录（{log.length} 条）
          </button>
        )}
      </div>
    </div>
  );
}
