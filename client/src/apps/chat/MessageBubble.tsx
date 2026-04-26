/**
 * MessageBubble.jsx — 消息气泡组件
 *
 * 包含：
 *   BreathingDots     — 回复中动画
 *   MessageBubbleContent — 长文本折叠展开
 *   MessageBubble     — 单条消息（线上/线下/编辑态/选择态）
 *   MessageGroup      — 处理 MSG_SEP 合并的多条子消息
 */
import { useState, useEffect } from 'react';
import { Check, X, User, ChevronDown } from 'lucide-react';
import { MSG_SEP, formatMsgTime } from './chatFormatters.js';

// ── 变量快照折叠条 ──────────────────────────────────────────────
const BASELINE_VARS = ['理智', '稳定', '强度'];

function VarSnapshotBar({ snapshot }: { snapshot: Record<string, any> }) {
  const [open, setOpen] = useState(false);

  const emotionState: string | null = snapshot.emotion_state ?? null;
  const numericEntries = Object.entries(snapshot)
    .filter(([k]) => k !== 'emotion_state')
    .map(([k, v]) => ({ k, v: typeof v === 'number' ? Math.round(v * 10) / 10 : v }));

  const preview = emotionState
    ? emotionState.slice(0, 28) + (emotionState.length > 28 ? '…' : '')
    : numericEntries.slice(0, 2).map(e => `${e.k} ${e.v}`).join('  ');

  return (
    <div className="pl-9 mt-1">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex items-center gap-1 text-[9px] text-gray-300 hover:text-gray-500 transition-colors"
      >
        <ChevronDown size={9} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        <span className="truncate max-w-[180px]">{preview}</span>
      </button>
      {open && (
        <div className="mt-1 ml-2 text-[9px] text-gray-400 space-y-0.5 border-l border-gray-100 pl-2">
          {emotionState && (
            <p className="text-indigo-400">{emotionState}</p>
          )}
          {numericEntries.map(({ k, v }) => (
            <p key={k} className={BASELINE_VARS.includes(k) ? 'text-gray-300' : ''}>
              {k}：{v}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 呼吸灯动点 ──────────────────────────────────────────────────
export function BreathingDots() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % 3), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="inline-block w-1 h-1 rounded-full bg-current transition-opacity duration-300"
          style={{ opacity: step >= i ? 1 : 0.2 }}
        />
      ))}
    </span>
  );
}

// ── 长文本折叠展示 ──────────────────────────────────────────────
export function MessageBubbleContent({ content }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content && content.length > 300;

  return (
    <div className="flex flex-col">
      <div
        className={`whitespace-pre-wrap break-words ${!expanded && isLong ? 'line-clamp-[12]' : ''}`}
        style={
          !expanded && isLong
            ? { display: '-webkit-box', WebkitLineClamp: 12, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
            : {}
        }
      >
        {content}
      </div>
      {isLong && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
          className="mt-2 text-xs text-indigo-500 hover:text-indigo-600 self-start font-medium transition-colors"
        >
          {expanded ? '收起内容' : '展开阅读全文...'}
        </button>
      )}
    </div>
  );
}

// ── 单条消息气泡 ────────────────────────────────────────────────
/**
 * env 对象（来自 useChatState 和 ChatMain）：
 *   editingId, editDraft, onEditChange, onSaveEdit, onCancelEdit
 *   selMode, selIds, onToggleSelect
 *   onPressStart, onPressEnd, onMsgClick
 *   charAvatarEl — (size: number) => ReactNode
 *   charName
 */
export function MessageBubble({
  msg,
  segMode,
  isSubsequent = false,
  withId = true,
  overrideShowTime = null,
  noUserAvatar = false,
  selectId = null,
  env,
}) {
  const {
    editingId, editDraft, onEditChange, onSaveEdit, onCancelEdit,
    selMode, selIds, onToggleSelect,
    onPressStart, onPressEnd, onMsgClick,
    charAvatarEl, charName,
  } = env;

  const sid    = selectId || msg.id;
  const isSel  = selIds.has(sid);
  const isEdit = editingId === msg.id;
  const isErr  = String(msg.id).startsWith('err-');

  // ── 内容渲染 ────────────────────────────────────────────────
  let inner;
  if (isEdit) {
    inner = (
      <div className={`flex flex-col gap-1.5 ${msg.sender === 'user' ? 'items-end' : 'items-start pl-9'}`}>
        <textarea
          autoFocus
          value={editDraft}
          onChange={e => onEditChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit(); }
            if (e.key === 'Escape') onCancelEdit();
          }}
          rows={3}
          className="w-full max-w-[80%] px-3 py-2 text-sm border-2 border-blue-300 rounded-2xl focus:outline-none resize-none leading-relaxed"
        />
        <div className="flex gap-2">
          <button onClick={onCancelEdit} className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600">
            <X size={11} /> 取消
          </button>
          <button onClick={onSaveEdit} className="flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700">
            <Check size={11} /> 保存
          </button>
        </div>
      </div>
    );
  } else if (segMode === 'offline') {
    inner = (
      <div className={`p-3 rounded-xl text-sm leading-relaxed shadow-sm ${
        msg.sender === 'user'
          ? 'bg-amber-100/70 border-l-4 border-amber-400 ml-4'
          : isErr
            ? 'bg-red-50 border-l-4 border-red-300 mr-4 text-red-500'
            : 'bg-white/90 border-l-4 border-purple-400 mr-4'
      }`}>
        {!isSubsequent && (
          <span className="font-bold text-[10px] text-gray-400 block mb-1">
            {msg.sender === 'user' ? '你' : charName}
          </span>
        )}
        <MessageBubbleContent content={msg.content} />
      </div>
    );
  } else {
    inner = (
      <div className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
        {msg.sender !== 'user' && (
          isSubsequent
            ? <div className="w-7 h-7 shrink-0" />
            : <div className="w-7 h-7 shrink-0">{charAvatarEl(28)}</div>
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
            : <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                <User size={14} className="text-sky-400" />
              </div>
        )}
      </div>
    );
  }

  const showTime = overrideShowTime !== null ? overrideShowTime : !isSubsequent;
  const tsText   = !isEdit && showTime ? formatMsgTime(msg.userTimestamp || msg.timestamp) : null;
  const tsEl = tsText ? (
    <p className={`text-[10px] text-gray-400 mt-0.5 ${
      msg.sender === 'user'
        ? `text-right ${segMode === 'online' ? 'pr-9' : 'pr-1'}`
        : 'pl-9'
    }`}>
      {tsText}
    </p>
  ) : null;

  // 变量快照条（仅角色消息，有快照时显示）
  const snap = msg.variableSnapshot;
  const snapEl = !isEdit && msg.sender !== 'user' && snap && Object.keys(snap).length > 0
    ? <VarSnapshotBar snapshot={snap} />
    : null;

  const selMsg = sid !== msg.id ? { ...msg, id: sid } : msg;
  const touchProps = !isEdit ? {
    onMouseDown:  () => onPressStart(selMsg),
    onMouseUp:    onPressEnd,
    onMouseLeave: onPressEnd,
    onTouchStart: () => onPressStart(selMsg),
    onTouchEnd:   onPressEnd,
    onClick:      () => onMsgClick(selMsg),
  } : {};

  const bubble = (
    <div {...touchProps} className={`select-none transition-opacity ${isSel ? 'opacity-60' : ''}`}>
      {inner}
      {tsEl}
      {snapEl}
    </div>
  );

  if (!selMode) {
    return (
      <div {...(withId ? { id: `msg-${msg.id}` } : {})}>
        {bubble}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 py-0.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
      <button
        onClick={() => onToggleSelect(sid)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          isSel ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
        }`}
      >
        {isSel && <Check size={10} className="text-white" />}
      </button>
      <div className="flex-1">{bubble}</div>
    </div>
  );
}

// ── 消息组（处理 MSG_SEP 合并的多条子消息）────────────────────────
export function MessageGroup({ msg, segMode, env }) {
  const parts = msg.content.split(MSG_SEP).filter(Boolean);
  if (parts.length <= 1) {
    return <MessageBubble msg={msg} segMode={segMode} env={env} />;
  }
  const last = parts.length - 1;
  return (
    <div id={`msg-${msg.id}`} className="space-y-0.5">
      {parts.map((part, i) => (
        <MessageBubble
          key={i}
          msg={{ ...msg, content: part, id: `${msg.id}_sub_${i}` }}
          segMode={segMode}
          isSubsequent={i > 0}
          withId={false}
          overrideShowTime={i === last}
          noUserAvatar={i !== last}
          selectId={msg.id}
          env={env}
        />
      ))}
    </div>
  );
}
