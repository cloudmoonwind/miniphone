/**
 * worldbook/EntryCard.tsx — 条目编辑卡 & 新建条目表单
 *
 * 交互：左滑（触控/鼠标）露出操作区，书图标展开详情，策略圆点切换
 */
import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Copy, Trash2 } from 'lucide-react';
import { WB } from './api';
import { POSITIONS, FILTER_LOGICS } from './constants';
import { BookSVG, CornerBox, InlineDropdown, EntryDivider } from './ui';

// ── 表单初始化 ──────────────────────────────────────────────────
export const initForm = (e: any) => ({
  memo:              e.memo || '',
  content:           e.content || '',
  enabled:           e.enabled ?? 1,
  strategy:          e.strategy || 'constant',
  probability:       e.probability ?? 100,
  keywordText:       (() => { try { return JSON.parse(e.keywords || '[]').join(', '); } catch { return ''; } })(),
  filterKeywordText: (() => { try { return JSON.parse(e.filterKeywords || '[]').join(', '); } catch { return ''; } })(),
  filterLogic:       e.filterLogic || 'AND_ANY',
  position:          e.position || 'system-bottom',
  depth:             e.depth ?? 0,
  orderNum:          e.orderNum ?? 0,
  caseSensitive:     e.caseSensitive ?? 0,
  matchWholeWord:    e.matchWholeWord ?? 0,
  noRecurse:         e.noRecurse ?? 0,
  noFurtherRecurse:  e.noFurtherRecurse ?? 0,
  inclusionGroup:    e.inclusionGroup || '',
  groupWeight:       e.groupWeight ?? 100,
  sticky:            e.sticky ?? 0,
  cooldown:          e.cooldown ?? 0,
  delay:             e.delay ?? 0,
});

