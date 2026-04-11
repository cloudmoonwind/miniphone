import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, Database, Trash2, Archive, Download, RotateCcw,
  AlertTriangle, X, HardDrive, Zap, Clock, Snowflake, RefreshCw,
  CheckCircle, Info, ChevronDown, ChevronRight, Settings2, Plus, User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from '../components/Avatar.jsx';
import { api } from '../services/api.js';

// ─── 常量 ───────────────────────────────────────────────
const MAX_STORAGE = 5 * 1024 * 1024; // 5MB 浏览器 localStorage 估算上限
const SETTINGS_KEY = 'ics_memory_settings';
const TRASH_KEY = 'ics_trash';
const ARCHIVE_LOG_KEY = 'ics_archive_log';
const TRASH_TTL = 7 * 86400e3; // 7天

// ─── 工具函数 ────────────────────────────────────────────
const fmt = (b) => {
  if (!b || b < 1024) return `${b || 0}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1048576).toFixed(2)}MB`;
};

const CATS = {
  chat:      { label: '聊天记录', color: '#60a5fa' },
  dreams:    { label: '梦境',     color: '#a78bfa' },
  maps:      { label: '地图',     color: '#34d399' },
  chars:     { label: '角色',     color: '#f59e0b' },
  wallpaper: { label: '壁纸',     color: '#fb923c' },
  settings:  { label: '设置',     color: '#6b7280' },
  trash:     { label: '回收站',   color: '#9ca3af' },
};

const classifyKey = (key) => {
  if (key.startsWith('ics_msgs_'))  return 'chat';
  if (key === 'ics_dreams')         return 'dreams';
  if (key === 'ics_maps' || key === 'ics_active_map') return 'maps';
  if (key === 'ics_characters')     return 'chars';
  if (key === 'ics_wallpaper')      return 'wallpaper';
  if (key === 'ics_trash' || key === ARCHIVE_LOG_KEY) return 'trash';
  if (key.startsWith('ics_api_') || key === 'ics_active_preset_id' || key === SETTINGS_KEY) return 'settings';
  return null; // ignore unknown keys
};

const getStorageInfo = () => {
  const cats = Object.fromEntries(
    Object.entries(CATS).map(([k, v]) => [k, { ...v, bytes: 0, keys: [] }])
  );
  let total = 0;
  for (const key in localStorage) {
    if (!Object.prototype.hasOwnProperty.call(localStorage, key)) continue;
    const val = localStorage.getItem(key) || '';
    const bytes = (key.length + val.length) * 2;
    const cat = classifyKey(key);
    if (cat) { cats[cat].bytes += bytes; cats[cat].keys.push(key); }
    total += bytes;
  }
  // Item counts
  const safeJSON = (k, fb = []) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };
  const chatCount = cats.chat.keys.reduce((s, k) => s + safeJSON(k).length, 0);
  const dreamCount = safeJSON('ics_dreams').length;
  const mapCount = safeJSON('ics_maps').length;
  const charCount = safeJSON('ics_characters').length;
  const trashCount = safeJSON(TRASH_KEY).length;
  const usedPct = Math.min(100, Math.round((total / MAX_STORAGE) * 100));
  return { total, usedPct, cats, counts: { chat: chatCount, dreams: dreamCount, maps: mapCount, chars: charCount, trash: trashCount } };
};

const defaultSettings = {
  retentionMode: 'balanced',
  retentionDays: { chat: 90, dreams: 365, maps: 365 },
  keepImportant: true,
  keepMinCount: 100,
  keepStarred: true,
  autoCleanEnabled: false,
  autoCleanHour: 3,
  warnAt: 80, orangeAt: 90, criticalAt: 95,
};

