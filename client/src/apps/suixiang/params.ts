// ══════════════════════════════════════════════════════════════════════════════
// 随想溪流场景 — 可调参数
// 修改这里可以直接改变视觉效果，无需动其他文件中的逻辑代码
// ══════════════════════════════════════════════════════════════════════════════

// ── 水面晃动（浮在水面的小幅波动，不影响整体漂移路径）──────────────────────
export const FLOAT_BOB_DURATION_MIN = 5;      // 最短晃动周期(秒)
export const FLOAT_BOB_DURATION_MAX = 15;      // 最长晃动周期(秒)
export const FLOAT_BOB_X            = 10;      // 晃动横向幅度(px)
export const FLOAT_BOB_Y            = 2;      // 晃动纵向幅度(px)

// ── 素材旋转（独立动画层，有时摆动有时打旋）──────────────────────────────────
export const SPIN_CHANCE   = 0.25;  // 打旋概率 (0~1)，约1/4的素材会整圈旋转
export const SPIN_MAX_DEG  = 270;   // 打旋幅度(deg)：360=转整圈，180=半圈
export const SPIN_DUR_MIN  = 8;    // 旋转周期最短(秒)
export const SPIN_DUR_MAX  = 20;    // 旋转周期最长(秒)

// ── 素材互斥（水面张力：靠太近会互相推开）────────────────────────────────────
export const REPEL_RADIUS  = 55;    // 感应半径(px)，进入此范围才开始互斥

// ── 素材图尺寸（用户说改后自己微调，在这里改参数）──────────────────────────
// "完整的花大小改成现在的1/4" → 16px（原64px的1/4）
// "花瓣绿叶大小是改后花的1/2" → 8px
export const ITEM_SIZE_FLOWER  = 25;          // 完整花朵尺寸(px)：白花1/2, 粉花1/2
export const ITEM_SIZE_SMALL   = 25;          // 花瓣/绿叶尺寸(px)：花瓣1/2, 嫩叶
// 顺序与 FloatingItem.tsx 中 ITEM_IMAGES 数组一致：
// [嫩叶, 白花1, 白花2, 粉花1, 粉花2, 花瓣1, 花瓣2]
export const ITEM_SIZES = [
  ITEM_SIZE_SMALL,   // 0: 嫩叶
  ITEM_SIZE_FLOWER,  // 1: 白花1
  ITEM_SIZE_FLOWER,  // 2: 白花2
  ITEM_SIZE_FLOWER,  // 3: 粉花1
  ITEM_SIZE_FLOWER,  // 4: 粉花2
  ITEM_SIZE_SMALL,   // 5: 花瓣1
  ITEM_SIZE_SMALL,   // 6: 花瓣2
];
export const ITEM_SHADOW = '0 2px 8px rgba(15,50,25,0.55)'; // drop-shadow

// ── 素材融合滤镜（让精拍素材融入水面环境）────────────────────────────────────
// sepia + hue-rotate → 往青绿色调偏移；saturate → 降艳；brightness → 压暗匹配水面
// blur → 柔化过于锋利的边缘（0 = 不模糊）
export const ITEM_SEPIA      = 0.18;   // 0~1，加暖黄底色再 hue-rotate 出绿
export const ITEM_HUE_ROTATE = 22;    // deg，正值偏绿，负值偏红
export const ITEM_SATURATE   = 0.88;  // <1 降艳，>1 增艳
export const ITEM_BRIGHTNESS = 0.88;  // <1 压暗，让素材不那么"漂浮在空中"
export const ITEM_EDGE_BLUR  = 0.5;   // px，柔化边缘；0 关闭

// ── 单击标题 ──────────────────────────────────────────────────────────────────
export const TITLE_HOLD_MS      = 5000;       // 竖排标题显示时长(ms)
export const TITLE_FONT_SIZE    = 13;         // 字号(px)
export const TITLE_MAX_CHARS    = 12;         // 超出截断上限
export const TITLE_COLOR        = 'rgba(255,254,240,0.95)';
export const TITLE_SHADOW       = '0 1px 5px rgba(10,50,20,0.85)';
export const TITLE_FONT_FAMILY  = "'Noto Serif SC', 'Songti SC', serif";

// ── 双击时间阈值 ─────────────────────────────────────────────────────────────
export const DBLCLICK_MS        = 250;        // 两次点击间隔小于此值视为双击(ms)

// ── 半透明弹窗 ────────────────────────────────────────────────────────────────
export const MODAL_BG           = 'rgba(252,248,236,0.90)';
export const MODAL_BLUR         = '16px';
export const MODAL_BORDER       = '1px solid rgba(180,160,110,0.35)';
export const MODAL_MAX_HEIGHT   = '80%';

// ── 搜索 ──────────────────────────────────────────────────────────────────────
export const SEARCH_FADE_OPACITY = 0.10;
export const SEARCH_BAR_BG      = 'rgba(235,248,238,0.88)';

// ── UI 配色 ───────────────────────────────────────────────────────────────────
export const UI_GREEN           = '#5a9e72';
export const UI_BTN_BG          = 'rgba(255,255,255,0.22)';
export const UI_BTN_BORDER      = 'rgba(255,255,255,0.45)';

// ── 物理速度 ──────────────────────────────────────────────────────────────────
export const PHYS_SPEED_MIN = 30;    // 最慢漂速(px/s)，增大让素材流得更快
export const PHYS_SPEED_MAX = 55;    // 最快漂速(px/s)

// ── 入场强制向下区（顶部这么多像素内忽略流场角度，保证素材能顺利入画）──────
export const ENTRY_FORCE_ZONE_PX = 120;  // 顶部 120px 内强制向下(90°)，再往下才走流场

// ── 入场间隔（素材依次从顶部漂入，控制相邻两个之间的时间差）──────────────
export const ENTRY_INTERVAL_MIN = 3;   // 相邻素材入场最短间隔(秒)
export const ENTRY_INTERVAL_MAX = 3.0;   // 相邻素材入场最长间隔(秒)
// 增大两者可让素材"一个一个地"陆续出现；减小则几乎同时涌入

// ── 漂浮物水平泳道（% 宽度，参考溪流底图水流走向）──────────────────────────
// Y 方向由顺流动画控制，此处只定义 X 泳道
export const FLOW_LANES: number[] = [
  25, 45, 35, 52, 28, 42, 38, 48, 30, 55, 32, 50, 40, 27, 44, 36,
];
