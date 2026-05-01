/**
 * useChatState.js — ChatMain 的所有状态与业务逻辑
 *
 * 从 ChatApp.jsx 的 ChatMain 提取，让 ChatMain.jsx 成为纯布局组件。
 *
 * 返回值分三类：
 *   数据状态  — messages, segments, allMessages, dateMap, ...
 *   UI 状态   — mode, input, sending, ctxMenu, selMode, showSettings, ...
 *   操作函数  — saveUserMessage, triggerAI, deleteMessages, toggleSeg, ...
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { buildSegments, DEFAULT_PAGE_SIZE } from './chatFormatters.js';
import { chatService } from '../../services/chat.js';

export function useChatState({ char, activePreset, onNewAIMessage }) {
  const charId   = char?.id;
  const charName = char?.name;
  const MSGS_KEY = `ics_msgs_${charId}`;

  // ── 消息 ──────────────────────────────────────────────────────
  const [allMessages,  setAllMessages]  = useState([]);
  const [pageSize,     setPageSize]     = useState(DEFAULT_PAGE_SIZE);
  const [displayStart, setDisplayStart] = useState(0);

  // ── 发送 ──────────────────────────────────────────────────────
  const [mode,      setMode]      = useState('online');
  const [input,     setInput]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState('');

  // ── 消息操作 ──────────────────────────────────────────────────
  const [ctxMenu,   setCtxMenu]   = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [selMode,   setSelMode]   = useState(false);
  const [selIds,    setSelIds]    = useState(new Set());

  // ── 段落 ──────────────────────────────────────────────────────
  const [segStates, setSegStates] = useState({});
  const summaryInFlight = useRef(new Set());

  // ── 面板 ──────────────────────────────────────────────────────
  const [showSettings,   setShowSettings]   = useState(false);
  const [showDateSearch, setShowDateSearch] = useState(false);
  const [dateDetail,     setDateDetail]     = useState(null);
  const [scrollToMsgId,  setScrollToMsgId]  = useState(null);

  // ── 设置 ──────────────────────────────────────────────────────
  const [summarySettings, setSummarySettings] = useState({
    periodicEnabled: false, periodicInterval: 20,
    modeSummaryEnabled: false, dailyEnabled: false,
  });
  const [timestampSettings, setTimestampSettings] = useState({
    sendUserTimestamp: true, sendCharTimestamp: false,
    syncConfirmed: false, timestampFormat: 'metadata',
  });

  // ── Refs ──────────────────────────────────────────────────────
  const scrollRef       = useRef(null);
  const loadMoreRef     = useRef(null);
  const abortCtrlRef    = useRef(null);
  const longPressTimer  = useRef(null);
  const longPressActive = useRef(false);

  // ── 加载设置 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!charId) return;
    chatService.getSummarySettings(charId)
      .then(d => { if (d) setSummarySettings(d); }).catch(() => {});
    chatService.getTimestampSettings()
      .then(d => { if (d) setTimestampSettings(d); }).catch(() => {});
  }, [charId]); // eslint-disable-line

  // ── 加载消息 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!charId) return;
    (async () => {
      try {
        const data = await chatService.getMessages(charId, { limit: 500 });
        if (data.length > 0) {
          setAllMessages(data);
          setDisplayStart(Math.max(0, data.length - pageSize));
          return;
        }
      } catch {}
      try {
        const cached = JSON.parse(localStorage.getItem(MSGS_KEY) || '[]');
        setAllMessages(cached);
        setDisplayStart(Math.max(0, cached.length - pageSize));
      } catch {}
    })();
  }, [charId]); // eslint-disable-line

  // ── 新消息时滚到底 ────────────────────────────────────────────
  useEffect(() => {
    if (!selMode && !ctxMenu) scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]); // eslint-disable-line

  // ── 滚到顶加载更多 ────────────────────────────────────────────
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

  // ── 滚到指定消息 ──────────────────────────────────────────────
  useEffect(() => {
    if (!scrollToMsgId) return;
    const el = document.getElementById(`msg-${scrollToMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollToMsgId(null);
    }
  }, [scrollToMsgId, allMessages]);

  // ── 派生数据 ──────────────────────────────────────────────────
  const messages = allMessages.slice(displayStart);
  const hasMore  = displayStart > 0;
  const segments = useMemo(() => buildSegments(messages), [messages]);

  const dateSummaryList = useMemo(() => {
    const map: Record<string, { date: string; count: number; firstMsgId: any }> = {};
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

  // ── 设置保存 ──────────────────────────────────────────────────
  const saveSummarySettings = useCallback((patch) => {
    const next = { ...summarySettings, ...patch };
    setSummarySettings(next);
    chatService.updateSummarySettings(charId, next).catch(() => {});
  }, [charId, summarySettings]);

  const saveTimestampSettings = useCallback((patch) => {
    const next = { ...timestampSettings, ...patch };
    setTimestampSettings(next);
    chatService.updateTimestampSettings(next).catch(() => {});
  }, [timestampSettings]);

  // ── 日期跳转 ──────────────────────────────────────────────────
  const gotoDate = useCallback((date) => {
    const firstMsg = allMessages.find(m => m.timestamp?.startsWith(date));
    if (!firstMsg) return;
    const idx = allMessages.findIndex(m => m.id === firstMsg.id);
    setDisplayStart(Math.max(0, idx - 1));
    setShowDateSearch(false);
    setScrollToMsgId(firstMsg.id);
  }, [allMessages]);

  // ── 日期总结加载 ──────────────────────────────────────────────
  const loadDateDetail = useCallback(async (date) => {
    setDateDetail({ date, summaries: [], loading: true });
    try {
      const summaries = await chatService.getSummariesByDate(charId, date);
      setDateDetail({ date, summaries: summaries || [], loading: false });
    } catch {
      setDateDetail({ date, summaries: [], loading: false });
    }
  }, [charId]);

  const generateDailySummary = useCallback(async (date) => {
    setDateDetail(prev => ({ ...prev, loading: true }));
    try {
      const data = await chatService.generateDailySummary(charId, date);
      if (data && !data.skipped) {
        setDateDetail(prev => ({ ...prev, summaries: [...(prev?.summaries || []), data], loading: false }));
      } else {
        await loadDateDetail(date);
      }
    } catch {
      setDateDetail(prev => ({ ...prev, loading: false }));
    }
  }, [charId, loadDateDetail]);

  // ── 保存用户消息（两阶段第1步）────────────────────────────────
  const saveUserMessage = useCallback(async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    const userContent = input.trim();
    setInput('');
    setSendError('');

    const tmpId = `tmp-${Date.now()}`;
    setAllMessages(prev => [...prev, {
      id: tmpId, sender: 'user', content: userContent, mode,
      timestamp: new Date().toISOString(),
    }]);

    try {
      const savedMsg = await chatService.saveMessage({ content: userContent, mode, characterId: charId });
      if (savedMsg.merged) {
        setAllMessages(prev =>
          prev.filter(m => m.id !== tmpId).map(m => m.id === savedMsg.id ? savedMsg : m)
        );
      } else {
        setAllMessages(prev => prev.map(m => m.id === tmpId ? savedMsg : m));
      }
    } catch (err) {
      setSendError(err.message);
      setAllMessages(prev => prev.filter(m => m.id !== tmpId));
    }
  }, [input, sending, mode, charId]);

  // ── 触发 AI 回复（两阶段第2步）────────────────────────────────
  const triggerAI = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setSendError('');
    abortCtrlRef.current = new AbortController();
    const useStream = activePreset?.stream ?? false;
    const body = {
      characterId: charId, mode,
      contextMode: activePreset?.contextMode,
      apiKey: activePreset?.apiKey,
      baseURL: activePreset?.baseURL,
      model: activePreset?.model,
      provider: activePreset?.provider,
      params: activePreset?.params,
    };

    if (useStream) {
      const tmpId = `tmp-ai-${Date.now()}`;
      setAllMessages(prev => [...prev, {
        id: tmpId, sender: 'character', content: '', mode,
        timestamp: new Date().toISOString(),
      }]);
      try {
        const res = await chatService.respondStream(body);
        const { realId, finalTimestamp, accumulated } = await chatService.readSSE(res, (acc) => {
          setAllMessages(prev => prev.map(m => m.id === tmpId ? { ...m, content: acc } : m));
        });
        if (realId) {
          setAllMessages(prev => prev.map(m => m.id === tmpId
            ? { ...m, id: realId, timestamp: finalTimestamp }
            : m));
          onNewAIMessage?.(char, accumulated);
        }
      } catch (err) {
        setAllMessages(prev => prev.filter(m => m.id !== tmpId));
        if (err.name === 'AbortError') {
          setSendError('已手动中止生成');
        } else {
          setSendError(err.message);
          setAllMessages(prev => [...prev, {
            id: `err-${Date.now()}`, sender: 'character',
            content: `（AI回复失败：${err.message}）`, mode,
            timestamp: new Date().toISOString(),
          }]);
        }
      } finally { setSending(false); }
      return;
    }

    // 非流式
    try {
      const aiMsg = await chatService.respond(body);
      setAllMessages(prev => [...prev, { ...aiMsg, mode }]);
      onNewAIMessage?.(char, aiMsg.content);
    } catch (err) {
      if (err.name === 'AbortError') {
        setSendError('已手动中止生成');
      } else {
        setSendError(err.message);
        setAllMessages(prev => [...prev, {
          id: `err-${Date.now()}`, sender: 'character',
          content: `（AI回复失败：${err.message}）`, mode,
          timestamp: new Date().toISOString(),
        }]);
      }
    } finally { setSending(false); }
  }, [sending, activePreset, charId, mode, char, onNewAIMessage]);

  // ── 重新生成 ──────────────────────────────────────────────────
  const regenerate = useCallback(async (msgId) => {
    setCtxMenu(null);
    const target = allMessages.find(m => m.id === msgId);
    const targetMode = target?.mode || mode;
    setAllMessages(prev => prev.filter(m => m.id !== msgId));
    if (!String(msgId).startsWith('tmp-') && !String(msgId).startsWith('err-')) {
      await chatService.deleteMessage(msgId).catch(() => {});
    }
    setSending(true);
    setSendError('');
    abortCtrlRef.current = new AbortController();
    const useStream = activePreset?.stream ?? false;
    const body = {
      characterId: charId, mode: targetMode,
      contextMode: activePreset?.contextMode,
      apiKey: activePreset?.apiKey,
      baseURL: activePreset?.baseURL,
      model: activePreset?.model,
      provider: activePreset?.provider,
      params: activePreset?.params,
    };

    if (useStream) {
      const tmpId = `tmp-ai-${Date.now()}`;
      setAllMessages(prev => [...prev, {
        id: tmpId, sender: 'character', content: '', mode: targetMode,
        timestamp: new Date().toISOString(),
      }]);
      try {
        const res = await chatService.respondStream(body);
        const { realId, finalTimestamp, accumulated } = await chatService.readSSE(res, (acc) => {
          setAllMessages(prev => prev.map(m => m.id === tmpId ? { ...m, content: acc } : m));
        });
        if (realId) {
          setAllMessages(prev => prev.map(m => m.id === tmpId
            ? { ...m, id: realId, timestamp: finalTimestamp }
            : m));
          onNewAIMessage?.(char, accumulated);
        }
      } catch (err) {
        setAllMessages(prev => prev.filter(m => m.id !== tmpId));
        if (err.name !== 'AbortError') setSendError(err.message);
      } finally { setSending(false); }
      return;
    }

    try {
      const aiMsg = await chatService.respond(body);
      setAllMessages(prev => [...prev, { ...aiMsg, mode: targetMode }]);
      onNewAIMessage?.(char, aiMsg.content);
    } catch (err) {
      if (err.name !== 'AbortError') setSendError(err.message);
    } finally { setSending(false); }
  }, [allMessages, mode, activePreset, charId, char, onNewAIMessage]);

  // ── 消息删除/编辑 ────────────────────────────────────────────
  const deleteMessages = useCallback(async (ids) => {
    const normalIds = new Set([...ids].map(id => String(id).replace(/_sub_\d+$/, '')));
    setAllMessages(prev => prev.filter(m => !normalIds.has(m.id)));
    const realIds = [...normalIds].filter(id => !id.startsWith('tmp-') && !id.startsWith('err-'));
    for (const id of realIds) {
      await chatService.deleteMessage(id).catch(() => {});
    }
  }, []);

  const startEdit = useCallback((msg) => {
    setEditingId(msg.id);
    setEditDraft(msg.content);
    setCtxMenu(null);
  }, []);

  const saveEdit = useCallback(async () => {
    const id = editingId;
    const content = editDraft.trim();
    if (!content) { setEditingId(null); return; }
    setAllMessages(prev => prev.map(m => m.id === id ? { ...m, content } : m));
    setEditingId(null);
    if (!String(id).startsWith('tmp-') && !String(id).startsWith('err-')) {
      await chatService.updateMessage(id, content).catch(() => {});
    }
  }, [editingId, editDraft]);

  // ── 选择模式 ──────────────────────────────────────────────────
  const toggleSelect = useCallback((id) => {
    setSelIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (!next.size) setSelMode(false);
      return next;
    });
  }, []);
  const enterSelMode = useCallback((id) => { setSelMode(true); setSelIds(new Set([id])); }, []);
  const exitSelMode  = useCallback(() => { setSelMode(false); setSelIds(new Set()); }, []);
  const selectAll    = useCallback(() => setSelIds(new Set(messages.map(m => m.id))), [messages]);

  // ── 长按检测 ──────────────────────────────────────────────────
  const onMsgPressStart = useCallback((msg) => {
    longPressActive.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressActive.current = true;
      if (selMode) toggleSelect(msg.id);
      else setCtxMenu({ msgId: msg.id, sender: msg.sender, content: msg.content });
    }, 500);
  }, [selMode, toggleSelect]);

  const onMsgPressEnd = useCallback(() => clearTimeout(longPressTimer.current), []);

  const onMsgClick = useCallback((msg) => {
    if (longPressActive.current) return;
    if (selMode) toggleSelect(msg.id);
  }, [selMode, toggleSelect]);

  // ── 段落折叠 ──────────────────────────────────────────────────
  const requestSummary = useCallback(async (key, msgs) => {
    if (summaryInFlight.current.has(key)) return;
    summaryInFlight.current.add(key);
    setSegStates(prev => ({ ...prev, [key]: { ...prev[key], summaryStatus: 'loading' } }));
    const validIds = msgs.map(m => m.id).filter(id => id && !String(id).startsWith('tmp-') && !String(id).startsWith('err-'));
    try {
      const data = await chatService.generateSummary(charId, {
        messageIds: validIds.length > 0 ? validIds : undefined,
        periodFrom: validIds.length === 0 ? msgs[0]?.timestamp : undefined,
        periodTo:   validIds.length === 0 ? msgs[msgs.length - 1]?.timestamp : undefined,
        level: 'segment', type: 'conversation',
        apiKey:  activePreset?.apiKey,
        baseURL: activePreset?.baseURL,
        model:   activePreset?.model,
        provider: activePreset?.provider,
      });
      setSegStates(prev => ({ ...prev, [key]: { ...prev[key], summaryStatus: 'ready', summary: data.content } }));
    } catch {
      setSegStates(prev => ({ ...prev, [key]: { ...prev[key], summaryStatus: 'failed' } }));
    } finally {
      summaryInFlight.current.delete(key);
    }
  }, [charId, activePreset]);

  const toggleSeg = useCallback((key, msgs) => {
    const cur = segStates[key] || {};
    const nowCollapsed = !cur.collapsed;
    setSegStates(prev => ({ ...prev, [key]: { ...prev[key], collapsed: nowCollapsed } }));
    if (nowCollapsed && !cur.summaryStatus) requestSummary(key, msgs);
  }, [segStates, requestSummary]);

  const collapseAll = useCallback(() => {
    const updates = {};
    segments.forEach(seg => {
      const cur = segStates[seg.key] || {};
      updates[seg.key] = { ...cur, collapsed: true };
      if (!cur.summaryStatus) requestSummary(seg.key, seg.msgs);
    });
    setSegStates(prev => ({ ...prev, ...updates }));
  }, [segments, segStates, requestSummary]);

  return {
    // 数据
    allMessages, messages, hasMore, segments,
    dateSummaryList, dateMap,
    charId, charName,
    // 发送状态
    mode, setMode,
    input, setInput,
    sending, sendError, setSendError,
    // 消息操作
    ctxMenu, setCtxMenu,
    editingId, editDraft, setEditDraft, setEditingId,
    selMode, selIds,
    // 段落
    segStates, setSegStates,
    // 面板
    showSettings, setShowSettings,
    showDateSearch, setShowDateSearch,
    dateDetail, setDateDetail,
    // 设置
    pageSize, setPageSize,
    summarySettings, timestampSettings,
    // Refs
    scrollRef, loadMoreRef, abortCtrlRef,
    // 操作函数
    saveUserMessage, triggerAI, regenerate,
    deleteMessages, startEdit, saveEdit,
    toggleSelect, enterSelMode, exitSelMode, selectAll,
    onMsgPressStart, onMsgPressEnd, onMsgClick,
    toggleSeg, collapseAll, requestSummary,
    gotoDate, loadDateDetail, generateDailySummary,
    saveSummarySettings, saveTimestampSettings,
  };
}
