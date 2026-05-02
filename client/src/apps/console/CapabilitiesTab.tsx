import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, ChevronDown, FlaskConical, Layers, Zap, CircleDot } from 'lucide-react';
import { useActiveChar } from '../../core/hooks/useActiveChar';

// ── 类型 ────────────────────────────────────────────────────────

interface IdentifierInfo {
  identifier: string;
  description?: string;
  modifiers?: string[];
  currentValue: string | null;
  status: 'ok' | 'unknown-field' | 'unknown-namespace' | 'error' | 'no-context' | 'no-record';
}

interface NamespaceGroup {
  namespace: string;
  identifiers: IdentifierInfo[];
}

interface TestRecord {
  raw: string;
  namespace: string;
  identifier: string;
  modifier: string | null;
  result: string;
  status: 'ok' | 'unknown-namespace' | 'unknown-field' | 'error';
  error?: string;
}

type SubTab = 'vars' | 'test' | 'triggers' | 'effects';

// ── 主组件 ──────────────────────────────────────────────────────

export function CapabilitiesTab() {
  const { activeChar } = useActiveChar();
  const [sub, setSub] = useState<SubTab>('vars');

  return (
    <div className="flex flex-col gap-3">
      {/* 当前角色提示 */}
      <div className="rounded-xl bg-white/75 border border-indigo-100/60 px-3 py-2 flex items-center gap-2 shadow-sm">
        <CircleDot size={12} className={activeChar ? 'text-emerald-500' : 'text-slate-300'} />
        <span className="text-[11px] text-slate-500">当前角色</span>
        <span className="text-xs font-medium text-slate-800">
          {activeChar?.name ?? <span className="text-slate-400">未选择（动态命名空间会显示空）</span>}
        </span>
      </div>

      {/* 子 Tab pills */}
      <div className="flex items-center gap-1 rounded-full bg-indigo-50 p-0.5 self-start">
        <SubTabPill icon={<Layers size={11} />}     label="变量"   active={sub === 'vars'}     onClick={() => setSub('vars')} />
        <SubTabPill icon={<FlaskConical size={11} />} label="测试器" active={sub === 'test'}     onClick={() => setSub('test')} />
        <SubTabPill icon={<Zap size={11} />}        label="Trigger" active={sub === 'triggers'} onClick={() => setSub('triggers')} />
        <SubTabPill icon={<Zap size={11} />}        label="Effect"  active={sub === 'effects'}  onClick={() => setSub('effects')} />
      </div>

      {/* 内容 */}
      {sub === 'vars'     && <VarsView characterId={activeChar?.id ?? null} />}
      {sub === 'test'     && <TesterView characterId={activeChar?.id ?? null} />}
      {sub === 'triggers' && <TriggersView />}
      {sub === 'effects'  && <EffectsView />}
    </div>
  );
}

// ── 子 Tab 按钮 ─────────────────────────────────────────────────

