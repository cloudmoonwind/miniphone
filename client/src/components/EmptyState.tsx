/**
 * EmptyState — 空数据状态占位组件
 *
 * Props:
 *   icon     — lucide 图标组件
 *   title    — 主标题
 *   desc     — 副标题/说明
 *   action   — { label, onClick } 操作按钮（可选）
 */
export default function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Icon size={30} className="text-gray-300" />
        </div>
      )}
      {title && <p className="text-gray-700 font-semibold text-base">{title}</p>}
      {desc && <p className="text-gray-400 text-sm mt-1 leading-relaxed">{desc}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold
            hover:bg-blue-600 active:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
