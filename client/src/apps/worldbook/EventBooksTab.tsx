/**
 * worldbook/EventBooksTab.tsx — 事件书列表、事件详情、事件编辑表单
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown,
  Plus, Trash2, BookOpen,
  Play, Lock, Clock, Check, RefreshCw, Edit3,
} from 'lucide-react';
import { EVT } from './api';
import { EVT_SCOPES, EVT_STATUSES, getStatus } from './constants';
import type { Opt } from './constants';
import { BottomPopup } from './ui';

// ── 选项行按钮（含底部弹窗） ─────────────────────────────────────
const SelectRow = ({ label, options, value, onChange }: {
  label: string; options: Opt[]; value: string; onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const cur = options.find(o => o.value === value);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-700 transition-colors">
        <span className="text-gray-400 mr-0.5">{label}</span>{cur?.label ?? value}
        <ChevronDown size={10} className="text-gray-400" />
      </button>
      {open && <BottomPopup title={label} options={options} value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  );
};

// ── 事件编辑表单 ──────────────────────────────────────────────────
const EventForm = ({ event, bookId, onSave, onCancel }: any) => {
  const isNew = !event;
  const [form, setForm] = useState(() => event
    ? { name: event.name||'', description: event.description||'', status: event.status||'locked',
        priority: event.priority??0, probability: event.probability??100,
        weight: event.weight??100, repeatable: event.repeatable??0, maxTriggers: event.maxTriggers??'' }
    : { name:'', description:'', status:'locked', priority:0, probability:100,
        weight:100, repeatable:0, maxTriggers:'' as number|'' }
  );
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, maxTriggers: form.maxTriggers === '' ? null : +form.maxTriggers };
      if (isNew) await EVT(`/event-books/${bookId}/events`, { method: 'POST', body: JSON.stringify(body) });
      else       await EVT(`/events/item/${event.id}`,      { method: 'PUT',  body: JSON.stringify(body) });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="h-12 flex items-center px-3 gap-2 shrink-0 border-b border-gray-100">
        <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <span className="font-medium text-gray-800 flex-1 text-sm">{isNew ? '新建事件' : '编辑事件'}</span>
        <button onClick={save} disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg disabled:opacity-40 hover:bg-gray-900">
          {saving ? '…' : '保存'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar">
        <p className="text-[11px] text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
          触发条件/效果在 <span className="text-indigo-500">元系统 → 规则系统</span> 中配置
        </p>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="事件名称 *"
          className="w-full border-b border-gray-200 pb-1 text-sm text-gray-800 focus:outline-none focus:border-gray-500 placeholder-gray-300 bg-transparent" />
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          rows={3} placeholder="描述（可选）"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400" />
        <SelectRow label="初始状态"
          options={EVT_STATUSES.map(s => ({ value: s.value, label: s.label }))}
          value={form.status} onChange={v => set('status', v)} />
        <div className="grid grid-cols-2 gap-3">
          {[['priority','优先级'],['probability','概率%'],['weight','权重'],['maxTriggers','最多触发']].map(([k,l]) => (
            <div key={k}>
              <label className="text-[10px] text-gray-400 block mb-1">{l}</label>
              <input type="number" value={(form as any)[k]} onChange={e => set(k, e.target.value)}
                placeholder={k==='maxTriggers'?'留空=无限':undefined}
                className="w-full border-b border-gray-200 text-sm text-gray-800 bg-transparent focus:outline-none focus:border-gray-500 pb-0.5" />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <button onClick={() => set('repeatable', form.repeatable ? 0 : 1)}
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${form.repeatable ? 'bg-gray-700' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.repeatable ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-sm text-gray-600">可重复触发</span>
        </label>
      </div>
    </div>
  );
};

// ── 事件书详情 ────────────────────────────────────────────────────
const EventBookDetail = ({ book, onBack }: any) => {
  const [events,       setEvents]       = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editing,      setEditing]      = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await EVT(`/event-books/${book.id}/events`);
    setEvents(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [book.id]);
  useEffect(() => { load(); }, [load]);

  if (editing === 'new') return <EventForm bookId={book.id} onSave={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />;
  if (editing)           return <EventForm event={editing} bookId={book.id} onSave={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />;

  const statusCounts: Record<string,number> = {};
  events.forEach(e => { statusCounts[e.status] = (statusCounts[e.status]||0)+1; });
  const filtered = statusFilter === 'all' ? events : events.filter(e => e.status === statusFilter);
  const transition = async (id: string, action: 'unlock'|'complete'|'reset') => {
    await EVT(`/events/item/${id}/${action}`, { method: 'POST' }); load();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b shrink-0">
        <div className="h-12 flex items-center px-3 gap-2">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{book.name}</p>
            <p className="text-[10px] text-gray-400">{events.length} 个事件</p>
          </div>
          <button onClick={() => setEditing('new')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 text-white text-xs rounded-lg">
            <Plus size={12} /> 新建
          </button>
        </div>
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto no-scrollbar">
          {[{v:'all',l:`全部(${events.length})`},
            ...EVT_STATUSES.map(s=>({v:s.value,l:`${s.label}(${statusCounts[s.value]||0})`}))
          ].map(({v,l}) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap shrink-0 transition-colors
                ${statusFilter===v ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading && <p className="text-center text-gray-400 text-sm mt-8">加载中…</p>}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <BookOpen size={28} strokeWidth={1.3} /><p className="text-sm">暂无事件</p>
          </div>
        )}
        {filtered.map(e => {
          const st = getStatus(e.status);
          const StIcon = st.icon;
          return (
            <div key={e.id} className="border-b border-gray-100 px-3 py-3 bg-white">
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full shrink-0 ${st.bg} ${st.text}`}>
                  <StIcon size={9}/>{st.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">{e.name}</p>
                  {e.description && <p className="text-xs text-gray-400 truncate">{e.description}</p>}
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400">{e.probability}%</span>
                    {e.repeatable ? <span className="text-[10px] text-gray-500">可重复</span> : null}
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {e.status==='locked'    && <button title="解锁"  onClick={() => transition(e.id,'unlock')}   className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight size={14} className="text-amber-500" /></button>}
                  {e.status==='pending'   && <button title="完成"  onClick={() => transition(e.id,'complete')} className="p-1.5 hover:bg-gray-100 rounded-lg"><Check size={14} className="text-green-500" /></button>}
                  {e.status==='completed' && e.repeatable && <button title="重置" onClick={() => transition(e.id,'reset')} className="p-1.5 hover:bg-gray-100 rounded-lg"><RefreshCw size={14} className="text-blue-500" /></button>}
                  <button onClick={() => setEditing(e)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit3 size={13} className="text-gray-400" /></button>
                  <button onClick={async () => { if (!confirm('删除？')) return; await EVT(`/events/item/${e.id}`,{method:'DELETE'}); load(); }} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={13} className="text-red-400" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 事件书列表 Tab ────────────────────────────────────────────────
export const EventBooksTab = () => {
  const [books,    setBooks]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [openBook, setOpenBook] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState('');
  const [newScope, setNewScope] = useState('global');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await EVT('/event-books');
    setBooks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (openBook) return <EventBookDetail book={openBook} onBack={() => { setOpenBook(null); load(); }} />;

  const createBook = async () => {
    if (!newName.trim()) return;
    await EVT('/event-books', { method: 'POST', body: JSON.stringify({ name: newName.trim(), scope: newScope }) });
    setNewName(''); setCreating(false); load();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-white shrink-0">
        <p className="text-xs text-gray-400 flex-1">按主题或剧情线组织事件</p>
        <button onClick={() => setCreating(o => !o)} className="text-gray-600 hover:text-gray-900 transition-colors">
          <Plus size={18} strokeWidth={1.5} />
        </button>
      </div>
      {creating && (
        <div className="px-3 py-2.5 border-b border-gray-100 bg-white shrink-0 space-y-2">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key==='Enter' && createBook()} placeholder="事件书名称…"
            className="w-full border-b border-gray-300 text-sm text-gray-800 bg-transparent pb-0.5 focus:outline-none focus:border-gray-600 placeholder-gray-300" />
          <div className="flex gap-2">
            <SelectRow label="范围" options={EVT_SCOPES} value={newScope} onChange={setNewScope} />
            <button onClick={createBook} className="text-xs text-gray-700 border-b border-gray-500 pb-0.5">确认</button>
            <button onClick={() => setCreating(false)} className="text-xs italic text-gray-400">取消</button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-2">
        {loading && <p className="text-center text-gray-400 text-sm mt-8">加载中…</p>}
        {!loading && books.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <BookOpen size={28} strokeWidth={1.3} /><p className="text-sm italic">还没有事件书</p>
          </div>
        )}
        {books.map((book, i) => (
          <React.Fragment key={book.id}>
            <div className="flex items-center gap-2 py-2.5">
              <button onClick={() => setOpenBook(book)} className="flex-1 text-left min-w-0">
                <p className="text-sm text-gray-800 font-medium truncate">{book.name}</p>
                <p className="text-[10px] text-gray-400">{EVT_SCOPES.find(s=>s.value===book.scope)?.label}</p>
              </button>
              <button onClick={() => setOpenBook(book)} className="text-gray-400 hover:text-gray-700">
                <ChevronRight size={14} strokeWidth={1.3} />
              </button>
              <button onClick={async () => { if (!confirm('删除此事件书？')) return; await EVT(`/event-books/${book.id}`,{method:'DELETE'}); load(); }}
                className="text-gray-400 hover:text-red-500 transition-colors">
                <Trash2 size={14} strokeWidth={1.3} />
              </button>
            </div>
            {i < books.length - 1 && <div className="border-t border-gray-100" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
