/**
 * Avatar — 头像展示组件（只读）
 *
 * 显示规则：
 *   - value 是 data URL 或 http URL → <img>
 *   - 否则 → SVG 人形占位（用名字首字取色）
 */
import { User } from 'lucide-react';

const NAME_COLORS = [
  'bg-violet-100 text-violet-400',
  'bg-sky-100 text-sky-400',
  'bg-rose-100 text-rose-400',
  'bg-amber-100 text-amber-400',
  'bg-emerald-100 text-emerald-400',
  'bg-indigo-100 text-indigo-400',
];

function colorFor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return NAME_COLORS[h % NAME_COLORS.length];
}

/**
 * @param {object}  props
 * @param {string}  props.value     头像值（data URL、http URL 或空）
 * @param {string}  [props.name]    角色名，用于生成颜色
 * @param {number}  [props.size=40] 像素尺寸
 * @param {boolean} [props.rounded] true = rounded-full
 * @param {string}  [props.className]
 */
export default function Avatar({ value, name = '', size = 40, rounded = false, className = '' }) {
  const isImage = value && (value.startsWith('data:') || value.startsWith('http'));
  const shape = rounded ? 'rounded-full' : 'rounded-2xl';
  const colors = colorFor(name);

  return (
    <div
      className={`shrink-0 overflow-hidden flex items-center justify-center ${shape} ${isImage ? '' : colors} ${className}`}
      style={{ width: size, height: size }}
    >
      {isImage ? (
        <img src={value} alt={name} className="w-full h-full object-cover" />
      ) : (
        <User size={Math.round(size * 0.45)} />
      )}
    </div>
  );
}
