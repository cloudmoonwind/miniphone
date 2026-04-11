/**
 * 日历 — 日历视图 + 备忘录/日程
 *
 * 布局：
 *   - 顶部：月份导航
 *   - 中部：月历格子（有事件的日期显示色点）
 *   - 下部：选中日期的事件列表 + 添加按钮
 *   - 弹窗：新增/编辑事件
 */
import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, Clock, AlignLeft, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const api = (path, opts = {}) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const EVENT_TYPES = {
  event:    { label: '事件',   color: '#3b82f6', bg: '#dbeafe' },
  todo:     { label: '待办',   color: '#22c55e', bg: '#dcfce7' },
  reminder: { label: '提醒',   color: '#f59e0b', bg: '#fef3c7' },
};

const COLOR_PRESETS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// ── 月历组件 ──────────────────────────────────────────────────────────────────
const MonthCalendar = ({ year, month, events, selectedDate, onSelectDate }) => {
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 事件日期 → 颜色列表
  const eventsByDate = {};
  events.forEach(e => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    if (!eventsByDate[e.date].includes(e.color)) eventsByDate[e.date].push(e.color);
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const ds = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div className="px-4">
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`text-center text-[10px] py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const date = ds(d);
          const isToday = date === today;
          const isSel = date === selectedDate;
          const colors = eventsByDate[date] || [];
          const dayOfWeek = (firstDay + d - 1) % 7;
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          return (
            <button
              key={date}
              onClick={() => onSelectDate(isSel ? null : date)}
              className={`flex flex-col items-center py-1.5 rounded-xl transition-colors ${
                isSel   ? 'bg-indigo-500' :
                isToday ? 'bg-indigo-50' :
                          'hover:bg-gray-100'
              }`}
            >
              <span className={`text-xs leading-none ${
                isSel   ? 'text-white font-bold' :
                isToday ? 'text-indigo-700 font-bold' :
                isWeekend && dayOfWeek === 0 ? 'text-red-500' :
                isWeekend ? 'text-blue-500' : 'text-gray-700'
              }`}>{d}</span>
              {colors.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {colors.slice(0, 3).map((c, j) => (
                    <span
                      key={j}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.7)' : c }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── 事件编辑弹窗 ──────────────────────────────────────────────────────────────
const EventModal = ({ event, date, onClose, onSave }) => {
  const [title, setTitle]       = useState(event?.title || '');
  const [type, setType]         = useState(event?.type || 'event');
  const [color, setColor]       = useState(event?.color || '#3b82f6');
  const [startTime, setStartTime] = useState(event?.startTime || '');
  const [endTime, setEndTime]   = useState(event?.endTime || '');
  const [notes, setNotes]       = useState(event?.notes || '');
  const [saving, setSaving]     = useState(false);
  const titleRef = useRef(null);

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 100); }, []);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), type, color, startTime: startTime || null, endTime: endTime || null, notes, date });
    } finally { setSaving(false); }
  };

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <motion.div
      className="absolute inset-0 z-30 bg-black/40 flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full bg-white rounded-t-3xl"
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        exit={{ y: 300 }}
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center px-5 pt-5 pb-3 border-b">
          <button onClick={onClose} className="text-sm text-gray-400 mr-3">取消</button>
          <div className="flex-1">
            <p className="text-xs text-gray-400">{displayDate}</p>
          </div>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="text-sm font-bold text-indigo-500 disabled:opacity-40"
          >
            {saving ? '保存中…' : event ? '更新' : '添加'}
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 标题 */}
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="添加标题"
            className="w-full text-lg font-semibold text-gray-800 outline-none placeholder-gray-300 border-b border-gray-100 pb-2"
          />

          {/* 类型 */}
          <div className="flex gap-2">
            {Object.entries(EVENT_TYPES).map(([k, cfg]) => (
              <button
                key={k}
                onClick={() => { setType(k); setColor(cfg.color); }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  type === k ? 'text-white' : 'text-gray-500 bg-gray-100'
                }`}
                style={type === k ? { backgroundColor: cfg.color } : {}}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          {/* 时间 */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={15} className="text-gray-400 shrink-0" />
            <input
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none flex-1"
              placeholder="开始时间"
            />
            <span className="text-gray-300">—</span>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none flex-1"
              placeholder="结束时间"
            />
          </div>

          {/* 颜色 */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-400 shrink-0">颜色</span>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1' : ''}`}
                  style={{ backgroundColor: c, ...(color === c ? { ringColor: c } : {}) }}
                />
              ))}
            </div>
          </div>

          {/* 备注 */}
          <div className="flex gap-2">
            <AlignLeft size={15} className="text-gray-400 shrink-0 mt-1" />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="添加备注"
              rows={2}
              className="flex-1 text-sm text-gray-700 outline-none resize-none placeholder-gray-300 leading-relaxed"
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function CalendarApp({ onBack }) {
  const today = new Date();
  const [year, setYear]       = useState(today.getFullYear());
  const [month, setMonth]     = useState(today.getMonth());
  const [events, setEvents]   = useState([]);
  const [selectedDate, setSelectedDate] = useState(today.toISOString().slice(0, 10));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const loadEvents = async () => {
    const data = await api(`/calendar?month=${monthStr}`);
    setEvents(Array.isArray(data) ? data : []);
  };

  useEffect(() => { loadEvents(); }, [monthStr]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const dayEvents = selectedDate ? events.filter(e => e.date === selectedDate) : [];

  const handleSave = async (data) => {
    if (editingEvent) {
      await api(`/calendar/${editingEvent.id}`, { method: 'PUT', body: JSON.stringify(data) });
    } else {
      await api('/calendar', { method: 'POST', body: JSON.stringify(data) });
    }
    setModalOpen(false);
    setEditingEvent(null);
    await loadEvents();
  };

  const handleToggle = async (event) => {
    await api(`/calendar/${event.id}`, {
      method: 'PUT',
      body: JSON.stringify({ completed: !event.completed }),
    });
    await loadEvents();
  };

  const handleDelete = async (id) => {
    await api(`/calendar/${id}`, { method: 'DELETE' });
    await loadEvents();
  };

  const openNewEvent = () => { setEditingEvent(null); setModalOpen(true); };
  const openEdit = (event) => { setEditingEvent(event); setModalOpen(true); };

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {/* 顶栏 */}
      <div className="h-14 border-b flex items-center px-4 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <Calendar size={18} className="text-indigo-500 mr-2" />
        <span className="font-bold text-gray-800 flex-1">日历</span>
        <button
          onClick={openNewEvent}
          className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center"
        >
          <Plus size={16} color="white" />
        </button>
      </div>

      {/* 月份导航 */}
      <div className="flex items-center px-4 py-3 shrink-0">
        <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={16} className="text-gray-500" />
        </button>
        <button
          className="flex-1 text-center text-base font-bold text-gray-800"
          onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDate(today.toISOString().slice(0, 10)); }}
        >
          {year}年 {month + 1}月
        </button>
        <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-full">
          <ChevronRight size={16} className="text-gray-500" />
        </button>
      </div>

      {/* 月历 */}
      <MonthCalendar
        year={year} month={month}
        events={events}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="mx-4 mt-3 h-px bg-gray-100 shrink-0" />

      {/* 选中日期事件列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {selectedDate ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
              </p>
              <button
                onClick={openNewEvent}
                className="flex items-center gap-1 text-xs text-indigo-500 font-semibold"
              >
                <Plus size={13} /> 添加
              </button>
            </div>

            {dayEvents.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-gray-300 gap-2">
                <Calendar size={32} strokeWidth={1} />
                <p className="text-sm">暂无日程</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayEvents.map(event => {
                  const typeConf = EVENT_TYPES[event.type] || EVENT_TYPES.event;
                  return (
                    <motion.div
                      key={event.id}
                      layout
                      className="group flex items-start gap-3 rounded-2xl px-4 py-3 border"
                      style={{ borderColor: event.color + '40', backgroundColor: event.color + '08' }}
                    >
                      {/* 完成勾选（仅 todo 类型） */}
                      {event.type === 'todo' ? (
                        <button
                          onClick={() => handleToggle(event)}
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                          style={{ borderColor: event.color, backgroundColor: event.completed ? event.color : 'transparent' }}
                        >
                          {event.completed && <Check size={11} color="white" />}
                        </button>
                      ) : (
                        <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: event.color }} />
                      )}

                      <div className="flex-1 min-w-0" onClick={() => openEdit(event)}>
                        <p className={`text-sm font-semibold text-gray-800 leading-tight ${event.completed ? 'line-through text-gray-400' : ''}`}>
                          {event.title}
                        </p>
                        {(event.startTime || event.endTime) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {event.startTime}{event.endTime ? ` — ${event.endTime}` : ''}
                          </p>
                        )}
                        {event.notes && (
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{event.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: typeConf.bg, color: typeConf.color }}
                        >
                          {typeConf.label}
                        </span>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-full transition-opacity"
                        >
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 text-center mt-8">点击日期查看日程</p>
        )}
      </div>

      {/* 事件编辑弹窗 */}
      <AnimatePresence>
        {modalOpen && (
          <EventModal
            event={editingEvent}
            date={selectedDate || today.toISOString().slice(0, 10)}
            onClose={() => { setModalOpen(false); setEditingEvent(null); }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
