/**
 * 世界书 App
 * 三层结构：书列表 → 书详情（条目列表）→ 条目编辑表单
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, Plus, Trash2, Edit3, ChevronRight,
  BookCopy, AlignLeft, Zap, Shuffle, Settings2, Eye, EyeOff,
} from 'lucide-react';

const API = (path, opts = {}) => fetch(`/api/worldbook${path}`, {
  headers: { 'Content-Type': 'application/json' }, ...opts,
}).then(r => r.json());

// ── 激活模式配置 ──────────────────────────────────────────────────────────
const ACTIVATION_MODES = [
  { value: 'always',             label: '始终激活',   icon: Zap,      color: 'text-yellow-500', desc: '始终插入上下文' },
  { value: 'keyword',            label: '关键词触发', icon: AlignLeft, color: 'text-blue-500',   desc: '消息中含关键词时激活' },
  { value: 'event-random',       label: '随机事件',   icon: Shuffle,  color: 'text-purple-500', desc: '每次生活生成随机选入' },
  { value: 'event-conditional',  label: '条件事件',   icon: Settings2, color: 'text-orange-500', desc: '满足数值条件时才进入事件池' },
];

const INSERTION_POSITIONS = [
  { value: 'system-top',    label: 'System 顶部',  desc: '角色定义之前（世界观/全局背景）' },
  { value: 'system-bottom', label: 'System 底部',  desc: '角色定义之后（规则补充）' },
  { value: 'before-chat',   label: '对话前',       desc: '插在聊天记录开头' },
  { value: 'after-chat',    label: '对话后',       desc: '插在聊天记录结尾、新消息之前' },
];

const STAT_KEYS = ['mood', 'energy', 'relationship', 'trust', 'stress'];
const STAT_NAMES = { mood: '心情', energy: '精力', relationship: '好感度', trust: '信任度', stress: '压力' };
const COND_OPS = [
  { value: 'gte', label: '≥' }, { value: 'lte', label: '≤' },
  { value: 'gt',  label: '>' }, { value: 'lt',  label: '<' },
  { value: 'eq',  label: '=' },
];

// ── 条目编辑表单 ───────────────────────────────────────────────────────────
const EntryForm = ({ entry, bookId, onSave, onCancel }) => {
  const isNew = !entry;
  const [form, setForm] = useState(entry ? { ...entry } : {
    name: '', content: '', enabled: true,
    keywords: [], activationMode: 'always',
    insertionPosition: 'system-bottom', priority: 100,
    noRecurse: false, noFurtherRecurse: false,
    eventConfig: { tags: [], weight: 1, condition: { stat: 'mood', op: 'gte', value: 50 } },
  });
  const [kwInput, setKwInput] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setEvent = (k, v) => setForm(f => ({
    ...f, eventConfig: { ...f.eventConfig, [k]: v }
  }));
  const setCondition = (k, v) => setForm(f => ({
    ...f,
    eventConfig: { ...f.eventConfig, condition: { ...f.eventConfig?.condition, [k]: v } }
  }));

  const addKw = () => {
    const kw = kwInput.trim();
    if (kw && !form.keywords.includes(kw)) set('keywords', [...form.keywords, kw]);
    setKwInput('');
  };

  const save = async () => {
    if (!form.content.trim()) { alert('内容不能为空'); return; }
    setSaving(true);
    try {
      if (isNew) {
        await API('/entries', { method: 'POST', body: JSON.stringify({ ...form, bookId }) });
      } else {
        await API(`/entries/${entry.id}`, { method: 'PUT', body: JSON.stringify(form) });
      }
      onSave();
    } finally { setSaving(false); }
  };

  const modeInfo = ACTIVATION_MODES.find(m => m.value === form.activationMode);
  const isEvent = form.activationMode.startsWith('event-');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 顶栏 */}
      <div className="h-12 bg-white border-b flex items-center px-3 gap-2 shrink-0">
        <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-gray-800 flex-1 text-sm">{isNew ? '新建条目' : '编辑条目'}</span>
        <button
          onClick={save} disabled={saving}
          className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* 名称 */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">条目名称（内部标识，可选）</label>
          <input
            value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="如：主角性格、晨间习惯…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
          />
        </div>

        {/* 内容 */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">条目内容 *</label>
          <textarea
            value={form.content} onChange={e => set('content', e.target.value)}
            rows={5}
            placeholder="这里填写要注入上下文的文本内容…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none"
          />
        </div>

        {/* 激活模式 */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">激活模式</label>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVATION_MODES.map(m => {
              const Icon = m.icon;
              const active = form.activationMode === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => set('activationMode', m.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                    active ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} className={active ? 'text-indigo-500' : 'text-gray-400'} />
                  <div>
                    <p className={`text-xs font-medium ${active ? 'text-indigo-700' : 'text-gray-700'}`}>{m.label}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{m.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 关键词（keyword 模式） */}
        {form.activationMode === 'keyword' && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">触发关键词</label>
            <div className="flex gap-1.5 mb-2">
              <input
                value={kwInput} onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKw()}
                placeholder="输入关键词后回车或点击添加"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
              />
              <button onClick={addKw} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm">+</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.keywords.map(kw => (
                <span key={kw} className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                  {kw}
                  <button onClick={() => set('keywords', form.keywords.filter(k => k !== kw))} className="text-indigo-400 hover:text-indigo-700">×</button>
                </span>
              ))}
              {form.keywords.length === 0 && <span className="text-xs text-gray-400">尚未添加关键词</span>}
            </div>
          </div>
        )}

        {/* 事件配置（event-* 模式） */}
        {isEvent && (
          <div className="border border-orange-200 bg-orange-50 rounded-xl p-3 space-y-3">
            <p className="text-xs font-semibold text-orange-700">事件配置</p>

            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-600 w-14 shrink-0">随机权重</label>
              <input
                type="number" min={1} max={10}
                value={form.eventConfig?.weight ?? 1}
                onChange={e => setEvent('weight', +e.target.value)}
                className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center"
              />
              <span className="text-[10px] text-gray-400">（越大越容易被选中，1-10）</span>
            </div>

            {/* 条件（仅 event-conditional） */}
            {form.activationMode === 'event-conditional' && (
              <div>
                <p className="text-[10px] text-orange-600 mb-1.5">满足以下数值条件时才进入事件候选池：</p>
                <div className="flex items-center gap-2">
                  <select
                    value={form.eventConfig?.condition?.stat || 'mood'}
                    onChange={e => setCondition('stat', e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 text-sm bg-white"
                  >
                    {STAT_KEYS.map(k => <option key={k} value={k}>{STAT_NAMES[k]}</option>)}
                  </select>
                  <select
                    value={form.eventConfig?.condition?.op || 'gte'}
                    onChange={e => setCondition('op', e.target.value)}
                    className="border border-gray-200 rounded px-2 py-1 text-sm bg-white w-12 text-center"
                  >
                    {COND_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    type="number" min={0} max={100}
                    value={form.eventConfig?.condition?.value ?? 50}
                    onChange={e => setCondition('value', +e.target.value)}
                    className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center"
                  />
                  <span className="text-[10px] text-gray-400">（0-100）</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 插入位置（非事件模式才有意义） */}
        {!isEvent && (
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">插入位置</label>
            <div className="space-y-1.5">
              {INSERTION_POSITIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => set('insertionPosition', p.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                    form.insertionPosition === p.value
                      ? 'border-indigo-400 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-800">{p.label}</p>
                    <p className="text-[10px] text-gray-400">{p.desc}</p>
                  </div>
                  {form.insertionPosition === p.value && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 优先级 & 启用 */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">排列优先级（数值越小越靠前）</label>
            <input
              type="number"
              value={form.priority} onChange={e => set('priority', +e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <button
              onClick={() => set('enabled', !form.enabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.enabled ? 'bg-indigo-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-gray-600">{form.enabled ? '已启用' : '已禁用'}</span>
          </div>
        </div>

        {/* 递归控制（仅 keyword / always 模式） */}
        {!isEvent && (
          <div className="border border-gray-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium text-gray-600">级联激活控制</p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox" checked={!!form.noRecurse}
                onChange={e => set('noRecurse', e.target.checked)}
                className="mt-0.5 accent-indigo-500"
              />
              <div>
                <p className="text-xs text-gray-700 font-medium">不可递归</p>
                <p className="text-[10px] text-gray-400">此条目不会被其他世界书条目的内容激活，只响应原始对话消息</p>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox" checked={!!form.noFurtherRecurse}
                onChange={e => set('noFurtherRecurse', e.target.checked)}
                className="mt-0.5 accent-indigo-500"
              />
              <div>
                <p className="text-xs text-gray-700 font-medium">防止进一步递归</p>
                <p className="text-[10px] text-gray-400">此条目被激活后，其内容不会用于触发其他世界书条目</p>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

// ── 书详情页（条目列表） ───────────────────────────────────────────────────
const BookDetail = ({ book, onBack }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null=列表, 'new'=新建, entry=编辑
  const [scanDepth, setScanDepth] = useState(book.scanDepth ?? 20);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await API(`/entries?bookId=${book.id}`);
    setEntries(Array.isArray(data) ? data.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100)) : []);
    setLoading(false);
  }, [book.id]);

  useEffect(() => { load(); }, [load]);

  const deleteEntry = async (id) => {
    if (!confirm('确认删除此条目？')) return;
    await API(`/entries/${id}`, { method: 'DELETE' });
    load();
  };

  const toggleEntry = async (entry) => {
    await API(`/entries/${entry.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !entry.enabled }) });
    load();
  };

  const saveScanDepth = async (val) => {
    const v = Math.max(1, Math.min(200, val || 20));
    setScanDepth(v);
    await API(`/books/${book.id}`, { method: 'PUT', body: JSON.stringify({ scanDepth: v }) });
  };

  if (editing === 'new' || (editing && editing !== null)) {
    return (
      <EntryForm
        entry={editing === 'new' ? null : editing}
        bookId={book.id}
        onSave={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const modeColor = (mode) => {
    return ACTIVATION_MODES.find(m => m.value === mode)?.color || 'text-gray-400';
  };
  const modeLabel = (mode) => ACTIVATION_MODES.find(m => m.value === mode)?.label || mode;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b shrink-0">
        <div className="h-12 flex items-center px-3 gap-2">
          <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={20} className="text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{book.name}</p>
            <p className="text-[10px] text-gray-400">{entries.length} 条条目</p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white text-xs rounded-lg"
          >
            <Plus size={12} /> 新建条目
          </button>
        </div>
        <div className="flex items-center gap-2 px-4 pb-2">
          <span className="text-[10px] text-gray-400">关键词扫描深度（最近 N 条消息）：</span>
          <input
            type="number" min={1} max={200}
            value={scanDepth}
            onChange={e => setScanDepth(+e.target.value)}
            onBlur={e => saveScanDepth(+e.target.value)}
            className="w-14 border border-gray-200 rounded px-2 py-0.5 text-xs text-center focus:outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <p className="text-center text-gray-400 text-sm mt-8">加载中…</p>}
        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <AlignLeft size={32} />
            <p className="text-sm">还没有条目</p>
            <p className="text-xs">点击右上角「新建条目」开始创建</p>
          </div>
        )}
        {!loading && entries.map(e => {
          const ModeIcon = ACTIVATION_MODES.find(m => m.value === e.activationMode)?.icon || Zap;
          return (
            <div key={e.id} className={`bg-white border-b border-gray-100 px-4 py-3 ${!e.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-2">
                <button onClick={() => toggleEntry(e)} className="mt-0.5 shrink-0">
                  {e.enabled
                    ? <Eye size={14} className="text-indigo-400" />
                    : <EyeOff size={14} className="text-gray-400" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <ModeIcon size={11} className={modeColor(e.activationMode)} />
                    <span className={`text-[10px] font-medium ${modeColor(e.activationMode)}`}>{modeLabel(e.activationMode)}</span>
                    {e.name && <span className="text-xs text-gray-700 font-medium">· {e.name}</span>}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{e.content}</p>
                  {e.activationMode === 'keyword' && e.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {e.keywords.map(kw => (
                        <span key={kw} className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full border border-blue-200">{kw}</span>
                      ))}
                    </div>
                  )}
                  {e.activationMode === 'event-conditional' && e.eventConfig?.condition && (
                    <p className="text-[10px] text-orange-500 mt-0.5">
                      条件：{STAT_NAMES[e.eventConfig.condition.stat] || e.eventConfig.condition.stat}
                      {' '}{COND_OPS.find(o => o.value === e.eventConfig.condition.op)?.label || e.eventConfig.condition.op}
                      {' '}{e.eventConfig.condition.value}
                    </p>
                  )}
                </div>
                <button onClick={() => setEditing(e)} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
                  <Edit3 size={14} className="text-gray-400" />
                </button>
                <button onClick={() => deleteEntry(e.id)} className="p-1.5 hover:bg-red-50 rounded-lg shrink-0">
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 书列表（主页） ────────────────────────────────────────────────────────
const WorldbookApp = ({ onBack }) => {
  const [books, setBooks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [openBook, setOpenBook] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]  = useState('');
  const [newScanDepth, setNewScanDepth] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await API('/books');
    setBooks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (openBook) {
    return <BookDetail book={openBook} onBack={() => { setOpenBook(null); load(); }} />;
  }

  const createBook = async () => {
    if (!newName.trim()) return;
    await API('/books', { method: 'POST', body: JSON.stringify({ name: newName.trim(), scanDepth: newScanDepth }) });
    setNewName('');
    setNewScanDepth(20);
    setCreating(false);
    load();
  };

  const deleteBook = async (id) => {
    if (!confirm('删除此世界书及其所有条目？')) return;
    await API(`/books/${id}`, { method: 'DELETE' });
    load();
  };

  const toggleBook = async (book) => {
    await API(`/books/${book.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !book.enabled }) });
    load();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 顶栏 */}
      <div className="h-14 bg-white border-b flex items-center px-4 gap-2 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <BookCopy size={18} className="text-indigo-500" />
        <span className="font-bold text-gray-800 flex-1">世界书</span>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg"
        >
          <Plus size={12} /> 新建
        </button>
      </div>

      {/* 说明 */}
      <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100">
        <p className="text-[11px] text-indigo-700">
          世界书存储大量背景文本，通过关键词触发或始终激活，自动注入聊天上下文。
          事件条目供角色生活生成使用。
        </p>
      </div>

      {/* 新建表单 */}
      {creating && (
        <div className="bg-white border-b px-4 py-3 space-y-2">
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createBook()}
              placeholder="新世界书名称…"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
            />
            <button onClick={createBook} className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg">确认</button>
            <button onClick={() => setCreating(false)} className="px-3 py-2 text-gray-500 text-sm">取消</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">扫描深度（最近几条消息）：</span>
            <input
              type="number" min={1} max={200}
              value={newScanDepth} onChange={e => setNewScanDepth(+e.target.value)}
              className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>
      )}

      {/* 书列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading && <p className="text-center text-gray-400 text-sm mt-8">加载中…</p>}
        {!loading && books.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <BookCopy size={40} />
            <p className="text-sm">还没有世界书</p>
            <p className="text-xs text-center px-8">新建一本世界书，然后添加条目来设置角色的世界观、事件等</p>
          </div>
        )}
        {books.map(book => (
          <div key={book.id} className={`bg-white border-b border-gray-100 ${!book.enabled ? 'opacity-60' : ''}`}>
            <div className="flex items-center px-4 py-3 gap-3">
              <button onClick={() => toggleBook(book)} className="shrink-0">
                {book.enabled
                  ? <Eye size={16} className="text-indigo-400" />
                  : <EyeOff size={16} className="text-gray-400" />
                }
              </button>
              <button className="flex-1 text-left" onClick={() => setOpenBook(book)}>
                <p className="text-sm font-semibold text-gray-800">{book.name}</p>
                {book.description && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{book.description}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {book.charId ? '角色专属' : '全局'} · {book.enabled ? '已启用' : '已禁用'} · 扫描深度 {book.scanDepth ?? 20}
                </p>
              </button>
              <button onClick={() => setOpenBook(book)} className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
                <ChevronRight size={16} className="text-gray-400" />
              </button>
              <button onClick={() => deleteBook(book.id)} className="p-1.5 hover:bg-red-50 rounded-lg shrink-0">
                <Trash2 size={14} className="text-red-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorldbookApp;
