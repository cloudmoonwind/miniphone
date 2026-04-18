// ══════════════════════════════════════════════════════════════════════════════
// 随想溪流场景 — 可调参数
// 修改这里可以直接改变视觉效果，无需动其他文件中的逻辑代码
// ══════════════════════════════════════════════════════════════════════════════

// ── 流光效果（流光视频.mp4 叠加到水流区域）──────────────────────────────────
export const SHIMMER_OPACITY    = 0.22;        // 视频叠加强度 (0~1，越大越亮)
export const SHIMMER_BLEND      = 'screen';    // CSS mix-blend-mode: 'screen' | 'overlay' | 'luminosity'
export const SHIMMER_VIDEO_FILTER =            // 视频预处理（去色+提亮，只保留亮度信息）
  'grayscale(1) brightness(1.5) contrast(1.1)';

// ── 水面折射扭曲（SVG feTurbulence + feDisplacementMap）────────────────────
export const DISTORT_SCALE      = 5;           // 扭曲强度（像素），越大水波越明显
export const DISTORT_FREQ_X     = 0.008;       // x 方向湍流空间频率，越大纹理越细碎
export const DISTORT_FREQ_Y     = 0.004;       // y 方向湍流空间频率
export const DISTORT_OCTAVES    = 3;           // 湍流叠加层数 (1~5)，越多越自然但更消耗性能
export const DISTORT_DURATION   = '14s';       // 湍流动画一个周期的时长

// ── 漂浮动效 ─────────────────────────────────────────────────────────────────
export const FLOAT_DURATION_MIN = 4;           // 最短漂浮周期（秒）
export const FLOAT_DURATION_MAX = 9;           // 最长漂浮周期（秒）
export const FLOAT_DRIFT_X      = 8;           // 横向漂移幅度（px）
export const FLOAT_DRIFT_Y      = 12;          // 纵向漂移幅度（px）
export const FLOAT_ROTATION     = 7;           // 旋转摆幅（度）
export const ITEM_SIZE          = 64;          // 素材图显示尺寸（px）
export const ITEM_SHADOW        =              // 素材图投影（模拟水面悬浮）
  '0 4px 12px rgba(20,60,30,0.40)';

// ── 单击标题 ──────────────────────────────────────────────────────────────────
export const TITLE_HOLD_MS      = 5000;        // 竖排标题显示时长（ms）
export const TITLE_FONT_SIZE    = 13;          // 字号（px）
export const TITLE_MAX_CHARS    = 12;          // 超出字数截断上限
export const TITLE_COLOR        = 'rgba(255,254,240,0.95)';  // 文字颜色
export const TITLE_SHADOW       = '0 1px 5px rgba(10,50,20,0.85)'; // 文字阴影
export const TITLE_FONT_FAMILY  = "'Noto Serif SC', 'Songti SC', serif"; // 字体

// ── 双击时间阈值 ─────────────────────────────────────────────────────────────
export const DBLCLICK_MS        = 250;         // 两次点击间隔小于此值视为双击（ms）

// ── 半透明弹窗 ────────────────────────────────────────────────────────────────
export const MODAL_BG           = 'rgba(252,248,236,0.90)'; // 弹窗背景色（纸面调）
export const MODAL_BLUR         = '16px';      // 毛玻璃模糊强度
export const MODAL_BORDER       = '1px solid rgba(180,160,110,0.35)'; // 边框
export const MODAL_MAX_HEIGHT   = '80%';       // 弹窗最大高度（相对容器）

// ── 搜索 ──────────────────────────────────────────────────────────────────────
export const SEARCH_FADE_OPACITY = 0.10;       // 不匹配随想的淡出透明度 (0~1)
export const SEARCH_BAR_BG      = 'rgba(235,248,238,0.88)'; // 搜索栏背景

// ── UI 配色 ───────────────────────────────────────────────────────────────────
export const UI_GREEN           = '#5a9e72';   // 返回按钮 / 新建按钮的主色（自然绿）
export const UI_BTN_BG          = 'rgba(255,255,255,0.22)'; // 浮动按钮背景
export const UI_BTN_BORDER      = 'rgba(255,255,255,0.45)'; // 浮动按钮边框

// ── 漂浮位置池（百分比，参考溪流底图1080×1920水流走向分布）────────────────
// 修改这里可以调整随想在画面中的分布区域
export const FLOW_POSITIONS: { x: number; y: number }[] = [
  { x: 19, y: 10 }, { x: 73, y: 8  }, { x: 30, y: 26 }, { x: 84, y: 28 },
  { x: 16, y: 46 }, { x: 88, y: 50 }, { x: 24, y: 63 }, { x: 60, y: 70 },
  { x: 80, y: 78 }, { x: 42, y: 42 }, { x: 67, y: 18 }, { x: 52, y: 55 },
  { x: 38, y: 82 }, { x: 75, y: 60 }, { x: 12, y: 78 }, { x: 55, y: 30 },
];
