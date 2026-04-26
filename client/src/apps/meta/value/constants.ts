export const CATEGORIES = [
  { value: 'attribute', label: '内在属性', color: '#818cf8' },
  { value: 'status',    label: '动态状态', color: '#34d399' },
  { value: 'emotion',   label: '心理状态', color: '#f472b6' },
  { value: 'relation',  label: '关系类',   color: '#a78bfa' },
  { value: 'social',    label: '社会属性', color: '#60a5fa' },
];

export const VALUE_TYPES = [
  { value: 'continuous', label: '连续数值', desc: '范围内连续取值，如 0–100' },
  { value: 'discrete',   label: '离散状态', desc: '有限选项，如平静 / 喜悦 / 愤怒' },
];

export const TRIGGER_OPTIONS = [
  { value: 'chat_end',       label: '每轮对话结束' },
  { value: 'time_pass',      label: '时间流逝'     },
  { value: 'receive_gift',   label: '收到礼物'     },
  { value: 'event_complete', label: '事件完成'     },
  { value: 'value_change',   label: '数值变化'     },
];

export const OP_OPTIONS = [
  { value: 'add',      label: '加减' },
  { value: 'set',      label: '设为' },
  { value: 'multiply', label: '乘以' },
];

// 浅色星云主题 — 柔和粉彩色系
export const STAGE_PALETTE = [
  '#a5b4fc', // 薰衣草
  '#c4b5fd', // 紫晶
  '#93c5fd', // 天青
  '#f9a8d4', // 樱粉
  '#86efac', // 嫩绿
  '#fda4af', // 玫瑰
  '#fde68a', // 琥珀
  '#67e8f9', // 青瓷
];

export function getCat(cat: string) {
  return CATEGORIES.find(c => c.value === cat) ?? { value: cat, label: cat, color: '#94a3b8' };
}

// 玻璃主题输入样式
export const inputCls    = 'w-full bg-transparent border-b border-slate-300/50 text-slate-700 text-xs py-1 outline-none focus:border-indigo-400/60 placeholder:text-slate-300 transition-colors';
export const selectCls   = 'w-full bg-transparent border-b border-slate-300/50 text-slate-600 text-xs py-1 outline-none focus:border-indigo-400/60 transition-colors';
export const textareaCls = 'w-full bg-white/20 border border-white/40 rounded-xl text-slate-700 text-xs py-2 px-2.5 outline-none focus:border-indigo-300/50 placeholder:text-slate-300 resize-none leading-relaxed';
