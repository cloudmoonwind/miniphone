/**
 * 知识库 App — 重构版
 * 世界书：玻璃态风格 + 行内折叠条目编辑
 * 事件书：保留原有结构，统一视觉风格
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft, Plus, Trash2, ChevronRight, ChevronDown,
  BookCopy, AlignLeft, X, BookOpen, Play, Lock, Clock,
  Check, RefreshCw, Download, Upload, Copy, Settings,
  Edit3, Eye, EyeOff,
} from 'lucide-react';

// ── API helpers ─────────────────────────────────────────────────
const WB  = (path: string, opts: any = {}) => fetch(`/api/worldbook${path}`, {
  headers: { 'Content-Type': 'application/json' }, ...opts,
}).then(r => r.json());

const EVT = (path: string, opts: any = {}) => fetch(`/api${path}`, {
  headers: { 'Content-Type': 'application/json' }, ...opts,
}).then(r => r.json());

// ── 设置持久化 ───────────────────────────────────────────────────
const WB_SETTINGS_KEY = 'ics_wb_settings';
const getWBSettings = () => {
  try { return JSON.parse(localStorage.getItem(WB_SETTINGS_KEY) || '{}'); } catch { return {}; }
};
const saveWBSettings = (s: any) => {
  try { localStorage.setItem(WB_SETTINGS_KEY, JSON.stringify(s)); } catch {}
};

// ── 常量 ────────────────────────────────────────────────────────
const POSITIONS = [
  { value: 'system-top',    label: 'System顶部' },
  { value: 'system-bottom', label: 'System底部' },
  { value: 'before-chat',   label: '对话前' },
  { value: 'after-chat',    label: '对话后' },
  { value: 'depth',         label: '指定深度' },
];
const FILTER_LOGICS = [
  { value: 'AND_ANY', label: '满足任一' }, { value: 'AND_ALL', label: '满足全部' },
  { value: 'NOT_ANY', label: '排除任一' }, { value: 'NOT_ALL', label: '排除全部' },
];
const EVT_SCOPES = [
  { value: 'global', label: '全局' }, { value: 'character', label: '角色专属' },
];
const EVT_STATUSES = [
  { value: 'locked',    label: '锁定',   icon: Lock,      bg: 'bg-gray-100',   text: 'text-gray-500' },
  { value: 'pending',   label: '待触发', icon: Clock,     bg: 'bg-amber-100',  text: 'text-amber-600' },
  { value: 'active',    label: '进行中', icon: Play,      bg: 'bg-blue-100',   text: 'text-blue-600' },
  { value: 'completed', label: '已完成', icon: Check,     bg: 'bg-green-100',  text: 'text-green-600' },
];
function getStatus(v: string) { return EVT_STATUSES.find(s => s.value === v) ?? EVT_STATUSES[0]; }
const posLabel = (v: string) => POSITIONS.find(p => p.value === v)?.label ?? v;

// ── 通用 UI 基元 ─────────────────────────────────────────────────
const Glass = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white/15 backdrop-blur-[16px] border border-white/25 ${className}`}>{children}</div>
);

interface Opt { value: string; label: string }
const SelectPopup = ({ title, options, value, onChange, onClose }: {
  title: string; options: Opt[]; value: string;
  onChange: (v: string) => void; onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
    <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-t-2xl pb-6"
      onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="font-semibold text-sm text-gray-800">{title}</span>
        <button onClick={onClose} className="p-1"><X size={18} className="text-gray-400" /></button>
      </div>
      <div className="px-2 py-2 max-h-56 overflow-y-auto">
        {options.map(o => (
          <button key={o.value} onClick={() => { onChange(o.value); onClose(); }}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
              o.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
            }`}>
            {o.label}{o.value === value && <span className="float-right text-indigo-500">✓</span>}
          </button>
        ))}
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// 世界书部分
// ═══════════════════════════════════════════════════════════════

// ── 折叠条目卡 ──────────────────────────────────────────────────
const EntryCard = ({ entry, onReload, onCopy, onDelete }: any) => {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(() => ({
    memo: entry.memo || '',
    content: entry.content || '',
    strategy: entry.strategy || 'constant',
    probability: entry.probability ?? 100,
    keywords: entry.keywords ? (() => { try { return JSON.parse(entry.keywords); } catch { return []; } })() : [],
    filterKeywords: entry.filterKeywords ? (() => { try { return JSON.parse(entry.filterKeywords); } catch { return []; } })() : [],
    filterLogic: entry.filterLogic || 'AND_ANY',
    position: entry.position || 'system-bottom',
    depth: entry.depth ?? 0,
    orderNum: entry.orderNum ?? 0,
    caseSensitive: entry.caseSensitive ?? 0,
    matchWholeWord: entry.matchWholeWord ?? 0,
    noRecurse: entry.noRecurse ?? 0,
    noFurtherRecurse: entry.noFurtherRecurse ?? 0,
    inclusionGroup: entry.inclusionGroup || '',
    groupWeight: entry.groupWeight ?? 100,
    sticky: entry.sticky ?? 0,
    cooldown: entry.cooldown ?? 0,
    delay: entry.delay ?? 0,
  }));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kwIn, setKwIn] = useState('');
  const [posOpen, setPosOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);

  const set = (k: string, v: any) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  const toggleStrategy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = entry.strategy === 'constant' ? 'keyword' : 'constant';
    await WB(`/entries/${entry.id}`, { method: 'PUT', body: JSON.stringify({ strategy: next }) });
    onReload();
  };

  const save = async () => {
    setSaving(true);
    try {
      await WB(`/entries/${entry.id}`, { method: 'PUT', body: JSON.stringify({
        ...form,
        keywords: JSON.stringify(form.keywords),
        filterKeywords: form.filterKeywords.length ? JSON.stringify(form.filterKeywords) : null,
        inclusionGroup: form.inclusionGroup.trim() || null,
      }) });
      setDirty(false);
      onReload();
    } finally { setSaving(false); }
  };

  const addKw = (kw: string) => {
    if (!kw.trim() || form.keywords.includes(kw.trim())) return;
    set('keywords', [...form.keywords, kw.trim()]);
    setKwIn('');
  };

  const isKeyword = form.strategy === 'keyword';

  return (
    <div className="mb-1.5 rounded-xl overflow-hidden border border-white/20">
      {/* ── 收起态 ─────────────────────────────────────────────── */}
      <div
        onClick={() => setExpanded(e => !e)}
        className={`flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors ${expanded ? 'bg-white/20' : 'bg-white/10 hover:bg-white/15'}`}
      >
        {/* 策略圆点 */}
        <button
          onClick={toggleStrategy}
          title={isKeyword ? '关键词触发（点击切换为常驻）' : '常驻（点击切换为关键词）'}
          className={`w-3 h-3 rounded-full mt-1 shrink-0 border-2 transition-colors ${
            isKeyword ? 'bg-green-400 border-green-400' : 'bg-blue-400 border-blue-400'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm text-white font-medium truncate max-w-[140px]">
              {form.memo || '(无名条目)'}
            </span>
            <span className="text-[10px] bg-white/20 text-white/70 px-1.5 py-0.5 rounded-full">
              {posLabel(entry.position)}
            </span>
          </div>
          <div className="flex gap-2 mt-0.5 text-[10px] text-white/50 flex-wrap">
            {entry.position === 'depth' && <span>深度{entry.depth}</span>}
            <span>排序{entry.orderNum}</span>
            <span>概率{entry.probability}%</span>
            {isKeyword && entry.keywords && (() => {
              try {
                const kws = JSON.parse(entry.keywords);
                return kws.length ? <span className="text-green-300/70">{kws.slice(0,2).join('/')}…</span> : null;
              } catch { return null; }
            })()}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => onCopy(entry)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <Copy size={12} className="text-white/50" />
          </button>
          <button onClick={() => onDelete(entry.id)} className="p-1.5 hover:bg-red-400/20 rounded-lg transition-colors">
            <Trash2 size={12} className="text-red-300/70" />
          </button>
          <ChevronDown size={13} className={`text-white/40 transition-transform ml-0.5 ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* ── 展开态 ─────────────────────────────────────────────── */}
      {expanded && (
        <div className="bg-white/5 px-3 pb-3 pt-2 space-y-2.5">
          {/* 名称 */}
          <div className="flex gap-2">
            <input value={form.memo} onChange={e => set('memo', e.target.value)}
              placeholder="条目名称（备注）"
              className="flex-1 bg-white/20 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/40" />
          </div>

          {/* 内容 */}
          <textarea value={form.content} onChange={e => set('content', e.target.value)}
            placeholder="条目内容（注入到上下文的文本）"
            className="w-full bg-white/20 border border-white/20 rounded-lg px-2.5 py-2 text-sm text-white placeholder-white/40 resize-y min-h-[80px] max-h-[240px] focus:outline-none focus:border-white/40" />

          {/* 策略 + 触发关键词 */}
          {isKeyword && (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input value={kwIn} onChange={e => setKwIn(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addKw(kwIn)}
                  placeholder="触发关键词（回车添加）"
                  className="flex-1 bg-white/20 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/40" />
                <button onClick={() => addKw(kwIn)}
                  className="px-2.5 py-1.5 bg-green-500/30 text-green-200 text-xs rounded-lg">+</button>
              </div>
              {form.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {form.keywords.map((kw: string) => (
                    <span key={kw} className="flex items-center gap-1 bg-green-500/20 text-green-200 text-[10px] px-2 py-0.5 rounded-full border border-green-400/30">
                      {kw}
                      <button onClick={() => set('keywords', form.keywords.filter((k: string) => k !== kw))} className="opacity-60 hover:opacity-100">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
                  <input type="checkbox" checked={!!form.caseSensitive} onChange={e => set('caseSensitive', e.target.checked ? 1 : 0)} className="accent-green-400" />区分大小写
                </label>
                <label className="flex items-center gap-1 text-[10px] text-white/60 cursor-pointer">
                  <input type="checkbox" checked={!!form.matchWholeWord} onChange={e => set('matchWholeWord', e.target.checked ? 1 : 0)} className="accent-green-400" />全词匹配
                </label>
              </div>
            </div>
          )}

          {/* 插入位置 + 深度 */}
          <div className="flex gap-2 items-center">
            <button onClick={() => setPosOpen(true)}
              className="flex-1 flex items-center justify-between bg-white/20 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white">
              <span className="text-white/60">位置</span>
              <span>{posLabel(form.position)}<ChevronDown size={11} className="inline ml-1 text-white/40" /></span>
            </button>
            {form.position === 'depth' && (
              <input type="number" min={0} value={form.depth} onChange={e => set('depth', +e.target.value)}
                placeholder="深度"
                className="w-16 bg-white/20 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none" />
            )}
          </div>
          {posOpen && <SelectPopup title="插入位置" options={POSITIONS} value={form.position} onChange={v => set('position', v)} onClose={() => setPosOpen(false)} />}

          {/* 排序 + 概率 */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1.5">
              <span className="text-[10px] text-white/50 shrink-0">排序</span>
              <input type="number" value={form.orderNum} onChange={e => set('orderNum', +e.target.value)}
                className="flex-1 bg-white/20 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none" />
            </div>
            <div className="flex-1 flex items-center gap-1.5">
              <span className="text-[10px] text-white/50 shrink-0">概率%</span>
              <input type="number" min={0} max={100} value={form.probability} onChange={e => set('probability', +e.target.value)}
                className="flex-1 bg-white/20 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none" />
            </div>
          </div>

          {/* 高级设置折叠 */}
          <button onClick={() => setAdvOpen(o => !o)}
            className="w-full flex items-center justify-between text-[10px] text-white/40 hover:text-white/60 transition-colors">
            <span>高级设置（递归/分组/定时）</span>
            <ChevronDown size={11} className={`transition-transform ${advOpen ? 'rotate-180' : ''}`} />
          </button>
          {advOpen && (
            <div className="space-y-2 pt-1 border-t border-white/10">
              <label className="flex items-center gap-2 text-[10px] text-white/60 cursor-pointer">
                <input type="checkbox" checked={!!form.noRecurse} onChange={e => set('noRecurse', e.target.checked ? 1 : 0)} className="accent-indigo-400" />
                此条目不触发其他条目
              </label>
              <label className="flex items-center gap-2 text-[10px] text-white/60 cursor-pointer">
                <input type="checkbox" checked={!!form.noFurtherRecurse} onChange={e => set('noFurtherRecurse', e.target.checked ? 1 : 0)} className="accent-indigo-400" />
                此条目不被其他条目触发
              </label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-1">
                  <span className="text-[10px] text-white/50 shrink-0">互斥组</span>
                  <input value={form.inclusionGroup} onChange={e => set('inclusionGroup', e.target.value)}
                    placeholder="组名"
                    className="flex-1 bg-white/20 border border-white/20 rounded px-2 py-1 text-[10px] text-white focus:outline-none" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/50">权重</span>
                  <input type="number" min={1} value={form.groupWeight} onChange={e => set('groupWeight', +e.target.value)}
                    className="w-14 bg-white/20 border border-white/20 rounded px-2 py-1 text-[10px] text-white text-center focus:outline-none" />
                </div>
              </div>
              {[['sticky', 'sticky'], ['cooldown', '冷却'], ['delay', '延迟']].map(([k, l]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-[10px] text-white/50 w-12 shrink-0">{l}</span>
                  <input type="number" min={0} value={(form as any)[k]} onChange={e => set(k, +e.target.value)}
                    className="w-14 bg-white/20 border border-white/20 rounded px-2 py-1 text-[10px] text-white text-center focus:outline-none" />
                  <span className="text-[10px] text-white/40">条</span>
                </div>
              ))}
            </div>
          )}

          {/* 保存按钮 */}
          {dirty && (
            <button onClick={save} disabled={saving}
              className="w-full py-1.5 bg-indigo-500/50 hover:bg-indigo-500/70 border border-indigo-400/40 text-white text-xs rounded-lg disabled:opacity-50 transition-colors">
              {saving ? '保存中…' : '保存修改'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── 新建条目卡 ───────────────────────────────────────────────────
const NewEntryCard = ({ bookId, onSave, onCancel }: any) => {
  const [form, setForm] = useState({
    memo: '', content: '', strategy: 'constant',
    probability: 100, position: 'system-bottom', depth: 0, orderNum: 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.content.trim() && !form.memo.trim()) return;
    setSaving(true);
    try {
      await WB('/entries', { method: 'POST', body: JSON.stringify({
        bookId, ...form,
        keywords: '[]', filterKeywords: null,
      }) });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="mb-2 rounded-xl border border-indigo-400/40 overflow-hidden">
      <div className="bg-indigo-500/20 px-3 py-2 flex items-center gap-2">
        <span className="text-xs text-indigo-200 font-medium flex-1">新建条目</span>
        <button onClick={onCancel} className="p-1 hover:bg-white/10 rounded"><X size={13} className="text-white/60" /></button>
      </div>
      <div className="bg-white/5 px-3 pb-3 pt-2 space-y-2">
        <input value={form.memo} onChange={e => set('memo', e.target.value)}
          placeholder="条目名称（可选）"
          className="w-full bg-white/20 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/40" />
        <textarea value={form.content} onChange={e => set('content', e.target.value)}
          placeholder="条目内容…"
          rows={3}
          className="w-full bg-white/20 border border-white/20 rounded-lg px-2.5 py-2 text-sm text-white placeholder-white/40 resize-none focus:outline-none focus:border-white/40" />
        <div className="flex gap-2">
          <button onClick={save} disabled={saving}
            className="flex-1 py-1.5 bg-indigo-500/50 hover:bg-indigo-500/70 border border-indigo-400/40 text-white text-xs rounded-lg disabled:opacity-50 transition-colors">
            {saving ? '创建中…' : '创建'}
          </button>
          <button onClick={onCancel} className="px-4 py-1.5 bg-white/10 text-white/60 text-xs rounded-lg">取消</button>
        </div>
      </div>
    </div>
  );
};

// ── 书详情 (内联条目) ─────────────────────────────────────────────
const BookDetail = ({ book, onBack }: any) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const e = await WB(`/entries?bookId=${book.id}`);
    setEntries(Array.isArray(e) ? e.sort((a: any, b: any) => a.orderNum - b.orderNum) : []);
    setLoading(false);
  }, [book.id]);

  useEffect(() => { load(); }, [load]);

  const deleteEntry = async (id: string) => {
    if (!confirm('删除此条目？')) return;
    await WB(`/entries/${id}`, { method: 'DELETE' });
    load();
  };

  const copyEntry = async (entry: any) => {
    const { id, worldbookId, createdAt, updatedAt, ...rest } = entry;
    await WB('/entries', { method: 'POST', body: JSON.stringify({
      ...rest, bookId: book.id,
      memo: (rest.memo || '') + ' 副本',
    }) });
    load();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0 bg-white/15 backdrop-blur-[16px] border-b border-white/20">
        <button onClick={onBack} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
          <ChevronLeft size={18} className="text-white" />
        </button>
        <span className="flex-1 text-white font-semibold text-sm truncate">{book.name}</span>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg border border-white/20 transition-colors">
          <Plus size={12} /> 新建条目
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
        {creating && <NewEntryCard bookId={book.id} onSave={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />}
        {loading && <p className="text-center text-white/50 text-sm mt-8">加载中…</p>}
        {!loading && entries.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-white/40">
            <AlignLeft size={28} />
            <p className="text-sm">还没有条目</p>
            <p className="text-xs text-white/30">点击右上角"新建条目"开始添加</p>
          </div>
        )}
        {entries.map(e => (
          <EntryCard key={e.id} entry={e} onReload={load} onDelete={deleteEntry} onCopy={copyEntry} />
        ))}
      </div>
    </div>
  );
};

// ── 设置弹窗 ──────────────────────────────────────────────────────
const SettingsModal = ({ settings, onSave, onClose }: any) => {
  const [form, setForm] = useState({ ...settings });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-t-2xl pb-8"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200">
          <span className="font-semibold text-gray-800">世界书设置</span>
          <button onClick={onClose} className="p-1"><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">全局扫描深度</label>
            <p className="text-[11px] text-gray-400 mb-2">扫描最近 N 条对话消息以触发关键词（影响所有世界书）</p>
            <input type="number" min={1} max={200} value={form.scanDepth}
              onChange={e => setForm((f: any) => ({ ...f, scanDepth: +e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">上下文百分比</label>
            <p className="text-[11px] text-gray-400 mb-2">世界书内容最多占发给 AI 的总上下文的百分比</p>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={80} value={form.contextPercent}
                onChange={e => setForm((f: any) => ({ ...f, contextPercent: +e.target.value }))}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
              <span className="text-gray-500 text-sm">%</span>
            </div>
          </div>
        </div>
        <div className="px-4">
          <button onClick={() => onSave(form)}
            className="w-full py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors">
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

// ── 世界书 Tab ────────────────────────────────────────────────────
const WorldbookTab = () => {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openBook, setOpenBook] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const s = getWBSettings();
    return { scanDepth: s.scanDepth ?? 20, contextPercent: s.contextPercent ?? 30 };
  });
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await WB('/books');
    setBooks(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (openBook) return <BookDetail book={openBook} onBack={() => { setOpenBook(null); load(); }} />;

  const createBook = async () => {
    if (!newName.trim()) return;
    await WB('/books', { method: 'POST', body: JSON.stringify({ name: newName.trim(), scope: 'global' }) });
    setNewName(''); setCreating(false);
    load();
  };

  const toggleEnabled = async (book: any) => {
    await WB(`/books/${book.id}`, { method: 'PUT', body: JSON.stringify({ enabled: book.enabled ? 0 : 1 }) });
    load();
  };

  const copyBook = async (book: any) => {
    const entries = await WB(`/entries?bookId=${book.id}`);
    const newBook = await WB('/books', { method: 'POST', body: JSON.stringify({
      name: book.name + ' 副本', scope: book.scope, scanDepth: book.scanDepth,
    }) });
    if (newBook?.id && Array.isArray(entries)) {
      for (const e of entries) {
        const { id, worldbookId, createdAt, updatedAt, ...rest } = e;
        await WB('/entries', { method: 'POST', body: JSON.stringify({ ...rest, bookId: newBook.id }) });
      }
    }
    load();
  };

  const exportBooks = async () => {
    const booksData = await WB('/books');
    const out: any[] = [];
    for (const b of (Array.isArray(booksData) ? booksData : [])) {
      const entries = await WB(`/entries?bookId=${b.id}`);
      out.push({ ...b, entries: Array.isArray(entries) ? entries : [] });
    }
    const blob = new Blob([JSON.stringify({ version: 1, books: out }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `worldbooks_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const bookList = data.books ?? (Array.isArray(data) ? data : []);
      for (const book of bookList) {
        const { id, entries, createdAt, updatedAt, ...bookData } = book;
        const newBook = await WB('/books', { method: 'POST', body: JSON.stringify({
          name: bookData.name || '导入的书', scope: bookData.scope || 'global',
          scanDepth: bookData.scanDepth, description: bookData.description,
        }) });
        if (newBook?.id && Array.isArray(entries)) {
          for (const entry of entries) {
            const { id: eid, worldbookId, createdAt: ec, updatedAt: eu, ...entryData } = entry;
            await WB('/entries', { method: 'POST', body: JSON.stringify({ ...entryData, bookId: newBook.id }) });
          }
        }
      }
      load();
    } catch {
      alert('导入失败：JSON格式错误');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 操作栏 */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/20 shrink-0 flex-wrap">
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 border border-white/20 text-white text-xs rounded-lg transition-colors">
          <Plus size={12} /> 新建
        </button>
        <button onClick={() => importRef.current?.click()}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 border border-white/20 text-white text-xs rounded-lg transition-colors">
          <Upload size={12} /> 导入
        </button>
        <button onClick={exportBooks}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 border border-white/20 text-white text-xs rounded-lg transition-colors">
          <Download size={12} /> 导出
        </button>
        <button onClick={() => setShowSettings(true)}
          className="ml-auto p-1.5 bg-white/20 hover:bg-white/30 border border-white/20 text-white rounded-lg transition-colors">
          <Settings size={14} />
        </button>
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>

      {/* 新建表单 */}
      {creating && (
        <div className="px-3 py-2 border-b border-white/20 shrink-0 flex gap-2">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createBook()}
            placeholder="书名（用 [分组] 归组，如：主线[世界观]）"
            className="flex-1 bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/40" />
          <button onClick={createBook} className="px-3 py-1.5 bg-indigo-500/60 text-white text-xs rounded-lg">确认</button>
          <button onClick={() => { setCreating(false); setNewName(''); }} className="px-2 py-1.5 text-white/60 text-xs rounded-lg">取消</button>
        </div>
      )}

      {/* 书列表（全局注入选择面板） */}
      <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
        {!loading && books.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-white/40">
            <BookCopy size={32} />
            <p className="text-sm">还没有世界书</p>
            <p className="text-xs text-white/30 text-center px-6">新建时用 [分组名] 归组，如：主线背景[世界观]</p>
          </div>
        )}
        <p className="text-[10px] text-white/40 mb-1.5">右侧圆点 = 全局注入开关 · 点击行名称查看条目 · 点击 ⧉ 复制</p>
        {books.map(book => (
          <div key={book.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-1.5 border transition-colors ${
              book.enabled
                ? 'bg-indigo-400/20 border-indigo-400/30'
                : 'bg-white/10 border-white/15'
            }`}>
            <button onClick={() => setOpenBook(book)} className="flex-1 text-left min-w-0">
              <p className={`text-sm truncate ${book.enabled ? 'text-white font-medium' : 'text-white/60'}`}>{book.name}</p>
            </button>
            <button onClick={() => copyBook(book)}
              className="p-1.5 hover:bg-white/20 rounded-lg shrink-0 transition-colors" title="复制此书">
              <Copy size={12} className="text-white/50" />
            </button>
            <button onClick={() => setOpenBook(book)}
              className="p-1.5 hover:bg-white/20 rounded-lg shrink-0 transition-colors">
              <ChevronRight size={14} className="text-white/50" />
            </button>
            <button onClick={() => toggleEnabled(book)}
              className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${
                book.enabled ? 'bg-indigo-400 border-indigo-400' : 'bg-transparent border-white/40 hover:border-white/60'
              }`}
              title={book.enabled ? '已全局注入（点击关闭）' : '未注入（点击开启）'}
            />
          </div>
        ))}
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={(s: any) => { setSettings(s); saveWBSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 事件书部分（保留结构，统一视觉）
// ═══════════════════════════════════════════════════════════════

const SelectRow = ({ label, options, value, onChange }: {
  label: string; options: Opt[]; value: string; onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const cur = options.find(o => o.value === value);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2.5 py-1.5 bg-white/20 border border-white/20 rounded-lg text-xs text-white">
        <span className="text-white/60">{label}</span>
        <span className="ml-1">{cur?.label ?? value}</span>
        <ChevronDown size={11} className="text-white/40" />
      </button>
      {open && <SelectPopup title={label} options={options} value={value} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  );
};

const EventForm = ({ event, bookId, onSave, onCancel }: any) => {
  const isNew = !event;
  const [form, setForm] = useState(() => event ? {
    name: event.name || '', description: event.description || '',
    status: event.status || 'locked', priority: event.priority ?? 0,
    probability: event.probability ?? 100, weight: event.weight ?? 100,
    repeatable: event.repeatable ?? 0, maxTriggers: event.maxTriggers ?? '',
  } : {
    name: '', description: '', status: 'locked',
    priority: 0, probability: 100, weight: 100, repeatable: 0, maxTriggers: '' as number | '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, maxTriggers: form.maxTriggers === '' ? null : +form.maxTriggers };
      if (isNew) await EVT(`/event-books/${bookId}/events`, { method: 'POST', body: JSON.stringify(body) });
      else await EVT(`/events/item/${event.id}`, { method: 'PUT', body: JSON.stringify(body) });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 flex items-center px-3 gap-2 shrink-0 bg-white/15 border-b border-white/20">
        <button onClick={onCancel} className="p-1.5 hover:bg-white/20 rounded-full"><ChevronLeft size={20} className="text-white" /></button>
        <span className="font-semibold text-white flex-1 text-sm">{isNew ? '新建事件' : '编辑事件'}</span>
        <button onClick={save} disabled={saving || !form.name.trim()}
          className="px-3 py-1.5 bg-violet-500/60 text-white text-xs rounded-lg disabled:opacity-50">
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar">
        <p className="text-[11px] text-white/50 bg-white/10 px-3 py-2 rounded-lg">
          触发条件/效果/事件链在 <span className="text-violet-300">元系统 → 规则系统</span> 中配置
        </p>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="事件名称 *"
          className="w-full bg-white/20 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/40" />
        <textarea value={form.description} onChange={e => set('description', e.target.value)}
          rows={3} placeholder="描述（可选）"
          className="w-full bg-white/20 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/40 resize-none focus:outline-none focus:border-white/40" />
        <div className="flex gap-2 flex-wrap">
          <SelectRow label="初始状态" options={EVT_STATUSES.map(s => ({ value: s.value, label: s.label }))} value={form.status} onChange={v => set('status', v)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[['priority', '优先级'], ['probability', '概率%'], ['weight', '随机权重'], ['maxTriggers', '最多触发']].map(([k, l]) => (
            <div key={k}>
              <label className="text-[10px] text-white/50 block mb-1">{l}</label>
              <input type="number" value={(form as any)[k]} onChange={e => set(k, e.target.value)}
                placeholder={k === 'maxTriggers' ? '留空=无限' : undefined}
                className="w-full bg-white/20 border border-white/20 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => set('repeatable', form.repeatable ? 0 : 1)}
            className={`relative w-9 h-5 rounded-full transition-colors ${form.repeatable ? 'bg-violet-500' : 'bg-white/20'}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.repeatable ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-sm text-white/80">可重复触发</span>
        </div>
      </div>
    </div>
  );
};

const EventBookDetail = ({ book, onBack }: any) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await EVT(`/event-books/${book.id}/events`);
    setEvents(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [book.id]);

  useEffect(() => { load(); }, [load]);

  if (editing === 'new') return <EventForm bookId={book.id} onSave={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />;
  if (editing) return <EventForm event={editing} bookId={book.id} onSave={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />;

  const statusCounts: Record<string, number> = {};
  events.forEach(e => { statusCounts[e.status] = (statusCounts[e.status] || 0) + 1; });
  const filtered = statusFilter === 'all' ? events : events.filter(e => e.status === statusFilter);

  const statusTransition = async (id: string, action: 'unlock' | 'complete' | 'reset') => {
    await EVT(`/events/item/${id}/${action}`, { method: 'POST' });
    load();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white/15 border-b border-white/20 shrink-0">
        <div className="h-12 flex items-center px-3 gap-2">
          <button onClick={onBack} className="p-1.5 hover:bg-white/20 rounded-full"><ChevronLeft size={20} className="text-white" /></button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">{book.name}</p>
            <p className="text-[10px] text-white/50">{events.length} 个事件</p>
          </div>
          <button onClick={() => setEditing('new')} className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-500/40 border border-violet-400/30 text-white text-xs rounded-lg">
            <Plus size={12} /> 新建
          </button>
        </div>
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto no-scrollbar">
          {[{ v: 'all', l: `全部(${events.length})` }, ...EVT_STATUSES.map(s => ({ v: s.value, l: `${s.label}(${statusCounts[s.value] || 0})` }))].map(({ v, l }) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors shrink-0 ${statusFilter === v ? 'bg-violet-500/60 text-white border border-violet-400/40' : 'bg-white/10 text-white/60'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading && <p className="text-center text-white/50 text-sm mt-8">加载中…</p>}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-white/40">
            <BookOpen size={28} /><p className="text-sm">暂无事件</p>
          </div>
        )}
        {filtered.map(e => {
          const st = getStatus(e.status);
          const StIcon = st.icon;
          return (
            <div key={e.id} className="border-b border-white/10 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${st.bg} ${st.text} shrink-0`}>
                  <StIcon size={8} />{st.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{e.name}</p>
                  {e.description && <p className="text-[11px] text-white/50 truncate">{e.description}</p>}
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-white/40">{e.probability}%</span>
                    {e.repeatable ? <span className="text-[10px] text-violet-300">可重复</span> : null}
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {e.status === 'locked' && (
                    <button title="解锁" onClick={() => statusTransition(e.id, 'unlock')} className="p-1.5 hover:bg-amber-400/20 rounded-lg"><ChevronRight size={13} className="text-amber-300" /></button>
                  )}
                  {e.status === 'pending' && (
                    <button title="完成" onClick={() => statusTransition(e.id, 'complete')} className="p-1.5 hover:bg-green-400/20 rounded-lg"><Check size={13} className="text-green-300" /></button>
                  )}
                  {e.status === 'completed' && e.repeatable && (
                    <button title="重置" onClick={() => statusTransition(e.id, 'reset')} className="p-1.5 hover:bg-blue-400/20 rounded-lg"><RefreshCw size={13} className="text-blue-300" /></button>
                  )}
                  <button onClick={() => setEditing(e)} className="p-1.5 hover:bg-white/20 rounded-lg"><Edit3 size={13} className="text-white/50" /></button>
                  <button onClick={async () => {
                    if (!confirm('删除此事件？')) return;
                    await EVT(`/events/item/${e.id}`, { method: 'DELETE' });
                    load();
                  }} className="p-1.5 hover:bg-red-400/20 rounded-lg"><Trash2 size={13} className="text-red-300/70" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EventBooksTab = () => {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openBook, setOpenBook] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/20 shrink-0">
        <p className="text-xs text-white/50 flex-1">按主题或剧情线组织事件</p>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-500/40 border border-violet-400/30 text-white text-xs rounded-lg">
          <Plus size={12} /> 新建
        </button>
      </div>
      {creating && (
        <div className="px-3 py-2 border-b border-white/20 shrink-0 space-y-2">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createBook()} placeholder="事件书名称…"
            className="w-full bg-white/20 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none" />
          <div className="flex gap-2">
            <SelectRow label="范围" options={EVT_SCOPES} value={newScope} onChange={setNewScope} />
            <button onClick={createBook} className="px-3 py-1.5 bg-violet-500/60 text-white text-xs rounded-lg">确认</button>
            <button onClick={() => setCreating(false)} className="px-2 py-1.5 text-white/60 text-xs">取消</button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
        {loading && <p className="text-center text-white/50 text-sm mt-8">加载中…</p>}
        {!loading && books.length === 0 && !creating && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-white/40">
            <BookOpen size={32} /><p className="text-sm">还没有事件书</p>
          </div>
        )}
        {books.map(book => (
          <div key={book.id}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl mb-1.5 border transition-colors ${
              book.enabled ? 'bg-violet-400/15 border-violet-400/25' : 'bg-white/10 border-white/15 opacity-70'
            }`}>
            <button onClick={() => setOpenBook(book)} className="flex-1 text-left min-w-0">
              <p className="text-sm text-white font-medium truncate">{book.name}</p>
              <p className="text-[10px] text-white/50">{EVT_SCOPES.find(s => s.value === book.scope)?.label}</p>
            </button>
            <button onClick={() => setOpenBook(book)} className="p-1.5 hover:bg-white/20 rounded-lg">
              <ChevronRight size={14} className="text-white/50" />
            </button>
            <button onClick={async () => {
              if (!confirm('删除此事件书及其所有事件？')) return;
              await EVT(`/event-books/${book.id}`, { method: 'DELETE' });
              load();
            }} className="p-1.5 hover:bg-red-400/20 rounded-lg">
              <Trash2 size={13} className="text-red-300/70" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 知识库主 App
// ═══════════════════════════════════════════════════════════════

export default function WorldbookApp({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'世界书' | '事件书'>('世界书');

  return (
    <div className="flex flex-col h-full overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' }}>

      {/* 顶栏 */}
      <div className="h-12 flex items-center px-3 gap-2 shrink-0 bg-white/10 backdrop-blur-[16px] border-b border-white/20">
        <button onClick={onBack} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-white" />
        </button>
        <BookCopy size={16} className="text-white/70" />
        <span className="font-bold text-white">知识库</span>
        <div className="ml-auto flex gap-0.5 bg-white/15 border border-white/20 rounded-xl p-0.5">
          {(['世界书', '事件书'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-[10px] text-xs font-medium transition-colors ${
                tab === t ? 'bg-white/30 text-white' : 'text-white/50 hover:text-white/70'
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === '世界书' ? <WorldbookTab /> : <EventBooksTab />}
      </div>
    </div>
  );
}