function SubTabPill({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 h-7 text-xs font-semibold transition-all ${
        active ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:text-indigo-600'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ── 变量目录视图 ─────────────────────────────────────────────────

function VarsView({ characterId }: { characterId: string | null }) {
  const [groups, setGroups]   = useState<NamespaceGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  const fetchGroups = async () => {
    setLoading(true); setErr(null);
    try {
      const url = characterId
        ? `/api/capabilities?characterId=${encodeURIComponent(characterId)}`
        : `/api/capabilities`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setGroups(data.namespaces || []);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, [characterId]);

  if (err) return <ErrorBox msg={err} onRetry={fetchGroups} />;
  if (loading && groups.length === 0) return <LoadingBox />;

  return (
    <div className="flex flex-col gap-2">
      {groups.map(g => <NamespaceCard key={g.namespace} group={g} />)}
      {groups.length === 0 && !loading && (
        <div className="text-center text-slate-400 text-xs py-10">无已注册命名空间</div>
      )}
    </div>
  );
}

function NamespaceCard({ group }: { group: NamespaceGroup }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-indigo-100/60 bg-white/75 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-indigo-50/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <code className="text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{`{{${group.namespace}:...}}`}</code>
          <span className="text-[10px] text-slate-400">{group.identifiers.length} 项</span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="divide-y divide-indigo-50/80">
          {group.identifiers.length === 0
            ? <div className="px-3 py-3 text-[11px] text-slate-400 italic">（占位，暂无 identifier）</div>
            : group.identifiers.map(id => <IdentifierRow key={id.identifier} ns={group.namespace} info={id} />)}
        </div>
      )}
    </div>
  );
}

function IdentifierRow({ ns, info }: { ns: string; info: IdentifierInfo }) {
  const placeholder = `{{${ns}:${info.identifier}}}`;
  const display = info.currentValue == null
    ? (info.status === 'no-context' ? '需选角色' : '—')
    : info.currentValue;

  return (
    <div className="flex items-start gap-2 px-3 py-2 hover:bg-indigo-50/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <code className="text-[11px] font-mono text-slate-700">{info.identifier}</code>
          <StatusDot status={info.status} />
          {info.modifiers && info.modifiers.length > 0 && (
            <span className="text-[9px] text-slate-400">[{info.modifiers.join('|')}]</span>
          )}
        </div>
        {info.description && <div className="text-[10px] text-slate-400 mt-0.5">{info.description}</div>}
        <div className="text-[11px] mt-1 font-mono text-slate-600 break-all line-clamp-2">{display}</div>
      </div>
      <CopyBtn text={placeholder} />
    </div>
  );
}

function StatusDot({ status }: { status: IdentifierInfo['status'] }) {
  const map: Record<string, { color: string; label: string }> = {
    ok:                { color: 'bg-emerald-400', label: '已求值' },
    'unknown-field':   { color: 'bg-slate-300',   label: '无值' },
    'unknown-namespace': { color: 'bg-rose-400',  label: '错误' },
    error:             { color: 'bg-rose-500',    label: '异常' },
    'no-context':      { color: 'bg-amber-300',   label: '需选角色' },
    'no-record':       { color: 'bg-slate-300',   label: '—' },
  };
  const { color, label } = map[status] ?? map['no-record'];
  return <span title={label} className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="shrink-0 rounded p-1 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
      title="复制"
    >
      {copied
        ? <span className="text-[10px] text-emerald-600 font-bold">✓</span>
        : <Copy size={11} />}
    </button>
  );
}

// ── 测试器视图 ───────────────────────────────────────────────────

function TesterView({ characterId }: { characterId: string | null }) {
  const [template, setTemplate] = useState('你是 {{char:name}}。好感度 {{val:affection}}（{{val:affection:stage}}）。今天天气 {{world:weather}}。');
  const [output, setOutput]     = useState('');
  const [records, setRecords]   = useState<TestRecord[]>([]);
  const [err, setErr]           = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!characterId) {
      setOutput(''); setRecords([]); setErr('请先选择角色');
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setErr(null);
      try {
        const res = await fetch('/api/capabilities/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template, characterId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setOutput(data.output ?? '');
        setRecords(data.records ?? []);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [template, characterId]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] text-slate-500">模板（输入混合文本，含 {`{{ns:id}}`} 占位符）</label>
      <textarea
        value={template}
        onChange={e => setTemplate(e.target.value)}
        rows={5}
        className="w-full rounded-xl border border-indigo-100 bg-white/80 px-3 py-2 text-xs font-mono text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 resize-y"
      />

      <label className="text-[11px] text-slate-500 mt-1">替换后输出</label>
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-xs font-mono text-slate-700 min-h-[60px] whitespace-pre-wrap break-all">
        {err ? <span className="text-rose-500">{err}</span> : output || <span className="text-slate-300">（空）</span>}
      </div>

      {records.length > 0 && (
        <>
          <label className="text-[11px] text-slate-500 mt-1">命中详情（{records.length} 处占位符）</label>
          <div className="rounded-xl border border-indigo-100/60 bg-white/75 divide-y divide-indigo-50/80 overflow-hidden">
            {records.map((r, i) => <RecordRow key={i} record={r} />)}
          </div>
        </>
      )}
    </div>
  );
}

