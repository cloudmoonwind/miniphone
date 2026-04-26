import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronDown, Sparkles, Play, Globe, Database } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Avatar from '../../components/Avatar.jsx';
import ValueEditor from './ValueEditor';
import EventEditor from './EventEditor';
import WorldStateEditor from './WorldStateEditor';

const api = (path: string, opts: any = {}) =>
  fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts }).then(r => r.json());

const TabButton = ({ active, label, icon: Icon, onClick }: any) => (
  <button onClick={onClick}
    className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
      active
        ? 'bg-white/40 backdrop-blur-sm border border-white/60 text-slate-700 shadow-sm'
        : 'text-slate-500 hover:text-slate-600 hover:bg-white/20'
    }`}>
    <Icon size={11} />
    {label}
  </button>
);

// 四角星装饰
const Sparkle = ({ style }: { style: React.CSSProperties }) => (
  <span className="absolute pointer-events-none select-none text-white/30 font-thin" style={style}>✦</span>
);

export default function MetaApp({ onBack }: { onBack: () => void }) {
  const [chars,      setChars]      = useState<any[]>([]);
  const [char,       setChar]       = useState<any>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [tab,        setTab]        = useState<'values' | 'rules' | 'world'>('values');

  useEffect(() => {
    api('/characters').then(d => {
      const list = Array.isArray(d) ? d : [];
      setChars(list);
      if (list.length > 0) setChar(list[0]);
    });
  }, []);

  return (
    <div className="flex flex-col h-full relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #dce1f5 0%, #cdd3ee 45%, #bfc6e8 100%)' }}>

      {/* 棱镜光晕 */}
      <div className="absolute -top-6 right-0 w-52 h-36 pointer-events-none"
        style={{
          background: 'linear-gradient(130deg, rgba(255,200,230,0.4) 0%, rgba(190,210,255,0.35) 50%, transparent 100%)',
          filter: 'blur(28px)',
        }} />
      <div className="absolute top-16 left-0 w-32 h-24 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(200,210,255,0.25) 0%, transparent 70%)',
          filter: 'blur(16px)',
        }} />

      {/* 星芒点缀 */}
      <Sparkle style={{ top: '11%', left: '22%', fontSize: 8 }} />
      <Sparkle style={{ top: '5%',  right: '30%', fontSize: 5 }} />
      <Sparkle style={{ top: '24%', right: '10%', fontSize: 6 }} />

      {/* 顶栏 */}
      <div className="flex items-center px-3 pt-3 pb-2 shrink-0 z-10">
        <button onClick={onBack}
          className="p-1.5 hover:bg-white/25 rounded-full transition-colors">
          <ChevronLeft size={18} className="text-slate-600" />
        </button>
        <Database size={13} className="text-slate-400 ml-1.5" />
        <span className="text-slate-700 font-semibold text-sm ml-1.5 tracking-wide">元系统</span>
        <div className="flex-1" />
        <button onClick={() => setShowPicker(p => !p)}
          className="flex items-center gap-1.5 bg-white/30 backdrop-blur-sm border border-white/50 hover:bg-white/45 px-3 py-1.5 rounded-full transition-colors">
          <span className="text-slate-700 text-xs font-medium">{char?.name || '选择角色'}</span>
          <ChevronDown size={11} className="text-slate-500" />
        </button>
      </div>

      {/* 角色下拉 */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[3.2rem] right-3 z-30 bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl overflow-hidden min-w-[128px]">
            {chars.map(c => (
              <button key={c.id} onClick={() => { setChar(c); setShowPicker(false); }}
                className={`w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/30 transition-colors text-left ${char?.id === c.id ? 'bg-white/20' : ''}`}>
                <Avatar value={c.avatar} name={c.name} size={22} rounded className="shrink-0" />
                <span className="text-slate-700 text-xs font-medium">{c.name}</span>
              </button>
            ))}
            {chars.length === 0 && <p className="text-slate-400 text-xs px-4 py-3">暂无角色</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 标签栏 */}
      <div className="flex items-center gap-1 px-3 pb-2 z-10">
        <TabButton active={tab === 'values'} label="变量"   icon={Sparkles} onClick={() => setTab('values')} />
        <TabButton active={tab === 'rules'}  label="规则事件" icon={Play}   onClick={() => setTab('rules')} />
        <TabButton active={tab === 'world'}  label="世界状态" icon={Globe}  onClick={() => setTab('world')} />
      </div>

      {/* 内容区 */}
      {!char ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 text-sm">请选择角色</p>
        </div>
      ) : tab === 'values' ? (
        <div className="flex-1 overflow-hidden z-10">
          <ValueEditor key={char.id} charId={char.id} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 pb-4 z-10">
          {tab === 'rules' && <EventEditor key={char.id} charId={char.id} />}
          {tab === 'world' && <WorldStateEditor key="world" />}
        </div>
      )}
    </div>
  );
}
