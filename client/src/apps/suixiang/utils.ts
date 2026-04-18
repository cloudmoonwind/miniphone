// ── 基于 card.id 的伪随机工具（确定性：同一 id 永远得到同一结果）──────────────

/** 返回 [0, len) 内的整数 */
export const seededInt = (id: string, salt: number, len: number): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i) + salt) >>> 0;
  return h % len;
};

/** 返回 [min, max) 内的浮点数 */
export const seededFloat = (id: string, salt: number, min: number, max: number): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 37 + id.charCodeAt(i) + salt) >>> 0;
  return min + (h % 10000) / 10000 * (max - min);
};

// ── 时间格式化 ────────────────────────────────────────────────────────────────

export const formatRelative = (iso?: string): string => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)       return '刚刚';
  if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}小时前`;
  if (diff < 604_800_000)  return `${Math.floor(diff / 86_400_000)}天前`;
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

export const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
