/**
 * ChatCalendar.jsx — 聊天日历视图
 * 从原 ChatApp.jsx 中的 CalendarGrid 提取。
 */
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';

export function CalendarGrid({ dateMap, onSelectDate, onViewSummary }) {
  const today = new Date().toISOString().slice(0, 10);
  const [ym, setYm] = useState(() => {
    const dates = Object.keys(dateMap).sort();
    const last  = dates[dates.length - 1] || today;
    return { y: +last.slice(0, 4), m: +last.slice(5, 7) - 1 };
  });

  const days = useMemo(() => {
    const { y, m } = ym;
    const firstDow    = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ d, ds, info: dateMap[ds] || null });
    }
    return cells;
  }, [ym, dateMap]);

  const changeMonth = (delta) =>
    setYm(prev => {
      const nd = new Date(prev.y, prev.m + delta, 1);
      return { y: nd.getFullYear(), m: nd.getMonth() };
    });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500">
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold text-gray-700">{ym.y}年{ym.m + 1}月</span>
        <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1.5">
        {['一', '二', '三', '四', '五', '六', '日'].map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-2">
        {days.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} />;
          const { d, ds, info } = cell;
          const isToday = ds === today;
          return (
            <div key={ds} className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => info && onSelectDate(ds)}
                disabled={!info}
                className={`w-9 h-9 rounded-full flex flex-col items-center justify-center transition-colors
                  ${isToday ? 'ring-2 ring-purple-400 ring-offset-1' : ''}
                  ${info ? 'hover:bg-purple-50 active:bg-purple-100' : 'opacity-20 cursor-default'}`}
              >
                <span className={`text-sm font-medium leading-none ${
                  isToday ? 'text-purple-600' : info ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  {d}
                </span>
                {info && <span className="text-[8px] text-purple-400 leading-none mt-0.5">{info.count}</span>}
              </button>
              {info && (
                <button
                  onClick={() => onViewSummary(ds)}
                  className="text-gray-300 hover:text-purple-400 transition-colors"
                  title="查看总结"
                >
                  <FileText size={9} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
