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
  const id = color.replace('#', '');

  // 深内凹四叉星：控制点落在对角象限，曲线腰部极细
  // 从 top(50,2) → right(98,50)，控制点(38,62) 在左下象限 → 强内凹
  const path = 'M 50 2 Q 38 62, 98 50 Q 38 38, 50 98 Q 62 38, 2 50 Q 62 62, 50 2 Z';

  // 光芒矩形：从 x=-220 到 x=320（宽540），中心 x=50 在 50% 处
  // 纵向同理。用 objectBoundingBox 渐变，白点在 50%。
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 100 100"
      style={{ overflow: 'visible', opacity, ...style }}
      className={className}
    >
      <defs>
        {/* 横向光芒 */}
        <linearGradient id={`hs-${id}`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%"   stopColor={color} stopOpacity="0" />
          <stop offset="44%"  stopColor={color} stopOpacity="0.18" />
          <stop offset="49%"  stopColor="white" stopOpacity="0.85" />
          <stop offset="50%"  stopColor="white" stopOpacity="1" />
          <stop offset="51%"  stopColor="white" stopOpacity="0.85" />
          <stop offset="56%"  stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        {/* 纵向光芒 */}
        <linearGradient id={`vs-${id}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stopColor={color} stopOpacity="0" />
          <stop offset="44%"  stopColor={color} stopOpacity="0.18" />
          <stop offset="49%"  stopColor="white" stopOpacity="0.85" />
          <stop offset="50%"  stopColor="white" stopOpacity="1" />
          <stop offset="51%"  stopColor="white" stopOpacity="0.85" />
          <stop offset="56%"  stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        {/* 星体填充 */}
        <radialGradient id={`sf-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="white" stopOpacity="1" />
          <stop offset="22%"  stopColor="white" stopOpacity="0.95" />
          <stop offset="52%"  stopColor={color} stopOpacity="0.80" />
          <stop offset="82%"  stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </radialGradient>
      </defs>

      {/* 主光芒：宽8，延伸至±220 */}
      <rect x="-220" y="46"   width="540" height="8"   rx="4"   fill={`url(#hs-${id})`} />
      <rect x="46"   y="-220" width="8"   height="540" rx="4"   fill={`url(#vs-${id})`} />
      {/* 细光芒：宽3，略短，叠加亮度 */}
      <rect x="-170" y="48.5" width="440" height="3"   rx="1.5" fill={`url(#hs-${id})`} opacity="0.55" />
      <rect x="48.5" y="-170" width="3"   height="440" rx="1.5" fill={`url(#vs-${id})`} opacity="0.55" />

      {/* 星体 */}
      <path d={path} fill={`url(#sf-${id})`} />

      {/* 核心亮点：小而极亮 */}
      <circle cx="50" cy="50" r="3.5" fill="white" opacity="0.95" />
      <circle cx="50" cy="50" r="1.5" fill="white" opacity="1" />
    </svg>
  );
};
