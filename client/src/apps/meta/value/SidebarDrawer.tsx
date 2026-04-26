import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

export function SidebarDrawer({ open, values, selectedId, onSelect, onClose, onMoveUp, onMoveDown }: {
  open: boolean;
  values: any[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
}) {
  const groups = Array.from(new Set(values.map(v => v.groupName ?? ''))).sort();
  const groupedValues = groups.map(g => ({
    label: g || '未分组',
    isDefault: !g,
    items: values.filter(v => (v.groupName ?? '') === g),
  }));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-slate-900/10 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="absolute left-0 top-0 bottom-0 z-30 w-44 flex flex-col"
            style={{
              background: 'rgba(230, 234, 252, 0.6)',
              backdropFilter: 'blur(24px)',
              borderRight: '1px solid rgba(255,255,255,0.5)',
            }}>

            <div className="px-4 py-3 border-b border-white/30 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">变量列表</span>
              <button onClick={onClose} className="p-1 hover:bg-white/30 rounded-full transition-colors">
                <X size={12} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {groupedValues.map(({ label, isDefault, items }) => (
                <div key={label}>
                  {!isDefault && (
                    <div className="px-4 pt-3 pb-1 text-[8px] uppercase tracking-widest text-slate-400">
                      {label}
                    </div>
                  )}
                  {items.map(v => {
                    const isSelected = v.id === selectedId;
                    const displayVal = v.valueType !== 'discrete'
                      ? Math.round(v.currentValue)
                      : null;
                    return (
                      <div key={v.id}
                        className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                          isSelected ? 'bg-white/50' : 'hover:bg-white/25'
                        }`}
                        onClick={() => { onSelect(v.id); onClose(); }}>
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-medium truncate ${
                            isSelected ? 'text-indigo-600' : 'text-slate-700'
                          }`}>
                            {v.name}
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5 font-mono">
                            {displayVal !== null ? displayVal : '离散'}
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={e => { e.stopPropagation(); onMoveUp(v.id); }}
                            className="p-0.5 hover:bg-white/40 rounded">
                            <ChevronUp size={9} className="text-slate-400" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); onMoveDown(v.id); }}
                            className="p-0.5 hover:bg-white/40 rounded">
                            <ChevronDown size={9} className="text-slate-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {values.length === 0 && (
                <div className="px-4 py-8 text-center text-[11px] text-slate-400">暂无变量</div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
