/**
 * 事件系统编辑器
 *
 * 完整 CRUD：
 * - 事件列表（按状态分组）
 * - 创建/编辑/删除事件
 * - 点击展开详情面板：基本信息、标签、冷却设置
 * - 解锁条件编辑器（条件组 + 组内条件）
 * - 触发条件编辑器（条件组 + 组内条件）
 * - 触发效果编辑器（注入、改数值、设标记、触发/解锁/锁定事件）
 * - 事件连接管理
 * - 状态流转操作（解锁、完成、重置）
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronRight, Plus, Trash2, Save, X, Edit3,
  Lock, Clock, Play, Check, RotateCcw, Link2, Tag, Zap,
  AlertTriangle,
} from 'lucide-react';

const api = (path: string, opts: any = {}) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

// ── 常量 ──────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  locked:    { color: 'text-gray-400',   bg: 'bg-gray-500/20',   label: '锁定',   icon: Lock },
  pending:   { color: 'text-amber-300',  bg: 'bg-amber-500/20',  label: '待触发', icon: Clock },
  active:    { color: 'text-blue-300',   bg: 'bg-blue-500/20',   label: '进行中', icon: Play },
  completed: { color: 'text-green-300',  bg: 'bg-green-500/20',  label: '已完成', icon: Check },
};

const CONDITION_TYPES = [
  { value: 'value',    label: '数值' },
  { value: 'flag',     label: '标记' },
  { value: 'event',    label: '事件' },
  { value: 'time',     label: '时间' },
  { value: 'date',     label: '日期' },
  { value: 'weather',  label: '天气' },
  { value: 'location', label: '地点' },
  { value: 'keyword',  label: '关键词' },
];

const OPERATORS = ['>=', '<=', '>', '<', '==', '!='];

const EFFECT_TYPES = [
  { value: 'inject',        label: '注入' },
  { value: 'modify_value',  label: '改数值' },
  { value: 'set_flag',      label: '设标记' },
  { value: 'trigger_event', label: '触发事件' },
  { value: 'unlock_event',  label: '解锁事件' },
  { value: 'lock_event',    label: '锁定事件' },
];

const POSITION_OPTIONS = [
  { value: 'before_char',    label: '角色设定前' },
  { value: 'after_char',     label: '角色设定后' },
  { value: 'status_section', label: '状态区域' },
  { value: 'before_history', label: '历史消息前' },
  { value: 'depth',          label: '指定深度' },
];

const DURATION_OPTIONS = [
  { value: 'once',        label: '一次' },
  { value: 'turns',       label: 'N轮' },
  { value: 'until_event', label: '直到事件' },
  { value: 'permanent',   label: '永久' },
];

const COOLDOWN_TYPES = [
  { value: 'none',  label: '无冷却' },
  { value: 'time',  label: '按时间' },
  { value: 'turns', label: '按轮次' },
];

const CONNECTION_TYPES = [
  { value: 'next',    label: '顺序 →',  style: '实线' },
  { value: 'branch',  label: '分支 ⤵',  style: '虚线' },
  { value: 'trigger', label: '触发 ⚡',  style: '粗线' },
  { value: 'unlock',  label: '解锁 🔓', style: '实线' },
];

// ── 条件编辑器 ───────────────────────────────────────────────

interface Condition {
  type: string;
  target?: string;
  operator?: string;
  value?: any;
  status?: string;
}

interface ConditionGroup {
  logic: string;
  conditions: Condition[];
}

interface ConditionsData {
  logic?: string;
  groups: ConditionGroup[];
}

function parseConditions(json?: string): ConditionsData {
  if (!json) return { logic: 'and', groups: [] };
  try {
    const parsed = JSON.parse(json);
    if (parsed.groups) return parsed;
    if (parsed.条件组) {
      return {
        logic: parsed.组间逻辑 === '或' ? 'or' : 'and',
        groups: parsed.条件组.map((g: any) => ({
          logic: g.组内逻辑 === '或' ? 'or' : 'and',
          conditions: (g.条件 || []).map((c: any) => ({
            type: c.类型 || c.type,
            target: c.目标 || c.target,
            operator: c.比较 || c.operator,
            value: c.值 || c.value,
            status: c.状态 || c.status,
          })),
        })),
      };
    }
    return { logic: 'and', groups: [] };
  } catch { return { logic: 'and', groups: [] }; }
}

function serializeConditions(data: ConditionsData): string | undefined {
  if (!data.groups.length) return undefined;
  return JSON.stringify(data);
}

function ConditionEditor({ label, value, onChange }: {
  label: string;
  value?: string;
  onChange: (val?: string) => void;
}) {
  const [data, setData] = useState(() => parseConditions(value));

  const update = (newData: ConditionsData) => {
    setData(newData);
    onChange(serializeConditions(newData));
  };

  const addGroup = () => {
    update({ ...data, groups: [...data.groups, { logic: 'and', conditions: [{ type: 'value', target: '', operator: '>=', value: '' }] }] });
  };

  const removeGroup = (gi: number) => {
    update({ ...data, groups: data.groups.filter((_, i) => i !== gi) });
  };

  const addCondition = (gi: number) => {
    const groups = [...data.groups];
    groups[gi] = { ...groups[gi], conditions: [...groups[gi].conditions, { type: 'value', target: '', operator: '>=', value: '' }] };
    update({ ...data, groups });
  };

  const removeCondition = (gi: number, ci: number) => {
    const groups = [...data.groups];
    groups[gi] = { ...groups[gi], conditions: groups[gi].conditions.filter((_, i) => i !== ci) };
    if (groups[gi].conditions.length === 0) groups.splice(gi, 1);
    update({ ...data, groups });
  };

  const updateCondition = (gi: number, ci: number, patch: Partial<Condition>) => {
    const groups = [...data.groups];
    const conds = [...groups[gi].conditions];
    conds[ci] = { ...conds[ci], ...patch };
    groups[gi] = { ...groups[gi], conditions: conds };
    update({ ...data, groups });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/60 font-semibold">{label}</span>
        <button onClick={addGroup} className="text-[10px] text-white/50 hover:text-white/70 flex items-center gap-0.5">
          <Plus size={10} />添加条件组
        </button>
      </div>

      {data.groups.length === 0 && (
        <p className="text-[10px] text-white/30 py-1">无条件（总是满足）</p>
      )}

      {data.groups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && (
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-white/10" />
              <button onClick={() => update({ ...data, logic: data.logic === 'or' ? 'and' : 'or' })}
                className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 hover:bg-white/20">
                {data.logic === 'or' ? '或' : '且'}
              </button>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}
          <div className="bg-white/5 rounded-lg border border-white/10 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">条件组 {gi + 1}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => {
                  const groups = [...data.groups];
                  groups[gi] = { ...groups[gi], logic: groups[gi].logic === 'or' ? 'and' : 'or' };
                  update({ ...data, groups });
                }} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 hover:bg-white/20">
                  组内：{group.logic === 'or' ? '或' : '且'}
                </button>
                <button onClick={() => removeGroup(gi)} className="p-0.5 hover:bg-red-500/20 rounded">
                  <Trash2 size={10} className="text-red-400/50" />
                </button>
              </div>
            </div>

            {group.conditions.map((cond, ci) => (
              <div key={ci} className="flex items-center gap-1">
                <select value={cond.type} onChange={e => updateCondition(gi, ci, { type: e.target.value })}
                  className="bg-white/10 text-white text-[10px] rounded px-1.5 py-1 border border-white/10 outline-none w-14">
                  {CONDITION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                <input value={cond.target || ''} onChange={e => updateCondition(gi, ci, { target: e.target.value })}
                  placeholder={cond.type === 'event' ? '事件ID' : cond.type === 'value' ? '变量名' : '值'}
                  className="flex-1 bg-white/10 text-white text-[10px] rounded px-1.5 py-1 border border-white/10 outline-none min-w-0" />

                {(cond.type === 'value') && (
                  <>
                    <select value={cond.operator || '>='} onChange={e => updateCondition(gi, ci, { operator: e.target.value })}
                      className="bg-white/10 text-white text-[10px] rounded px-1 py-1 border border-white/10 outline-none w-12">
                      {OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input type="number" value={cond.value ?? ''} onChange={e => updateCondition(gi, ci, { value: +e.target.value })}
                      className="w-12 bg-white/10 text-white text-[10px] rounded px-1.5 py-1 border border-white/10 outline-none" />
                  </>
                )}

                {cond.type === 'event' && (
                  <select value={cond.status || 'completed'} onChange={e => updateCondition(gi, ci, { status: e.target.value })}
                    className="bg-white/10 text-white text-[10px] rounded px-1 py-1 border border-white/10 outline-none w-16">
                    <option value="completed">已完成</option>
                    <option value="pending">待触发</option>
                    <option value="locked">锁定</option>
                  </select>
                )}

                <button onClick={() => removeCondition(gi, ci)} className="p-0.5 hover:bg-red-500/20 rounded shrink-0">
                  <X size={10} className="text-red-400/50" />
                </button>
              </div>
            ))}

            <button onClick={() => addCondition(gi)} className="text-[10px] text-white/40 hover:text-white/60 flex items-center gap-0.5">
              <Plus size={8} />添加条件
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 效果编辑器 ───────────────────────────────────────────────

function EffectEditor({ value, onChange }: { value?: string; onChange: (val?: string) => void }) {
  const [effects, setEffects] = useState<any[]>(() => {
    try { return value ? JSON.parse(value) : []; } catch { return []; }
  });

  const update = (newEffects: any[]) => {
    setEffects(newEffects);
    onChange(newEffects.length ? JSON.stringify(newEffects) : undefined);
  };

  const addEffect = () => {
    update([...effects, { type: 'inject', content: '', position: 'after_char', durationType: 'turns', durationValue: 3 }]);
  };

  const removeEffect = (i: number) => update(effects.filter((_, idx) => idx !== i));

  const updateEffect = (i: number, patch: any) => {
    const arr = [...effects];
    arr[i] = { ...arr[i], ...patch };
    update(arr);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/60 font-semibold">触发效果</span>
        <button onClick={addEffect} className="text-[10px] text-white/50 hover:text-white/70 flex items-center gap-0.5">
          <Plus size={10} />添加效果
        </button>
      </div>

      {effects.length === 0 && <p className="text-[10px] text-white/30 py-1">无效果</p>}

      {effects.map((eff, i) => (
        <div key={i} className="bg-white/5 rounded-lg border border-white/10 p-2 space-y-1.5">
          <div className="flex items-center gap-1">
            <select value={eff.type} onChange={e => updateEffect(i, { type: e.target.value })}
              className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
              {EFFECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div className="flex-1" />
            <button onClick={() => removeEffect(i)} className="p-1 hover:bg-red-500/20 rounded">
              <Trash2 size={10} className="text-red-400/50" />
            </button>
          </div>

          {/* 注入类型 */}
          {eff.type === 'inject' && (
            <>
              <textarea value={eff.content || ''} onChange={e => updateEffect(i, { content: e.target.value })}
                placeholder="注入内容" rows={2}
                className="w-full bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none resize-none" />
              <div className="flex gap-1">
                <select value={eff.position || 'after_char'} onChange={e => updateEffect(i, { position: e.target.value })}
                  className="flex-1 bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
                  {POSITION_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <select value={eff.durationType || 'turns'} onChange={e => updateEffect(i, { durationType: e.target.value })}
                  className="flex-1 bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
                  {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
                {(eff.durationType === 'turns' || eff.durationType === 'until_event') && (
                  <input value={eff.durationValue ?? ''} onChange={e => updateEffect(i, { durationValue: e.target.value })}
                    placeholder={eff.durationType === 'turns' ? '轮数' : '事件ID'}
                    className="w-16 bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
                )}
              </div>
            </>
          )}

          {/* 改数值 */}
          {eff.type === 'modify_value' && (
            <div className="flex gap-1">
              <input value={eff.target || ''} onChange={e => updateEffect(i, { target: e.target.value })}
                placeholder="变量名" className="flex-1 bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
              <select value={eff.operation || 'add'} onChange={e => updateEffect(i, { operation: e.target.value })}
                className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
                <option value="add">加减</option>
                <option value="set">设为</option>
                <option value="multiply">乘以</option>
              </select>
              <input type="number" value={eff.amount ?? ''} onChange={e => updateEffect(i, { amount: +e.target.value })}
                placeholder="数量" className="w-16 bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
            </div>
          )}

          {/* 设标记 */}
          {eff.type === 'set_flag' && (
            <div className="flex gap-1">
              <input value={eff.target || ''} onChange={e => updateEffect(i, { target: e.target.value })}
                placeholder="标记名" className="flex-1 bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
              <select value={eff.value === false ? 'false' : 'true'} onChange={e => updateEffect(i, { value: e.target.value === 'true' })}
                className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
          )}

          {/* 触发/解锁/锁定事件 */}
          {(eff.type === 'trigger_event' || eff.type === 'unlock_event' || eff.type === 'lock_event') && (
            <input value={eff.target || ''} onChange={e => updateEffect(i, { target: e.target.value })}
              placeholder="目标事件ID"
              className="w-full bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── 标签编辑 ─────────────────────────────────────────────────

function TagsEditor({ eventId, initialTags }: { eventId: string; initialTags: any[] }) {
  const [tags, setTags] = useState(initialTags || []);
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState({ tagType: 'line', tagValue: '' });

  const addTag = async () => {
    if (!newTag.tagValue.trim()) return;
    const result = await api(`/events/item/${eventId}/tags`, {
      method: 'POST', body: JSON.stringify(newTag),
    });
    setTags([...tags, result]);
    setNewTag({ tagType: 'line', tagValue: '' });
    setAdding(false);
  };

  const deleteTag = async (id: number) => {
    await api(`/events/tags/${id}`, { method: 'DELETE' });
    setTags(tags.filter((t: any) => t.id !== id));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/60 font-semibold">标签</span>
        <button onClick={() => setAdding(true)} className="text-[10px] text-white/50 hover:text-white/70 flex items-center gap-0.5">
          <Plus size={10} />添加
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {tags.map((t: any) => (
          <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 flex items-center gap-1 group">
            <span className="text-white/30">{t.tagType}:</span>{t.tagValue}
            <button onClick={() => deleteTag(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <X size={8} className="text-red-400/60" />
            </button>
          </span>
        ))}
        {tags.length === 0 && !adding && <span className="text-[10px] text-white/30">无标签</span>}
      </div>
      {adding && (
        <div className="flex gap-1">
          <select value={newTag.tagType} onChange={e => setNewTag({ ...newTag, tagType: e.target.value })}
            className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
            <option value="line">剧情线</option>
            <option value="category">类型</option>
            <option value="chapter">章节</option>
          </select>
          <input value={newTag.tagValue} onChange={e => setNewTag({ ...newTag, tagValue: e.target.value })}
            placeholder="标签值" className="flex-1 bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none" />
          <button onClick={addTag} className="bg-green-500/20 text-green-300 text-[10px] rounded px-2 py-1 hover:bg-green-500/30">添加</button>
          <button onClick={() => setAdding(false)} className="bg-white/10 text-white/50 text-[10px] rounded px-2 py-1 hover:bg-white/20">取消</button>
        </div>
      )}
    </div>
  );
}

// ── 连接编辑 ─────────────────────────────────────────────────

function ConnectionsEditor({ eventId, allEvents, initialConnections }: { eventId: string; allEvents: any[]; initialConnections: any }) {
  const [conns, setConns] = useState<{ outgoing: any[]; incoming: any[] }>(initialConnections || { outgoing: [], incoming: [] });
  const [adding, setAdding] = useState(false);
  const [newConn, setNewConn] = useState({ toEventId: '', relationType: 'next' });

  const loadConns = async () => {
    const data = await api(`/events/item/${eventId}/connections`);
    setConns(data);
  };

  const addConn = async () => {
    if (!newConn.toEventId) return;
    await api('/events/connections', {
      method: 'POST',
      body: JSON.stringify({ fromEventId: eventId, ...newConn }),
    });
    setAdding(false);
    setNewConn({ toEventId: '', relationType: 'next' });
    loadConns();
  };

  const deleteConn = async (id: number) => {
    await api(`/events/connections/${id}`, { method: 'DELETE' });
    loadConns();
  };

  const otherEvents = allEvents.filter(e => e.id !== eventId);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/60 font-semibold">连接</span>
        <button onClick={() => setAdding(true)} className="text-[10px] text-white/50 hover:text-white/70 flex items-center gap-0.5">
          <Plus size={10} />添加
        </button>
      </div>

      {/* 出连接 */}
      {conns.outgoing?.map((c: any) => {
        const target = allEvents.find(e => e.id === c.toEventId);
        const connType = CONNECTION_TYPES.find(t => t.value === c.relationType);
        return (
          <div key={c.id} className="flex items-center gap-1 text-[10px] text-white/50 group">
            <span className="text-white/30">{connType?.label || c.relationType}</span>
            <span className="text-white/70">{target?.name || c.toEventId}</span>
            <div className="flex-1" />
            <button onClick={() => deleteConn(c.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded transition-opacity">
              <Trash2 size={8} className="text-red-400/50" />
            </button>
          </div>
        );
      })}
      {/* 入连接 */}
      {conns.incoming?.map((c: any) => {
        const source = allEvents.find(e => e.id === c.fromEventId);
        const connType = CONNECTION_TYPES.find(t => t.value === c.relationType);
        return (
          <div key={c.id} className="flex items-center gap-1 text-[10px] text-white/40">
            <span className="text-white/25">← {connType?.label || c.relationType}</span>
            <span className="text-white/50">{source?.name || c.fromEventId}</span>
          </div>
        );
      })}

      {!conns.outgoing?.length && !conns.incoming?.length && !adding && (
        <span className="text-[10px] text-white/30">无连接</span>
      )}

      {adding && (
        <div className="flex gap-1">
          <select value={newConn.relationType} onChange={e => setNewConn({ ...newConn, relationType: e.target.value })}
            className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
            {CONNECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={newConn.toEventId} onChange={e => setNewConn({ ...newConn, toEventId: e.target.value })}
            className="flex-1 bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/10 outline-none">
            <option value="">选择目标事件</option>
            {otherEvents.map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
          </select>
          <button onClick={addConn} disabled={!newConn.toEventId}
            className="bg-green-500/20 text-green-300 text-[10px] rounded px-2 py-1 hover:bg-green-500/30 disabled:opacity-30">添加</button>
          <button onClick={() => setAdding(false)} className="bg-white/10 text-white/50 text-[10px] rounded px-2 py-1 hover:bg-white/20">取消</button>
        </div>
      )}
    </div>
  );
}

// ── 新建事件表单 ─────────────────────────────────────────────

function CreateEventForm({ charId, bookId, onCreated, onCancel }: {
  charId: string;
  bookId?: string | null;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    id: '', name: '', description: '',
    status: 'locked', priority: 0, probability: 100,
    repeatable: 0, maxTriggers: '' as any,
  });
  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleCreate = async () => {
    await api(`/events/${charId}`, {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        bookId: bookId ?? null,
        maxTriggers: form.maxTriggers === '' ? undefined : +form.maxTriggers,
      }),
    });
    onCreated();
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/90">新建事件</span>
        <button onClick={onCancel} className="p-1 hover:bg-white/10 rounded-full"><X size={14} className="text-white/60" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-white/50">事件 ID</span>
          <input value={form.id} onChange={e => set('id', e.target.value)} placeholder="evt_xxx"
            className="w-full bg-white/10 text-white text-xs rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-white/30" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] text-white/50">名称</span>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="事件名称"
            className="w-full bg-white/10 text-white text-xs rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-white/30" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[10px] text-white/50">描述</span>
        <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="事件描述"
          className="w-full bg-white/10 text-white text-xs rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-white/30" />
      </label>
      <div className="grid grid-cols-4 gap-2">
        <label className="space-y-1">
          <span className="text-[10px] text-white/50">状态</span>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-2 border border-white/10 outline-none">
            <option value="locked">锁定</option>
            <option value="pending">待触发</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] text-white/50">优先级</span>
          <input type="number" value={form.priority} onChange={e => set('priority', +e.target.value)}
            className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-2 border border-white/10 outline-none" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] text-white/50">概率%</span>
          <input type="number" value={form.probability} onChange={e => set('probability', +e.target.value)} min={0} max={100}
            className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-2 border border-white/10 outline-none" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] text-white/50">可重复</span>
          <select value={form.repeatable} onChange={e => set('repeatable', +e.target.value)}
            className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-2 border border-white/10 outline-none">
            <option value={0}>否</option>
            <option value={1}>是</option>
          </select>
        </label>
      </div>
      <button onClick={handleCreate} disabled={!form.id.trim() || !form.name.trim()}
        className="w-full py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-30">
        <Save size={12} className="inline mr-1" />创建
      </button>
    </div>
  );
}

// ── 事件详情面板 ─────────────────────────────────────────────

function EventDetailPanel({ event, allEvents, onClose, onReload }: {
  event: any;
  allEvents: any[];
  onClose: () => void;
  onReload: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [editingBasic, setEditingBasic] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    loadDetail();
  }, [event.id]);

  const loadDetail = async () => {
    const d = await api(`/events/item/${event.id}`);
    setDetail(d);
    setForm({
      name: d.name, description: d.description || '',
      priority: d.priority, probability: d.probability,
      repeatable: d.repeatable, maxTriggers: d.maxTriggers ?? '',
      cooldownType: d.cooldownType || 'none', cooldownValue: d.cooldownValue || 0,
      conditionCooldown: d.conditionCooldown || 0,
    });
  };

  const saveBasic = async () => {
    await api(`/events/item/${event.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...form,
        maxTriggers: form.maxTriggers === '' ? null : +form.maxTriggers,
      }),
    });
    setEditingBasic(false);
    loadDetail();
    onReload();
  };

  const saveConditions = async (field: string, val?: string) => {
    await api(`/events/item/${event.id}`, {
      method: 'PUT',
      body: JSON.stringify({ [field]: val || null }),
    });
    loadDetail();
  };

  const saveEffects = async (val?: string) => {
    await api(`/events/item/${event.id}`, {
      method: 'PUT',
      body: JSON.stringify({ effects: val || null }),
    });
    loadDetail();
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除事件「${event.name}」？`)) return;
    await api(`/events/item/${event.id}`, { method: 'DELETE' });
    onClose();
    onReload();
  };

  const handleAction = async (action: string) => {
    await api(`/events/item/${event.id}/${action}`, { method: 'POST' });
    loadDetail();
    onReload();
  };

  if (!detail) return null;

  const ss = STATUS_STYLE[detail.status] || STATUS_STYLE.locked;
  const StatusIcon = ss.icon;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden">
      {/* 头部 */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <StatusIcon size={14} className={ss.color} />
        <span className="text-sm font-semibold text-white/90 flex-1">{detail.name}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${ss.bg} ${ss.color}`}>{ss.label}</span>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full"><X size={14} className="text-white/60" /></button>
      </div>

      <div className="px-4 py-3 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* 状态操作 */}
        <div className="flex gap-1">
          {detail.status === 'locked' && (
            <button onClick={() => handleAction('unlock')}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500/20 text-amber-200 text-[10px] hover:bg-amber-500/30">
              <Clock size={10} />解锁 → 待触发
            </button>
          )}
          {(detail.status === 'pending' || detail.status === 'active') && (
            <button onClick={() => handleAction('complete')}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-green-500/20 text-green-200 text-[10px] hover:bg-green-500/30">
              <Check size={10} />完成
            </button>
          )}
          {detail.status === 'completed' && detail.repeatable === 1 && (
            <button onClick={() => handleAction('reset')}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-500/20 text-blue-200 text-[10px] hover:bg-blue-500/30">
              <RotateCcw size={10} />重置 → 待触发
            </button>
          )}
          <div className="flex-1" />
          <button onClick={handleDelete}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/10 text-red-400/70 text-[10px] hover:bg-red-500/20">
            <Trash2 size={10} />删除
          </button>
        </div>

        {/* 基本信息 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/60 font-semibold">基本信息</span>
            <button onClick={() => setEditingBasic(!editingBasic)}
              className="text-[10px] text-white/50 hover:text-white/70 flex items-center gap-0.5">
              <Edit3 size={10} />{editingBasic ? '取消' : '编辑'}
            </button>
          </div>
          {editingBasic ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="名称" className="bg-white/10 text-white text-[10px] rounded px-2 py-1.5 border border-white/10 outline-none" />
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="描述" className="bg-white/10 text-white text-[10px] rounded px-2 py-1.5 border border-white/10 outline-none" />
              </div>
              <div className="grid grid-cols-4 gap-1">
                <input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: +e.target.value })}
                  placeholder="优先级" className="bg-white/10 text-white text-[10px] rounded px-2 py-1.5 border border-white/10 outline-none" />
                <input type="number" value={form.probability} onChange={e => setForm({ ...form, probability: +e.target.value })}
                  placeholder="概率" className="bg-white/10 text-white text-[10px] rounded px-2 py-1.5 border border-white/10 outline-none" />
                <select value={form.repeatable} onChange={e => setForm({ ...form, repeatable: +e.target.value })}
                  className="bg-white/10 text-white text-[10px] rounded px-2 py-1.5 border border-white/10 outline-none">
                  <option value={0}>不可重复</option><option value={1}>可重复</option>
                </select>
                <input type="number" value={form.maxTriggers} onChange={e => setForm({ ...form, maxTriggers: e.target.value })}
                  placeholder="最大次数" className="bg-white/10 text-white text-[10px] rounded px-2 py-1.5 border border-white/10 outline-none" />
              </div>
              {/* 冷却设置 */}
              <div className="flex gap-1">
                <select value={form.cooldownType} onChange={e => setForm({ ...form, cooldownType: e.target.value })}
                  className="bg-white/10 text-white text-[10px] rounded px-2 py-1.5 border border-white/10 outline-none">
                  {COOLDOWN_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {form.cooldownType !== 'none' && (
                  <input type="number" value={form.cooldownValue} onChange={e => setForm({ ...form, cooldownValue: +e.target.value })}
                    placeholder="冷却值" className="w-16 bg-white/10 text-white text-[10px] rounded px-2 py-1.5 border border-white/10 outline-none" />
                )}
                <input type="number" value={form.conditionCooldown} onChange={e => setForm({ ...form, conditionCooldown: +e.target.value })}
                  placeholder="条件冷却" className="w-20 bg-white/10 text-white text-[10px] rounded px-2 py-1.5 border border-white/10 outline-none" />
              </div>
              <button onClick={saveBasic}
                className="w-full py-1 bg-green-500/20 text-green-300 text-[10px] rounded hover:bg-green-500/30">
                <Save size={10} className="inline mr-1" />保存
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <span className="text-white/40">ID: <span className="text-white/70">{detail.id}</span></span>
              <span className="text-white/40">优先级: <span className="text-white/70">{detail.priority}</span></span>
              <span className="text-white/40">概率: <span className="text-white/70">{detail.probability}%</span></span>
              <span className="text-white/40">触发次数: <span className="text-white/70">{detail.triggerCount}</span></span>
              <span className="text-white/40">可重复: <span className="text-white/70">{detail.repeatable ? '是' : '否'}</span></span>
              {detail.cooldownType !== 'none' && (
                <span className="text-white/40">冷却: <span className="text-white/70">{detail.cooldownType} {detail.cooldownValue}</span></span>
              )}
              {detail.description && <span className="text-white/40 col-span-2">{detail.description}</span>}
            </div>
          )}
        </div>

        {/* 标签 */}
        <TagsEditor eventId={detail.id} initialTags={detail.tags || []} />

        {/* 解锁条件 */}
        <ConditionEditor label="解锁条件（锁定 → 待触发）"
          value={detail.unlockConditions}
          onChange={val => saveConditions('unlockConditions', val)} />

        {/* 触发条件 */}
        <ConditionEditor label="触发条件（待触发 → 触发）"
          value={detail.triggerConditions}
          onChange={val => saveConditions('triggerConditions', val)} />

        {/* 触发效果 */}
        <EffectEditor value={detail.effects} onChange={saveEffects} />

        {/* 连接 */}
        <ConnectionsEditor eventId={detail.id} allEvents={allEvents} initialConnections={detail.connections || { outgoing: [], incoming: [] }} />
      </div>
    </div>
  );
}

// ── 事件卡片（列表中的简略卡片） ─────────────────────────────

function EventCard({ event, selected, onClick }: { event: any; selected: boolean; onClick: () => void }) {
  const ss = STATUS_STYLE[event.status] || STATUS_STYLE.locked;
  const StatusIcon = ss.icon;

  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
        selected ? 'bg-white/15 border-white/25' : 'bg-white/5 border-white/10 hover:bg-white/10'
      }`}>
      <div className="flex items-center gap-2">
        <StatusIcon size={12} className={ss.color} />
        <span className="text-xs text-white/90 font-medium flex-1 truncate">{event.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ss.bg} ${ss.color}`}>{ss.label}</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[10px] text-white/30">{event.id}</span>
        {event.probability < 100 && <span className="text-[10px] text-amber-300/50">{event.probability}%</span>}
        {event.repeatable === 1 && <span className="text-[10px] text-blue-300/50">可重复</span>}
      </div>
    </button>
  );
}

// ── 事件书选择器 ─────────────────────────────────────────────

function BookSelector({ books, selectedBookId, onChange }: {
  books: any[];
  selectedBookId: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
      <button
        onClick={() => onChange(null)}
        className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full transition-colors ${
          selectedBookId === null
            ? 'bg-white/20 text-white font-medium'
            : 'text-white/50 hover:text-white/70 hover:bg-white/10'
        }`}>
        全部
      </button>
      {books.map(b => (
        <button
          key={b.id}
          onClick={() => onChange(b.id)}
          className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full transition-colors max-w-[96px] truncate ${
            selectedBookId === b.id
              ? 'bg-white/20 text-white font-medium'
              : 'text-white/50 hover:text-white/70 hover:bg-white/10'
          }`}>
          {b.name}
          {b.scope === 'global' && <span className="ml-1 opacity-50">全</span>}
        </button>
      ))}
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────────────

export default function EventEditor({ charId }: { charId: string }) {
  const [books, setBooks] = useState<any[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadBooks = async () => {
    const [charBooks, globalBooks] = await Promise.all([
      api(`/event-books?charId=${charId}`),
      api(`/event-books`),
    ]);
    const all = Array.isArray(charBooks) ? charBooks : [];
    const globals = (Array.isArray(globalBooks) ? globalBooks : []).filter((b: any) => b.scope === 'global');
    // merge, deduplicate
    const seen = new Set(all.map((b: any) => b.id));
    const merged = [...all, ...globals.filter((b: any) => !seen.has(b.id))];
    setBooks(merged);
  };

  const loadEvents = async () => {
    const url = selectedBookId
      ? `/events/${charId}?bookId=${selectedBookId}`
      : `/events/${charId}`;
    const data = await api(url);
    setEvents(Array.isArray(data) ? data : []);
    setLoaded(true);
  };

  useEffect(() => { loadBooks(); }, [charId]);
  useEffect(() => { setLoaded(false); loadEvents(); }, [charId, selectedBookId]);

  const sortedEvents = [...events].sort((a, b) => {
    const order: Record<string, number> = { active: 0, pending: 1, locked: 2, completed: 3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.priority - a.priority;
  });

  const selectedEvent = events.find(e => e.id === selectedId);

  return (
    <div className="space-y-3">
      {/* 事件书筛选 */}
      {books.length > 0 && (
        <BookSelector books={books} selectedBookId={selectedBookId} onChange={(id) => {
          setSelectedBookId(id);
          setSelectedId(null);
          setCreating(false);
        }} />
      )}

      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">
          {selectedBookId ? (books.find(b => b.id === selectedBookId)?.name || '事件') : '全部事件'}
        </span>
        <div className="flex items-center gap-2">
          {/* 状态统计 */}
          {(['pending', 'active', 'locked', 'completed'] as const).map(s => {
            const count = events.filter(e => e.status === s).length;
            if (count === 0) return null;
            const ss = STATUS_STYLE[s];
            return (
              <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-full ${ss.bg} ${ss.color}`}>
                {ss.label} {count}
              </span>
            );
          })}
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white/15 text-white/80 hover:bg-white/25 transition-colors">
            <Plus size={12} />新建
          </button>
        </div>
      </div>

      {creating && (
        <CreateEventForm charId={charId} bookId={selectedBookId} onCreated={() => { setCreating(false); loadEvents(); }} onCancel={() => setCreating(false)} />
      )}

      {/* 事件详情面板 */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <EventDetailPanel
              event={selectedEvent}
              allEvents={events}
              onClose={() => setSelectedId(null)}
              onReload={loadEvents}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 事件列表 */}
      {events.length === 0 && !creating && loaded && (
        <div className="text-center py-8">
          <Play size={24} className="text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-xs">
            {selectedBookId ? '该事件书暂无事件' : '暂无事件，点击「新建」创建'}
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        {sortedEvents.map(evt => (
          <EventCard key={evt.id} event={evt} selected={selectedId === evt.id}
            onClick={() => setSelectedId(selectedId === evt.id ? null : evt.id)} />
        ))}
      </div>
    </div>
  );
}
