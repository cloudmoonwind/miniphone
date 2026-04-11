/**
 * ChatMain.jsx — 聊天主视图（纯布局层）
 *
 * 职责：从 useChatState 取得所有状态和操作函数，组装视图。
 * 刻意不包含任何业务逻辑——业务逻辑全部在 useChatState。
 */
import {
  ChevronLeft, ChevronDown, ChevronRight,
  Send, AlertCircle, RefreshCw, Pencil, X, Check, Square,
  SlidersHorizontal, Trash2, Copy, Calendar, FileText,
  ToggleLeft, ToggleRight, Bot, Plus,
  Gamepad2, Clock, Moon, User,
} from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Avatar from '../../components/Avatar.jsx';
import { useChatState } from './useChatState.js';
import { MessageGroup, BreathingDots } from './MessageBubble.jsx';
import { CalendarGrid } from './ChatCalendar.jsx';

// ── 上下文菜单项 ─────────────────────────────────────────────────
const CtxItem = ({ icon: Icon, label, destructive = false, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-colors text-sm font-medium
      ${destructive ? 'text-red-500 active:bg-red-50' : 'text-gray-700 active:bg-gray-50'}`}
  >
    <Icon size={17} className={destructive ? 'text-red-400' : 'text-gray-400'} />
    {label}
  </button>
);

// ── 快捷功能面板 ─────────────────────────────────────────────────
const QuickAction = ({ icon: Icon, label, color, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 p-2 rounded-xl active:scale-95 transition-transform"
  >
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
      style={{ background: color + '22', border: `1px solid ${color}33` }}>
      <Icon size={22} style={{ color }} />
    </div>
    <span className="text-[10px] text-gray-500">{label}</span>
  </button>
);

export default function ChatMain({ onBack, activePreset, initialChar, onNewAIMessage, onOpenApp }) {
  const state = useChatState({ char: initialChar, activePreset, onNewAIMessage });
  const [showQuick, setShowQuick] = useState(false);

  const {
    allMessages, messages, hasMore, segments,
    dateSummaryList, dateMap,
    charName,
    mode, setMode, input, setInput,
    sending, sendError, setSendError,
    ctxMenu, setCtxMenu,
    editingId, editDraft, setEditDraft, setEditingId,
    selMode, selIds,
    segStates, setSegStates,
    showSettings, setShowSettings,
    showDateSearch, setShowDateSearch,
    dateDetail, setDateDetail,
    pageSize, setPageSize,
    summarySettings, timestampSettings,
    scrollRef, loadMoreRef, abortCtrlRef,
    saveUserMessage, triggerAI, regenerate,
    deleteMessages, startEdit, saveEdit,
    toggleSelect, enterSelMode, exitSelMode, selectAll,
    onMsgPressStart, onMsgPressEnd, onMsgClick,
    toggleSeg, collapseAll, requestSummary,
    gotoDate, loadDateDetail, generateDailySummary,
    saveSummarySettings, saveTimestampSettings,
  } = state;

  const charAvatarEl = (size) => (
    <Avatar value={initialChar.avatar} name={charName} size={size} rounded />
  );

  // 传给 MessageBubble 的环境对象
  const msgEnv = {
    editingId, editDraft,
    onEditChange: setEditDraft,
    onSaveEdit:   saveEdit,
    onCancelEdit: () => setEditingId(null),
    selMode, selIds,
    onToggleSelect: toggleSelect,
    onPressStart:   onMsgPressStart,
    onPressEnd:     onMsgPressEnd,
    onMsgClick,
    charAvatarEl, charName,
  };

  return (
    <div className={`flex flex-col h-full transition-colors duration-500 relative ${mode === 'online' ? 'bg-slate-50' : 'bg-amber-50'}`}>

      {/* ── 顶栏 ── */}
      <div className="h-14 bg-white border-b flex items-center px-3 shadow-sm shrink-0 gap-2 z-10">
        {selMode ? (
          <>
            <button onClick={exitSelMode} className="p-2 hover:bg-gray-100 rounded-full">
              <X size={18} className="text-gray-600" />
            </button>
            <span className="font-bold flex-1">已选 {selIds.size} 条</span>
            <button onClick={selectAll} className="text-xs text-blue-500 px-2 py-1">全选</button>
          </>
        ) : (
          <>
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            {charAvatarEl(36)}
            <span className="font-bold flex-1 truncate">{charName}</span>
            <button
              onClick={() => { setShowDateSearch(true); setShowSettings(false); }}
              className={`p-2 rounded-full transition-colors ${showDateSearch ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              <Calendar size={18} />
            </button>
            <button
              onClick={() => { setShowSettings(s => !s); setShowDateSearch(false); }}
              className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}
            >
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
                <button
                  onClick={() => !selMode && toggleSeg(seg.key, seg.msgs)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                    seg.mode === 'online'
                      ? 'bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100'
                      : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${seg.mode === 'online' ? 'bg-sky-400' : 'bg-amber-400'}`} />
                  <span>{seg.mode === 'online' ? '线上' : '线下'}</span>
                  <span className="opacity-60">{seg.msgs.length}条</span>
                  {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                </button>
                <div className={`flex-1 h-px ${seg.mode === 'online' ? 'bg-sky-200' : 'bg-amber-200'}`} />
              </div>

              {collapsed ? (
                // 折叠：总结卡片
                <div className={`mx-1 rounded-xl border shadow-sm p-3 relative min-h-[48px] ${
                  seg.mode === 'online' ? 'bg-sky-50/60 border-sky-100' : 'bg-amber-50/80 border-amber-100'
                }`}>
                  {(sumStatus === 'ready' || sumStatus === 'failed') && (
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                      <button onClick={() => requestSummary(seg.key, seg.msgs)} className="text-gray-400 hover:text-blue-500" title="重新总结">
                        <RefreshCw size={11} />
                      </button>
                      {sumStatus === 'ready' && !isEditing && (
                        <button
                          onClick={() => setSegStates(prev => ({ ...prev, [seg.key]: { ...prev[seg.key], editing: true, editDraft: ss.summary } }))}
                          className="text-gray-400 hover:text-blue-500"
                          title="编辑总结"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                    </div>
                  )}
                  {sumStatus === 'loading' && <div className="flex items-center text-xs text-gray-400"><span className="animate-pulse">总结中</span><BreathingDots /></div>}
                  {sumStatus === 'failed'  && <div className="flex items-center gap-1.5 text-xs text-red-400 pr-8"><AlertCircle size={12} /><span>总结失败，点右上角重试</span></div>}
                  {sumStatus === 'none'    && <span className="text-xs text-gray-400 animate-pulse">准备生成总结…<BreathingDots /></span>}
                  {sumStatus === 'ready' && !isEditing && <p className="text-xs text-gray-700 leading-relaxed pr-10">{ss.summary}</p>}
                  {sumStatus === 'ready' && isEditing && (
                    <div className="space-y-1.5">
                      <textarea
                        autoFocus
                        value={ss.editDraft ?? ss.summary}
                        onChange={e => setSegStates(prev => ({ ...prev, [seg.key]: { ...prev[seg.key], editDraft: e.target.value } }))}
                        className="w-full text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
                        rows={3}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setSegStates(prev => ({ ...prev, [seg.key]: { ...prev[seg.key], editing: false, editDraft: undefined } }))}
                          className="flex items-center gap-0.5 text-[10px] text-gray-400"
                        >
                          <X size={9} /> 取消
                        </button>
                        <button
                          onClick={() => setSegStates(prev => ({ ...prev, [seg.key]: { ...prev[seg.key], summary: prev[seg.key].editDraft ?? prev[seg.key].summary, editing: false, editDraft: undefined } }))}
                          className="flex items-center gap-0.5 text-[10px] text-blue-500"
                        >
                          <Check size={9} /> 保存
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // 展开：消息列表
                <div className="space-y-2 pb-1">
                  {seg.msgs.map(msg => <MessageGroup key={msg.id} msg={msg} segMode={seg.mode} env={msgEnv} />)}
                </div>
              )}
            </div>
          );
        })}

        {/* AI 回复中指示 */}
        {sending && (
          <div className="flex flex-col items-start gap-2 pl-1">
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 shrink-0">{charAvatarEl(28)}</div>
              <div className="bg-white border shadow-sm text-gray-400 text-xs px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center">
                <span className="animate-pulse">回复中</span><BreathingDots />
              </div>
            </div>
            <button
              onClick={() => abortCtrlRef.current?.abort()}
              className="ml-9 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-400 border border-red-100 hover:bg-red-100 text-xs font-medium"
            >
              <Square size={10} fill="currentColor" /> 中止生成
            </button>
          </div>
        )}

        {/* 发送错误 */}
        {sendError && !sending && (
          <div className="flex items-center gap-2 mx-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-500 flex-1 leading-relaxed">{sendError}</p>
            <button onClick={() => setSendError('')} className="text-gray-300 hover:text-gray-500 shrink-0">
              <X size={12} />
            </button>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* ── 设置面板 ── */}
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
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="px-5 pb-6 space-y-4">
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-bold text-gray-800">聊天管理</span>
                  <button onClick={() => setShowSettings(false)} className="text-gray-400 p-1"><X size={16} /></button>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">每次加载条数</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={10} max={100} step={10} value={pageSize}
                      onChange={e => setPageSize(+e.target.value)} className="flex-1 accent-purple-500" />
                    <span className="text-xs font-mono text-gray-600 w-6 text-right">{pageSize}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">段落管理</label>
                  <button onClick={collapseAll} className="w-full text-sm text-gray-600 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50">
                    折叠全部并生成总结
                  </button>
                </div>
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
                          className="w-14 text-sm border rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-purple-300" />
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
                <div className="border-t pt-3 space-y-3">
                  <label className="text-xs text-gray-500 font-medium block">时间戳（发给 AI）</label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">注入用户时间</span>
                    <button onClick={() => saveTimestampSettings({ sendUserTimestamp: !timestampSettings.sendUserTimestamp })}
                      className={timestampSettings.sendUserTimestamp ? 'text-purple-500' : 'text-gray-300'}>
                      {timestampSettings.sendUserTimestamp ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                  </div>
                  {timestampSettings.sendUserTimestamp && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">时间同步（不显示来源）</span>
                      <button onClick={() => saveTimestampSettings({ syncConfirmed: !timestampSettings.syncConfirmed })}
                        className={timestampSettings.syncConfirmed ? 'text-purple-500' : 'text-gray-300'}>
                        {timestampSettings.syncConfirmed ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                    </div>
                  )}
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-400">共 {allMessages.length} 条消息</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 多选底栏 ── */}
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
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-semibold disabled:opacity-40"
            >
              <Trash2 size={14} /> 删除{selIds.size > 0 ? ` ${selIds.size}` : ''}条
            </button>
            <button onClick={exitSelMode} className="text-xs text-gray-400 px-2">取消</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 输入区 ── */}
      {!selMode && (
        <div className={`border-t shrink-0 transition-colors duration-300 ${mode === 'online' ? 'bg-white' : 'bg-amber-50'}`}>
          <div className="px-3 pt-2.5 flex items-center gap-2">
            <div className={`flex p-0.5 rounded-full ${mode === 'online' ? 'bg-sky-100' : 'bg-amber-100'}`}>
              <button onClick={() => setMode('online')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${mode === 'online' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400 hover:text-sky-500'}`}>
                线上
              </button>
              <button onClick={() => setMode('offline')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${mode === 'offline' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-400 hover:text-amber-600'}`}>
                线下
              </button>
            </div>
            <span className="text-[10px] text-gray-400">{mode === 'online' ? '短消息 · 即时互动' : '沉浸叙事 · 场景描写'}</span>
          </div>
          <form onSubmit={saveUserMessage} className="p-3 flex gap-2 items-center">
            <button type="button"
              onClick={() => setShowQuick(v => !v)}
              className={`p-2.5 rounded-full border transition-all shrink-0 ${showQuick ? 'bg-gray-100 border-gray-200 text-gray-600 rotate-45' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
              style={{ transition: 'transform 0.2s, background 0.15s' }}
            >
              <Plus size={17} />
            </button>
            <input
              type="text" value={input} onChange={e => { setInput(e.target.value); if (showQuick) setShowQuick(false); }}
              placeholder={mode === 'online' ? '发消息…' : '描述场景或动作…'}
              className={`flex-1 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${mode === 'online' ? 'bg-gray-100 focus:ring-sky-300' : 'bg-amber-100/80 focus:ring-amber-300'}`}
            />
            <button type="submit" disabled={!input.trim()}
              title="发送（仅存消息）"
              className={`p-2.5 rounded-full text-white disabled:opacity-40 shrink-0 ${mode === 'online' ? 'bg-sky-500 hover:bg-sky-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
              <Send size={17} />
            </button>
            <button type="button" onClick={triggerAI} disabled={sending}
              title="让 AI 回复"
              className={`p-2.5 rounded-full disabled:opacity-40 shrink-0 ${sending ? 'bg-purple-200 text-purple-400' : 'bg-purple-500 hover:bg-purple-600 text-white'}`}>
              <Bot size={17} />
            </button>
          </form>

          {/* 快捷功能面板 */}
          <AnimatePresence>
            {showQuick && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className={`px-4 pb-4 pt-1 grid grid-cols-4 gap-2 border-t ${mode === 'online' ? 'bg-white border-gray-100' : 'bg-amber-50 border-amber-100'}`}>
                  <QuickAction icon={Gamepad2} label="邀请大富翁" color="#8b5cf6"
                    onClick={() => { setShowQuick(false); onOpenApp?.('大富翁'); }} />
                  <QuickAction icon={User} label="角色档案" color="#3b82f6"
                    onClick={() => { setShowQuick(false); onOpenApp?.('角色系统'); }} />
                  <QuickAction icon={Moon} label="梦境记录" color="#6366f1"
                    onClick={() => { setShowQuick(false); onOpenApp?.('梦境'); }} />
                  <QuickAction icon={Clock} label="时光邮局" color="#f59e0b"
                    onClick={() => { setShowQuick(false); onOpenApp?.('时光邮局'); }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── 按日期查找面板 ── */}
      <AnimatePresence>
        {showDateSearch && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-white flex flex-col"
          >
            <div className="h-14 border-b flex items-center px-3 gap-2 shrink-0 shadow-sm">
              <button onClick={() => setShowDateSearch(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <span className="font-bold flex-1">按日期查找</span>
              <span className="text-xs text-gray-400">{dateSummaryList.length} 天有记录</span>
            </div>
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

      {/* ── 日期总结详情 ── */}
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
                <button
                  onClick={() => generateDailySummary(dateDetail.date)}
                  className="text-xs text-purple-500 border border-purple-200 rounded-lg px-2 py-1 hover:bg-purple-50"
                >
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
                        'bg-amber-100 text-amber-600'
                      }`}>
                        {s.type === 'day' ? '日总结' : s.type === 'mode' ? `${s.modeType === 'online' ? '线上' : '线下'}段` : '阶段'}
                      </span>
                      {s.period?.from && (
                        <span className="text-[10px] text-gray-400">
                          {new Date(s.period.from).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
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

      {/* ── 上下文菜单 ── */}
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
}
