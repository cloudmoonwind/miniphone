import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronDown, Pencil, Settings, X, Check, Plus, Package, Tag, Eraser, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar.jsx';
import { api } from '../services/api.js';

// --- 组件：地图 App ---
const MAP_TILE_PX = 20;
const MAP_COLS = 18;
const MAP_ROWS = 18;

const TILE_DEFS = {
  grass:    { label: '草地',  bg: '#B8CDB8', bd: '#A8BDAB' },
  path:     { label: '道路',  bg: '#C8BFB0', bd: '#B4AB9E' },
  water:    { label: '水面',  bg: '#9EB5C2', bd: '#8CA5B2' },
  building: { label: '建筑',  bg: '#D4CBBA', bd: '#C0B8A8' },
  tree:     { label: '树木',  bg: '#8BAD8B', bd: '#7A9C7A' },
  sand:     { label: '沙地',  bg: '#D4C9A8', bd: '#C4B998' },
  flower:   { label: '花丛',  bg: '#C8ADB8', bd: '#B89DAA' },
};

const MAP_TOOLS = [
  { id: 'brush',  Icon: Pencil, label: '画笔' },
  { id: 'eraser', Icon: Eraser, label: '橡皮' },
  { id: 'fill',   Icon: Package, label: '填充' },
  { id: 'label',  Icon: Tag,    label: '标注' },
];

const genMapTiles = (template) => {
  const tiles = Array(MAP_ROWS).fill(null).map(() => Array(MAP_COLS).fill('grass'));
  if (template === 'village') {
    for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) {
      if (r === 9 || c === 9) tiles[r][c] = 'path';
      else if (r > 14) tiles[r][c] = r > 15 ? 'water' : 'sand';
      else if ((c < 3 || c > 14) && r < 9) tiles[r][c] = 'tree';
      else if ((r >= 3 && r <= 7 && c >= 3 && c <= 7) || (r >= 10 && r <= 14 && c >= 11 && c <= 15)) tiles[r][c] = 'building';
    }
  } else if (template === 'city') {
    for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++)
      tiles[r][c] = (r % 5 === 0 || c % 5 === 0) ? 'path' : 'building';
  } else if (template === 'nature') {
    for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) {
      if (r > 13) tiles[r][c] = 'water';
      else if (c < 3 || c > 14) tiles[r][c] = 'tree';
      else if (r > 10) tiles[r][c] = 'sand';
      else if (r < 3) tiles[r][c] = 'flower';
    }
  }
  return tiles;
};

