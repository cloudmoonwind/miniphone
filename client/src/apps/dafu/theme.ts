/**
 * theme.js — 大富翁 App 主题常量 & 配置
 */

export const THEME = {
  益智: {
    bg: '#07111f',
    boardBg: '#0a1830',
    accent: '#d4a017',
    accentSoft: 'rgba(212,160,23,0.15)',
    text: '#bfdbfe',
    scoreLabel: '资金',
    scoreIcon: '💰',
    scoreColor: '#fbbf24',
    cellProp: '#1d4ed8',
    diceBase: '#0f2a4a',
    dicePip: '#d4a017',
    dramaLabel: '剧情',
    dramaLabelColor: '#60a5fa',
    dramaBg: 'rgba(5,15,35,0.97)',
    choiceBg: 'rgba(29,78,216,0.2)',
    choiceBorder: '#2563eb',
    hallBg: 'linear-gradient(160deg, #0d1f3d 0%, #1a2f5a 60%, #0d1f3d 100%)',
    hallBorder: '#d4a017',
    hallTag: '烧脑',
    hallTagBg: 'rgba(212,160,23,0.18)',
    hallTagColor: '#fbbf24',
    hallTitle: '华尔街征途',
    hallSub: '策略 · 商战 · 智慧对决',
    hallIcon: '🏙️',
    modeName: '益智',
  },
  恋爱: {
    bg: '#160a20',
    boardBg: '#1e0d2a',
    accent: '#f472b6',
    accentSoft: 'rgba(244,114,182,0.15)',
    text: '#fce7f3',
    scoreLabel: '心动值',
    scoreIcon: '💕',
    scoreColor: '#f472b6',
    cellProp: '#be185d',
    diceBase: '#4a0e2e',
    dicePip: '#fda4af',
    dramaLabel: '剧情',
    dramaLabelColor: '#f9a8d4',
    dramaBg: 'rgba(30,10,40,0.97)',
    choiceBg: 'rgba(190,24,93,0.2)',
    choiceBorder: '#ec4899',
    hallBg: 'linear-gradient(160deg, #2d0f2f 0%, #4a0f42 60%, #2d0f2f 100%)',
    hallBorder: '#f472b6',
    hallTag: '治愈',
    hallTagBg: 'rgba(244,114,182,0.18)',
    hallTagColor: '#f9a8d4',
    hallTitle: '约会之旅',
    hallSub: '浪漫 · 甜蜜 · 心动时刻',
    hallIcon: '🌸',
    modeName: '恋爱',
  },
  十八禁: {
    bg: '#0e0516',
    boardBg: '#160820',
    accent: '#e879f9',
    accentSoft: 'rgba(232,121,249,0.12)',
    text: '#f3e8ff',
    scoreLabel: '氛围值',
    scoreIcon: '🌡️',
    scoreColor: '#d946ef',
    cellProp: '#7e22ce',
    diceBase: '#3b0a4f',
    dicePip: '#e879f9',
    dramaLabel: '剧情',
    dramaLabelColor: '#d8b4fe',
    dramaBg: 'rgba(10,5,18,0.98)',
    choiceBg: 'rgba(126,34,206,0.2)',
    choiceBorder: '#9333ea',
    hallBg: 'linear-gradient(160deg, #1a0a2e 0%, #2e0a42 60%, #1a0a2e 100%)',
    hallBorder: '#c084fc',
    hallTag: '18+',
    hallTagBg: 'rgba(248,113,113,0.18)',
    hallTagColor: '#f87171',
    hallTitle: '欲望迷宫',
    hallSub: '暧昧 · 探索 · 界限试探',
    hallIcon: '🌙',
    modeName: '十八禁',
  },
};

// Board cell type colors and labels
export const TYPE_COLOR = {
  start:    { base: '#16a34a', label: '起点', icon: '🏁' },
  end:      { base: '#d97706', label: '终点', icon: '⭐' },
  branch:   { base: '#0891b2', label: '岔路', icon: '🔀' },
  event:    { base: '#7c3aed', label: '事件', icon: '💫' },
  chance:   { base: '#d97706', label: '机遇', icon: '🍀' },
  fate:     { base: '#dc2626', label: '命运', icon: '🎭' },
  property: { base: '#2563eb', label: '地点', icon: '🏠' },
  corner:   { base: '#0d9488', label: '路口', icon: '🔄' },
  jail:     { base: '#64748b', label: '禁区', icon: '🔒' },
  station:  { base: '#4f46e5', label: '中转', icon: '🚉' },
  parking:  { base: '#059669', label: '休息', icon: '🅿️' },
};

// Board layout constants
export const CELL_W = 46;
export const BOARD_COLS = 6;
export const BOARD_ROWS = 7; // y: 2..8
export const SVG_PAD = 6;
export const SVG_W = BOARD_COLS * CELL_W + SVG_PAD * 2;  // 288
export const SVG_H = BOARD_ROWS * CELL_W + SVG_PAD * 2;  // 334

// Helper: compute SVG center for a cell
export function cellCenter(cell) {
  return {
    cx: cell.x * CELL_W + CELL_W / 2 + SVG_PAD,
    cy: (cell.y - 2) * CELL_W + CELL_W / 2 + SVG_PAD,
  };
}

// BFS: get all reachable cell ids within [minSteps..maxSteps]
export function getReachable(cells, startId, minSteps = 2, maxSteps = 12) {
  const cellMap = Object.fromEntries(cells.map(c => [c.id, c]));
  const reachable = new Set();
  const queue = [{ id: startId, steps: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const { id, steps } = queue.shift();
    const key = `${id}:${steps}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (steps >= minSteps && steps <= maxSteps) reachable.add(id);
    if (steps < maxSteps) {
      const cell = cellMap[id];
      if (cell) {
        for (const nid of (cell.next || [])) {
          queue.push({ id: nid, steps: steps + 1 });
        }
      }
    }
  }
  return reachable;
}

// Die pip positions
export const PIPS = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 24], [70, 24], [30, 50], [70, 50], [30, 76], [70, 76]],
};

// Shared API helper
export const api = (path, opts = {}) =>
  fetch(`/api/dafu${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  }).then(r => r.json());

