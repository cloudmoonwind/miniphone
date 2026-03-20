import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft, Send, AlertCircle, RefreshCw, Pencil, X, Check, Square,
  SlidersHorizontal, ChevronDown, ChevronRight, Trash2, Copy,
  Calendar, FileText, ToggleLeft, ToggleRight, Bot,
} from 'lucide-react';

// 消息合并分隔符（与 server/services/context.js 保持一致）
const MSG_SEP = '\u001E';
import { AnimatePresence, motion } from 'framer-motion';

// --- 呼吸灯动点 ---
const BreathingDots = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % 3), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {[0, 1, 2].map(i => (
        <span key={i} className="inline-block w-1 h-1 rounded-full bg-current transition-opacity duration-300"
          style={{ opacity: step >= i ? 1 : 0.2 }} />
      ))}
    </span>
  );
};

// --- 消息段落切分 ---
const buildSegments = (msgs) => {
  const segs = [];
  for (const msg of msgs) {
    const last = segs[segs.length - 1];
    if (last && last.mode === msg.mode) last.msgs.push(msg);
    else segs.push({ mode: msg.mode, key: `${msg.mode}-${msg.id}`, msgs: [msg] });
  }
  return segs;
};

// --- 上下文菜单项 ---
const CtxItem = ({ icon: Icon, label, destructive = false, onClick }) => (
  <button onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors text-sm font-medium
      ${destructive ? 'text-red-500 active:bg-red-50' : 'text-gray-700 active:bg-gray-50'}`}>
    <Icon size={17} className={destructive ? 'text-red-400' : 'text-gray-400'} />
    {label}
  </button>
);

const DEFAULT_PAGE_SIZE = 30;

// 格式化消息时间戳（仅显示时:分，跨天时加日期）
const formatMsgTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

// --- 无角色提示屏 ---
const ChatNoChar = ({ onBack }) => (
  <div className="flex flex-col h-full bg-gray-50">
    <div className="h-14 bg-white border-b flex items-center px-3 shadow-sm shrink-0">
      <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
        <ChevronLeft size={20} className="text-gray-600" />
      </button>
      <span className="ml-2 font-bold">信息</span>
    </div>
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center text-3xl">💬</div>
      <p className="text-gray-700 font-semibold">还没有选择角色</p>
      <p className="text-gray-400 text-sm leading-relaxed">请先去「结缘」选择一个角色，<br />再点击「发消息」开始聊天</p>
      <button onClick={onBack}
        className="mt-2 px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600">
        去结缘选角色
      </button>
    </div>
  </div>
);

// --- 优雅截断的消息内容组件 ---
const MessageBubbleContent = ({ content }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = content && content.length > 300;

  return (
    <div className="flex flex-col">
      <div
        className={`whitespace-pre-wrap break-words ${!expanded && isLong ? 'line-clamp-[12]' : ''}`}
        style={!expanded && isLong ? {
          display: '-webkit-box',
          WebkitLineClamp: 12,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        } : {}}
      >
        {content}
      </div>
      {isLong && (
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="mt-2 text-xs text-indigo-500 hover:text-indigo-600 self-start font-medium transition-colors">
          {expanded ? '收起内容' : '展开阅读全文...'}
        </button>
      )}
    </div>
  );
};

// ── 月历组件 ─────────────────────────────────────────────────────────────
const CalendarGrid = ({ dateMap, onSelectDate, onViewSummary }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [ym, setYm] = useState(() => {
    // 默认定位到最新有消息的月份
    const dates = Object.keys(dateMap).sort();
    const last = dates[dates.length - 1] || today;
    return { y: +last.slice(0, 4), m: +last.slice(5, 7) - 1 };
  });

  const days = useMemo(() => {
    const { y, m } = ym;
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Mon-first
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cells.push({ d, ds, info: dateMap[ds] || null });
    }
    return cells;
  }, [ym, dateMap]);

  const changeMonth = (delta) => setYm(prev => {
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
        {['一','二','三','四','五','六','日'].map(d => (
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
                  ${info ? 'hover:bg-purple-50 active:bg-purple-100' : 'opacity-20 cursor-default'}
                `}
              >
                <span className={`text-sm font-medium leading-none ${isToday ? 'text-purple-600' : info ? 'text-gray-700' : 'text-gray-300'}`}>{d}</span>
                {info && <span className="text-[8px] text-purple-400 leading-none mt-0.5">{info.count}</span>}
              </button>
              {info && (
                <button onClick={() => onViewSummary(ds)} className="text-gray-300 hover:text-purple-400 transition-colors" title="查看总结">
                  <FileText size={9} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- 主聊天组件（所有 hooks 统一放这里，不违反 Rules of Hooks）---
const ChatMain = ({ onBack, activePreset, initialChar, onNewAIMessage }) => {
  const charId     = initialChar.id;
  const MSGS_KEY   = `ics_msgs_${charId}`;
  const charName   = initialChar.name;
  const charAvatar = initialChar.avatar || '✨';

  // ── 消息 ──
  const [allMessages, setAllMessages]   = useState([]);
  const [pageSize, setPageSize]         = useState(DEFAULT_PAGE_SIZE);
  const [displayStart, setDisplayStart] = useState(0);

  // ── 发送 ──
  const [mode, setMode]           = useState('online');
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [sendError, setSendError] = useState('');

  // ── 消息操作 ──
  const [ctxMenu, setCtxMenu]     = useState(null); // { msgId, sender, content }
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [selMode, setSelMode]     = useState(false);
  const [selIds, setSelIds]       = useState(new Set());

  // ── 段落折叠 ──
  const [segStates, setSegStates] = useState({});
  const summaryInFlight = useRef(new Set());

  // ── 面板 ──
  const [showSettings, setShowSettings]     = useState(false);
  const [showDateSearch, setShowDateSearch] = useState(false);

  // ── 自动总结设置 ──
  const [summarySettings, setSummarySettings] = useState({
    periodicEnabled: false, periodicInterval: 20,
    modeSummaryEnabled: false, dailyEnabled: false,
  });
  // ── 时间戳设置 ──
  const [timestampSettings, setTimestampSettings] = useState({
    sendUserTimestamp: true, sendCharTimestamp: false, syncConfirmed: false, timestampFormat: 'metadata',
  });
  // 跳转到指定消息 id（设置后由 effect 执行滚动）
  const [scrollToMsgId, setScrollToMsgId]     = useState(null);
  // 日期详情（底部弹窗展示某天总结）
  const [dateDetail, setDateDetail]           = useState(null); // { date, summaries, loading }

  const scrollRef       = useRef(null);
  const loadMoreRef     = useRef(null);
  const abortCtrlRef    = useRef(null);
  const longPressTimer  = useRef(null);
  const longPressActive = useRef(false);

  // ── 加载设置（总结 + 时间戳）──
  useEffect(() => {
    fetch(`/api/characters/${charId}/summaries/settings`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSummarySettings(d); })
      .catch(() => {});
    fetch('/api/settings/timestamp')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTimestampSettings(d); })
      .catch(() => {});
  }, [charId]); // eslint-disable-line

  // ── 保存时间戳设置 ──
  const saveTimestampSettings = (patch) => {
    const next = { ...timestampSettings, ...patch };
    setTimestampSettings(next);
    fetch('/api/settings/timestamp', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => {});
  };

  // ── 保存自动总结设置 ──
  const saveSummarySettings = (patch) => {
    const next = { ...summarySettings, ...patch };
    setSummarySettings(next);
    fetch(`/api/characters/${charId}/summaries/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    }).catch(() => {});
  };

  // ── 滚动到指定消息 ──
  useEffect(() => {
    if (!scrollToMsgId) return;
    const el = document.getElementById(`msg-${scrollToMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToMsgId(null);
    }
  }, [scrollToMsgId, allMessages]);

  // ── 跳转到指定日期（第一条消息）──
  const gotoDate = (date) => {
    const firstMsg = allMessages.find(m => m.timestamp?.startsWith(date));
    if (!firstMsg) return;
    const idx = allMessages.findIndex(m => m.id === firstMsg.id);
    setDisplayStart(Math.max(0, idx - 1));
    setShowDateSearch(false);
    setScrollToMsgId(firstMsg.id);
  };

  // ── 加载某天的总结详情 ──
  const loadDateDetail = async (date) => {
    setDateDetail({ date, summaries: [], loading: true });
    try {
      const res = await fetch(`/api/characters/${charId}/summaries/by-date?date=${date}`);
      const summaries = res.ok ? await res.json() : [];
      setDateDetail({ date, summaries, loading: false });
    } catch {
      setDateDetail({ date, summaries: [], loading: false });
    }
  };

  // ── 触发某天的日总结生成 ──
  const generateDailySummary = async (date) => {
    setDateDetail(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/characters/${charId}/summaries/generate-daily`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      const data = res.ok ? await res.json() : null;
      if (data && !data.skipped) {
        setDateDetail(prev => ({ ...prev, summaries: [...(prev?.summaries || []), data], loading: false }));
      } else {
        await loadDateDetail(date); // 刷新
      }
    } catch {
      setDateDetail(prev => ({ ...prev, loading: false }));
    }
  };

  // ── 加载消息 ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/characters/${charId}/messages?limit=500`);
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) {
            setAllMessages(data);
            setDisplayStart(Math.max(0, data.length - pageSize));
            return;
          }
        }
      } catch {}
      try {
        const cached = JSON.parse(localStorage.getItem(MSGS_KEY) || '[]');
        setAllMessages(cached);
        setDisplayStart(Math.max(0, cached.length - pageSize));
      } catch {}
    })();
  }, [charId]); // eslint-disable-line

  // ── 新消息时滚到底（不在选择/菜单模式时）──
  useEffect(() => {
    if (!selMode && !ctxMenu) scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  // ── 滚到顶自动加载更多 ──
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && displayStart > 0)
        setDisplayStart(p => Math.max(0, p - pageSize));
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [displayStart, pageSize]);

  const messages = allMessages.slice(displayStart);
  const hasMore  = displayStart > 0;

  // ── 保存用户消息（不触发 AI，支持五分钟内合并）──
  const saveUserMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    const userContent = input.trim();
    setInput('');
    setSendError('');

    // 乐观展示（tmp id）
    const tmpId = `tmp-${Date.now()}`;
    setAllMessages(prev => [...prev, {
      id: tmpId, sender: 'user', content: userContent, mode,
      timestamp: new Date().toISOString(),
    }]);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userContent, mode, characterId: charId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const savedMsg = await res.json();

      if (savedMsg.merged) {
        // 合并到已有消息：移除 tmp，更新原消息
        setAllMessages(prev =>
          prev.filter(m => m.id !== tmpId).map(m => m.id === savedMsg.id ? savedMsg : m)
        );
      } else {
        // 替换 tmp 为真实消息
        setAllMessages(prev => prev.map(m => m.id === tmpId ? savedMsg : m));
      }
    } catch (err) {
      setSendError(err.message);
      setAllMessages(prev => prev.filter(m => m.id !== tmpId));
    }
  };

  // ── 内部：读取 SSE 流，实时更新 tmpId 消息 ──
  const readSSEStream = async (res, tmpId) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let realId = null;
    let finalTimestamp = null;
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.error) throw new Error(data.error);
          if (data.delta) {
            accumulated += data.delta;
            const snap = accumulated;
            setAllMessages(prev => prev.map(m => m.id === tmpId ? { ...m, content: snap } : m));
          }
          if (data.done) { realId = data.id; finalTimestamp = data.timestamp; }
        } catch (e) { if (e.name !== 'SyntaxError') throw e; }
      }
    }
    return { realId, finalTimestamp, accumulated };
  };

  // ── 触发 AI 回复（使用已保存的消息作为上下文）──
  const triggerAI = async () => {
    if (sending) return;
    setSending(true);
    setSendError('');
    abortCtrlRef.current = new AbortController();
    const useStream = activePreset?.stream ?? false;

    if (useStream) {
      const tmpId = `tmp-ai-${Date.now()}`;
      setAllMessages(prev => [...prev, {
        id: tmpId, sender: 'character', content: '', mode,
        timestamp: new Date().toISOString(),
      }]);
      try {
        const res = await fetch('/api/chat/respond', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          signal: abortCtrlRef.current.signal,
          body: JSON.stringify({
            characterId: charId, mode, stream: true,
            contextMode: activePreset?.contextMode,
            apiKey: activePreset?.apiKey, baseURL: activePreset?.baseURL,
            model: activePreset?.model, params: activePreset?.params,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        const { realId, finalTimestamp, accumulated } = await readSSEStream(res, tmpId);
        if (realId) {
          setAllMessages(prev => prev.map(m => m.id === tmpId ? { ...m, id: realId, timestamp: finalTimestamp } : m));
          onNewAIMessage?.(initialChar, accumulated);
        }
      } catch (err) {
        setAllMessages(prev => prev.filter(m => m.id !== tmpId));
        if (err.name === 'AbortError') {
          setSendError('已手动中止生成');
        } else {
          setSendError(err.message);
          setAllMessages(prev => [...prev, {
            id: `err-${Date.now()}`, sender: 'character',
            content: `（AI回复失败：${err.message}）`, mode, timestamp: new Date().toISOString(),
          }]);
        }
      } finally { setSending(false); }
      return;
    }

    // 非流式
    try {
      const res = await fetch('/api/chat/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortCtrlRef.current.signal,
        body: JSON.stringify({
          characterId: charId, mode,
          contextMode: activePreset?.contextMode,
          apiKey:  activePreset?.apiKey,
          baseURL: activePreset?.baseURL,
          model:   activePreset?.model,
          params:  activePreset?.params,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const aiMsg = await res.json();
      setAllMessages(prev => [...prev, { ...aiMsg, mode }]);
      onNewAIMessage?.(initialChar, aiMsg.content);
    } catch (err) {
      if (err.name === 'AbortError') {
        setSendError('已手动中止生成');
      } else {
        setSendError(err.message);
        setAllMessages(prev => [...prev, {
          id: `err-${Date.now()}`, sender: 'character',
          content: `（AI回复失败：${err.message}）`,
          mode, timestamp: new Date().toISOString(),
        }]);
      }
    } finally {
      setSending(false);
    }
  };

  // ── 长按检测 ──
  const onMsgPressStart = (msg) => {
    longPressActive.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressActive.current = true;
      if (selMode) toggleSelect(msg.id);
      else setCtxMenu({ msgId: msg.id, sender: msg.sender, content: msg.content });
    }, 500);
  };
  const onMsgPressEnd = () => clearTimeout(longPressTimer.current);
  const onMsgClick    = (msg) => {
    if (longPressActive.current) return;
    if (selMode) toggleSelect(msg.id);
  };

  // ── 选择模式 ──
  const toggleSelect = (id) => {
    setSelIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (!next.size) setSelMode(false);
      return next;
    });
  };
  const enterSelMode = (id) => { setSelMode(true); setSelIds(new Set([id])); };
  const exitSelMode  = () => { setSelMode(false); setSelIds(new Set()); };
  const selectAll    = () => setSelIds(new Set(messages.map(m => m.id)));

  // ── 删除消息 ──
  const deleteMessages = async (ids) => {
    setAllMessages(prev => prev.filter(m => !ids.has(m.id)));
    const realIds = [...ids].filter(id => !String(id).startsWith('tmp-') && !String(id).startsWith('err-'));
    await Promise.all(realIds.map(id =>
      fetch(`/api/messages/${id}`, { method: 'DELETE' }).catch(() => {})
    ));
  };

  // ── 编辑消息 ──
  const startEdit = (msg) => { setEditingId(msg.id); setEditDraft(msg.content); setCtxMenu(null); };
  const saveEdit  = async () => {
    const id = editingId;
    const content = editDraft.trim();
    if (!content) { setEditingId(null); return; }
    setAllMessages(prev => prev.map(m => m.id === id ? { ...m, content } : m));
    setEditingId(null);
    if (!String(id).startsWith('tmp-') && !String(id).startsWith('err-')) {
      await fetch(`/api/messages/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      }).catch(() => {});
    }
  };

  // ── 重新生成 AI 回复（删除旧回复，用 /respond 重新请求）──
  const regenerate = async (msgId) => {
    setCtxMenu(null);
    const target = allMessages.find(m => m.id === msgId);
    const targetMode = target?.mode || mode;
    setAllMessages(prev => prev.filter(m => m.id !== msgId));
    if (!String(msgId).startsWith('tmp-') && !String(msgId).startsWith('err-')) {
      await fetch(`/api/messages/${msgId}`, { method: 'DELETE' }).catch(() => {});
    }
    setSending(true); setSendError('');
    abortCtrlRef.current = new AbortController();
    const useStream = activePreset?.stream ?? false;
    const body = {
      characterId: charId, mode: targetMode,
      contextMode: activePreset?.contextMode,
      apiKey: activePreset?.apiKey, baseURL: activePreset?.baseURL,
      model: activePreset?.model, params: activePreset?.params,
    };

    if (useStream) {
      const tmpId = `tmp-ai-${Date.now()}`;
      setAllMessages(prev => [...prev, {
        id: tmpId, sender: 'character', content: '', mode: targetMode,
        timestamp: new Date().toISOString(),
      }]);
      try {
        const res = await fetch('/api/chat/respond', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          signal: abortCtrlRef.current.signal,
          body: JSON.stringify({ ...body, stream: true }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
        const { realId, finalTimestamp, accumulated } = await readSSEStream(res, tmpId);
        if (realId) {
          setAllMessages(prev => prev.map(m => m.id === tmpId ? { ...m, id: realId, timestamp: finalTimestamp } : m));
          onNewAIMessage?.(initialChar, accumulated);
        }
      } catch (err) {
        setAllMessages(prev => prev.filter(m => m.id !== tmpId));
        if (err.name !== 'AbortError') setSendError(err.message);
      } finally { setSending(false); }
      return;
    }

    try {
      const res = await fetch('/api/chat/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: abortCtrlRef.current.signal,
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      const aiMsg = await res.json();
      setAllMessages(prev => [...prev, { ...aiMsg, mode: targetMode }]);
      onNewAIMessage?.(initialChar, aiMsg.content);
    } catch (err) {
      if (err.name !== 'AbortError') setSendError(err.message);
    } finally {
      setSending(false);
    }
  };

  // ── 段落总结 ──
  const requestSummary = async (key, msgs) => {
    if (summaryInFlight.current.has(key)) return;
    summaryInFlight.current.add(key);
    setSegStates(prev => ({ ...prev, [key]: { ...prev[key], summaryStatus: 'loading' } }));
    const validIds = msgs.map(m => m.id).filter(id => id && !String(id).startsWith('tmp-') && !String(id).startsWith('err-'));
    try {
      const res = await fetch(`/api/characters/${charId}/summaries/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageIds: validIds.length > 0 ? validIds : undefined,
          periodFrom: validIds.length === 0 ? msgs[0]?.timestamp : undefined,
          periodTo:   validIds.length === 0 ? msgs[msgs.length - 1]?.timestamp : undefined,
          level: 'segment', type: 'conversation',
          apiKey: activePreset?.apiKey, baseURL: activePreset?.baseURL, model: activePreset?.model,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSegStates(prev => ({ ...prev, [key]: { ...prev[key], summaryStatus: 'ready', summary: data.content } }));
    } catch {
      setSegStates(prev => ({ ...prev, [key]: { ...prev[key], summaryStatus: 'failed' } }));
    } finally {
      summaryInFlight.current.delete(key);
    }
  };

  const toggleSeg = (key, msgs) => {
    const cur = segStates[key] || {};
    const nowCollapsed = !cur.collapsed;
    setSegStates(prev => ({ ...prev, [key]: { ...prev[key], collapsed: nowCollapsed } }));
    if (nowCollapsed && !cur.summaryStatus) requestSummary(key, msgs);
  };

  const collapseAll = () => {
    const updates = {};
    segments.forEach(seg => {
      const cur = segStates[seg.key] || {};
      updates[seg.key] = { ...cur, collapsed: true };
      if (!cur.summaryStatus) requestSummary(seg.key, seg.msgs);
    });
    setSegStates(prev => ({ ...prev, ...updates }));
  };

  const segments = useMemo(() => buildSegments(messages), [messages]);

  // 按日期汇总（从全量消息里算，不受分页影响）
  const dateSummaryList = useMemo(() => {
    const map = {};
    for (const msg of allMessages) {
      const date = msg.timestamp?.slice(0, 10);
      if (!date) continue;
      if (!map[date]) map[date] = { date, count: 0, firstMsgId: msg.id };
      map[date].count++;
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }, [allMessages]);

  const dateMap = useMemo(() =>
    Object.fromEntries(dateSummaryList.map(i => [i.date, i])),
  [dateSummaryList]);

  // ── 渲染单条消息
  //    isSubsequent: 是否为合并消息组的后续子消息（隐藏头像/名称）
  //    withId: 是否在外层 div 加 id 属性（renderMsgGroup 自己管理 id 时传 false）
  //    overrideShowTime: 强制覆盖时间戳显示（null=默认，true=显示，false=隐藏）
  const renderMsg = (msg, segMode, isSubsequent = false, withId = true, overrideShowTime = null, noUserAvatar = false) => {
    const isSel    = selIds.has(msg.id);
    const isEdit   = editingId === msg.id;
    const isErr    = String(msg.id).startsWith('err-');

    const inner = isEdit ? (
      /* 内联编辑框 */
      <div className={`flex flex-col gap-1.5 ${msg.sender === 'user' ? 'items-end' : 'items-start pl-9'}`}>
        <textarea autoFocus value={editDraft}
          onChange={e => setEditDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
            if (e.key === 'Escape') setEditingId(null);
          }}
          rows={3}
          className="w-full max-w-[80%] px-3 py-2 text-sm border-2 border-blue-300 rounded-2xl focus:outline-none resize-none leading-relaxed"
        />
        <div className="flex gap-2">
          <button onClick={() => setEditingId(null)} className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600">
            <X size={11} /> 取消
          </button>
          <button onClick={saveEdit} className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700">
            <Check size={11} /> 保存
          </button>
        </div>
      </div>
    ) : segMode === 'offline' ? (
      /* 线下：文学叙事排版 */
      <div className={`p-3 rounded-xl text-sm leading-relaxed shadow-sm ${
        msg.sender === 'user'
          ? 'bg-amber-100/70 border-l-4 border-amber-400 ml-4'
          : isErr
            ? 'bg-red-50 border-l-4 border-red-300 mr-4 text-red-500'
            : 'bg-white/90 border-l-4 border-purple-400 mr-4'
      }`}>
        {!isSubsequent && (
          <span className="font-bold text-[10px] text-gray-400 block mb-1">{msg.sender === 'user' ? '你' : charName}</span>
        )}
        <MessageBubbleContent content={msg.content} />
      </div>
    ) : (
      /* 线上：气泡 */
      <div className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
        {msg.sender !== 'user' && (
          isSubsequent
            ? <div className="w-7 h-7 shrink-0" /> /* 占位，与首条对齐 */
            : <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-sm shrink-0">{charAvatar}</div>
        )}
        <div className={`max-w-[72%] px-3.5 py-2 rounded-2xl text-sm ${
          msg.sender === 'user'
            ? 'bg-sky-500 text-white rounded-br-sm'
            : isErr
              ? 'bg-red-50 text-red-400 border border-red-100 rounded-bl-sm'
              : 'bg-white text-gray-800 shadow-sm rounded-bl-sm border'
        }`}>
          <MessageBubbleContent content={msg.content} />
        </div>
        {msg.sender === 'user' && (
          noUserAvatar
            ? <div className="w-7 h-7 shrink-0" />
            : <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sm shrink-0">🧑</div>
        )}
      </div>
    );

    // 小时间戳：overrideShowTime 优先；否则默认只有首条非子消息显示
    const showTime = overrideShowTime !== null ? overrideShowTime : !isSubsequent;
    const tsText = (!isEdit && showTime)
      ? formatMsgTime(msg.userTimestamp || msg.timestamp) : null;
    const tsEl = tsText
      ? <p className={`text-[10px] text-gray-400 mt-0.5 ${msg.sender === 'user' ? `text-right ${segMode === 'online' ? 'pr-9' : 'pr-1'}` : 'pl-9'}`}>{tsText}</p>
      : null;

    const touchProps = !isEdit ? {
      onMouseDown:  () => onMsgPressStart(msg),
      onMouseUp:    onMsgPressEnd,
      onMouseLeave: onMsgPressEnd,
      onTouchStart: () => onMsgPressStart(msg),
      onTouchEnd:   onMsgPressEnd,
      onClick:      () => onMsgClick(msg),
    } : {};

    const bubble = (
      <div {...touchProps} className={`select-none transition-opacity ${isSel ? 'opacity-60' : ''}`}>
        {inner}
        {tsEl}
      </div>
    );

    if (!selMode) {
      return (
        <div key={msg.id} {...(withId ? { id: `msg-${msg.id}` } : {})}>
          {bubble}
        </div>
      );
    }

    return (
      <div key={msg.id} className={`flex items-center gap-2 py-0.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
        <button onClick={() => toggleSelect(msg.id)}
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            isSel ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
          }`}>
          {isSel && <Check size={10} className="text-white" />}
        </button>
        <div className="flex-1">{bubble}</div>
      </div>
    );
  };

  // ── 渲染消息组（处理 MSG_SEP 合并的多条子消息）──
  const renderMsgGroup = (msg, segMode) => {
    const parts = msg.content.split(MSG_SEP).filter(Boolean);
    if (parts.length <= 1) return renderMsg(msg, segMode, false, true);
    const last = parts.length - 1;
    return (
      <div key={msg.id} id={`msg-${msg.id}`} className="space-y-0.5">
        {parts.map((part, i) =>
          renderMsg(
            { ...msg, content: part, id: `${msg.id}_sub_${i}` },
            segMode,
            i > 0,          // isSubsequent：后续子消息隐藏头像/名称
            false,          // withId
            i === last,     // overrideShowTime：只在最后一条子消息显示时间
            i !== last,     // noUserAvatar：user 头像只在最后一条子消息显示
          )
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════
  return (
    <div className={`flex flex-col h-full transition-colors duration-500 relative ${mode === 'online' ? 'bg-slate-50' : 'bg-amber-50'}`}>

      {/* ── 顶栏 ── */}
      <div className="h-14 bg-white border-b flex items-center px-3 shadow-sm shrink-0 gap-2 z-10">
        {selMode ? (
          <>
            <button onClick={exitSelMode} className="p-2 hover:bg-gray-100 rounded-full"><X size={18} className="text-gray-600" /></button>
            <span className="font-bold flex-1">已选 {selIds.size} 条</span>
            <button onClick={selectAll} className="text-xs text-blue-500 px-2 py-1">全选</button>
          </>
        ) : (
          <>
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-base shrink-0">{charAvatar}</div>
            <span className="font-bold flex-1 truncate">{charName}</span>
            <button onClick={() => { setShowDateSearch(true); setShowSettings(false); }}
              className={`p-2 rounded-full transition-colors ${showDateSearch ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}
              title="按日期查找">
              <Calendar size={18} />
            </button>
            <button onClick={() => { setShowSettings(s => !s); setShowDateSearch(false); }}
              className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}>
              <SlidersHorizontal size={18} />
            </button>
          </>
        )}
      </div>

      {/* ── 消息列表 ── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {hasMore && (
            <div ref={loadMoreRef} className="w-full flex justify-center py-2">
              <span className="text-xs text-blue-400 animate-pulse">↑ 加载更早的消息</span>
            </div>
          )}

          {segments.map(seg => {
            const ss        = segStates[seg.key] || {};
            const collapsed = ss.collapsed ?? false;
            const sumStatus = ss.summaryStatus || 'none';
            const isEditing = ss.editing ?? false;

            return (
              <div key={seg.key} className="space-y-1">
                {/* 段落分隔条 */}
                <div className="flex items-center gap-2 py-1.5 select-none">
                  <div className={`flex-1 h-px ${seg.mode === 'online' ? 'bg-sky-200' : 'bg-amber-200'}`} />
                  <button onClick={() => !selMode && toggleSeg(seg.key, seg.msgs)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                      seg.mode === 'online'
                        ? 'bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100'
                        : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                    }`}>
                    <span>{seg.mode === 'online' ? '📱 线上' : '🌸 线下'}</span>
                    <span className="opacity-60">{seg.msgs.length}条</span>
                    {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  </button>
                  <div className={`flex-1 h-px ${seg.mode === 'online' ? 'bg-sky-200' : 'bg-amber-200'}`} />
                </div>

                {collapsed ? (
                  /* 折叠：总结卡片 */
                  <div className={`mx-1 rounded-xl border shadow-sm p-3 relative min-h-[48px] ${
                    seg.mode === 'online' ? 'bg-sky-50/60 border-sky-100' : 'bg-amber-50/80 border-amber-100'
                  }`}>
                    {(sumStatus === 'ready' || sumStatus === 'failed') && (
                      <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                        <button onClick={() => requestSummary(seg.key, seg.msgs)}
                          className="text-gray-400 hover:text-blue-500 transition-colors" title="重新总结">
                          <RefreshCw size={11} />
                        </button>
                        {sumStatus === 'ready' && !isEditing && (
                          <button onClick={() => setSegStates(prev => ({ ...prev, [seg.key]: { ...prev[seg.key], editing: true, editDraft: ss.summary } }))}
                            className="text-gray-400 hover:text-blue-500 transition-colors" title="编辑总结">
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                    )}
                    {sumStatus === 'loading' && <div className="flex items-center text-xs text-gray-400"><span className="animate-[pulse_1.5s_ease-in-out_infinite]">总结中</span><BreathingDots /></div>}
                    {sumStatus === 'failed'  && <div className="flex items-center gap-1.5 text-xs text-red-400 pr-8"><AlertCircle size={12} /><span>总结失败，点右上角重试</span></div>}
                    {sumStatus === 'none'    && <span className="text-xs text-gray-400 animate-pulse">准备生成总结…<BreathingDots /></span>}
                    {sumStatus === 'ready' && !isEditing && <p className="text-xs text-gray-700 leading-relaxed pr-10">{ss.summary}</p>}
                    {sumStatus === 'ready' && isEditing && (
                      <div className="space-y-1.5">
                        <textarea autoFocus value={ss.editDraft ?? ss.summary}
                          onChange={e => setSegStates(prev => ({ ...prev, [seg.key]: { ...prev[seg.key], editDraft: e.target.value } }))}
                          className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300" rows={3} />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setSegStates(prev => ({ ...prev, [seg.key]: { ...prev[seg.key], editing: false, editDraft: undefined } }))}
                            className="flex items-center gap-0.5 text-[10px] text-gray-400"><X size={9} /> 取消</button>
                          <button onClick={() => setSegStates(prev => ({ ...prev, [seg.key]: { ...prev[seg.key], summary: prev[seg.key].editDraft ?? prev[seg.key].summary, editing: false, editDraft: undefined } }))}
                            className="flex items-center gap-0.5 text-[10px] text-blue-500"><Check size={9} /> 保存</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 展开：消息列表 */
                  <div className="space-y-2 pb-1">
                    {seg.msgs.map(msg => renderMsgGroup(msg, seg.mode))}
                  </div>
                )}
              </div>
            );
          })}

          {/* AI 回复中指示 */}
          {sending && (
            <div className="flex flex-col items-start gap-2 pl-1">
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-sm shrink-0">{charAvatar}</div>
                <div className="bg-white border shadow-sm text-gray-400 text-xs px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center">
                  <span className="animate-[pulse_1.5s_ease-in-out_infinite]">回复中</span><BreathingDots />
                </div>
              </div>
              <button onClick={() => abortCtrlRef.current?.abort()}
                className="ml-9 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-400 border border-red-100 hover:bg-red-100 transition-colors text-xs font-medium">
                <Square size={10} fill="currentColor" /> 中止生成
              </button>
            </div>
          )}

          {/* 发送错误提示 */}
          {sendError && !sending && (
            <div className="flex items-center gap-2 mx-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle size={13} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-500 flex-1 leading-relaxed">{sendError}</p>
              <button onClick={() => setSendError('')} className="text-gray-300 hover:text-gray-500 shrink-0"><X size={12} /></button>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

      {/* 聊天管理面板 - 底部浮层 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 z-30"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl max-h-[80%] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* 拖拽指示条 */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>

              <div className="px-5 pb-6 space-y-4">
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-bold text-gray-800">聊天管理</span>
                  <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 p-1"><X size={16} /></button>
                </div>

                {/* 加载条数 */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">每次加载条数</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={10} max={100} step={10} value={pageSize}
                      onChange={e => setPageSize(+e.target.value)} className="flex-1 accent-purple-500" />
                    <span className="text-xs font-mono text-gray-600 w-6 text-right">{pageSize}</span>
                  </div>
                </div>

                {/* 段落管理 */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">段落管理</label>
                  <button onClick={collapseAll}
                    className="w-full text-sm text-gray-600 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 active:bg-gray-100">
                    折叠全部并生成总结
                  </button>
                </div>

                {/* 自动总结设置 */}
                <div className="border-t pt-3 space-y-3">
                  <label className="text-xs text-gray-500 font-medium block">自动总结</label>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">按条数触发</span>
                      <button onClick={() => saveSummarySettings({ periodicEnabled: !summarySettings.periodicEnabled })}
                        className={summarySettings.periodicEnabled ? 'text-purple-500' : 'text-gray-300'}>
                        {summarySettings.periodicEnabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                    </div>
                    {summarySettings.periodicEnabled && (
                      <div className="flex items-center gap-2 pl-1">
                        <span className="text-xs text-gray-400">每</span>
                        <input type="number" min={5} max={200} value={summarySettings.periodicInterval}
                          onChange={e => saveSummarySettings({ periodicInterval: Math.max(5, +e.target.value) })}
                          className="w-14 text-sm border rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-purple-300"
                        />
                        <span className="text-xs text-gray-400">条触发</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">切模式自动总结</span>
                    <button onClick={() => saveSummarySettings({ modeSummaryEnabled: !summarySettings.modeSummaryEnabled })}
                      className={summarySettings.modeSummaryEnabled ? 'text-purple-500' : 'text-gray-300'}>
                      {summarySettings.modeSummaryEnabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                  </div>
                </div>

                {/* 时间戳设置 */}
                <div className="border-t pt-3 space-y-3">
                  <label className="text-xs text-gray-500 font-medium block">时间戳（发给 AI）</label>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">注入用户时间</span>
                    <button onClick={() => saveTimestampSettings({ sendUserTimestamp: !timestampSettings.sendUserTimestamp })}
                      className={timestampSettings.sendUserTimestamp ? 'text-purple-500' : 'text-gray-300'}>
                      {timestampSettings.sendUserTimestamp ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between opacity-40 pointer-events-none">
                    <span className="text-sm text-gray-700">注入角色时间</span>
                    <ToggleLeft size={22} className="text-gray-300" />
                  </div>

                  {timestampSettings.sendUserTimestamp && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">时间同步（不显示来源）</span>
                        <button onClick={() => saveTimestampSettings({ syncConfirmed: !timestampSettings.syncConfirmed })}
                          className={timestampSettings.syncConfirmed ? 'text-purple-500' : 'text-gray-300'}>
                          {timestampSettings.syncConfirmed ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">最近1小时逐条标注</span>
                        <button onClick={() => saveTimestampSettings({ hotTimestampEnabled: timestampSettings.hotTimestampEnabled === false ? true : false })}
                          className={timestampSettings.hotTimestampEnabled !== false ? 'text-purple-500' : 'text-gray-300'}>
                          {timestampSettings.hotTimestampEnabled !== false ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* 状态信息 */}
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    共 {allMessages.length} 条消息 ·{' '}
                    {initialChar?.id
                      ? <span className="text-green-500">后端存储</span>
                      : <span className="text-amber-500">本地缓存</span>}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 多选底栏 */}
      <AnimatePresence>
        {selMode && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="bg-white border-t px-4 py-3 flex justify-between items-center shrink-0 z-10"
          >
            <button
              disabled={!selIds.size}
              onClick={() => {
                if (window.confirm(`确认删除选中的 ${selIds.size} 条消息？`))
                  deleteMessages(selIds).then(() => exitSelMode());
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-semibold disabled:opacity-40">
              <Trash2 size={14} /> 删除{selIds.size > 0 ? ` ${selIds.size}` : ''}条
            </button>
            <button onClick={exitSelMode} className="text-xs text-gray-400 px-2">取消</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 输入区（选择模式时隐藏） */}
      {!selMode && (
        <div className={`border-t shrink-0 transition-colors duration-300 ${mode === 'online' ? 'bg-white' : 'bg-amber-50'}`}>
          <div className="px-3 pt-2.5 flex items-center gap-2">
            <div className={`flex p-0.5 rounded-full ${mode === 'online' ? 'bg-sky-100' : 'bg-amber-100'}`}>
              <button onClick={() => setMode('online')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${mode === 'online' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400 hover:text-sky-500'}`}>
                📱 线上
              </button>
              <button onClick={() => setMode('offline')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${mode === 'offline' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-400 hover:text-amber-600'}`}>
                🌸 线下
              </button>
            </div>
            <span className="text-[10px] text-gray-400">{mode === 'online' ? '短消息 · 即时互动' : '沉浸叙事 · 场景描写'}</span>
          </div>
          {/* 输入行：文本框 + 发送（存消息）+ Bot（触发 AI）*/}
          <form onSubmit={saveUserMessage} className="p-3 flex gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder={mode === 'online' ? '发消息…' : '描述场景或动作…'}
              className={`flex-1 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${mode === 'online' ? 'bg-gray-100 focus:ring-sky-300' : 'bg-amber-100/80 focus:ring-amber-300'}`} />
            {/* 发送：仅存消息，不触发 AI */}
            <button type="submit" disabled={!input.trim()}
              title="发送（仅存消息）"
              className={`p-2.5 rounded-full text-white transition-colors disabled:opacity-40 ${mode === 'online' ? 'bg-sky-500 hover:bg-sky-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
              <Send size={17} />
            </button>
            {/* Bot：触发 AI 回复 */}
            <button type="button" onClick={triggerAI} disabled={sending}
              title="让 AI 回复"
              className={`p-2.5 rounded-full transition-colors disabled:opacity-40 ${
                sending
                  ? 'bg-purple-200 text-purple-400'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}>
              <Bot size={17} />
            </button>
          </form>
        </div>
      )}

      {/* ── 按日期查找面板 ── */}
      <AnimatePresence>
        {showDateSearch && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-white flex flex-col"
          >
            {/* 顶栏 */}
            <div className="h-14 border-b flex items-center px-3 gap-2 shrink-0 shadow-sm">
              <button onClick={() => setShowDateSearch(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <span className="font-bold flex-1">按日期查找</span>
              <span className="text-xs text-gray-400">{dateSummaryList.length} 天有记录</span>
            </div>

            {/* 日历视图 */}
            <div className="flex-1 overflow-y-auto">
              {dateSummaryList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                  <Calendar size={36} className="opacity-30" />
                  <p className="text-sm">还没有聊天记录</p>
                </div>
              ) : (
                <CalendarGrid
                  dateMap={dateMap}
                  onSelectDate={date => { gotoDate(date); setShowDateSearch(false); }}
                  onViewSummary={loadDateDetail}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 日期总结详情弹窗 ── */}
      <AnimatePresence>
        {dateDetail && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end bg-black/30"
            onClick={() => setDateDetail(null)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="w-full bg-white rounded-t-2xl pb-6 max-h-[80%] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-3" />
              <div className="px-4 pb-2 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">
                  {dateDetail.date && new Date(dateDetail.date + 'T12:00:00').toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} 总结
                </h3>
                <button onClick={() => generateDailySummary(dateDetail.date)}
                  className="text-xs text-purple-500 border border-purple-200 rounded-lg px-2 py-1 hover:bg-purple-50">
                  {dateDetail.loading ? '生成中…' : '生成日总结'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 space-y-3">
                {dateDetail.loading && <p className="text-sm text-gray-400 text-center py-6">加载中…</p>}
                {!dateDetail.loading && dateDetail.summaries.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <FileText size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">当天暂无总结</p>
                    <p className="text-xs mt-1">点击右上角生成日总结</p>
                  </div>
                )}
                {dateDetail.summaries.map(s => (
                  <div key={s.id} className="p-3 rounded-xl border bg-gray-50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        s.type === 'day'      ? 'bg-purple-100 text-purple-600' :
                        s.type === 'mode'     ? 'bg-sky-100 text-sky-600' :
                        s.type === 'periodic' ? 'bg-amber-100 text-amber-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {s.type === 'day' ? '日总结' : s.type === 'mode' ? `${s.modeType === 'online' ? '线上' : '线下'}段` : '阶段'}
                      </span>
                      {s.period?.from && (
                        <span className="text-[10px] text-gray-400">
                          {new Date(s.period.from).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          {s.period.to !== s.period.from && ` — ${new Date(s.period.to).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{s.content}</p>
                    {s.sourceIds?.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1.5">涵盖 {s.sourceIds.length} 条消息</p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 长按上下文菜单 ── */}
      <AnimatePresence>
        {ctxMenu && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/25 z-40"
            onClick={() => setCtxMenu(null)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl pb-2 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-2" />
              {/* 消息预览 */}
              <div className="mx-4 mb-1 px-3 py-2 bg-gray-50 rounded-xl text-xs text-gray-500 leading-relaxed line-clamp-2">
                {ctxMenu.content}
              </div>
              <div className="px-2">
                <CtxItem icon={Copy} label="复制文本"
                  onClick={() => { navigator.clipboard?.writeText(ctxMenu.content).catch(() => {}); setCtxMenu(null); }} />
              <CtxItem icon={Pencil} label="编辑消息"
                onClick={() => startEdit({ id: ctxMenu.msgId, content: ctxMenu.content })} />
                {ctxMenu.sender === 'character' && (
                  <CtxItem icon={RefreshCw} label="重新生成"
                    onClick={() => regenerate(ctxMenu.msgId)} />
                )}
                <CtxItem icon={Check} label="进入多选模式"
                  onClick={() => { enterSelMode(ctxMenu.msgId); setCtxMenu(null); }} />
                <CtxItem icon={Trash2} label="删除此条" destructive
                  onClick={() => { deleteMessages(new Set([ctxMenu.msgId])); setCtxMenu(null); }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- 入口：先判断有无角色，再渲染主体（避免 Hooks 条件违规）---
const ChatApp = ({ onBack, activePreset, initialChar, onNewAIMessage }) => {
  if (!initialChar) return <ChatNoChar onBack={onBack} />;
  return <ChatMain onBack={onBack} activePreset={activePreset} initialChar={initialChar} onNewAIMessage={onNewAIMessage} />;
};

export default ChatApp;
