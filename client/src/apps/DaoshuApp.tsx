/**
 * 元系统 — 数值系统 & 规则系统编辑器
 *
 * 三个标签页：
 * - 数值系统：CRUD 数值 + 阶段 + 规则
 * - 规则系统：CRUD 事件 + 标签 + 条件 + 效果 + 连接
 * - 世界状态：全局键值对管理
 */
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronDown, Sparkles, Play, Globe, Database } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Avatar from '../components/Avatar.jsx';
import ValueEditor from './daoshu/ValueEditor.tsx';
import EventEditor from './daoshu/EventEditor.tsx';
import WorldStateEditor from './daoshu/WorldStateEditor.tsx';

const api = (path: string, opts: any = {}) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

const TabButton = ({ active, label, icon: Icon, onClick }: any) => (
  <button onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
      active ? 'bg-white/20 text-white shadow-lg shadow-white/5' : 'text-white/50 hover:text-white/70 hover:bg-white/10'
    }`}>
    <Icon size={13} />
    {label}
  </button>
);

export default function DaoshuApp({ onBack }: { onBack: () => void }) {
  const [chars, setChars]           = useState<any[]>([]);
  const [char, setChar]             = useState<any>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [tab, setTab]               = useState<'values' | 'rules' | 'world'>('values');

  useEffect(() => {
    api('/characters').then(d => {
      const list = Array.isArray(d) ? d : [];
      setChars(list);
      if (list.length > 0) setChar(list[0]);
    });
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 relative">
      {/* 顶栏 */}
      <div className="flex items-center px-4 pt-3 pb-2 shrink-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-white" />
        </button>
        <Database size={16} className="text-white/60 ml-1" />
        <span className="text-white font-bold text-base ml-1.5">元系统</span>
        <div className="flex-1" />
        <button onClick={() => setShowPicker(p => !p)}
          className="flex items-center gap-1.5 bg-white/15 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors">
          <span className="text-white text-sm font-medium">{char?.name || '选择角色'}</span>
          <ChevronDown size={14} className="text-white/70" />
        </button>
      </div>

      {/* 角色选择下拉 */}
      <AnimatePresence>
        {showPicker && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="absolute top-14 right-4 z-30 bg-white/20 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
            {chars.map(c => (
              <button key={c.id} onClick={() => { setChar(c); setShowPicker(false); }}
                className={`w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/20 transition-colors text-left ${char?.id === c.id ? 'bg-white/15' : ''}`}>
                <Avatar value={c.avatar} name={c.name} size={28} rounded className="shrink-0" />
                <span className="text-white text-sm font-medium">{c.name}</span>
              </button>
            ))}
            {chars.length === 0 && <p className="text-white/60 text-xs px-4 py-3">暂无角色</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 标签页导航 */}
      <div className="flex items-center gap-1 px-4 pb-2 z-10">
        <TabButton active={tab === 'values'} label="数值系统" icon={Sparkles} onClick={() => setTab('values')} />
        <TabButton active={tab === 'rules'}  label="规则系统" icon={Play}     onClick={() => setTab('rules')} />
        <TabButton active={tab === 'world'}  label="世界状态" icon={Globe}    onClick={() => setTab('world')} />
      </div>

      {/* 内容区 */}
      {!char ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/50 text-sm">请选择角色</p>
        </div>
      ) : tab === 'values' ? (
        <div className="flex-1 overflow-hidden z-10">
          <ValueEditor key={char.id} charId={char.id} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-4 z-10">
          {tab === 'rules' && <EventEditor key={char.id} charId={char.id} />}
          {tab === 'world' && <WorldStateEditor key="world" />}
        </div>
      )}
    </div>
  );
}
