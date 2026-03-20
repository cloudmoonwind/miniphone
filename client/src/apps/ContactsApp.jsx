import React, { useState, useEffect, useRef, useMemo } from 'react';
import { charactersService } from '../services/characters.js';
import { settingsService } from '../services/settings.js';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Trash2, Check, X, Heart, Users, Users2, Tag, MessageSquare, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 组件：联系人 (结缘) App ---
const AVATAR_COLORS = ['bg-purple-200','bg-pink-200','bg-sky-200','bg-green-200','bg-yellow-200','bg-rose-200','bg-indigo-200','bg-teal-200'];
const DEFAULT_FORM = { name:'', avatar:'', tags:[], group:'', core:'', persona:'', sample:'', timezone:'', apiPresetId:null, isFavorite:false, isBlacklisted:false };
const colorFor = (id) => id ? parseInt(id.replace(/\D/g,'').slice(-2)||'0') % AVATAR_COLORS.length : 0;

// CharRow 必须定义在 ContactsApp 外部，否则每次父组件渲染都是新类型，
// React DOM reconciliation 会抛 insertBefore 错误。
const CharRow = ({ char, selMode, selIds, onPressStart, onPressEnd, onCharClick, onStartChat }) => {
  const sel = selIds.has(char.id);
  const col = AVATAR_COLORS[colorFor(char.id)];

  const infoContent = (
    <>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${col}`}>
        {char.avatar || char.name?.[0] || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">{char.name||'未命名'}</span>
          {char.isFavorite && <Heart size={11} className="text-red-400 fill-red-400 shrink-0"/>}
          {char.isBlacklisted && <span className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded shrink-0">拉黑</span>}
        </div>
        {char.core && <p className="text-xs text-gray-400 truncate">{char.core}</p>}
        {char.tags?.length>0 && (
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {char.tags.slice(0,3).map(t=><span key={t} className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-px rounded-full">{t}</span>)}
            {char.tags.length>3 && <span className="text-[10px] text-gray-400">+{char.tags.length-3}</span>}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div
      className={`flex items-center gap-1 px-4 py-3 select-none transition-colors ${sel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
      onMouseDown={() => onPressStart(char.id)} onMouseUp={onPressEnd} onMouseLeave={onPressEnd}
      onTouchStart={() => onPressStart(char.id)} onTouchEnd={onPressEnd}
    >
      {selMode ? (
        <>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mr-2 ${sel?'bg-blue-500 border-blue-500':'border-gray-300'}`}
            onClick={() => onCharClick(char)}>
            {sel && <Check size={11} className="text-white"/>}
          </div>
          <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer active:bg-gray-100 rounded-xl" onClick={() => onCharClick(char)}>
            {infoContent}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => onCharClick(char)}>
            {infoContent}
          </div>
          <button
            className="p-2 rounded-full text-blue-400 hover:bg-blue-50 active:bg-blue-100 shrink-0 transition-colors ml-1"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={() => { onStartChat && onStartChat(char); }}
            title="发消息"
          >
            <MessageSquare size={17}/>
          </button>
        </>
      )}
    </div>
  );
};

const ContactsApp = ({ onBack, onStartChat }) => {
  const [chars, setChars] = useState([]);
  const [apiPresets, setApiPresets] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  // screen: 'list' | 'form' | 'detail'
  const [screen, setScreen] = useState('list');
  const [detailId, setDetailId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false); // true = edit existing, false = new

  // 表单状态（list 级管理，避免嵌套组件的 hook 问题）
  const [form, setForm] = useState(DEFAULT_FORM);
  const [tagInput, setTagInput] = useState('');

  // 列表过滤/分组
  const [filterFav, setFilterFav] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  // 多选模式
  const [selMode, setSelMode] = useState(false);
  const [selIds, setSelIds] = useState(new Set());
  const [tagModal, setTagModal] = useState(false);
  const [tagModalInput, setTagModalInput] = useState('');

  useEffect(() => {
    Promise.all([
      charactersService.list(),
      settingsService.listPresets(),
    ]).then(([charList, presetList]) => {
      setChars(charList);
      setApiPresets(presetList);
    }).catch(err => {
      setLoadError(`加载失败：${err.message}（请确认后端服务已启动）`);
    });
  }, []);

  const longPressTimer = useRef(null);
  const longPressed = useRef(false);
  const allTags = useMemo(() => [...new Set(chars.flatMap(c => c.tags||[]))], [chars]);
  const allGroups = useMemo(() => [...new Set(chars.map(c => c.group).filter(Boolean))], [chars]);

  const detailChar = chars.find(c => c.id === detailId);

  // ---- 导航 ----
  const openCreate = () => { setSaveError(''); setForm(DEFAULT_FORM); setTagInput(''); setIsEditMode(false); setScreen('form'); };
  const openEdit = (char) => {
    setSaveError('');
    setForm({
      ...DEFAULT_FORM, ...char,
      name: char.name ?? '',
      avatar: char.avatar ?? '',
      group: char.group ?? '',
      core: char.core ?? '',
      persona: char.persona ?? '',
      sample: char.sample ?? '',
      tags: Array.isArray(char.tags) ? char.tags : [],
      isFavorite: !!char.isFavorite,
      isBlacklisted: !!char.isBlacklisted,
    });
    setTagInput('');
    setIsEditMode(true);
    setScreen('form');
  };
  const openDetail = (char) => { setDetailId(char.id); setScreen('detail'); };
  const goList = () => { setScreen('list'); setDetailId(null); };

  // ---- 表单保存 ----
  const saveForm = async () => {
    setSaveError('');
    setSaving(true);
    const entry = { ...form, name: form.name.trim() || 'char', tags: form.tags };
    try {
      if (isEditMode) {
        const updated = await charactersService.update(entry.id, entry);
        setChars(cs => cs.map(c => c.id === entry.id ? updated : c));
      } else {
        const created = await charactersService.create(entry);
        setChars(cs => [...cs, created]);
      }
      goList();
    } catch (err) {
      setSaveError(`保存失败：${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addFormTag = () => {
    const t = tagInput.trim();
    if (t && !(form.tags||[]).includes(t)) setForm(f => ({...f, tags:[...(f.tags||[]),t]}));
    setTagInput('');
  };

  // ---- 长按 ----
  const onPressStart = (id) => {
    longPressed.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setSelMode(true);
      setSelIds(new Set([id]));
    }, 500);
  };
  const onPressEnd = () => clearTimeout(longPressTimer.current);
  const onCharClick = (char) => {
    if (longPressed.current) return;
    if (selMode) {
      setSelIds(prev => { const n=new Set(prev); n.has(char.id)?n.delete(char.id):n.add(char.id); if(!n.size) setSelMode(false); return n; });
    } else {
      openDetail(char);
    }
  };
  const exitSel = () => { setSelMode(false); setSelIds(new Set()); };

  // ---- 多选操作 ----
  const deleteSelected = async () => {
    await Promise.all([...selIds].map(id => charactersService.delete(id)));
    setChars(cs => cs.filter(c => !selIds.has(c.id)));
    exitSel();
  };
  const applyTag = async (tag, remove=false) => {
    const toUpdate = chars.filter(c => selIds.has(c.id));
    const updated = await Promise.all(toUpdate.map(c => {
      const tags = c.tags || [];
      const newTags = remove ? tags.filter(t => t !== tag) : (tags.includes(tag) ? tags : [...tags, tag]);
      return charactersService.update(c.id, { tags: newTags });
    }));
    setChars(cs => cs.map(c => updated.find(u => u.id === c.id) || c));
  };

  // ---- 可见列表 ----
  const visible = chars.filter(c => !filterFav || c.isFavorite);
  const grouped = useMemo(() => visible.reduce((acc,c)=>{ const g=c.group||'未分组'; (acc[g]||(acc[g]=[])).push(c); return acc; }, {}), [visible]);

  // ===== 表单页 =====
  // React.Fragment key 用于在 screen 切换时强制卸载/挂载，避免不兼容 DOM 树 reconcile 导致 insertBefore 错误
  if (screen === 'form') return (
    <React.Fragment key="form">
    <div className="flex flex-col h-full bg-white relative">
      <div className="h-14 border-b flex items-center px-3 shrink-0 gap-2">
        <button onClick={goList} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={20} className="text-gray-600"/></button>
        <span className="font-bold flex-1">{isEditMode?'编辑角色':'新建角色'}</span>
        <button onClick={saveForm} disabled={saving} className="px-4 py-1.5 bg-blue-500 text-white text-sm rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50">{saving ? '保存中…' : '保存'}</button>
      </div>
      {saveError && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-500 shrink-0">{saveError}</div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 导入 */}
        <button className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-400 flex items-center justify-center gap-2 transition-colors">
          <Plus size={15}/> 导入角色卡（PNG / JSON）
        </button>
        {/* 头像 + 姓名 */}
        <div className="flex gap-3 items-start">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border-2 border-dashed border-gray-200 ${AVATAR_COLORS[colorFor(form.id)]}`}>
              {form.avatar || form.name?.[0] || '?'}
            </div>
            <span className="text-[10px] text-gray-400">头像预览</span>
          </div>
          <div className="flex-1 space-y-2">
            <input value={form.avatar ?? ''} onChange={e=>setForm(f=>({...f,avatar:e.target.value}))} placeholder="头像（emoji 或字母）" className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"/>
            <input value={form.name ?? ''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="角色名（默认 char）" className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"/>
          </div>
        </div>
        {/* 标签 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">标签</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5 min-h-[1.5rem]">
            {(form.tags||[]).map(t=>(
              <span key={t} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                {t}<button onClick={()=>setForm(f=>({...f,tags:(f.tags||[]).filter(x=>x!==t)}))}>  <X size={9}/></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addFormTag())} placeholder="添加标签…" className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"/>
            <button onClick={addFormTag} className="px-3 py-1.5 bg-blue-100 text-blue-600 rounded-lg text-xs font-medium">添加</button>
          </div>
          {allTags.filter(t=>!(form.tags||[]).includes(t)).length>0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {allTags.filter(t=>!(form.tags||[]).includes(t)).map(t=>(
                <button key={t} onClick={()=>setForm(f=>({...f,tags:[...(f.tags||[]),t]}))} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full hover:bg-gray-200">+{t}</button>
              ))}
            </div>
          )}
        </div>
        {/* 分组 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">分组</label>
          <input value={form.group ?? ''} onChange={e=>setForm(f=>({...f,group:e.target.value}))} placeholder="输入分组名…" list="grp-list" className="w-full mt-1.5 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"/>
          <datalist id="grp-list">{allGroups.map(g=><option key={g} value={g}/>)}</datalist>
        </div>
        {/* 角色核心 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">角色核心 <span className="font-normal text-gray-400">（性格关键词）</span></label>
          <input value={form.core ?? ''} onChange={e=>setForm(f=>({...f,core:e.target.value}))} placeholder="例：温柔、善解人意、有些腹黑" className="w-full mt-1.5 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"/>
        </div>
        {/* 角色设定 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">角色设定</label>
          <textarea value={form.persona ?? ''} onChange={e=>setForm(f=>({...f,persona:e.target.value}))} placeholder="详细的角色描述、背景、性格…" rows={5} className="w-full mt-1.5 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none leading-relaxed"/>
        </div>
        {/* 角色语料 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">角色语料 <span className="font-normal text-gray-400">（对话示例，用于定义说话风格）</span></label>
          <textarea value={form.sample ?? ''} onChange={e=>setForm(f=>({...f,sample:e.target.value}))} placeholder="写几段示例对话或典型台词，帮助 AI 学习角色口吻…" rows={4} className="w-full mt-1.5 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none leading-relaxed"/>
        </div>
        {/* 时区 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">角色时区 <span className="font-normal text-gray-400">（用于时间戳格式化，如 +08:00）</span></label>
          <input value={form.timezone ?? ''} onChange={e=>setForm(f=>({...f,timezone:e.target.value}))} placeholder="+08:00（留空默认 UTC+8）" className="w-full mt-1.5 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"/>
        </div>
        {/* API 配置 */}
        <div>
          <label className="text-xs font-semibold text-gray-500">API 配置 <span className="font-normal text-gray-400">（空 = 使用系统默认）</span></label>
          <select value={form.apiPresetId||''} onChange={e=>setForm(f=>({...f,apiPresetId:e.target.value||null}))} className="w-full mt-1.5 px-3 py-2 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-300">
            <option value="">使用系统默认 API</option>
            {apiPresets.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {/* 世界书（占位） */}
        <div>
          <label className="text-xs font-semibold text-gray-500">绑定世界书</label>
          <div className="mt-1.5 px-3 py-2.5 border rounded-xl text-sm text-gray-400 bg-gray-50">暂无绑定（功能开发中）</div>
        </div>
        {/* 其他 */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!form.isFavorite} onChange={e=>setForm(f=>({...f,isFavorite:e.target.checked}))} className="rounded"/>
            <Heart size={13} className={form.isFavorite?'text-red-400 fill-red-400':'text-gray-400'}/> 收藏
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!form.isBlacklisted} onChange={e=>setForm(f=>({...f,isBlacklisted:e.target.checked}))} className="rounded"/>
            <span className="text-gray-500">拉黑</span>
          </label>
        </div>
      </div>
    </div>
    </React.Fragment>
  );

  // ===== 详情页 =====
  if (screen === 'detail' && detailChar) {
    const col = AVATAR_COLORS[colorFor(detailChar.id)];
    const toggleFav = async () => {
      const updated = await charactersService.update(detailChar.id, { isFavorite: !detailChar.isFavorite });
      setChars(cs => cs.map(c => c.id === updated.id ? updated : c));
    };
    const cur = chars.find(c=>c.id===detailChar.id)||detailChar;
    return (
      <React.Fragment key="detail">
      <div className="flex flex-col h-full bg-white">
        <div className="h-14 border-b flex items-center px-3 shrink-0 gap-1">
          <button onClick={goList} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={20} className="text-gray-600"/></button>
          <span className="font-bold flex-1">角色档案</span>
          <button onClick={()=>openEdit(cur)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><Pencil size={17}/></button>
          <button onClick={toggleFav} className="p-2 rounded-full">
            <Heart size={17} className={cur.isFavorite?'text-red-400 fill-red-400':'text-gray-400'}/>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center py-7 px-4 border-b">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-bold ${col}`}>
              {cur.avatar||cur.name?.[0]||'?'}
            </div>
            <h2 className="mt-3 text-xl font-bold">{cur.name}</h2>
            {cur.core && <p className="mt-1 text-sm text-gray-500 text-center">{cur.core}</p>}
            {cur.tags?.length>0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                {cur.tags.map(t=><span key={t} className="text-xs bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full">{t}</span>)}
              </div>
            )}
          </div>
          <div className="p-4 space-y-4">
            {cur.group&&<div className="flex items-center gap-2 text-sm"><span className="text-gray-400 w-14 shrink-0">分组</span><span className="text-gray-700">{cur.group}</span></div>}
            {cur.persona&&(
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5">角色设定</p>
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{cur.persona}</div>
              </div>
            )}
            {cur.sample&&(
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1.5">角色语料</p>
                <div className="bg-fuchsia-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{cur.sample}</div>
              </div>
            )}
            {cur.apiPresetId&&<div className="flex items-center gap-2 text-sm"><span className="text-gray-400 w-14 shrink-0">API</span><span className="text-gray-700">{apiPresets.find(p=>p.id===cur.apiPresetId)?.name||'自定义'}</span></div>}
            {cur.isBlacklisted&&<div className="bg-red-50 text-red-400 text-xs px-3 py-2 rounded-xl">此角色已被拉黑</div>}
          </div>
        </div>
        <div className="p-4 border-t">
          <button
            onClick={()=>onStartChat&&onStartChat(cur)}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 flex items-center justify-center gap-2"
          >
            <MessageSquare size={15}/> 发消息
          </button>
        </div>
      </div>
      </React.Fragment>
    );
  }

  // ===== 列表页 =====
  return (
    <React.Fragment key="list">
    <div className="flex flex-col h-full bg-gray-50 relative">
      <div className="h-14 bg-white border-b flex items-center px-3 shadow-sm shrink-0 gap-1">
        {selMode ? (
          <>
            <button onClick={exitSel} className="p-2 hover:bg-gray-100 rounded-full"><X size={18} className="text-gray-600"/></button>
            <span className="font-bold flex-1">已选 {selIds.size} 个</span>
          </>
        ) : (
          <>
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={20} className="text-gray-600"/></button>
            <span className="font-bold flex-1">结缘</span>
            <button onClick={openCreate} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"><Plus size={20}/></button>
            <button onClick={()=>setFilterFav(f=>!f)} className="p-2 rounded-full">
              <Heart size={17} className={filterFav?'text-red-400 fill-red-400':'text-gray-400'}/>
            </button>
            <button onClick={()=>setGroupMode(g=>!g)} className={`p-2 rounded-full ${groupMode?'bg-blue-100 text-blue-500':'text-gray-400 hover:bg-gray-100'}`}>
              <Users2 size={17}/>
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadError && (
          <div className="mx-4 mt-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-500 leading-relaxed">{loadError}</div>
        )}
        {!loadError && visible.length===0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <Users size={38} className="opacity-25"/>
            <p className="text-sm">{filterFav?'暂无收藏角色':'还没有角色，点击 + 新建'}</p>
          </div>
        ) : groupMode ? (
          Object.entries(grouped).map(([gname, gchars])=>(
            <div key={gname}>
              <button
                onClick={()=>setOpenGroups(prev=>({...prev,[gname]:!prev[gname]}))}
                className="w-full flex items-center px-4 py-2 gap-2"
              >
                <div className="flex-1 h-px bg-gray-200"/>
                <span className="text-xs text-gray-500 font-semibold px-2">{gname} ({gchars.length})</span>
                <div className="flex-1 h-px bg-gray-200"/>
                <span className="text-gray-400">{openGroups[gname]?<ChevronDown size={13}/>:<ChevronRight size={13}/>}</span>
              </button>
              {openGroups[gname] && gchars.map(c=><CharRow key={c.id} char={c} selMode={selMode} selIds={selIds} onPressStart={onPressStart} onPressEnd={onPressEnd} onCharClick={onCharClick} onStartChat={onStartChat}/>)}
            </div>
          ))
        ) : (
          visible.map(c=><CharRow key={c.id} char={c} selMode={selMode} selIds={selIds} onPressStart={onPressStart} onPressEnd={onPressEnd} onCharClick={onCharClick} onStartChat={onStartChat}/>)
        )}
      </div>

      {/* 多选底栏 */}
      {selMode && (
        <div className="bg-white border-t px-4 py-3 flex justify-between items-center shrink-0">
          <button
            onClick={()=>{ if(window.confirm(`确认删除 ${selIds.size} 个角色？`)) deleteSelected(); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-semibold"
          >
            <Trash2 size={14}/> 删除
          </button>
          <button onClick={()=>{setTagModalInput('');setTagModal(true);}} disabled={!selIds.size} className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-500 rounded-xl text-sm font-semibold disabled:opacity-40">
            <Tag size={14}/> 管理标签
          </button>
        </div>
      )}

      {/* 标签管理弹窗 */}
      <AnimatePresence>
        {tagModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-black/40 flex items-end z-50" onClick={()=>setTagModal(false)}>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:400,damping:40}} className="w-full bg-white rounded-t-2xl p-5 max-h-[65%] flex flex-col shadow-2xl" onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">管理标签（{selIds.size} 个角色）</h3>
                <button onClick={()=>setTagModal(false)}><X size={18} className="text-gray-400"/></button>
              </div>
              <div className="flex gap-2 mb-4">
                <input value={tagModalInput} onChange={e=>setTagModalInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(applyTag(tagModalInput.trim()),setTagModalInput(''))} placeholder="新标签名…" className="flex-1 px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                <button onClick={()=>{applyTag(tagModalInput.trim());setTagModalInput('');}} className="px-3 py-2 bg-blue-500 text-white rounded-xl text-xs font-semibold">批量添加</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <p className="text-xs text-gray-400 mb-2">点击已有标签：全部含 → 批量删除，部分/未含 → 批量添加</p>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag=>{
                    const selChars = chars.filter(c=>selIds.has(c.id));
                    const hasAll = selChars.every(c=>c.tags?.includes(tag));
                    const hasSome = selChars.some(c=>c.tags?.includes(tag));
                    return (
                      <button key={tag} onClick={()=>hasAll?applyTag(tag,true):applyTag(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${hasAll?'bg-blue-500 text-white border-blue-500':hasSome?'bg-blue-100 text-blue-600 border-blue-200':'bg-white text-gray-600 border-gray-200'}`}>
                        {tag}{hasAll?' ✓（点击删除）':hasSome?' (部分含)':''}
                      </button>
                    );
                  })}
                  {allTags.length===0&&<p className="text-sm text-gray-400">暂无已有标签</p>}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </React.Fragment>
  );
};

export default ContactsApp;