const MapApp = ({ onBack }) => {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMapId, setActiveMapId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState('brush');
  const [tilePick, setTilePick] = useState('grass');
  const [tileModal, setTileModal] = useState(null);
  const [tileEditModal, setTileEditModal] = useState(null);
  const [editTileForm, setEditTileForm] = useState({ label: '', desc: '', passable: true });
  const [mapSwitchOpen, setMapSwitchOpen] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [mapSettingsOpen, setMapSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 8, y: 8 });
  const [savedMsg, setSavedMsg] = useState(false);
  const dragRef = useRef(null);
  const mapContainerRef = useRef(null);

  const [chars, setChars] = useState([]);

  const activeMapIdResolved = activeMapId || maps[0]?.id;
  const activeMap = useMemo(
    () => maps.find(m => m.id === activeMapIdResolved) || maps[0] || null,
    [maps, activeMapIdResolved]
  );

  // 初始化：从后端加载地图和角色
  useEffect(() => {
    Promise.all([api.get('/api/maps'), api.get('/api/characters')])
      .then(async ([mapsData, charsData]) => {
        setChars(charsData);
        if (mapsData.length === 0) {
          // 首次使用，自动创建默认地图
          const m = await api.post('/api/maps', {
            name: '主世界', tiles: genMapTiles('village'), charPositions: {}, labels: {},
          });
          setMaps([{ ...m, tileLabels: m.labels || {} }]);
        } else {
          setMaps(mapsData.map(m => ({ ...m, tileLabels: m.labels || {} })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const mutateTiles = useCallback((fn) => {
    setMaps(prev => prev.map(m => m.id !== activeMapIdResolved ? m : { ...m, tiles: fn(m.tiles) }));
  }, [activeMapIdResolved]);

  const paintTile = useCallback((row, col, type) => {
    mutateTiles(t => { const n = t.map(r => [...r]); n[row][col] = type; return n; });
  }, [mutateTiles]);

  const handleTileViewClick = (r, c) => setTileModal({ r, c });

  const handleTileEditMouseDown = (r, c) => {
    if (tool === 'brush')  { setIsPainting(true); paintTile(r, c, tilePick); }
    else if (tool === 'eraser') { setIsPainting(true); paintTile(r, c, 'grass'); }
    else if (tool === 'fill') {
      const target = activeMap?.tiles[r]?.[c];
      if (!target || target === tilePick) return;
      mutateTiles(t => {
        const n = t.map(row => [...row]);
        const stack = [[r, c]];
        while (stack.length) {
          const [cr, cc] = stack.pop();
          if (cr < 0 || cr >= MAP_ROWS || cc < 0 || cc >= MAP_COLS || n[cr][cc] !== target) continue;
          n[cr][cc] = tilePick;
          stack.push([cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1]);
        }
        return n;
      });
    } else if (tool === 'label') {
      const ex = activeMap?.tileLabels?.[`${r},${c}`] || {};
      setEditTileForm({ label: ex.label || '', desc: ex.desc || '', passable: ex.passable !== false });
      setTileEditModal({ r, c });
    }
  };

  const handleTileEditEnter = (r, c) => {
    if (!isPainting) return;
    if (tool === 'brush') paintTile(r, c, tilePick);
    else if (tool === 'eraser') paintTile(r, c, 'grass');
  };

  // 滚轮缩放（非被动监听，需要 useEffect 绑定）
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom(z => Math.min(2.5, Math.max(0.5, +(z + (e.deltaY < 0 ? 0.15 : -0.15)).toFixed(2))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onMapDragStart = (e) => {
    if (editMode) return;
    dragRef.current = { startX: e.clientX - pan.x, startY: e.clientY - pan.y };
  };
  const onMapDragMove = (e) => {
    if (!dragRef.current) return;
    setPan({ x: e.clientX - dragRef.current.startX, y: e.clientY - dragRef.current.startY });
  };
  const onMapDragEnd = () => { dragRef.current = null; };

  const focusOnChar = (charId) => {
    const pos = activeMap?.charPositions?.[charId];
    if (!pos || !mapContainerRef.current) return;
    const { clientWidth: cW, clientHeight: cH } = mapContainerRef.current;
    const tpx = MAP_TILE_PX * zoom;
    setPan({ x: -(pos.c * tpx - cW / 2 + tpx / 2), y: -(pos.r * tpx - cH / 2 + tpx / 2) });
  };

  const saveTileLabel = () => {
    if (!tileEditModal) return;
    const key = `${tileEditModal.r},${tileEditModal.c}`;
    setMaps(prev => prev.map(m =>
      m.id !== activeMapIdResolved ? m : { ...m, tileLabels: { ...(m.tileLabels || {}), [key]: editTileForm } }
    ));
    setTileEditModal(null);
  };

  const createNewMap = async (name, template = null) => {
    try {
      const m = await api.post('/api/maps', {
        name: name || '新地图', tiles: genMapTiles(template), charPositions: {}, labels: {},
      });
      setMaps(prev => [...prev, { ...m, tileLabels: m.labels || {} }]);
      setActiveMapId(m.id);
    } catch (err) { console.error('创建地图失败:', err); }
    setMapSwitchOpen(false);
    setTemplateModal(false);
  };

  const saveMap = async () => {
    const map = maps.find(m => m.id === activeMapIdResolved);
    if (!map) return;
    try {
      await api.put(`/api/maps/${map.id}`, {
        name: map.name, tiles: map.tiles,
        charPositions: map.charPositions || {},
        labels: map.tileLabels || {},
      });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 1500);
      setEditMode(false);
    } catch (err) { console.error('保存地图失败:', err); }
  };

  const deleteActiveMap = async () => {
    try {
      await api.delete(`/api/maps/${activeMapIdResolved}`);
      const remaining = maps.filter(m => m.id !== activeMapIdResolved);
      if (!remaining.length) {
        const m = await api.post('/api/maps', {
          name: '主世界', tiles: genMapTiles('village'), charPositions: {}, labels: {},
        });
        setMaps([{ ...m, tileLabels: m.labels || {} }]);
        setActiveMapId(m.id);
      } else {
        setMaps(remaining);
        setActiveMapId(remaining[0].id);
      }
    } catch (err) { console.error('删除地图失败:', err); }
    setConfirmDelete(false);
    setMapSettingsOpen(false);
  };

  const charsByTile = useMemo(() => {
    const res = {};
    Object.entries(activeMap?.charPositions || {}).forEach(([cid, pos]) => {
      const k = `${pos.r},${pos.c}`;
      if (!res[k]) res[k] = [];
      res[k].push(cid);
    });
    return res;
  }, [activeMap]);

  const charsOnMap = chars.filter(c => activeMap?.charPositions?.[c.id]);
  const tpx = MAP_TILE_PX * zoom;

  const tileInfoData = tileModal ? {
    type: activeMap?.tiles[tileModal.r]?.[tileModal.c] || 'grass',
    meta: activeMap?.tileLabels?.[`${tileModal.r},${tileModal.c}`],
    chars: (charsByTile[`${tileModal.r},${tileModal.c}`] || []).map(id => chars.find(c => c.id === id)).filter(Boolean),
  } : null;

  if (!activeMap) return (
    <div className="flex flex-col h-full">
      <div className="h-14 bg-white border-b flex items-center px-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft size={20} className="text-gray-600" /></button>
        <span className="ml-1 font-bold">地图</span>
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">初始化中…</div>
    </div>
  );

  return (
    <div
      className="flex flex-col h-full bg-[#FAFAF8] select-none"
      onMouseUp={() => { setIsPainting(false); onMapDragEnd(); }}
    >
      {/* 顶栏 */}
      <div className="h-14 bg-white border-b flex items-center px-3 shadow-sm shrink-0 gap-1 z-10">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full shrink-0">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <button
          onClick={() => setMapSwitchOpen(true)}
          className="flex-1 flex items-center justify-center gap-1 font-bold text-[#2D3748] hover:text-[#5EAAA8] transition-colors"
        >
          <span>{activeMap.name}</span><ChevronDown size={14} />
        </button>
        {editMode ? (
          <>
            <button onClick={() => setEditMode(false)} className="text-sm text-gray-500 px-2">取消</button>
            <button
              onClick={saveMap}
              className={`text-sm font-semibold px-3 py-1.5 rounded-lg transition-all ${savedMsg ? 'bg-green-500 text-white' : 'bg-[#5EAAA8] text-white'}`}
            >
              {savedMsg ? '✓ 保存' : '保存'}
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditMode(true)} className="p-2 hover:bg-gray-100 rounded-full shrink-0">
              <Pencil size={17} className="text-[#2D3748]" />
            </button>
            <button onClick={() => setMapSettingsOpen(true)} className="p-2 hover:bg-gray-100 rounded-full shrink-0">
              <Settings size={17} className="text-[#2D3748]" />
            </button>
          </>
        )}
      </div>

      {/* 编辑工具栏 */}
      {editMode && (
        <div className="bg-white border-b px-3 py-2 flex items-center gap-2 shrink-0">
          <div className="flex gap-1">
            {MAP_TOOLS.map(({ id, Icon, label }) => (
              <button key={id} onClick={() => setTool(id)} title={label}
                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${tool === id ? 'bg-[#5EAAA8] text-white scale-105 shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              ><Icon size={14} /></button>
            ))}
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex gap-1.5 flex-1 overflow-x-auto">
            {Object.entries(TILE_DEFS).map(([id, { label, bg }]) => (
              <button key={id} onClick={() => setTilePick(id)} title={label}
                style={{ backgroundColor: bg, width: 28, height: 28, flexShrink: 0 }}
                className={`rounded-lg border-2 transition-all ${tilePick === id ? 'border-[#5EAAA8] scale-110 shadow-sm' : 'border-transparent'}`}
              />
            ))}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setZoom(z => Math.min(2.5, +(z + 0.25).toFixed(2)))} className="w-7 h-7 bg-gray-100 rounded-lg text-gray-600 text-sm font-bold hover:bg-gray-200">+</button>
            <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="w-7 h-7 bg-gray-100 rounded-lg text-gray-600 text-sm font-bold hover:bg-gray-200">-</button>
          </div>
        </div>
      )}

      {/* 地图画布 */}
      <div
        ref={mapContainerRef}
        className="flex-1 overflow-hidden relative"
        style={{ cursor: editMode ? 'crosshair' : 'grab' }}
        onMouseDown={onMapDragStart}
        onMouseMove={onMapDragMove}
        onMouseLeave={onMapDragEnd}
      >
        <div style={{ position: 'absolute', transform: `translate(${pan.x}px, ${pan.y}px)`, width: MAP_COLS * tpx, height: MAP_ROWS * tpx }}>
          {activeMap.tiles.flat().map((tileId, idx) => {
            const r = Math.floor(idx / MAP_COLS);
            const c = idx % MAP_COLS;
            const tile = TILE_DEFS[tileId] || TILE_DEFS.grass;
            const tileChars = charsByTile[`${r},${c}`];
            const labelMeta = activeMap.tileLabels?.[`${r},${c}`];
            return (
              <div
                key={idx}
                style={{
                  position: 'absolute', left: c * tpx, top: r * tpx, width: tpx, height: tpx,
                  backgroundColor: tile.bg, boxShadow: `inset -1px -1px 0 ${tile.bd}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', cursor: editMode ? 'crosshair' : 'pointer',
                }}
                onClick={() => { if (!editMode) handleTileViewClick(r, c); }}
                onMouseDown={(e) => { e.stopPropagation(); if (editMode) handleTileEditMouseDown(r, c); }}
                onMouseEnter={() => { if (editMode) handleTileEditEnter(r, c); }}
              >
                {tileChars?.length > 0 && (() => {
                  const ch = chars.find(x => x.id === tileChars[0]);
                  return ch ? <span style={{ lineHeight: 1, fontSize: tpx * 0.52, fontWeight: 700, color: '#6d28d9' }}>{ch.name?.[0] || '？'}</span> : null;
                })()}
                {!tileChars?.length && labelMeta?.label && zoom >= 1.5 && (
                  <span style={{ fontSize: 7, color: 'rgba(0,0,0,0.38)', fontWeight: 600 }} className="truncate px-0.5 text-center leading-tight">
                    {labelMeta.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 角色栏 */}
      {charsOnMap.length > 0 && !editMode && (
        <div className="bg-white/90 backdrop-blur border-t px-3 py-2 shrink-0">
          <div className="flex gap-2 overflow-x-auto">
            {charsOnMap.map(char => (
              <button key={char.id} onClick={() => focusOnChar(char.id)} className="flex flex-col items-center gap-1 shrink-0 hover:opacity-75 transition-opacity">
                <Avatar value={char.avatar} name={char.name} size={36} rounded className="border-2 border-white shadow-sm" />
                <span className="text-[9px] text-gray-500 max-w-[36px] truncate">{char.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 地块信息弹窗 */}
      <AnimatePresence>
        {tileModal && tileInfoData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 z-20 flex items-end" onClick={() => setTileModal(null)}
          >
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="w-full bg-white rounded-t-3xl shadow-2xl p-5" onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl shadow border border-gray-100" style={{ backgroundColor: TILE_DEFS[tileInfoData.type]?.bg }} />
                <div className="flex-1">
                  <p className="font-bold text-[#2D3748]">{tileInfoData.meta?.label || TILE_DEFS[tileInfoData.type]?.label}</p>
                  <p className="text-xs text-gray-400">坐标 ({tileModal.c}, {tileModal.r})</p>
                </div>
                <button onClick={() => setTileModal(null)} className="text-gray-300 hover:text-gray-500"><X size={18} /></button>
              </div>
              {tileInfoData.meta?.desc && (
                <p className="text-sm text-gray-600 mb-3 bg-gray-50 rounded-xl p-3 leading-relaxed">{tileInfoData.meta.desc}</p>
              )}
              {tileInfoData.chars.length > 0 ? (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 font-semibold mb-2">当前在此</p>
                  {tileInfoData.chars.map(ch => (
                    <div key={ch.id} className="flex items-center gap-2.5 py-1.5">
                      <Avatar value={ch.avatar} name={ch.name} size={32} rounded />
                      <span className="text-sm font-medium text-[#2D3748]">{ch.name}</span>
                      <span className="text-xs text-gray-400 ml-auto">在此一段时间</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-1 mb-2">此处暂无人</p>
              )}
              <div className="flex gap-2">
                <button className="flex-1 py-2.5 text-sm border rounded-xl text-gray-500 hover:bg-gray-50" onClick={() => setTileModal(null)}>关闭</button>
                <button className="flex-1 py-2.5 text-sm bg-[#5EAAA8] text-white rounded-xl font-semibold"
                  onClick={() => {
                    const ex = activeMap?.tileLabels?.[`${tileModal.r},${tileModal.c}`] || {};
                    setEditTileForm({ label: ex.label || '', desc: ex.desc || '', passable: ex.passable !== false });
                    setTileEditModal(tileModal); setTileModal(null); setEditMode(true); setTool('label');
                  }}
                >编辑此地</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 地图切换 */}
      <AnimatePresence>
        {mapSwitchOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 z-30" onClick={() => setMapSwitchOpen(false)}
          >
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="absolute top-14 left-1/2 -translate-x-1/2 w-56 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-[11px] text-gray-400 font-semibold px-4 pt-3 pb-1">我的地图</p>
              {maps.map(m => (
                <button key={m.id} onClick={() => { setActiveMapId(m.id); setMapSwitchOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50 text-sm transition-colors ${m.id === activeMapIdResolved ? 'text-[#5EAAA8] font-semibold' : 'text-[#2D3748]'}`}
                >
                  {m.id === activeMapIdResolved ? <Check size={13} /> : <div className="w-[13px]" />}
                  {m.name}
                </button>
              ))}
              <div className="border-t my-1" />
              <button onClick={() => { setMapSwitchOpen(false); setTemplateModal(true); }}
                className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-[#5EAAA8] text-sm hover:bg-teal-50"
              ><Sparkles size={13} />从模板创建</button>
              <button onClick={() => createNewMap('新地图')}
                className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-gray-500 text-sm hover:bg-gray-50"
              ><Plus size={13} />新建空白地图</button>
              <button onClick={() => { setMapSwitchOpen(false); setMapSettingsOpen(true); }}
                className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-gray-500 text-sm hover:bg-gray-50 border-t"
              ><Settings size={13} />地图设置</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 模板选择 */}
      <AnimatePresence>
        {templateModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 z-30 flex items-center justify-center p-6" onClick={() => setTemplateModal(false)}
          >
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="w-full bg-white rounded-2xl shadow-2xl p-5" onClick={e => e.stopPropagation()}
            >
              <h3 className="font-bold text-[#2D3748] mb-4">从模板创建</h3>
              {[
                ['village', '小村落', '宁静乡村，小屋、道路与湖泊', ['grass','path','building','water','tree']],
                ['city',    '城市',   '规整街道，高密度建筑布局',   ['building','path','building','path','building']],
                ['nature',  '自然探索','山野湖泊，适合冒险场景',    ['tree','grass','flower','sand','water']],
              ].map(([id, name, desc, swatch]) => (
                <button key={id} onClick={() => createNewMap(name, id)}
                  className="w-full text-left mb-2 p-3 border rounded-xl hover:border-[#5EAAA8] hover:bg-teal-50/30 transition-all"
                >
                  <div className="flex gap-1 mb-1.5">
                    {swatch.map((s, i) => <div key={i} className="w-5 h-5 rounded-md" style={{ backgroundColor: TILE_DEFS[s]?.bg }} />)}
                  </div>
                  <p className="font-semibold text-sm text-[#2D3748]">{name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </button>
              ))}
              <button onClick={() => setTemplateModal(false)} className="w-full mt-1 py-2 text-sm text-gray-400">取消</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 地图设置 */}
      <AnimatePresence>
        {mapSettingsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 z-30 flex items-end"
            onClick={() => { setMapSettingsOpen(false); setConfirmDelete(false); }}
          >
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="w-full bg-white rounded-t-2xl p-5 pb-8" onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-[#2D3748]">地图设置</h3>
                <button onClick={() => { setMapSettingsOpen(false); setConfirmDelete(false); }} className="text-gray-300"><X size={18} /></button>
              </div>
              <div className="space-y-4 mb-6">
                {[['自动生成角色位置','自动在地图上放置角色'],['记录移动轨迹','保存角色的移动历史']].map(([title, sub]) => (
                  <div key={title} className="flex items-center justify-between">
                    <div><p className="text-sm font-medium text-[#2D3748]">{title}</p><p className="text-xs text-gray-400 mt-0.5">{sub}</p></div>
                    <div className="w-10 h-5 bg-gray-200 rounded-full opacity-40 cursor-not-allowed" />
                  </div>
                ))}
              </div>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} disabled={maps.length <= 1}
                  className="w-full py-3 text-sm border border-[#E57373] text-[#E57373] rounded-xl hover:bg-red-50 transition-colors disabled:opacity-40"
                >删除此地图</button>
              ) : (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-sm text-red-600 text-center mb-3">确认删除「{activeMap.name}」？</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 text-sm border rounded-xl">取消</button>
                    <button onClick={deleteActiveMap} className="flex-1 py-2 text-sm bg-red-500 text-white rounded-xl">确认删除</button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 地块标注编辑 */}
      <AnimatePresence>
        {tileEditModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 z-40 flex items-end" onClick={() => setTileEditModal(null)}
          >
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="w-full bg-white rounded-t-2xl p-5 pb-8" onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#2D3748]">地块属性</h3>
                <button onClick={() => setTileEditModal(null)} className="text-gray-300"><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold">地点名称</label>
                  <input type="text" value={editTileForm.label}
                    onChange={e => setEditTileForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="为这个地点起个名字..." autoFocus
                    className="w-full mt-1.5 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5EAAA8]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold">描述</label>
                  <textarea value={editTileForm.desc}
                    onChange={e => setEditTileForm(f => ({ ...f, desc: e.target.value }))}
                    placeholder="描述这个地点..." rows={3}
                    className="w-full mt-1.5 px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5EAAA8] resize-none"
                  />
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-sm text-[#2D3748]">可通行</span>
                  <button onClick={() => setEditTileForm(f => ({ ...f, passable: !f.passable }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${editTileForm.passable ? 'bg-[#5EAAA8]' : 'bg-gray-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${editTileForm.passable ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setTileEditModal(null)} className="flex-1 py-2.5 text-sm border rounded-xl text-gray-600">取消</button>
                <button onClick={saveTileLabel} className="flex-1 py-2.5 text-sm bg-[#5EAAA8] text-white rounded-xl font-semibold">保存</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapApp;
