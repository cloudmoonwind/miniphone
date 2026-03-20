import React from 'react';
import { Battery, Wifi, Signal } from 'lucide-react';

// --- 组件：状态栏 ---
const StatusBar = () => (
  <div className="h-8 bg-black text-white flex justify-between items-center px-4 text-xs select-none z-50 rounded-t-[2rem]">
    <div className="flex items-center gap-1">
      <span>09:41</span>
    </div>
    <div className="flex items-center gap-2">
      <Signal size={14} />
      <Wifi size={14} />
      <Battery size={14} />
    </div>
  </div>
);

export default StatusBar;
