/**
 * Board.jsx — SVG graph board with cells, edges, player tokens
 * CELL_W = 46, draws within ~288px wide SVG
 */
import { useMemo } from 'react';
import { THEME, TYPE_COLOR, CELL_W, SVG_PAD, SVG_W, SVG_H, cellCenter, getReachable } from '../theme.js';

function buildEdges(cells) {
  const edges = [];
  cells.forEach(c => {
    (c.next || []).forEach(nid => {
      edges.push({ from: c.id, to: nid });
    });
  });
  return edges;
}

export default function Board({ game, mode, showReachable = false }) {
  if (!game) return null;
  const { cells, players, waitingFor } = game;
  const theme = THEME[mode] || THEME['恋爱'];
  const edges = useMemo(() => buildEdges(cells), [cells]);

  const userPlayer = players.find(p => p.id === 'user');
  const charPlayer = players.find(p => p.id === 'char');
  const userPos = userPlayer?.position ?? 0;
  const charPos = charPlayer?.position ?? 0;
  const curId = players[game.currentPlayerIndex]?.id;

  // Compute reachable cells for highlighting when it's user's roll turn
  const reachable = useMemo(() => {
    if (!showReachable || waitingFor !== 'roll' || curId !== 'user') return new Set();
    return getReachable(cells, userPos, 2, 12);
  }, [showReachable, waitingFor, curId, userPos, cells]);

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ display: 'block', margin: '0 auto' }}
    >
      {/* Board background */}
      <defs>
        <filter id="glow-user">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-char">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="cell-reach" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={theme.accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={theme.accent} stopOpacity="0.05" />
        </radialGradient>
        <style>{`
          @keyframes pulse-ring {
            0% { opacity: 0.8; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(1.15); }
            100% { opacity: 0.8; transform: scale(1); }
          }
          @keyframes token-pulse {
            0% { opacity: 1; }
            50% { opacity: 0.6; }
            100% { opacity: 1; }
          }
          .pulsing { animation: pulse-ring 1.6s ease-in-out infinite; }
          .token-active { animation: token-pulse 1.2s ease-in-out infinite; }
        `}</style>
      </defs>

      <rect x={0} y={0} width={SVG_W} height={SVG_H} rx={10}
        fill={theme.boardBg}
        stroke={`${theme.accent}18`}
        strokeWidth={1} />

      {/* Grid lines (subtle) */}
      {Array.from({ length: 6 }, (_, x) => (
        <line key={`vl${x}`}
          x1={x * CELL_W + SVG_PAD} y1={SVG_PAD}
          x2={x * CELL_W + SVG_PAD} y2={SVG_H - SVG_PAD}
          stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
      ))}

      {/* Path edges */}
      {edges.map(({ from, to }, i) => {
        const a = cells.find(c => c.id === from);
        const b = cells.find(c => c.id === to);
        if (!a || !b) return null;
        const ac = cellCenter(a), bc = cellCenter(b);
        return (
          <line key={i}
            x1={ac.cx} y1={ac.cy} x2={bc.cx} y2={bc.cy}
            stroke={`${theme.accent}28`}
            strokeWidth={1.5}
            strokeDasharray="4,4" />
        );
      })}

      {/* Cells */}
      {cells.map(cell => {
        const { cx, cy } = cellCenter(cell);
        const hw = (CELL_W - 4) / 2;
        const x = cx - hw;
        const y = cy - hw;
        const w = hw * 2;
        const typeInfo = TYPE_COLOR[cell.type] || TYPE_COLOR.event;
        const color = cell.type === 'property' ? theme.cellProp : typeInfo.base;
        const isSpecial = cell.type === 'start' || cell.type === 'end' || cell.type === 'branch';
        const isReachable = reachable.has(cell.id);
        const isUserHere = cell.id === userPos;
        const isCharHere = cell.id === charPos;

        return (
          <g key={cell.id}>
            {/* Reachable highlight */}
            {isReachable && (
              <rect x={x - 3} y={y - 3} width={w + 6} height={w + 6} rx={isSpecial ? 9 : 6}
                fill={`${theme.accent}18`}
                stroke={`${theme.accent}60`}
                strokeWidth={1.5}
                strokeDasharray="3,2" />
            )}

            {/* Current-player pulsing ring */}
            {(isUserHere && curId === 'user') || (isCharHere && curId === 'char') ? (
              <rect
                className="pulsing"
                x={x - 2} y={y - 2} width={w + 4} height={w + 4} rx={isSpecial ? 8 : 5}
                fill="none"
                stroke={isUserHere && curId === 'user' ? '#60a5fa' : '#f472b6'}
                strokeWidth={2}
                style={{ transformOrigin: `${cx}px ${cy}px` }} />
            ) : null}

            {/* Cell background */}
            <rect x={x} y={y} width={w} height={w} rx={isSpecial ? 7 : 4}
              fill={`${color}${isSpecial ? '28' : '1a'}`}
              stroke={isSpecial ? color : `${color}55`}
              strokeWidth={isSpecial ? 1.5 : 1} />

            {/* Type icon */}
            <text x={cx} y={cy - 5} textAnchor="middle" fontSize={9}>
              {typeInfo.icon}
            </text>

            {/* Cell name */}
            <text
              x={cx} y={cy + 8}
              textAnchor="middle"
              fontSize={cell.name.length > 3 ? 5 : 6}
              fill={isSpecial ? color : 'rgba(203,213,225,0.75)'}
              fontWeight={isSpecial ? 'bold' : 'normal'}
            >
              {cell.name.length > 4 ? cell.name.slice(0, 4) : cell.name}
            </text>
          </g>
        );
      })}

      {/* Player tokens */}
      {players.map((p, pi) => {
        const cell = cells.find(c => c.id === p.position);
        if (!cell) return null;
        const { cx, cy } = cellCenter(cell);
        // Offset tokens if same cell
        const sameCell = userPos === charPos && userPos === p.position;
        const offset = sameCell ? (pi === 0 ? -7 : 7) : 0;
        const isCur = p.id === curId;

        return (
          <g key={p.id}>
            {/* Glow ring for current player */}
            {isCur && (
              <circle
                cx={cx + offset} cy={cy - 7}
                r={9}
                fill={p.color}
                opacity={0.2}
                filter={`url(#glow-${p.id})`} />
            )}
            {/* Token circle */}
            <circle
              cx={cx + offset} cy={cy - 7}
              r={6}
              fill={p.color}
              stroke={isCur ? 'white' : 'rgba(255,255,255,0.35)'}
              strokeWidth={isCur ? 1.5 : 0.8}
              style={{
                filter: isCur ? `drop-shadow(0 0 5px ${p.color})` : 'none',
              }} />
            {/* Token initial */}
            <text
              x={cx + offset} y={cy - 4}
              textAnchor="middle"
              fontSize={6}
              fill="white"
              fontWeight="bold">
              {p.name?.[0] || '?'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
