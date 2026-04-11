import { wbBookStore, wbEntryStore } from '../storage/index.js';

/**
 * 获取角色上下文中应注入的非事件条目（always / keyword 模式）
 * @deprecated 用 getActivatedEntries 代替
 */
export async function getActiveNonEventEntries(charId) {
  const [books, entries] = await Promise.all([
    wbBookStore.getAll(),
    wbEntryStore.getAll(),
  ]);
  const enabledBookIds = new Set(
    books.filter(b => b.enabled && (b.charId == null || b.charId === charId))
      .map(b => b.id)
  );
  return entries
    .filter(e =>
      e.enabled &&
      enabledBookIds.has(e.bookId) &&
      (e.activationMode === 'always' || e.activationMode === 'keyword')
    )
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

/**
 * 带级联激活的世界书条目激活函数
 *
 * 规则：
 * - 先用最近 scanDepth 条消息的文本作为 baseText
 * - always 条目无条件激活
 * - keyword 条目：若 noRecurse=true 只扫 baseText，否则扫 scanText（含已激活条目内容）
 * - 激活后：若 noFurtherRecurse=false，将其内容追加到 scanText（供后续条目匹配）
 * - 循环直到没有新激活
 *
 * @param {string} charId
 * @param {Array<{role:string, content:string}>} messages 按时间升序排列的消息列表
 * @returns {Promise<Array>} 激活的条目，按 priority 排序
 */
export async function getActivatedEntries(charId, messages = []) {
  const [books, entries] = await Promise.all([
    wbBookStore.getAll(),
    wbEntryStore.getAll(),
  ]);

  const enabledBooks = books.filter(
    b => b.enabled && (b.charId == null || b.charId === charId)
  );
  const enabledBookIds = new Set(enabledBooks.map(b => b.id));

  // 取最大 scanDepth（各书取最大值，默认 20）
  const scanDepth = enabledBooks.reduce(
    (max, b) => Math.max(max, b.scanDepth ?? 20), 20
  );

  const candidates = entries.filter(
    e =>
      e.enabled &&
      enabledBookIds.has(e.bookId) &&
      (e.activationMode === 'always' || e.activationMode === 'keyword')
  );

  const baseText = messages
    .slice(-scanDepth)
    .map(m => m.content || '')
    .join(' ')
    .toLowerCase();

  let scanText = baseText;
  const activated = new Map(); // id → entry
  let remaining = [...candidates];

  // 级联激活：循环直到无新激活
  let changed = true;
  while (changed) {
    changed = false;
    const nextRemaining = [];
    for (const entry of remaining) {
      let shouldActivate = false;
      if (entry.activationMode === 'always') {
        shouldActivate = true;
      } else if (entry.activationMode === 'keyword') {
        const textToScan = entry.noRecurse ? baseText : scanText;
        shouldActivate = (entry.keywords || []).some(
          kw => kw && textToScan.includes(kw.toLowerCase())
        );
      }

      if (shouldActivate) {
        activated.set(entry.id, entry);
        changed = true;
        // 若不设置 noFurtherRecurse，将内容追加到 scanText 供后续匹配
        if (!entry.noFurtherRecurse && entry.content) {
          scanText += ' ' + entry.content.toLowerCase();
        }
      } else {
        nextRemaining.push(entry);
      }
    }
    remaining = nextRemaining;
  }

  return [...activated.values()].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
}

/**
 * 获取事件池条目（event-random + event-conditional，供生活生成用）
 */
export async function getEventPoolEntries(charId) {
  const [books, entries] = await Promise.all([
    wbBookStore.getAll(),
    wbEntryStore.getAll(),
  ]);
  const enabledBookIds = new Set(
    books.filter(b => b.enabled && (b.charId == null || b.charId === charId))
      .map(b => b.id)
  );
  return entries.filter(e =>
    e.enabled &&
    enabledBookIds.has(e.bookId) &&
    (e.activationMode === 'event-random' || e.activationMode === 'event-conditional')
  );
}
