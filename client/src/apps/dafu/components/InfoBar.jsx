/**
 * InfoBar.jsx — compact 36px status bar
 * Shows: round + current player | items | scores with progress bar
 */
import { THEME } from '../theme.js';

const ITEM_ICONS = {
  reroll: '🎲',
  skip: '⏭️',
  double: '×2',
};

export default function InfoBar({ game, mode }) {
  if (!game) return null;
  const theme = THEME[mode] || THEME['恋爱'];
  const curPlayer = game.players[game.currentPlayerIndex];
  const userP = game.players.find(p => p.id === 'user');
  const charP = game.players.find(p => p.id === 'char');
  const MAX_SCORE = 1000;

  return (
    <div style={{
      height: 36,
      display: 'flex',
      alignItems: 'center',
      padding: '0 10px',
      gap: 6,
      background: 'rgba(0,0,0,0.3)',
      borderBottom: `1px solid ${theme.accent}18`,
      flexShrink: 0,
    }}>
      {/* Left: round + current player */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        minWidth: 0,
        flex: '0 0 auto',
      }}>
        <span style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}>
          第{game.round}轮
        </span>
        {curPlayer && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 6,
            background: `${curPlayer.color}15`,
            border: `1px solid ${curPlayer.color}40`,
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: curPlayer.color,
              boxShadow: `0 0 6px ${curPlayer.color}`,
              animation: 'pulse-dot 1.4s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: 10,
              color: 'white',
              maxWidth: 50,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {curPlayer.name}
            </span>
          </div>
        )}
      </div>

      {/* Center: items */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        overflow: 'hidden',
      }}>
        {(userP?.items || []).length > 0 && (
          <>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', marginRight: 2 }}>
              道具
            </span>
            {(userP.items || []).slice(0, 3).map((item, i) => (
              <div key={i} style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 4,
                background: `${theme.accent}15`,
                border: `1px solid ${theme.accent}30`,
                color: theme.accent,
              }}>
                {ITEM_ICONS[item] || item}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Right: scores */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: '0 0 auto',
      }}>
        {[userP, charP].filter(Boolean).map(p => (
          <div key={p.id} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: p.id === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              marginBottom: 2,
            }}>
              <span style={{
                fontSize: 9,
                color: p.id === 'user' ? '#60a5fa' : '#f472b6',
                fontWeight: 'bold',
              }}>
                {p.score}
              </span>
            </div>
            {/* Progress bar */}
            <div style={{
              width: 36,
              height: 3,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (p.score / MAX_SCORE) * 100)}%`,
                borderRadius: 2,
                background: p.id === 'user'
                  ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                  : `linear-gradient(90deg, ${theme.accent}90, ${theme.accent})`,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        ))}
        <span style={{
          fontSize: 8,
          color: theme.scoreColor,
          whiteSpace: 'nowrap',
          opacity: 0.7,
        }}>
          {theme.scoreIcon}{theme.scoreLabel}
        </span>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%,100% { opacity:1; }
          50% { opacity:0.4; }
        }
      `}</style>
    </div>
  );
}
