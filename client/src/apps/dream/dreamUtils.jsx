// 梦境工具函数和常量

export const SKY_RATIO = 0.62; // 天空占整体高度比例

// hex 颜色 → [r, g, b] 整数数组
export const hexRgb = (hex) => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
};

// hex → 0xRRGGBB 整数（PixiJS 用）
export const hexToInt = (hex) => {
  const [r,g,b] = hexRgb(hex);
  return (r << 16) | (g << 8) | b;
};

export const DREAM_TYPES = {
  emotion: { label: '情绪梦', color: '#C8B0C8' },
  omen:    { label: '预示梦', color: '#A898D8' },
  memory:  { label: '回忆梦', color: '#98B0D0' },
  desire:  { label: '欲望梦', color: '#D0B898' },
};

// 用 id 生成 [0,1) 范围内的稳定随机数
export const dreamSeed = (id) => {
  let h = 0x811c9dc5;
  for (const c of String(id)) h = (Math.imul(h ^ c.charCodeAt(0), 0x01000193)) >>> 0;
  return h / 0xffffffff;
};

export const getStarSize = (imp) => imp >= 8 ? 28 : imp >= 5 ? 22 : 16;

/**
 * 二次元四叉尖刺星星 SVG
 * 用 Q 二次贝塞尔，控制点靠近中心，形成内凹弧线
 * outer: 尖端长度, inner: 内凹半径
 */
export const AnimeStar = ({ size, color, opacity = 1, className, style }) => {
  // 四个尖端（上下左右）和四个内凹点（对角）
  // outer=47 inner=8，100x100 viewBox
  const path = 'M 50 3 L 55.6 44.4 L 97 50 L 55.6 55.6 L 50 97 L 44.4 55.6 L 3 50 L 44.4 44.4 Z';
  const glow1 = `0 0 ${size * 0.6}px ${color}`;
  const glow2 = `0 0 ${size * 1.2}px ${color}80`;
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 100 100"
      style={{ overflow: 'visible', opacity, filter: `drop-shadow(${glow1}) drop-shadow(${glow2})`, ...style }}
      className={className}
    >
      <defs>
        <radialGradient id={`asg-${color.replace('#','')}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="white"  stopOpacity="1" />
          <stop offset="30%"  stopColor="white"  stopOpacity="0.9" />
          <stop offset="70%"  stopColor={color}  stopOpacity="0.85" />
          <stop offset="100%" stopColor={color}  stopOpacity="0.4" />
        </radialGradient>
      </defs>
      {/* 外层光晕（大，柔和） */}
      <ellipse cx="50" cy="50" rx="42" ry="42"
        fill={color} opacity="0.12" />
      {/* 星形主体 */}
      <path d={path} fill={`url(#asg-${color.replace('#','')})`} />
      {/* 白热核心 */}
      <circle cx="50" cy="50" r="6" fill="white" opacity="0.95" />
    </svg>
  );
};