// ── 条目卡 ──────────────────────────────────────────────────────
export const EntryCard = ({ entry, onReload, onCopy, onDelete }: any) => {
  const [expanded, setExpanded] = useState(false);
  const [advOpen,  setAdvOpen]  = useState(false);
  const [dirty,    setDirty]    = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm]         = useState(() => initForm(entry));

  const [slideX, setSlideX] = useState(0);
  const touchX0 = useRef(0);
  const SNAP    = 80;

  // 鼠标拖动左滑
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX     = e.clientX;
    const startSlide = slideX;
    let didDrag      = false;
    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;
      if (!didDrag && Math.abs(dx) > 6) didDrag = true;
      if (!didDrag) return;
      me.preventDefault();
      setSlideX(Math.max(Math.min(startSlide + dx, 0), -SNAP));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (didDrag) setSlideX(s => s < -SNAP * 0.5 ? -SNAP : 0);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    setForm(f => ({ ...f, strategy: entry.strategy, enabled: entry.enabled ?? 1 }));
  }, [entry.strategy, entry.enabled]);

  const set = (k: string, v: any) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  const toggleStrategy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = entry.strategy === 'constant' ? 'keyword' : 'constant';
    await WB(`/entries/${entry.id}`, { method: 'PUT', body: JSON.stringify({ strategy: next }) });
    onReload();
  };

  const doEnabled = async () => {
    await WB(`/entries/${entry.id}`, { method: 'PUT', body: JSON.stringify({ enabled: entry.enabled ? 0 : 1 }) });
    setSlideX(0); onReload();
  };
  const doCopy   = () => { setSlideX(0); onCopy(entry); };
  const doDelete = () => { setSlideX(0); onDelete(entry.id); };

  const save = async () => {
    setSaving(true);
    try {
      const kws  = form.keywordText.split(',').map((s: string) => s.trim()).filter(Boolean);
      const fkws = form.filterKeywordText.split(',').map((s: string) => s.trim()).filter(Boolean);
      await WB(`/entries/${entry.id}`, { method: 'PUT', body: JSON.stringify({
        ...form,
        keywords:       JSON.stringify(kws),
        filterKeywords: fkws.length ? JSON.stringify(fkws) : null,
        inclusionGroup: form.inclusionGroup.trim() || null,
      }) });
      setDirty(false);
    } finally { setSaving(false); }
  };

  const isKeyword     = form.strategy === 'keyword';
  const actionOpacity = Math.min(1, Math.max(0, (-slideX - 10) / 25));

  return (
    <div className="relative">
      {/* 右侧操作区（渐显） */}
      <div className="absolute right-0 top-0 bottom-0 flex flex-col items-center justify-center gap-4 pointer-events-none"
        style={{ width: SNAP, opacity: actionOpacity, transition: 'opacity 0.1s' }}>
        <button style={{ pointerEvents: actionOpacity > 0.3 ? 'auto' : 'none' }}
          onClick={doEnabled} className="text-gray-500 hover:text-gray-800 transition-colors"
          title={entry.enabled ? '禁用' : '启用'}>
          {entry.enabled ? <Eye size={17} strokeWidth={1.3} /> : <EyeOff size={17} strokeWidth={1.3} />}
        </button>
        <button style={{ pointerEvents: actionOpacity > 0.3 ? 'auto' : 'none' }}
          onClick={doCopy} className="text-gray-500 hover:text-gray-800 transition-colors">
          <Copy size={16} strokeWidth={1.3} />
        </button>
        <button style={{ pointerEvents: actionOpacity > 0.3 ? 'auto' : 'none' }}
          onClick={doDelete} className="text-gray-600 hover:text-red-600 transition-colors">
          <Trash2 size={16} strokeWidth={1.3} />
        </button>
      </div>

      {/* 条目主体（transform 仅在滑动时设置，避免破坏 position:fixed 子元素） */}
      <div
        style={{
          ...(slideX !== 0 ? { transform: `translateX(${slideX}px)` } : {}),
          transition: 'transform 0.18s ease-out',
          position: 'relative',
          zIndex: 1,
          backgroundImage: 'url(/paper-bg.jpg)',
          backgroundSize: 'cover',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={e  => { touchX0.current = e.touches[0].clientX; }}
        onTouchMove={e   => {
          const dx = e.touches[0].clientX - touchX0.current;
          if (dx < 0) setSlideX(Math.max(dx, -SNAP));
          else if (slideX < 0) setSlideX(Math.min(0, slideX + dx));
        }}
        onTouchEnd={() => { slideX < -SNAP * 0.5 ? setSlideX(-SNAP) : setSlideX(0); }}
        className={!entry.enabled ? 'opacity-40' : ''}
      >
        {/* 策略指示圆点 — 左侧书脊旁，点击切换 */}
        <button onClick={toggleStrategy}
          className="absolute top-4 flex items-center justify-center transition-opacity hover:opacity-70"
          style={{ left: 17, zIndex: 3 }}
          title={isKeyword ? '关键词触发 → 点切常驻' : '常驻 → 点切关键词'}>
          <svg width="7" height="7" viewBox="0 0 7 7">
            <circle cx="3.5" cy="3.5" r="3"
              fill={isKeyword ? 'rgba(60,100,48,0.80)' : 'rgba(38,18,6,0.25)'}
              stroke={isKeyword ? 'rgba(50,85,38,0.7)' : 'rgba(38,18,6,0.45)'}
              strokeWidth="0.8" />
          </svg>
        </button>

        {/* 行1：名称（左移以避开圆点） + 书图标 */}
        <div className="flex items-start gap-2 pt-3 pl-7 pr-4 pb-0.5">
          <input value={form.memo} onChange={e => set('memo', e.target.value)}
            placeholder="条目名称"
            className="flex-1 text-[15px] font-semibold text-gray-800 bg-transparent border-b border-gray-200 focus:border-gray-600 focus:outline-none pb-0.5 min-w-0 placeholder-gray-300" />
          <button onClick={() => setExpanded(o => !o)}
            className="mt-0.5 shrink-0 text-gray-600 hover:text-gray-900 transition-colors">
            <BookSVG open={expanded} />
          </button>
        </div>

        {/* 行2：位置/排序/概率（斜体淡色，行内可编辑） */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-7 pr-4 pb-3 pt-1">
          <InlineDropdown options={POSITIONS} value={form.position} onChange={v => set('position', v)} />
          {form.position === 'depth' && (
            <span className="text-xs italic text-gray-400 flex items-center gap-0.5">
              深度&thinsp;<input type="number" value={form.depth} onChange={e => set('depth', +e.target.value)}
                className="w-8 bg-transparent border-b border-gray-300 text-center text-xs italic text-gray-400 focus:outline-none" />
            </span>
          )}
          <span className="text-xs italic text-gray-400 flex items-center gap-0.5">
            排&thinsp;<input type="number" value={form.orderNum} onChange={e => set('orderNum', +e.target.value)}
              className="w-8 bg-transparent border-b border-gray-300 text-center text-xs italic text-gray-400 focus:outline-none" />
          </span>
          <span className="text-xs italic text-gray-400 flex items-center gap-0.5">
            <input type="number" min={0} max={100} value={form.probability}
              onChange={e => set('probability', +e.target.value)}
              className="w-10 bg-transparent border-b border-gray-300 text-center text-xs italic text-gray-400 focus:outline-none" />%
          </span>
        </div>

        {/* 展开详情 */}
        {expanded && (
          <div className="px-4 pb-3 space-y-3">

            {/* 关键词区（strategy=keyword 时显示） */}
            {isKeyword && (
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-gray-500 shrink-0">关键词：</span>
                  <input value={form.keywordText} onChange={e => set('keywordText', e.target.value)}
                    placeholder="词1, 词2, ..."
                    className="flex-1 text-xs text-gray-700 bg-transparent border-b border-gray-300 focus:border-gray-600 focus:outline-none pb-0.5 placeholder-gray-300 min-w-0" />
                </div>
                {/* 条件行：直接左对齐，紧靠关键词标签下方 */}
                <div className="flex items-baseline gap-2">
                  <InlineDropdown options={FILTER_LOGICS} value={form.filterLogic} onChange={v => set('filterLogic', v)} italic={false} />
                  <input value={form.filterKeywordText} onChange={e => set('filterKeywordText', e.target.value)}
                    placeholder="过滤词, ..."
                    className="flex-1 text-xs text-gray-600 bg-transparent border-b border-gray-300 focus:border-gray-600 focus:outline-none pb-0.5 placeholder-gray-300 min-w-0" />
                </div>
                <div className="flex gap-3 pt-0.5">
                  {[['caseSensitive', '大小写'], ['matchWholeWord', '全词']].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={!!(form as any)[k]}
                        onChange={e => set(k, e.target.checked ? 1 : 0)} className="accent-gray-500" />{l}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 内容（四角框） */}
            <CornerBox>
              <textarea value={form.content} onChange={e => set('content', e.target.value)}
                placeholder="条目内容…" rows={4}
                className="w-full text-sm text-gray-800 bg-transparent resize-y focus:outline-none placeholder-gray-300 leading-relaxed" />
            </CornerBox>

            {/* 高级设置（折叠） */}
            <button onClick={() => setAdvOpen(o => !o)}
              className="text-[11px] italic text-gray-400 hover:text-gray-600 transition-colors select-none">
              高级设置{advOpen ? ' ▴' : ' ▾'}
            </button>

            {advOpen && (
              <div className="space-y-2.5 pl-1">
                <div className="grid grid-cols-3 gap-2">
                  {[['sticky', '黏性'], ['cooldown', '冷却'], ['delay', '延迟']].map(([k, l]) => (
                    <div key={k}>
                      <label className="text-[10px] italic text-gray-400 block mb-0.5">{l}(条)</label>
                      <input type="number" min={0} value={(form as any)[k]}
                        onChange={e => set(k, +e.target.value)}
                        className="w-full text-xs text-gray-600 bg-transparent border-b border-gray-200 text-center focus:outline-none focus:border-gray-400" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-4">
                  {[['noRecurse', '不触发其他'], ['noFurtherRecurse', '不被触发']].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-1 text-[10px] italic text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={!!(form as any)[k]}
                        onChange={e => set(k, e.target.checked ? 1 : 0)} className="accent-gray-500" />{l}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 items-baseline">
                  <input value={form.inclusionGroup} onChange={e => set('inclusionGroup', e.target.value)}
                    placeholder="互斥组名"
                    className="flex-1 text-xs text-gray-600 bg-transparent border-b border-gray-200 focus:outline-none placeholder-gray-300" />
                  <span className="text-[10px] italic text-gray-400 shrink-0">权重</span>
                  <input type="number" min={1} value={form.groupWeight}
                    onChange={e => set('groupWeight', +e.target.value)}
                    className="w-12 text-xs text-gray-600 bg-transparent border-b border-gray-200 text-center focus:outline-none" />
                </div>
              </div>
            )}

            {/* 保存栏 */}
            {dirty && (
              <div className="flex items-center gap-2 pt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-[10px] italic text-amber-600 flex-1">有改动</span>
                <button onClick={() => { setForm(initForm(entry)); setDirty(false); }}
                  className="text-[11px] italic text-gray-400 hover:text-gray-600">撤销</button>
                <button onClick={save} disabled={saving}
                  className="text-xs text-gray-700 border-b border-gray-500 pb-0.5 hover:text-gray-900 disabled:opacity-40">
                  {saving ? '…' : '保存'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── 新建条目表单 ─────────────────────────────────────────────────
export const NewEntryInline = ({ bookId, onSave, onCancel }: any) => {
  const [name,    setName]    = useState('');
  const [content, setContent] = useState('');
  const [saving,  setSaving]  = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await WB('/entries', { method: 'POST', body: JSON.stringify({
        bookId, memo: name.trim(), content: content.trim(),
        strategy: 'constant', probability: 100, position: 'system-bottom',
        depth: 0, orderNum: 0, keywords: '[]',
      }) });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="px-4 pt-3 pb-4">
      <input value={name} onChange={e => setName(e.target.value)}
        placeholder="条目名称" autoFocus
        className="w-full text-[15px] font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:border-gray-600 focus:outline-none pb-0.5 placeholder-gray-300 mb-3" />
      <CornerBox>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder="内容…" rows={3}
          className="w-full text-sm text-gray-800 bg-transparent resize-none focus:outline-none placeholder-gray-300" />
      </CornerBox>
      <div className="flex items-center gap-3 mt-2.5">
        <button onClick={save} disabled={saving}
          className="text-xs text-gray-700 border-b border-gray-500 pb-0.5 hover:text-gray-900 disabled:opacity-40">
          {saving ? '创建中…' : '创建'}
        </button>
        <button onClick={onCancel} className="text-xs italic text-gray-400 hover:text-gray-600">取消</button>
      </div>
    </div>
  );
};
