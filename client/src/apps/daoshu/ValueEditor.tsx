/**
 * 数值系统编辑器 — 侧边栏 + 详情布局
 *
 * 布局：
 * - 左侧边栏（112px）：变量列表 + 底部新建按钮（弹出 Modal）
 * - 右主区：选中变量的详情
 *   - 顶部：范围长条（阶段着色 + 当前值标记）+ 快捷 ±5 调节
 *   - 阶段设置编辑区
 *   - 变化规则编辑区
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Save, X, Edit3, Zap, Heart, Shield, Sparkles, Check,
} from 'lucide-react';

const api = (path: string, opts: any = {}) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

// ── 常量 ──────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'attribute', label: '内在属性', icon: Sparkles, color: '#fbbf24' },
  { value: 'status',    label: '动态状态', icon: Zap,      color: '#4ade80' },
  { value: 'emotion',   label: '心理状态', icon: Heart,    color: '#f472b6' },
  { value: 'relation',  label: '关系类',   icon: Heart,    color: '#a78bfa' },
  { value: 'social',    label: '社会属性', icon: Shield,   color: '#60a5fa' },
];

const TRIGGER_OPTIONS = [
  { value: 'chat_end',       label: '每轮对话结束' },
  { value: 'time_pass',      label: '时间流逝' },
  { value: 'receive_gift',   label: '收到礼物' },
  { value: 'event_complete', label: '事件完成' },
  { value: 'value_change',   label: '数值变化' },
];

const OP_OPTIONS = [
  { value: 'add',      label: '加减' },
  { value: 'set',      label: '设为' },
  { value: 'multiply', label: '乘以' },
];

const STAGE_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#34d399'];

function getCatStyle(cat: string) {
  return CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];
}

// ── 新建/编辑数值 Modal ─────────────────────────────────────

interface ValueFormData {
  category: string; name: string; variableName: string;
  currentValue: number; minValue: number; maxValue: number;
}
const EMPTY: ValueFormData = {
  category: 'emotion', name: '', variableName: '',
  currentValue: 50, minValue: 0, maxValue: 100,
};

function ValueModal({ initial, onSave, onCancel }: {
  initial?: ValueFormData;
  onSave: (data: ValueFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ValueFormData>(initial || EMPTY);
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-72 bg-slate-800 border border-white/20 rounded-2xl p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">{initial ? '编辑数值' : '新建数值'}</span>
          <button onClick={onCancel} className="p-1 hover:bg-white/10 rounded-full">
            <X size={14} className="text-white/60" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[10px] text-white/50">显示名</span>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="好感度"
              className="w-full bg-white/10 text-white text-xs rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-white/30" />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] text-white/50">变量名 (英文)</span>
            <input value={form.variableName} onChange={e => set('variableName', e.target.value)} placeholder="affection"
              className="w-full bg-white/10 text-white text-xs rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-white/30" />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] text-white/50">分类</span>
          <select value={form.category} onChange={e => set('category', e.target.value)}
            className="w-full bg-white/10 text-white text-xs rounded-lg px-3 py-2 border border-white/10 outline-none">
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-3 gap-2">
          {([['minValue', '最小值'], ['maxValue', '最大值'], ['currentValue', '初始值']] as const).map(([k, label]) => (
            <label key={k} className="space-y-1">
              <span className="text-[10px] text-white/50">{label}</span>
              <input type="number" value={form[k]} onChange={e => set(k, +e.target.value)}
                className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-2 border border-white/10 outline-none" />
            </label>
          ))}
        </div>

        <button onClick={() => onSave(form)} disabled={!form.name.trim() || !form.variableName.trim()}
          className="w-full py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-30">
          <Save size={12} className="inline mr-1" />保存
        </button>
      </div>
    </div>
  );
}

// ── 范围长条 ─────────────────────────────────────────────────

function RangeBar({ value, stages, onAdjust, adjusting }: {
  value: any; stages: any[]; onAdjust: (delta: number) => void; adjusting: boolean;
}) {
  const { minValue, maxValue, currentValue } = value;
  const range = maxValue - minValue || 1;

  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - minValue) / range) * 100))}%`;

  const sortedStages = [...stages].sort((a, b) => a.rangeMin - b.rangeMin);

  return (
    <div className="space-y-2">
      {/* 长条区域 */}
      <div className="relative h-14">
        {/* 背景轨道 */}
        <div className="absolute left-0 right-0 top-4 h-4 bg-white/10 rounded-full overflow-hidden">
          {/* 阶段色块 */}
          {sortedStages.map((s, i) => {
            const left = Math.max(0, Math.min(100, ((s.rangeMin - minValue) / range) * 100));
            const right = Math.max(0, Math.min(100, ((s.rangeMax - minValue) / range) * 100));
            const width = right - left;
            return (
              <div key={s.id}
                className="absolute top-0 h-full opacity-70"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length],
                }}
              />
            );
          })}
        </div>

        {/* 当前值标记 */}
        <motion.div
          className="absolute top-2 w-1 h-8 bg-white rounded-full shadow-lg shadow-white/30"
          style={{ left: pct(currentValue), transform: 'translateX(-50%)' }}
          animate={{ left: pct(currentValue) }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />

        {/* 刻度标签 */}
        <span className="absolute left-0 top-9 text-[9px] text-white/40 leading-none">{minValue}</span>
        <span className="absolute right-0 top-9 text-[9px] text-white/40 leading-none" style={{ transform: 'translateX(100%)' }}>{maxValue}</span>

        {/* 当前阶段标签 */}
        {value.currentStage && (
          <span className="absolute top-9 text-[9px] text-white/70 leading-none font-medium"
            style={{ left: pct(currentValue), transform: 'translateX(-50%)' }}>
            {value.currentStage.stageName}
          </span>
        )}
      </div>

      {/* 当前值 + 快捷调节 */}
      <div className="flex items-center gap-2">
        <button onClick={() => onAdjust(-5)} disabled={adjusting}
          className="w-7 h-6 rounded-lg bg-white/10 text-white/60 text-xs hover:bg-white/20 active:scale-95 disabled:opacity-30 flex items-center justify-center font-bold transition-colors">
          −5
        </button>
        <div className="flex-1 text-center">
          <span className="text-lg font-bold text-white">{Math.round(currentValue)}</span>
          <span className="text-[10px] text-white/40 ml-1">/ {maxValue}</span>
        </div>
        <button onClick={() => onAdjust(+5)} disabled={adjusting}
          className="w-7 h-6 rounded-lg bg-white/10 text-white/60 text-xs hover:bg-white/20 active:scale-95 disabled:opacity-30 flex items-center justify-center font-bold transition-colors">
          +5
        </button>
      </div>

      {/* 阶段图例 */}
      {sortedStages.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sortedStages.map((s, i) => (
            <span key={s.id} className="text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-1"
              style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] + '30', color: STAGE_COLORS[i % STAGE_COLORS.length] }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }} />
              {s.rangeMin}-{s.rangeMax} {s.stageName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 阶段行 ────────────────────────────────────────────────────

function StageRow({ stage, color, onUpdate, onDelete }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(stage);
  const save = () => { onUpdate(form); setEditing(false); };

  if (editing) {
    return (
      <div className="bg-white/5 rounded-lg p-2 space-y-1.5 border border-white/10">
        <div className="grid grid-cols-3 gap-1">
          <input type="number" value={form.rangeMin} onChange={e => setForm({ ...form, rangeMin: +e.target.value })}
            placeholder="最小" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
          <input type="number" value={form.rangeMax} onChange={e => setForm({ ...form, rangeMax: +e.target.value })}
            placeholder="最大" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
          <input value={form.stageName} onChange={e => setForm({ ...form, stageName: e.target.value })}
            placeholder="名称" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
        </div>
        <input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}
          placeholder="描述" className="w-full bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
        <textarea value={form.promptSnippet || ''} onChange={e => setForm({ ...form, promptSnippet: e.target.value })}
          placeholder="提示词片段（注入到AI上下文）" rows={2}
          className="w-full bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none resize-none" />
        <div className="flex gap-1">
          <button onClick={save} className="flex-1 bg-green-500/20 text-green-300 text-[10px] rounded py-1 hover:bg-green-500/30">保存</button>
          <button onClick={() => setEditing(false)} className="bg-white/10 text-white/50 text-[10px] rounded px-3 py-1">取消</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-lg group">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[10px] text-white/40 w-10 shrink-0">{stage.rangeMin}-{stage.rangeMax}</span>
      <span className="text-[10px] text-white/80 font-medium flex-1 truncate">{stage.stageName}</span>
      <span className="text-[10px] text-white/30 flex-1 truncate hidden">{stage.description}</span>
      <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity">
        <Edit3 size={10} className="text-white/50" />
      </button>
      <button onClick={() => onDelete(stage.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity">
        <Trash2 size={10} className="text-red-400/70" />
      </button>
    </div>
  );
}

// ── 规则行 ────────────────────────────────────────────────────

function RuleRow({ rule, onUpdate, onDelete }: any) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(rule);
  const save = () => { onUpdate(form); setEditing(false); };
  const triggerLabel = TRIGGER_OPTIONS.find(t => t.value === rule.triggerOn)?.label || rule.triggerOn;
  const opLabel = OP_OPTIONS.find(o => o.value === rule.operation)?.label || rule.operation;
  const rangeText = (rule.rangeMin != null && rule.rangeMax != null) ? `${rule.rangeMin}-${rule.rangeMax}` : '全范围';

  if (editing) {
    return (
      <div className="bg-white/5 rounded-lg p-2 space-y-1.5 border border-white/10">
        <div className="grid grid-cols-2 gap-1">
          <select value={form.triggerOn} onChange={e => setForm({ ...form, triggerOn: e.target.value })}
            className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
            {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={form.operation} onChange={e => setForm({ ...form, operation: e.target.value })}
            className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
            {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <input type="number" value={form.rangeMin ?? ''} onChange={e => setForm({ ...form, rangeMin: e.target.value === '' ? null : +e.target.value })}
            placeholder="范围最小" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
          <input type="number" value={form.rangeMax ?? ''} onChange={e => setForm({ ...form, rangeMax: e.target.value === '' ? null : +e.target.value })}
            placeholder="范围最大" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
          <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} step="0.5"
            placeholder="数量" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
        </div>
        <div className="flex gap-1">
          <button onClick={save} className="flex-1 bg-green-500/20 text-green-300 text-[10px] rounded py-1 hover:bg-green-500/30">保存</button>
          <button onClick={() => setEditing(false)} className="bg-white/10 text-white/50 text-[10px] rounded px-3 py-1">取消</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white/5 rounded-lg group">
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 shrink-0 truncate max-w-[60px]">{triggerLabel}</span>
      <span className="text-[10px] text-white/40 shrink-0">{rangeText}</span>
      <span className="text-[10px] text-white/80 shrink-0">
        {opLabel} {rule.operation === 'add' && rule.amount >= 0 ? '+' : ''}{rule.amount}
      </span>
      {rule.enabled === 0 && <span className="text-[10px] text-red-400/50">(禁用)</span>}
      <div className="flex-1" />
      <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity">
        <Edit3 size={10} className="text-white/50" />
      </button>
      <button onClick={() => onDelete(rule.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity">
        <Trash2 size={10} className="text-red-400/70" />
      </button>
    </div>
  );
}

// ── 添加阶段表单 ─────────────────────────────────────────────

function AddStageForm({ onAdd, onCancel }: { onAdd: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ rangeMin: 0, rangeMax: 100, stageName: '', description: '', promptSnippet: '' });
  return (
    <div className="bg-white/5 rounded-lg p-2 space-y-1.5 border border-white/10">
      <div className="grid grid-cols-3 gap-1">
        <input type="number" value={form.rangeMin} onChange={e => setForm({ ...form, rangeMin: +e.target.value })}
          placeholder="最小" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
        <input type="number" value={form.rangeMax} onChange={e => setForm({ ...form, rangeMax: +e.target.value })}
          placeholder="最大" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
        <input value={form.stageName} onChange={e => setForm({ ...form, stageName: e.target.value })}
          placeholder="阶段名" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
      </div>
      <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
        placeholder="描述（可选）" className="w-full bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
      <textarea value={form.promptSnippet} onChange={e => setForm({ ...form, promptSnippet: e.target.value })}
        placeholder="提示词片段（可选）" rows={2}
        className="w-full bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none resize-none" />
      <div className="flex gap-1">
        <button onClick={() => onAdd(form)} disabled={!form.stageName.trim()}
          className="flex-1 bg-green-500/20 text-green-300 text-[10px] rounded py-1 hover:bg-green-500/30 disabled:opacity-30">添加</button>
        <button onClick={onCancel} className="bg-white/10 text-white/50 text-[10px] rounded px-3 py-1">取消</button>
      </div>
    </div>
  );
}

// ── 添加规则表单 ─────────────────────────────────────────────

function AddRuleForm({ onAdd, onCancel }: { onAdd: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ triggerOn: 'chat_end', operation: 'add', amount: 1, rangeMin: '' as any, rangeMax: '' as any });
  return (
    <div className="bg-white/5 rounded-lg p-2 space-y-1.5 border border-white/10">
      <div className="grid grid-cols-2 gap-1">
        <select value={form.triggerOn} onChange={e => setForm({ ...form, triggerOn: e.target.value })}
          className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
          {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={form.operation} onChange={e => setForm({ ...form, operation: e.target.value })}
          className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
          {OP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <input type="number" value={form.rangeMin} onChange={e => setForm({ ...form, rangeMin: e.target.value })}
          placeholder="范围最小" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
        <input type="number" value={form.rangeMax} onChange={e => setForm({ ...form, rangeMax: e.target.value })}
          placeholder="范围最大" className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
        <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} step="0.5"
          className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
      </div>
      <div className="flex gap-1">
        <button onClick={() => onAdd({
          ...form,
          rangeMin: form.rangeMin === '' ? undefined : +form.rangeMin,
          rangeMax: form.rangeMax === '' ? undefined : +form.rangeMax,
        })} className="flex-1 bg-green-500/20 text-green-300 text-[10px] rounded py-1 hover:bg-green-500/30">添加</button>
        <button onClick={onCancel} className="bg-white/10 text-white/50 text-[10px] rounded px-3 py-1">取消</button>
      </div>
    </div>
  );
}

// ── 详情面板 ─────────────────────────────────────────────────

function ValueDetail({ value, onReload, onEdit, onDelete }: {
  value: any;
  onReload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [stages, setStages] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [addingStage, setAddingStage] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const loadDetails = async () => {
    const [s, r] = await Promise.all([
      api(`/values/item/${value.id}/stages`),
      api(`/values/item/${value.id}/rules`),
    ]);
    setStages(Array.isArray(s) ? s : []);
    setRules(Array.isArray(r) ? r : []);
  };

  useEffect(() => { loadDetails(); }, [value.id]);

  const handleAdjust = async (delta: number) => {
    if (adjusting) return;
    setAdjusting(true);
    try {
      await api(`/values/item/${value.id}/adjust`, { method: 'POST', body: JSON.stringify({ delta }) });
      onReload();
    } finally { setAdjusting(false); }
  };

  const handleAddStage = async (data: any) => {
    await api(`/values/item/${value.id}/stages`, { method: 'POST', body: JSON.stringify(data) });
    setAddingStage(false);
    loadDetails();
    onReload();
  };
  const handleUpdateStage = async (data: any) => {
    await api(`/values/stages/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    loadDetails();
  };
  const handleDeleteStage = async (id: number) => {
    await api(`/values/stages/${id}`, { method: 'DELETE' });
    loadDetails();
    onReload();
  };

  const handleAddRule = async (data: any) => {
    await api(`/values/item/${value.id}/rules`, { method: 'POST', body: JSON.stringify(data) });
    setAddingRule(false);
    loadDetails();
  };
  const handleUpdateRule = async (data: any) => {
    await api(`/values/rules/${data.id}`, { method: 'PUT', body: JSON.stringify(data) });
    loadDetails();
  };
  const handleDeleteRule = async (id: number) => {
    await api(`/values/rules/${id}`, { method: 'DELETE' });
    loadDetails();
  };

  const catStyle = getCatStyle(value.category);
  const CatIcon = catStyle.icon;
  const sortedStages = [...stages].sort((a, b) => a.rangeMin - b.rangeMin);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* 变量标题 */}
      <div className="flex items-center gap-2">
        <CatIcon size={16} style={{ color: catStyle.color }} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-white">{value.name}</span>
          <span className="text-[10px] text-white/40 ml-1.5">{value.variableName}</span>
        </div>
        <button onClick={onEdit} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
          <Edit3 size={12} className="text-white/50" />
        </button>
        <button onClick={onDelete} className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors">
          <Trash2 size={12} className="text-red-400/60" />
        </button>
      </div>

      <div className="text-[10px] text-white/40 flex gap-2">
        <span>{catStyle.label}</span>
        <span>范围 {value.minValue} ~ {value.maxValue}</span>
      </div>

      {/* 范围长条 */}
      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
        <RangeBar value={value} stages={stages} onAdjust={handleAdjust} adjusting={adjusting} />
      </div>

      {/* 阶段设置 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white/70">阶段设置</span>
          <button onClick={() => setAddingStage(true)}
            className="text-[10px] text-white/50 hover:text-white/70 flex items-center gap-0.5 transition-colors">
            <Plus size={10} />添加
          </button>
        </div>
        {stages.length === 0 && !addingStage && (
          <p className="text-[10px] text-white/30 py-1 pl-1">暂无阶段</p>
        )}
        <div className="space-y-0.5">
          {sortedStages.map((s, i) => (
            <StageRow key={s.id} stage={s} color={STAGE_COLORS[i % STAGE_COLORS.length]}
              onUpdate={handleUpdateStage} onDelete={handleDeleteStage} />
          ))}
        </div>
        {addingStage && <AddStageForm onAdd={handleAddStage} onCancel={() => setAddingStage(false)} />}
      </div>

      {/* 变化规则 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-white/70">变化规则</span>
          <button onClick={() => setAddingRule(true)}
            className="text-[10px] text-white/50 hover:text-white/70 flex items-center gap-0.5 transition-colors">
            <Plus size={10} />添加
          </button>
        </div>
        {rules.length === 0 && !addingRule && (
          <p className="text-[10px] text-white/30 py-1 pl-1">暂无规则</p>
        )}
        <div className="space-y-0.5">
          {rules.map(r => (
            <RuleRow key={r.id} rule={r} onUpdate={handleUpdateRule} onDelete={handleDeleteRule} />
          ))}
        </div>
        {addingRule && <AddRuleForm onAdd={handleAddRule} onCancel={() => setAddingRule(false)} />}
      </div>
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────────────

export default function ValueEditor({ charId }: { charId: string }) {
  const [values, setValues] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);

  const loadValues = async () => {
    const data = await api(`/values/${charId}`);
    const list = Array.isArray(data) ? data : [];
    setValues(list);
    setLoaded(true);
    if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
  };

  useEffect(() => { loadValues(); }, [charId]);

  const selectedValue = values.find(v => v.id === selectedId);

  const handleCreate = async (data: ValueFormData) => {
    await api(`/values/${charId}`, { method: 'POST', body: JSON.stringify(data) });
    setModal(null);
    await loadValues();
  };

  const handleEdit = async (data: ValueFormData) => {
    if (!selectedId) return;
    await api(`/values/item/${selectedId}`, { method: 'PUT', body: JSON.stringify(data) });
    setModal(null);
    await loadValues();
  };

  const handleDelete = async () => {
    if (!selectedId || !selectedValue) return;
    if (!confirm(`确定删除数值「${selectedValue.name}」？相关阶段和规则也会一起删除。`)) return;
    await api(`/values/item/${selectedId}`, { method: 'DELETE' });
    setSelectedId(null);
    await loadValues();
  };

  return (
    <div className="h-full flex flex-row">
      {/* 左侧边栏 */}
      <div className="w-28 flex flex-col border-r border-white/10 shrink-0">
        <div className="flex-1 overflow-y-auto py-2">
          {values.map(v => {
            const cat = getCatStyle(v.category);
            const pct = Math.max(0, Math.min(100, ((v.currentValue - v.minValue) / (v.maxValue - v.minValue || 1)) * 100));
            const isSelected = v.id === selectedId;
            return (
              <button key={v.id} onClick={() => setSelectedId(v.id)}
                className={`w-full px-2.5 py-2 text-left transition-colors ${isSelected ? 'bg-white/15' : 'hover:bg-white/5'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-[11px] text-white/90 font-medium truncate flex-1">{v.name}</span>
                </div>
                {/* 迷你进度条 */}
                <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                </div>
                <span className="text-[9px] text-white/30 mt-0.5 block">{Math.round(v.currentValue)}</span>
              </button>
            );
          })}

          {loaded && values.length === 0 && (
            <div className="px-3 py-4 text-center">
              <Sparkles size={16} className="text-white/20 mx-auto mb-1" />
              <p className="text-[10px] text-white/30">暂无数值</p>
            </div>
          )}
        </div>

        {/* 新建按钮 */}
        <button onClick={() => setModal('create')}
          className="mx-2 mb-3 py-1.5 flex items-center justify-center gap-1 rounded-lg bg-white/10 text-white/60 text-[11px] hover:bg-white/20 transition-colors">
          <Plus size={11} />新建变量
        </button>
      </div>

      {/* 右主区 */}
      <div className="flex-1 overflow-hidden">
        {selectedValue ? (
          <ValueDetail
            key={selectedValue.id}
            value={selectedValue}
            onReload={loadValues}
            onEdit={() => setModal('edit')}
            onDelete={handleDelete}
          />
        ) : (
          <div className="h-full flex items-center justify-center flex-col gap-2">
            <Sparkles size={28} className="text-white/15" />
            <p className="text-white/30 text-xs">{loaded ? '选择或新建一个数值' : '加载中…'}</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === 'create' && (
          <ValueModal onSave={handleCreate} onCancel={() => setModal(null)} />
        )}
        {modal === 'edit' && selectedValue && (
          <ValueModal
            initial={{
              category: selectedValue.category,
              name: selectedValue.name,
              variableName: selectedValue.variableName,
              currentValue: selectedValue.currentValue,
              minValue: selectedValue.minValue,
              maxValue: selectedValue.maxValue,
            }}
            onSave={handleEdit}
            onCancel={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
