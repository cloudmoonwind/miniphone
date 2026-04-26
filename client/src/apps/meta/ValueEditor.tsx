import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Plus, Menu, Sparkles } from 'lucide-react';
import { ValueModal, ValueFormData } from './value/ValueModal';
import { SidebarDrawer } from './value/SidebarDrawer';
import { ValueDetail } from './value/ValueDetail';

const api = (path: string, opts: any = {}) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

export default function ValueEditor({ charId }: { charId: string }) {
  const [values,      setValues]      = useState<any[]>([]);
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [loaded,      setLoaded]      = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal,       setModal]       = useState<'create' | 'edit' | null>(null);

  const loadValues = async () => {
    const data = await api(`/values/${charId}`);
    const list = Array.isArray(data) ? data : [];
    setValues(list);
    setLoaded(true);
    if (list.length > 0 && selectedId == null) setSelectedId(list[0].id);
  };

  useEffect(() => { loadValues(); }, [charId]);

  const selectedValue = values.find(v => v.id === selectedId);
  const groups = Array.from(new Set(values.map(v => v.groupName ?? '').filter(Boolean)));

  const handleCreate = async (data: ValueFormData) => {
    await api(`/values/${charId}`, {
      method: 'POST',
      body: JSON.stringify({ ...data, sortOrder: values.length, groupName: data.groupName || null }),
    });
    setModal(null);
    await loadValues();
  };

  const handleEdit = async (data: ValueFormData) => {
    if (!selectedId) return;
    await api(`/values/item/${selectedId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, groupName: data.groupName || null }),
    });
    setModal(null);
    await loadValues();
  };

  const handleDelete = async () => {
    if (!selectedId || !selectedValue) return;
    if (!confirm(`确定删除「${selectedValue.name}」？相关阶段和规则也会一起删除。`)) return;
    await api(`/values/item/${selectedId}`, { method: 'DELETE' });
    setSelectedId(null);
    await loadValues();
  };

  const handleMoveUp = async (id: number) => {
    const idx = values.findIndex(v => v.id === id);
    if (idx <= 0) return;
    const prev = values[idx - 1];
    await Promise.all([
      api(`/values/item/${id}`,      { method: 'PUT', body: JSON.stringify({ sortOrder: prev.sortOrder }) }),
      api(`/values/item/${prev.id}`, { method: 'PUT', body: JSON.stringify({ sortOrder: values[idx].sortOrder }) }),
    ]);
    await loadValues();
  };

  const handleMoveDown = async (id: number) => {
    const idx = values.findIndex(v => v.id === id);
    if (idx < 0 || idx >= values.length - 1) return;
    const next = values[idx + 1];
    await Promise.all([
      api(`/values/item/${id}`,      { method: 'PUT', body: JSON.stringify({ sortOrder: next.sortOrder }) }),
      api(`/values/item/${next.id}`, { method: 'PUT', body: JSON.stringify({ sortOrder: values[idx].sortOrder }) }),
    ]);
    await loadValues();
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* 顶栏 */}
      <div className="flex items-center px-3 py-2 shrink-0 bg-white/20 backdrop-blur-sm border-b border-white/30">
        <button onClick={() => setSidebarOpen(true)}
          className="p-1.5 hover:bg-white/30 rounded-full transition-colors mr-1.5">
          <Menu size={14} className="text-slate-500" />
        </button>
        <span className="text-xs font-medium text-slate-600 truncate flex-1">
          {selectedValue ? selectedValue.name : '选择变量'}
        </span>
        <button onClick={() => setModal('create')}
          className="flex items-center gap-1 px-2.5 py-1 bg-white/40 backdrop-blur-sm border border-white/60 text-slate-600 text-[11px] font-medium hover:bg-white/60 transition-colors rounded-full shrink-0">
          <Plus size={10} />新建
        </button>
      </div>

      {/* 详情区 */}
      <div className="flex-1 overflow-hidden relative">
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
            <Sparkles size={20} className="text-slate-300" />
            <p className="text-slate-400 text-xs">
              {loaded
                ? values.length === 0 ? '点击右上角新建变量' : '点击左上角菜单选择变量'
                : '加载中…'}
            </p>
          </div>
        )}

        <SidebarDrawer
          open={sidebarOpen}
          values={values}
          selectedId={selectedId}
          onSelect={id => setSelectedId(id)}
          onClose={() => setSidebarOpen(false)}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
      </div>

      <AnimatePresence>
        {modal === 'create' && (
          <ValueModal groups={groups} onSave={handleCreate} onCancel={() => setModal(null)} />
        )}
        {modal === 'edit' && selectedValue && (
          <ValueModal
            groups={groups}
            initial={{
              category:     selectedValue.category,
              name:         selectedValue.name,
              variableName: selectedValue.variableName,
              valueType:    selectedValue.valueType ?? 'continuous',
              currentValue: selectedValue.currentValue,
              minValue:     selectedValue.minValue,
              maxValue:     selectedValue.maxValue,
              groupName:    selectedValue.groupName ?? '',
            }}
            onSave={handleEdit}
            onCancel={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
