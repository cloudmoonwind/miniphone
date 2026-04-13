/**
 * worldbook/WorldbookTab.tsx — 世界书列表、书详情、设置弹窗
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Upload, Download, Settings, Copy, ChevronRight, AlignLeft, X } from 'lucide-react';
import { WB, getWBSettings, saveWBSettings } from './api';
import { SpineStrip, PageStack, InnerShadow, EntryDivider } from './ui';
import { EntryCard, NewEntryInline } from './EntryCard';

// ── 设置弹窗 ──────────────────────────────────────────────────────
const SettingsModal = ({ settings, onSave, onClose }: any) => {
  const [form, setForm] = useState({ ...settings });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl pb-8 shadow-xl"
        style={{ backgroundImage: 'url(/paper-bg.jpg)', backgroundSize: 'cover' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: 'rgba(90,60,35,0.15)' }}>
          <span className="font-medium text-gray-800 text-sm tracking-wide">世界书设置</span>
          <button onClick={onClose}><X size={17} className="text-gray-400" /></button>
        </div>
        <div className="px-4 py-4 space-y-4">
          {[
            { key: 'scanDepth',      label: '全局扫描深度',      hint: '扫描最近 N 条消息以触发关键词',     min: 1, max: 200 },
            { key: 'contextPercent', label: '上下文百分比 (%)',   hint: '世界书内容占发送上下文的最大比例',  min: 1, max: 80  },
            { key: 'entriesPerPage', label: '单页条目数',         hint: '每页显示的最大条目数量',            min: 1, max: 50  },
          ].map(({ key, label, hint, min, max }) => (
            <div key={key}>
              <label className="text-xs text-gray-600 block mb-0.5">{label}</label>
              <p className="text-[10px] text-gray-400 mb-1.5">{hint}</p>
              <input type="number" min={min} max={max} value={(form as any)[key]}
                onChange={e => setForm((f: any) => ({ ...f, [key]: +e.target.value }))}
                className="w-full bg-transparent border-b border-gray-300 text-sm text-gray-800 focus:outline-none focus:border-gray-600 pb-0.5" />
            </div>
          ))}
        </div>
        <div className="px-4">
          <button onClick={() => onSave(form)}
            className="w-full py-2.5 text-sm text-gray-700 border border-gray-400 rounded-none tracking-wider hover:bg-black/5 transition-colors">
            保 存
          </button>
        </div>
      </div>
    </div>
  );
};

// ── 书详情（沉浸式，无顶栏）─────────────────────────────────────────
export const BookDetail = ({ book, onBack, entriesPerPage }: any) => {
  const [entries,  setEntries]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [page,     setPage]     = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const e = await WB(`/entries?bookId=${book.id}`);
    setEntries(Array.isArray(e) ? e.sort((a: any, b: any) => a.orderNum - b.orderNum) : []);
    setLoading(false);
  }, [book.id]);

  useEffect(() => { load(); }, [load]);

  const perPage     = entriesPerPage || 8;
  const totalPages  = Math.max(1, Math.ceil(entries.length / perPage));
  const safePage    = Math.min(page, totalPages - 1);
  const pageEntries = entries.slice(safePage * perPage, (safePage + 1) * perPage);

  const deleteEntry = async (id: string) => {
    if (!confirm('删除此条目？')) return;
    await WB(`/entries/${id}`, { method: 'DELETE' });
    load();
  };
  const copyEntry = async (entry: any) => {
    const { id, worldbookId, createdAt, updatedAt, ...rest } = entry;
    await WB('/entries', { method: 'POST', body: JSON.stringify({ ...rest, bookId: book.id, memo: (rest.memo || '') + ' 副本' }) });
    load();
  };

  return (
    <div className="flex flex-col h-full relative"
      style={{ backgroundImage: 'url(/paper-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>

      <SpineStrip />
      <PageStack />
      <InnerShadow />

      {/* 书名标题区（点击返回，与左侧脊色呼应） */}
      <div className="shrink-0 relative px-5 pt-5 pb-3"
        style={{
          background: 'linear-gradient(to bottom, rgba(38,18,6,0.10) 0%, rgba(38,18,6,0.05) 60%, transparent 100%)',
          borderBottom: '1px solid rgba(60,32,12,0.28)',
        }}>
        <div className="absolute bottom-[3px] left-5 right-5 h-px" style={{ background: 'rgba(60,32,12,0.10)' }} />

        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1" style={{ background: 'rgba(60,32,12,0.2)' }} />
          <span className="text-[8px] tracking-[0.45em] select-none" style={{ color: 'rgba(60,32,12,0.5)' }}>知识库</span>
          <div className="h-px flex-1" style={{ background: 'rgba(60,32,12,0.2)' }} />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex-1 text-center leading-snug group">
            <span className="text-[17px] font-bold tracking-wide transition-colors group-hover:opacity-60"
              style={{ color: 'rgba(38,18,6,0.85)' }}>
              《{book.name}》
            </span>
          </button>
          <button onClick={() => setCreating(o => !o)}
            className="shrink-0 mb-0.5 transition-colors hover:opacity-60"
            style={{ color: 'rgba(38,18,6,0.55)' }} title="新建条目">
            <Plus size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 条目列表 */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {creating && (
          <>
            <NewEntryInline bookId={book.id}
              onSave={() => { setCreating(false); load(); }}
              onCancel={() => setCreating(false)} />
            <EntryDivider />
          </>
        )}

        {loading && <p className="text-center text-gray-400 text-sm mt-10 italic">载入中…</p>}
        {!loading && entries.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400 pb-8">
            <AlignLeft size={22} strokeWidth={1.3} />
            <p className="text-xs italic">还没有条目，点右上角 + 新建</p>
          </div>
        )}

        {pageEntries.map((e, i) => (
          <React.Fragment key={e.id}>
            <EntryCard entry={e} onReload={load} onDelete={deleteEntry} onCopy={copyEntry} />
            {i < pageEntries.length - 1 && <EntryDivider />}
          </React.Fragment>
        ))}

        {/* 翻页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-3 border-t"
            style={{ borderColor: 'rgba(90,60,35,0.12)' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
              className="text-gray-500 disabled:opacity-30 hover:text-gray-800 transition-colors px-2 py-1 text-base leading-none">‹</button>
            <span className="text-[11px] italic text-gray-400 tracking-widest">{safePage + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}
              className="text-gray-500 disabled:opacity-30 hover:text-gray-800 transition-colors px-2 py-1 text-base leading-none">›</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── 世界书列表 Tab ────────────────────────────────────────────────
export const WorldbookTab = ({ onOpenBook }: { onOpenBook: (book: any) => void }) => {
  const [books,        setBooks]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [creating,     setCreating]     = useState(false);
  const [newName,      setNewName]      = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const s = getWBSettings();
    return { scanDepth: s.scanDepth ?? 20, contextPercent: s.contextPercent ?? 30, entriesPerPage: s.entriesPerPage ?? 8 };
  });
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await WB('/books');
    setBooks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const createBook = async () => {
    if (!newName.trim()) return;
    await WB('/books', { method: 'POST', body: JSON.stringify({ name: newName.trim(), scope: 'global' }) });
    setNewName(''); setCreating(false); load();
  };
  const toggleEnabled = async (book: any) => {
    await WB(`/books/${book.id}`, { method: 'PUT', body: JSON.stringify({ enabled: book.enabled ? 0 : 1 }) });
    load();
  };
  const copyBook = async (book: any) => {
    const entries = await WB(`/entries?bookId=${book.id}`);
    const nb = await WB('/books', { method: 'POST', body: JSON.stringify({ name: book.name + ' 副本', scope: book.scope }) });
    if (nb?.id && Array.isArray(entries)) {
      for (const e of entries) {
        const { id, worldbookId, createdAt, updatedAt, ...rest } = e;
        await WB('/entries', { method: 'POST', body: JSON.stringify({ ...rest, bookId: nb.id }) });
      }
    }
    load();
  };
  const exportBooks = async () => {
    const bs = await WB('/books');
    const out: any[] = [];
    for (const b of Array.isArray(bs) ? bs : []) {
      const entries = await WB(`/entries?bookId=${b.id}`);
      out.push({ ...b, entries: Array.isArray(entries) ? entries : [] });
    }
    const blob = new Blob([JSON.stringify({ version: 1, books: out }, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `worldbooks_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    try {
      const data     = JSON.parse(await file.text());
      const bookList = data.books ?? (Array.isArray(data) ? data : []);
      for (const book of bookList) {
        const { id, entries, createdAt, updatedAt, ...bd } = book;
        const nb = await WB('/books', { method: 'POST', body: JSON.stringify({ name: bd.name || '导入', scope: bd.scope || 'global' }) });
        if (nb?.id && Array.isArray(entries)) {
          for (const en of entries) {
            const { id: eid, worldbookId, createdAt: ec, updatedAt: eu, ...ed } = en;
            await WB('/entries', { method: 'POST', body: JSON.stringify({ ...ed, bookId: nb.id }) });
          }
        }
      }
      load();
    } catch { alert('导入失败：JSON格式有误'); }
  };

  return (
    <div className="flex flex-col h-full relative"
      style={{ backgroundImage: 'url(/paper-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>

      <SpineStrip />
      <PageStack />
      <InnerShadow />

      {/* 操作栏 */}
      <div className="flex items-center gap-3 px-5 py-2.5 shrink-0">
        <button onClick={() => setCreating(o => !o)} title="新建" className="text-gray-600 hover:text-gray-900 transition-colors">
          <Plus size={18} strokeWidth={1.5} />
        </button>
        <button onClick={() => importRef.current?.click()} title="导入JSON" className="text-gray-600 hover:text-gray-900 transition-colors">
          <Upload size={17} strokeWidth={1.5} />
        </button>
        <button onClick={exportBooks} title="导出JSON" className="text-gray-600 hover:text-gray-900 transition-colors">
          <Download size={17} strokeWidth={1.5} />
        </button>
        <div className="flex-1" />
        <button onClick={() => setShowSettings(true)} title="设置" className="text-gray-500 hover:text-gray-800 transition-colors">
          <Settings size={16} strokeWidth={1.5} />
        </button>
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>

      <div className="mx-5 h-px" style={{ background: 'rgba(90,60,35,0.15)' }} />

      {creating && (
        <div className="px-5 py-3 flex gap-2">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createBook()}
            placeholder="书名（可用 [分组] 归组）"
            className="flex-1 text-sm text-gray-800 bg-transparent border-b border-gray-400 focus:border-gray-700 focus:outline-none pb-0.5 placeholder-gray-400" />
          <button onClick={createBook} className="text-xs text-gray-700 border-b border-gray-500 pb-0.5 hover:text-gray-900">确认</button>
          <button onClick={() => { setCreating(false); setNewName(''); }} className="text-xs italic text-gray-400">取消</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-2">
        {!loading && books.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 pb-8">
            <svg width="48" height="36" viewBox="0 0 48 36" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <rect x="4"  y="4"  width="10" height="28" rx="1" />
              <rect x="18" y="8"  width="8"  height="24" rx="1" />
              <rect x="30" y="2"  width="14" height="30" rx="1" />
              <line x1="1" y1="34" x2="47" y2="34" />
            </svg>
            <p className="text-xs italic">书架空空，点 + 新建</p>
          </div>
        )}
        {books.map((book, i) => (
          <React.Fragment key={book.id}>
            <div className="flex items-center gap-3 py-2.5">
              <div className="w-[3px] h-[18px] rounded-sm shrink-0"
                style={{ background: book.enabled ? 'rgba(90,60,35,0.35)' : 'rgba(150,140,130,0.25)' }} />
              <button onClick={() => onOpenBook(book)} className="flex-1 text-left min-w-0">
                <span className={`text-sm ${book.enabled ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>{book.name}</span>
              </button>
              <button onClick={() => copyBook(book)} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                <Copy size={14} strokeWidth={1.3} />
              </button>
              <button onClick={() => onOpenBook(book)} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                <ChevronRight size={14} strokeWidth={1.3} />
              </button>
              <button onClick={() => toggleEnabled(book)} className="shrink-0" title={book.enabled ? '全局注入中' : '未注入'}>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <circle cx="5" cy="5" r="4"
                    fill={book.enabled ? 'rgba(90,60,35,0.6)' : 'none'}
                    stroke="rgba(90,60,35,0.5)" strokeWidth="1" />
                </svg>
              </button>
            </div>
            {i < books.length - 1 && <div className="h-px" style={{ background: 'rgba(90,60,35,0.08)' }} />}
          </React.Fragment>
        ))}
      </div>

      {showSettings && (
        <SettingsModal settings={settings}
          onSave={(s: any) => { setSettings(s); saveWBSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};