// ─── 子组件 ──────────────────────────────────────────────
const Card = ({ title, icon, children }) => (
  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
    <div className="px-4 py-3 border-b flex items-center gap-2 text-gray-500">
      {icon}
      <span className="font-semibold text-sm text-gray-700">{title}</span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)}
    className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${value ? 'bg-indigo-500' : 'bg-gray-200'}`}>
    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

// ─── Tab 1：自动管理 ─────────────────────────────────────
const AutoTab = ({ settings, save }) => {
  const [advOpen, setAdvOpen] = useState(false);
  const MODES = [
    { key: 'aggressive',   label: '激进', desc: '30天/每天' },
    { key: 'balanced',     label: '平衡', desc: '90天/每周' },
    { key: 'conservative', label: '保守', desc: '180天/手动' },
  ];
  const modeDesc = {
    aggressive:   '超过30天的聊天进入压缩层，每天凌晨执行',
    balanced:     '超过90天的聊天进入摘要存储，每周执行（推荐）',
    conservative: '保留180天完整记录，仅在存储告警时清理',
  };
  return (
    <div className="p-3 space-y-3 pb-6">
      {/* 激进度 */}
      <Card title="清理策略" icon={<Zap size={14} />}>
        <div className="flex gap-2 mb-3">
          {MODES.map(m => (
            <button key={m.key} onClick={() => save({ retentionMode: m.key })}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${settings.retentionMode === m.key ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-transparent bg-gray-100 text-gray-500'}`}>
              <div>{m.label}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{m.desc}</div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">{modeDesc[settings.retentionMode]}</p>
      </Card>

      {/* 分类保留天数 */}
      <Card title="分类保留策略" icon={<Clock size={14} />}>
        {[
          { key: 'chat',   label: '聊天记录', max: 365 },
          { key: 'dreams', label: '梦境',     max: 999 },
          { key: 'maps',   label: '地图',     max: 999 },
        ].map(({ key, label, max }) => (
          <div key={key} className="mb-4 last:mb-0">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-gray-600">{label}</span>
              <span className="text-xs font-semibold text-indigo-600">
                {settings.retentionDays[key] >= 999 ? '永久保留' : `${settings.retentionDays[key]}天`}
              </span>
            </div>
            <input type="range" min={7} max={max} value={settings.retentionDays[key]}
              onChange={e => save({ retentionDays: { ...settings.retentionDays, [key]: +e.target.value } })}
              className="w-full accent-indigo-500" />
          </div>
        ))}
        <label className="flex items-center gap-2 text-xs text-gray-500 mt-2 pt-2 border-t">
          <input type="checkbox"
            checked={settings.retentionDays.dreams >= 999}
            onChange={e => save({ retentionDays: { ...settings.retentionDays, dreams: e.target.checked ? 999 : 90 } })}
            className="accent-indigo-500" />
          梦境永久保留摘要，详情按上方天数清理
        </label>
      </Card>

      {/* 重要内容保护 */}
      <Card title="重要内容保护" icon={<CheckCircle size={14} />}>
        {[
          { k: 'keepImportant', label: '自动保留重要内容（即使超时限）' },
          { k: 'keepStarred',   label: '用户标星内容永久保留' },
        ].map(({ k, label }) => (
          <label key={k} className="flex items-center gap-3 text-sm text-gray-600 py-2 border-b last:border-0">
            <input type="checkbox" checked={settings[k]} onChange={e => save({ [k]: e.target.checked })}
              className="accent-indigo-500 w-4 h-4 shrink-0" />
            {label}
          </label>
        ))}
        <div className="flex items-center gap-2 pt-2">
          <span className="text-sm text-gray-600">至少保留</span>
          <input type="number" value={settings.keepMinCount} min={10} max={1000}
            onChange={e => save({ keepMinCount: +e.target.value })}
            className="w-16 text-center text-sm border rounded-lg px-1 py-0.5" />
          <span className="text-sm text-gray-600">条最重要记忆</span>
        </div>
      </Card>

      {/* 定时任务 */}
      <Card title="自动定时清理" icon={<Clock size={14} />}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">启用定时清理</p>
            <p className="text-[11px] text-gray-400">每天定时将过期数据移入回收站</p>
          </div>
          <Toggle value={settings.autoCleanEnabled} onChange={v => save({ autoCleanEnabled: v })} />
        </div>
        {settings.autoCleanEnabled && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-gray-500">执行时间：每天</span>
            <input type="number" min={0} max={23} value={settings.autoCleanHour}
              onChange={e => save({ autoCleanHour: +e.target.value })}
              className="w-14 text-center text-sm border rounded-lg px-1 py-0.5" />
            <span className="text-xs text-gray-500">时</span>
          </div>
        )}
        <p className="text-[10px] text-amber-500 mt-2.5 flex items-center gap-1">
          <Info size={10} />需后端定时任务支持，当前为配置预留
        </p>
      </Card>

      {/* 高级：预警阈值 */}
      <button onClick={() => setAdvOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl shadow-sm text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Settings2 size={14} />
          <span className="font-medium text-gray-700">高级 — 存储预警阈值</span>
        </div>
        {advOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {advOpen && (
        <Card title="预警阈值（%）" icon={<AlertTriangle size={14} />}>
          {[
            { k: 'warnAt',     label: '黄色预警',            dot: 'bg-yellow-400' },
            { k: 'orangeAt',   label: '橙色预警，自动轻量清理', dot: 'bg-orange-400' },
            { k: 'criticalAt', label: '强制清理，停止新梦境生成', dot: 'bg-red-500' },
          ].map(({ k, label, dot }) => (
            <div key={k} className="flex items-center gap-3 mb-3 last:mb-0">
              <span className="flex items-center gap-1.5 text-xs text-gray-600 flex-1">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />{label}
              </span>
              <input type="number" min={50} max={99} value={settings[k]}
                onChange={e => save({ [k]: +e.target.value })}
                className="w-14 text-center text-sm border rounded-lg px-1 py-1" />
              <span className="text-xs text-gray-400">%</span>
            </div>
          ))}
        </Card>
      )}

      {/* 四层架构说明 */}
      <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
        <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1">
          <Info size={12} /> 四层数据模型（规划中）
        </p>
        {[
          { icon: <Zap size={11} />,      label: '热数据（7天）',  desc: 'Redis · 当前对话、角色状态', c: 'text-yellow-600' },
          { icon: <Clock size={11} />,    label: '温数据（30天）', desc: 'SQLite · 完整对话、梦境', c: 'text-blue-600' },
          { icon: <Snowflake size={11} />,label: '冷数据（90天）', desc: '向量库 · 摘要+embedding', c: 'text-cyan-600' },
          { icon: <Archive size={11} />,  label: '归档（90天+）',  desc: 'JSON.gz · 压缩文件', c: 'text-gray-400' },
        ].map(({ icon, label, desc, c }) => (
          <div key={label} className="flex items-start gap-2 mb-1.5 last:mb-0">
            <span className={`${c} mt-0.5 shrink-0`}>{icon}</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-[11px] font-semibold ${c}`}>{label}</span>
              <span className="text-[10px] text-gray-400">{desc}</span>
            </div>
          </div>
        ))}
        <p className="text-[10px] text-indigo-400 mt-2.5">当前基于 localStorage，接入后端后自动升级至此架构</p>
      </div>
    </div>
  );
};

// ─── Tab 2：手动清理 ─────────────────────────────────────
const ManualTab = ({ info, onConfirm, showToast }) => {
  const [trash, setTrash]       = useState(() => { try { return JSON.parse(localStorage.getItem(TRASH_KEY) || '[]'); } catch { return []; } });
  const [trashOpen, setTrashOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);

  const syncTrash = (next) => { setTrash(next); localStorage.setItem(TRASH_KEY, JSON.stringify(next)); };

  const addToTrash = (item) => { const next = [...trash, item]; syncTrash(next); };

  const cleanChatDays = useCallback((days) => {
    const cutoff = Date.now() - days * 86400e3;
    let removed = 0;
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('ics_msgs_')) continue;
      try {
        const msgs = JSON.parse(localStorage.getItem(key) || '[]');
        const old  = msgs.filter(m => new Date(m.timestamp).getTime() < cutoff);
        const kept = msgs.filter(m => new Date(m.timestamp).getTime() >= cutoff);
        if (old.length) {
          addToTrash({ id: Date.now() + Math.random(), type: 'chat', key, label: `${key.replace('ics_msgs_', '')} 聊天 (${old.length}条)`, data: old, deletedAt: Date.now() });
          localStorage.setItem(key, JSON.stringify(kept));
          removed += old.length;
        }
      } catch {}
    }
    return removed;
  }, [trash]);

  const runScan = () => {
    setScanning(true);
    setTimeout(() => {
      const safe = [], optional = [];
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith('ics_msgs_')) continue;
        try {
          const msgs = JSON.parse(localStorage.getItem(key) || '[]');
          const charId = key.replace('ics_msgs_', '');
          const old30 = msgs.filter(m => new Date(m.timestamp).getTime() < Date.now() - 30 * 86400e3);
          if (old30.length > 5) safe.push({ key: charId, label: `「${charId}」30天前聊天`, count: old30.length, bytes: JSON.stringify(old30).length * 2 });
        } catch {}
      }
      const wp = localStorage.getItem('ics_wallpaper');
      if (wp) optional.push({ key: 'wallpaper', label: '壁纸图片', count: 1, bytes: wp.length * 2 });
      setScanResult({ safe, optional, ts: Date.now() });
      setScanning(false);
    }, 800);
  };

  const doScanAction = (item) => {
    if (item.key === 'wallpaper') {
      const wp = localStorage.getItem('ics_wallpaper');
      if (wp) { addToTrash({ id: Date.now(), type: 'wallpaper', key: 'ics_wallpaper', label: '壁纸', data: wp, deletedAt: Date.now() }); }
      localStorage.removeItem('ics_wallpaper');
      showToast('壁纸已移入回收站');
    } else {
      const n = cleanChatDays(30);
      showToast(n > 0 ? `已移入回收站：${n}条消息` : '没有可清理的内容');
    }
    setScanResult(null);
  };

  const restore = (item) => {
    try {
      if (item.type === 'chat') {
        const existing = JSON.parse(localStorage.getItem(item.key) || '[]');
        const merged = [...item.data, ...existing].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
        localStorage.setItem(item.key, JSON.stringify(merged));
      } else if (item.type === 'wallpaper') {
        localStorage.setItem(item.key, item.data);
      }
    } catch {}
    syncTrash(trash.filter(t => t.id !== item.id));
    showToast('已恢复');
  };

  const purge = (id) => syncTrash(trash.filter(t => t.id !== id));

  // Auto-expire trash
  useEffect(() => {
    const fresh = trash.filter(t => Date.now() - t.deletedAt < TRASH_TTL);
    if (fresh.length !== trash.length) syncTrash(fresh);
  }, []);

  const hasWallpaper = !!info.cats.wallpaper.bytes;

  return (
    <div className="p-3 space-y-3 pb-6">
      {/* 快捷清理 */}
      <Card title="快捷清理" icon={<Trash2 size={14} />}>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {[30, 60, 90].map(d => (
            <button key={d}
              onClick={() => onConfirm({
                title: `清理 ${d} 天前聊天`,
                body: `将把 ${d} 天前的聊天消息移入回收站，可在7天内恢复。`,
                onOk: () => { const n = cleanChatDays(d); showToast(n > 0 ? `已移入回收站：${n}条` : '没有可清理内容'); },
              })}
              className="py-3 rounded-xl bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors">
              {d}天前
            </button>
          ))}
        </div>
        {hasWallpaper && (
          <button
            onClick={() => onConfirm({
              title: '删除壁纸',
              body: '壁纸将移入回收站，7天内可恢复。',
              onOk: () => {
                const wp = localStorage.getItem('ics_wallpaper');
                if (wp) addToTrash({ id: Date.now(), type: 'wallpaper', key: 'ics_wallpaper', label: '壁纸', data: wp, deletedAt: Date.now() });
                localStorage.removeItem('ics_wallpaper');
                showToast('壁纸已移入回收站');
              },
            })}
            className="w-full py-3 rounded-xl bg-orange-50 text-orange-600 text-xs font-medium hover:bg-orange-100 transition-colors">
            删除壁纸（{fmt(info.cats.wallpaper.bytes)}）
          </button>
        )}
        <p className="text-[10px] text-gray-400 mt-2.5">删除内容先进回收站，7天后自动永久清除</p>
      </Card>

      {/* 智能建议 */}
      <Card title="智能清理建议" icon={<HardDrive size={14} />}>
        {!scanResult ? (
          <button onClick={runScan} disabled={scanning}
            className="w-full py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium disabled:opacity-50">
            {scanning ? '扫描中…' : '开始扫描'}
          </button>
        ) : (
          <div>
            {scanResult.safe.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-green-600 mb-2">✓ 可安全删除</p>
                {scanResult.safe.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-xs text-gray-700">{s.label}</p>
                      <p className="text-[10px] text-gray-400">{s.count}条 · {fmt(s.bytes)}</p>
                    </div>
                    <button onClick={() => doScanAction(s)} className="text-xs text-red-500 px-3 py-1 bg-red-50 rounded-lg">清理</button>
                  </div>
                ))}
              </div>
            )}
            {scanResult.optional.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-amber-600 mb-2">~ 可选删除</p>
                {scanResult.optional.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-xs text-gray-700">{s.label}</p>
                      <p className="text-[10px] text-gray-400">{fmt(s.bytes)}</p>
                    </div>
                    <button onClick={() => doScanAction(s)} className="text-xs text-red-500 px-3 py-1 bg-red-50 rounded-lg">删除</button>
                  </div>
                ))}
              </div>
            )}
            {scanResult.safe.length === 0 && scanResult.optional.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">暂无可清理内容</p>
            )}
            <button onClick={() => setScanResult(null)} className="text-xs text-indigo-400 mt-1">重新扫描</button>
          </div>
        )}
      </Card>

      {/* 回收站 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <button onClick={() => setTrashOpen(o => !o)} className="w-full px-4 py-3 flex items-center gap-2">
          <Trash2 size={14} className="text-gray-400" />
          <span className="font-semibold text-sm text-gray-700 flex-1">回收站</span>
          <span className="text-xs text-gray-400 mr-1">{trash.length}项</span>
          {trashOpen ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
        </button>
        {trashOpen && (
          <div className="px-3 pb-3">
            {trash.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-5">回收站为空</p>
            ) : (
              <div className="space-y-2">
                {trash.map(item => {
                  const daysLeft = Math.max(0, Math.ceil((item.deletedAt + TRASH_TTL - Date.now()) / 86400e3));
                  return (
                    <div key={item.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{item.label}</p>
                        <p className="text-[10px] text-gray-400">{daysLeft}天后永久删除</p>
                      </div>
                      <button onClick={() => restore(item)} className="text-[10px] text-indigo-500 px-2 py-1 bg-indigo-50 rounded-lg shrink-0">恢复</button>
                      <button onClick={() => purge(item.id)} className="text-[10px] text-red-400 px-2 py-1 bg-red-50 rounded-lg shrink-0">删除</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab 3：归档与恢复 ───────────────────────────────────
const ArchiveTab = ({ showToast }) => {
  const [log, setLog] = useState(() => { try { return JSON.parse(localStorage.getItem(ARCHIVE_LOG_KEY) || '[]'); } catch { return []; } });

  const doExport = (label, keys) => {
    const data = {};
    const realKeys = keys || Object.keys(localStorage).filter(k => k.startsWith('ics_') && k !== TRASH_KEY && k !== ARCHIVE_LOG_KEY);
    for (const k of realKeys) {
      try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { data[k] = localStorage.getItem(k); }
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miniphone_${label}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const entry = { id: Date.now(), label: `${label} ${new Date().toISOString().slice(0, 10)}`, keys: realKeys.length, size: json.length * 2 };
    const nextLog = [entry, ...log].slice(0, 30);
    setLog(nextLog);
    localStorage.setItem(ARCHIVE_LOG_KEY, JSON.stringify(nextLog));
    showToast('已下载到本地');
  };

  return (
    <div className="p-3 space-y-3 pb-6">
      {/* 导出 */}
      <Card title="导出数据" icon={<Download size={14} />}>
        <button onClick={() => doExport('全量', null)}
          className="w-full py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium mb-2">
          导出全量备份
        </button>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '聊天',  keys: () => Object.keys(localStorage).filter(k => k.startsWith('ics_msgs_')), key: '聊天' },
            { label: '梦境',  keys: () => ['ics_dreams'], key: '梦境' },
            { label: '地图',  keys: () => ['ics_maps', 'ics_active_map'], key: '地图' },
          ].map(({ label, keys, key }) => (
            <button key={key} onClick={() => doExport(key, keys())}
              className="py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200">
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-3">导出 JSON 格式，可用于备份或接入后端向量库处理</p>
      </Card>

      {/* 导出记录 */}
      <Card title="导出记录" icon={<Archive size={14} />}>
        {log.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-5">暂无导出记录</p>
        ) : (
          <div>
            {log.map(entry => (
              <div key={entry.id} className="flex items-center py-2 border-b last:border-0 gap-2">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-700">{entry.label}</p>
                  <p className="text-[10px] text-gray-400">{entry.keys}个键 · {fmt(entry.size)}</p>
                </div>
              </div>
            ))}
            <button onClick={() => { setLog([]); localStorage.removeItem(ARCHIVE_LOG_KEY); }}
              className="text-[10px] text-gray-400 mt-2">清空记录</button>
          </div>
        )}
      </Card>

      {/* 未来规划 */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 mb-2.5 flex items-center gap-1">
          <Info size={12} /> 后端接入后的归档能力
        </p>
        {[
          '向量数据库：自动生成 embedding，768维热存/384维冷压',
          '副 API 异步总结：每5条对话压缩一次，降低 token 占用',
          '云端归档同步：多设备共享记忆，跨平台恢复',
          '临时加载：解压归档到内存中查看，关闭后自动释放',
          '重要性评分：引用次数+情感强度+事件类型，智能决定保留',
        ].map((t, i) => (
          <p key={i} className="text-[11px] text-gray-400 mb-1">• {t}</p>
        ))}
      </div>
    </div>
  );
};

// ─── Tab 4：角色记忆 ─────────────────────────────────────
const CAT_LABELS = { event: '事件', preference: '偏好', relationship: '关系', fact: '事实' };
const CAT_KEYS = Object.keys(CAT_LABELS);

const CharMemoriesTab = ({ showToast }) => {
  const [chars, setChars] = useState([]);
  const [selCharId, setSelCharId] = useState(null);
  const [memories, setMemories] = useState([]);
  const [loadingMem, setLoadingMem] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ content: '', importance: 5, category: 'event' });

  useEffect(() => {
    api.get('/api/characters').then(setChars).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selCharId) { setMemories([]); return; }
    setLoadingMem(true);
    api.get(`/api/characters/${selCharId}/memories`)
      .then(data => { setMemories(data); setLoadingMem(false); })
      .catch(() => setLoadingMem(false));
  }, [selCharId]);

  const addMemory = async () => {
    if (!form.content.trim() || !selCharId) return;
    try {
      const m = await api.post(`/api/characters/${selCharId}/memories`, form);
      setMemories(prev => [m, ...prev]);
      setForm({ content: '', importance: 5, category: 'event' });
      setAddOpen(false);
      showToast('记忆已保存');
    } catch { showToast('保存失败'); }
  };

  const deleteMemory = async (id) => {
    try {
      await api.delete(`/api/memories/${id}`);
      setMemories(prev => prev.filter(m => m.id !== id));
      showToast('已删除');
    } catch { showToast('删除失败'); }
  };

  return (
    <div className="p-3 space-y-3 pb-6">
      <Card title="选择角色" icon={<User size={14} />}>
        <div className="flex gap-2 flex-wrap">
          {chars.map(c => (
            <button key={c.id} onClick={() => setSelCharId(c.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-all ${selCharId === c.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-transparent bg-gray-100 text-gray-600'}`}>
              <Avatar value={c.avatar} name={c.name} size={18} rounded />
              {c.name}
            </button>
          ))}
          {chars.length === 0 && <p className="text-xs text-gray-400">暂无角色，请先在通讯录中创建</p>}
        </div>
      </Card>

      {selCharId && (
        <>
          <button onClick={() => setAddOpen(o => !o)}
            className="w-full py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium flex items-center justify-center gap-2">
            <Plus size={14} /> 添加记忆
          </button>

          <AnimatePresence>
            {addOpen && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">新增记忆</p>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="记录角色对用户的记忆内容…" rows={3} autoFocus
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <p className="text-[11px] text-gray-400 mb-1">重要度（≥7 会注入上下文）</p>
                    <div className="flex items-center gap-2">
                      <input type="range" min={1} max={10} value={form.importance}
                        onChange={e => setForm(f => ({ ...f, importance: +e.target.value }))}
                        className="flex-1 accent-indigo-500" />
                      <span className={`text-sm font-bold w-5 text-right ${form.importance >= 7 ? 'text-indigo-600' : 'text-gray-400'}`}>
                        {form.importance}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1">类型</p>
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="text-sm border rounded-lg px-2 py-1.5 focus:outline-none">
                      {CAT_KEYS.map(k => <option key={k} value={k}>{CAT_LABELS[k]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setAddOpen(false)} className="flex-1 py-2 text-sm border rounded-xl text-gray-500">取消</button>
                  <button onClick={addMemory} disabled={!form.content.trim()}
                    className="flex-1 py-2 text-sm bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50">保存</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loadingMem ? (
            <div className="text-center py-8 text-gray-400 text-sm">加载中…</div>
          ) : memories.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">暂无记忆</div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-400 px-1">
                共 {memories.length} 条 · 重要度 ≥7 的会注入 AI 上下文
              </p>
              {memories.map(m => (
                <div key={m.id} className="bg-white rounded-2xl shadow-sm p-3 flex gap-3 items-start">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${m.importance >= 7 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.importance}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-relaxed">{m.content}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{CAT_LABELS[m.category] || m.category}</p>
                  </div>
                  <button onClick={() => deleteMemory(m.id)} className="text-gray-200 hover:text-red-400 transition-colors shrink-0 pt-0.5">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── 主组件 ──────────────────────────────────────────────
const MemoryApp = ({ onBack }) => {
  const [tab, setTab] = useState(0);
  const [settings, setSettings] = useState(() => {
    try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return { ...defaultSettings }; }
  });
  const [info, setInfo] = useState(getStorageInfo);
  const [dialog, setDialog] = useState(null); // { title, body, onOk }
  const [toast, setToast]   = useState(null);

  const refresh = useCallback(() => setInfo(getStorageInfo()), []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const save = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const onConfirm = (opts) => setDialog(opts);

  // Gauge color
  const { usedPct } = info;
  const gc = usedPct >= settings.criticalAt ? '#ef4444'
           : usedPct >= settings.orangeAt   ? '#f97316'
           : usedPct >= settings.warnAt     ? '#eab308'
           : '#22c55e';

  const TABS = ['自动管理', '手动清理', '归档', '角色记忆'];

  // Refresh storage info whenever tab changes (manual cleanup may have changed it)
  useEffect(() => { refresh(); }, [tab]);

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* ── Header ── */}
      <div className="bg-white border-b shadow-sm shrink-0">
        {/* Title bar */}
        <div className="h-14 flex items-center px-3 gap-2">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <Database size={18} className="text-indigo-500" />
          <span className="font-bold flex-1">忆海</span>
          <button onClick={refresh} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Storage gauge */}
        <div className="px-4 pb-3">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-xs text-gray-500">存储占用（localStorage）</span>
            <span className="text-xs font-bold" style={{ color: gc }}>{fmt(info.total)} / {fmt(MAX_STORAGE)} ({usedPct}%)</span>
          </div>
          {/* Main bar */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(usedPct, 100)}%`, background: gc }} />
          </div>
          {/* Stacked category bar */}
          <div className="h-1 mt-1.5 bg-gray-100 rounded-full overflow-hidden flex">
            {Object.entries(info.cats)
              .filter(([, v]) => v.bytes > 0)
              .map(([k, v]) => (
                <div key={k} title={v.label} style={{ width: `${(v.bytes / Math.max(info.total, 1)) * 100}%`, background: v.color }} />
              ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {Object.entries(info.cats).filter(([, v]) => v.bytes > 0).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-2 h-2 rounded-sm inline-block" style={{ background: v.color }} />
                {v.label} {fmt(v.bytes)}
              </span>
            ))}
          </div>
          {/* Alert */}
          {usedPct >= settings.warnAt && (
            <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 ${usedPct >= settings.criticalAt ? 'bg-red-50 text-red-600' : usedPct >= settings.orangeAt ? 'bg-orange-50 text-orange-600' : 'bg-yellow-50 text-yellow-700'}`}>
              <AlertTriangle size={11} />
              {usedPct >= settings.criticalAt ? '存储严重不足，建议立即清理' : usedPct >= settings.orangeAt ? '存储空间紧张，建议尽快清理' : '存储使用较多，可考虑清理旧数据'}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex">
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${tab === i ? 'text-indigo-600 border-indigo-500' : 'text-gray-400 border-transparent'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">
        {tab === 0 && <AutoTab settings={settings} save={save} />}
        {tab === 1 && <ManualTab info={info} onConfirm={onConfirm} showToast={(m) => { showToast(m); refresh(); }} />}
        {tab === 2 && <ArchiveTab showToast={showToast} />}
        {tab === 3 && <CharMemoriesTab showToast={showToast} />}
      </div>

      {/* ── Confirm dialog ── */}
      <AnimatePresence>
        {dialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 flex items-end z-50"
            onClick={() => setDialog(null)}>
            <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
              className="w-full bg-white rounded-t-2xl p-5"
              onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-base mb-1.5">{dialog.title}</h3>
              <p className="text-sm text-gray-500 mb-5 leading-relaxed">{dialog.body}</p>
              <div className="flex gap-2">
                <button onClick={() => setDialog(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium">取消</button>
                <button onClick={() => { dialog.onOk(); setDialog(null); }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium">确认</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-4 py-2 rounded-full whitespace-nowrap z-50 pointer-events-none">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MemoryApp;
