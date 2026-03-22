/**
 * AppShell — 标准 App 外壳
 *
 * 提供统一的顶部导航栏（返回按钮 + 标题 + 右侧操作区），
 * 避免每个 App 重复实现 header 样式。
 *
 * Props:
 *   onBack       — 返回按钮回调（必填）
 *   title        — 标题文本
 *   titleNode    — 自定义标题节点（覆盖 title）
 *   right        — 右侧内容节点
 *   noBorder     — 去除底部分割线
 *   transparent  — 透明背景（全屏内容类 App）
 *   children     — 主体内容
 */
import { ChevronLeft } from 'lucide-react';

export default function AppShell({
  onBack,
  title,
  titleNode,
  right,
  noBorder = false,
  transparent = false,
  children,
}) {
  return (
    <div className="flex flex-col h-full">
      <header
        className={`
          h-14 flex items-center px-3 shrink-0 z-10
          ${transparent ? '' : 'bg-white'}
          ${noBorder ? '' : 'border-b border-gray-100 shadow-sm'}
        `}
      >
        <button
          onClick={onBack}
          className="p-2 -ml-1 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors"
        >
          <ChevronLeft size={22} className="text-gray-600" />
        </button>

        <div className="flex-1 min-w-0 ml-1">
          {titleNode ?? (
            <h1 className="font-semibold text-gray-800 text-base truncate">{title}</h1>
          )}
        </div>

        {right && <div className="flex items-center gap-1 ml-2">{right}</div>}
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