function RecordRow({ record }: { record: TestRecord }) {
  const statusStyle: Record<string, string> = {
    ok:                  'bg-emerald-50 text-emerald-700',
    'unknown-field':     'bg-slate-100 text-slate-500',
    'unknown-namespace': 'bg-rose-50 text-rose-700',
    error:               'bg-rose-100 text-rose-700',
  };
  return (
    <div className="px-3 py-2 flex items-start gap-2">
      <code className="shrink-0 text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{record.raw}</code>
      <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded ${statusStyle[record.status] ?? 'bg-slate-100'}`}>
        {record.status}
      </span>
      <span className="flex-1 text-[11px] font-mono text-slate-700 break-all">{record.result}</span>
    </div>
  );
}

// ── Trigger 类型库视图 ──────────────────────────────────────────

interface TriggerMeta { type: string; description: string; ctxHint?: string }

function TriggersView() {
  const [list, setList] = useState<TriggerMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/capabilities/triggers');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setList(data.triggers || []);
    } catch (e: any) { setErr(e?.message ?? String(e)); } finally { setLoading(false); }
  };
  useEffect(() => { fetchList(); }, []);

  if (err) return <ErrorBox msg={err} onRetry={fetchList} />;
  if (loading && list.length === 0) return <LoadingBox />;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-slate-400">Trigger 字符串本身是开放的；下面列出的是已知在用的官方类型。</div>
      <div className="rounded-xl border border-indigo-100/60 bg-white/75 divide-y divide-indigo-50/80 overflow-hidden">
        {list.map((t) => (
          <div key={t.type} className="px-3 py-2 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <code className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{t.type}</code>
              {t.ctxHint && t.ctxHint !== '—' && (
                <code className="text-[10px] font-mono text-slate-400">{t.ctxHint}</code>
              )}
            </div>
            <div className="text-[11px] text-slate-600">{t.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Effect 类型库视图 ───────────────────────────────────────────

interface EffectMeta { type: string; aliases?: string[]; description: string; paramsHint?: string }

function EffectsView() {
  const [list, setList] = useState<EffectMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/capabilities/effects');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setList(data.effects || []);
    } catch (e: any) { setErr(e?.message ?? String(e)); } finally { setLoading(false); }
  };
  useEffect(() => { fetchList(); }, []);

  if (err) return <ErrorBox msg={err} onRetry={fetchList} />;
  if (loading && list.length === 0) return <LoadingBox />;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] text-slate-400">事件 effects JSON 中可使用以下 type；中文别名等价。</div>
      <div className="rounded-xl border border-indigo-100/60 bg-white/75 divide-y divide-indigo-50/80 overflow-hidden">
        {list.map((e) => (
          <div key={e.type} className="px-3 py-2 flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{e.type}</code>
              {e.aliases?.map(a => (
                <code key={a} className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">{a}</code>
              ))}
            </div>
            <div className="text-[11px] text-slate-600">{e.description}</div>
            {e.paramsHint && (
              <code className="text-[10px] font-mono text-slate-400 break-all">{e.paramsHint}</code>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 占位/状态视图 ───────────────────────────────────────────────

function PendingNotice({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-indigo-200 bg-white/50 p-6 text-center">
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="text-[11px] text-slate-400 mt-1">{hint}</div>
    </div>
  );
}

function LoadingBox() {
  return <div className="text-center text-slate-400 text-xs py-10">加载中...</div>;
}

function ErrorBox({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-600">
      <div className="font-bold mb-1">加载失败</div>
      <div className="font-mono text-[11px] break-all">{msg}</div>
      <button onClick={onRetry} className="mt-2 rounded px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold">重试</button>
    </div>
  );
}
