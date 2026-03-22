/**
 * chatFormatters.js — ChatApp 工具函数与常量
 *
 * 从 ChatApp.jsx 提取，避免在主组件文件中混入工具逻辑。
 */

/** 消息合并分隔符（与 server/services/context.js 保持一致）*/
export const MSG_SEP = '\u001E';

/**
 * 将消息列表按模式（online/offline）分段
 * @param {Array} msgs
 * @returns {Array} [{ mode, key, msgs }]
 */
export function buildSegments(msgs) {
  const segs = [];
  for (const msg of msgs) {
    const last = segs[segs.length - 1];
    if (last && last.mode === msg.mode) {
      last.msgs.push(msg);
    } else {
      segs.push({ mode: msg.mode, key: `${msg.mode}-${msg.id}`, msgs: [msg] });
    }
  }
  return segs;
}

/**
 * 格式化消息时间戳（显示用）
 * 同天只显示时:分，跨天加日期前缀
 */
export function formatMsgTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return (
    d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  );
}

/** 默认消息分页大小 */
export const DEFAULT_PAGE_SIZE = 30;
