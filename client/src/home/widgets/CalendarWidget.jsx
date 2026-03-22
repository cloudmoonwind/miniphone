/**
 * CalendarWidget — 主屏日历小组件（占位）
 *
 * BRIDGE[calendar widget → CalendarApp]：此组件目前只是占位，
 *   后续接入 calendarService.getAll() 展示当月待办/事件高亮。
 *   接入方式：
 *     1. useEffect 获取本月日历事件
 *     2. 渲染简化月历视图，有事件的日期高亮
 *     3. 点击跳转到 CalendarApp
 */
export default function CalendarWidget() {
  return (
    <div className="w-full h-full bg-white/10 rounded-2xl flex items-center justify-center text-white/50 text-sm">
      日历组件
    </div>
  );
}
