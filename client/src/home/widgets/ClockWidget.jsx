import { CloudSun } from 'lucide-react';

/**
 * ClockWidget — 主屏时钟小组件
 *
 * TODO: 接入真实时间（目前写死）
 * TODO: 接入真实天气 API（目前占位）
 *
 * BRIDGE[clock → realtime]：组件已有布局，等待接入：
 *   1. useEffect 刷新当前时间（每分钟）
 *   2. 服务端天气接口（或第三方 API）
 */
export default function ClockWidget() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const dateStr = now.toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'short',
  });

  return (
    <div className="w-full h-full flex flex-col justify-center items-center text-white">
      <h1 className="text-6xl font-light tracking-tight drop-shadow-lg">
        {hours}:{minutes}
      </h1>
      <p className="text-blue-50 text-lg mt-1 drop-shadow-md">{dateStr}</p>
      <div className="flex items-center gap-2 mt-4 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10 shadow-sm">
        <CloudSun size={16} />
        <span className="text-xs font-medium">多云 24°C</span>
      </div>
    </div>
  );
}
