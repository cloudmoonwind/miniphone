/**
 * LoadingSpinner — 通用加载状态组件
 *
 * Props:
 *   size    — 尺寸 ('sm' | 'md' | 'lg')，默认 'md'
 *   text    — 加载文字（可选）
 *   center  — 是否垂直居中显示（默认 false）
 */
export default function LoadingSpinner({ size = 'md', text, center = false }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-3' };

  const spinner = (
    <div className={`${sizes[size]} border-gray-200 border-t-blue-400 rounded-full animate-spin`} />
  );

  if (center) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        {spinner}
        {text && <p className="text-gray-400 text-sm">{text}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {spinner}
      {text && <span className="text-gray-400 text-sm">{text}</span>}
    </div>
  );
}
