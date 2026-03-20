import { wbBookStore, wbEntryStore } from '../storage/index.js';

/**
 * 获取角色上下文中应注入的非事件条目（always / keyword 模式）
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
