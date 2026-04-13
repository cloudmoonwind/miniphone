/**
 * 世界状态编辑器
 *
 * 全局键值对管理：新增、编辑、删除
 */
import { useState } from 'react';
import { Plus, Trash2, Globe, Cloud, MapPin, Clock, Sun, Save, X } from 'lucide-react';

const api = (path: string, opts: any = {}) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

const KNOWN_ICONS: Record<string, any> = {
  weather: Cloud, location: MapPin, time_period: Clock, season: Sun, day_type: Globe,
};

function WorldRow({ entry, onUpdate, onDelete }: {
  entry: any; onUpdate: (key: string, value: string) => void; onDelete: (key: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(entry.value);
  const Icon = KNOWN_ICONS[entry.key] || Globe;

  const save = () => { onUpdate(entry.key, val); setEditing(false); };

  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg group">
      <Icon size={14} className="text-white/40 shrink-0" />
      <span className="text-xs text-white/60 w-24 shrink-0 font-mono">{entry.key}</span>
      {editing ? (
        <div className="flex-1 flex gap-1">
          <input value={val} onChange={e => setVal(e.target.value)} autoFocus
            onKeyDown={e => e.key === 'Enter' && save()}
            className="flex-1 bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20 outline-none" />
          <button onClick={save} className="bg-green-500/20 text-green-300 text-[10px] rounded px-2 py-1 hover:bg-green-500/30">保存</button>
          <button onClick={() => { setVal(entry.value); setEditing(false); }}
            className="bg-white/10 text-white/50 text-[10px] rounded px-2 py-1 hover:bg-white/20">取消</button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-xs text-white/90 cursor-pointer hover:text-white" onClick={() => setEditing(true)}>
            {entry.value}
          </span>
          <button onClick={() => onDelete(entry.key)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity">
            <Trash2 size={12} className="text-red-400/60" />
          </button>
        </>
      )}
    </div>
  );
}

export default function WorldStateEditor() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const loadEntries = async () => {
    const data = await api('/worldstate');
    setEntries(Array.isArray(data) ? data : []);
    setLoaded(true);
  };

  if (!loaded) loadEntries();

  const handleUpdate = async (key: string, value: string) => {
    await api(`/worldstate/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });
    loadEntries();
  };

  const handleDelete = async (key: string) => {
    await api(`/worldstate/${key}`, { method: 'DELETE' });
    loadEntries();
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newVal.trim()) return;
    await api(`/worldstate/${newKey.trim()}`, { method: 'PUT', body: JSON.stringify({ value: newVal.trim() }) });
    setNewKey(''); setNewVal(''); setAdding(false);
    loadEntries();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">世界状态</span>
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white/15 text-white/80 hover:bg-white/25 transition-colors">
          <Plus size={12} />新增
        </button>
      </div>

      {adding && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/80">新增世界状态</span>
            <button onClick={() => setAdding(false)} className="p-1 hover:bg-white/10 rounded-full"><X size={12} className="text-white/60" /></button>
          </div>
          <div className="flex gap-2">
            <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="键名（如 weather）"
              className="flex-1 bg-white/10 text-white text-xs rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-white/30" />
            <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="值（如 sunny）"
              className="flex-1 bg-white/10 text-white text-xs rounded-lg px-3 py-2 border border-white/10 outline-none focus:border-white/30" />
          </div>
          <button onClick={handleAdd} disabled={!newKey.trim() || !newVal.trim()}
            className="w-full py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-30">
            <Save size={12} className="inline mr-1" />添加
          </button>
        </div>
      )}

      {entries.length === 0 && !adding && loaded && (
        <div className="text-center py-8">
          <Globe size={24} className="text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-xs">暂无世界状态，点击「新增」添加</p>
        </div>
      )}

      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/15 overflow-hidden">
        {entries.map(e => (
          <WorldRow key={e.key} entry={e} onUpdate={handleUpdate} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
