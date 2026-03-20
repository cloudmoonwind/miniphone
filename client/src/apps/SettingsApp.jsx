import React, { useState, useEffect } from 'react';
import { ChevronLeft, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { settingsService } from '../services/settings.js';

const FEATURE_LIST = [
  { key: 'summaries', label: '聊天总结',   desc: '折叠段落时自动生成摘要' },
  { key: 'life',      label: '角色生活生成', desc: '角色系统自主生活内容生成' },
  { key: 'dafu',      label: '大富翁主持', desc: '大富翁游戏 AI 主持' },
];

// 各 provider 的静态配置（与后端 PROVIDER_CONFIGS 保持同步）
const PROVIDERS = [
  {
    key: 'openai',
    name: 'OpenAI',
    defaultBaseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'gpt-3.5-turbo'],
  },
  {
    key: 'zhipu',
    name: 'Z.AI (智谱)',
    defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5-turbo', 'glm-5', 'glm-4.7', 'glm-4.7-flash', 'glm-4.7-flashx', 'glm-4.6', 'glm-4.5-air', 'glm-4.5-airx', 'glm-4.5-flash'],
    temperatureMax: 1,
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    key: 'grok',
    name: 'Grok (xAI)',
    defaultBaseURL: 'https://api.x.ai/v1',
    models: ['grok-2', 'grok-2-latest', 'grok-beta'],
  },
  {
    key: 'anthropic',
    name: 'Claude',
    defaultBaseURL: 'https://api.anthropic.com',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    todo: true,
  },
  {
    key: 'gemini',
    name: 'Gemini',
    defaultBaseURL: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    todo: true,
  },
];

const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map(p => [p.key, p]));

const DEFAULT_FORM = { name: '', apiKey: '', baseURL: '', model: '', provider: 'openai', params: { temperature: 0.7 }, contextMode: 'flexible', stream: false };

const SettingsApp = ({ onBack, onPresetChange }) => {
  const [tab, setTab] = useState('presets'); // 'presets' | 'features'
  const [presets, setPresets] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState('');
  const [modelList, setModelList] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState('idle');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);

  // Feature preset assignments
  const [featurePresets, setFeaturePresets] = useState({ summaries: null, life: null, dafu: null });
  const [featureSaving, setFeatureSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [presetList, active, fp] = await Promise.all([
          settingsService.listPresets(),
          settingsService.getActivePreset(),
          settingsService.getFeaturePresets(),
        ]);
        if (presetList.length === 0) {
          const legacyKeys = ['ics_presets', 'ics_api_presets', 'ics_settings', 'apiPresets', 'presets'];
          for (const key of legacyKeys) {
            try {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                const arr = Array.isArray(parsed) ? parsed : (parsed?.presets || []);
                if (arr.length > 0) {
                  setFormError(`检测到旧版本配置（${key}），已恢复显示，保存后将迁移到后端`);
                  setPresets(arr.map((p, i) => ({ ...p, id: p.id || `legacy_${i}` })));
                  break;
                }
              }
            } catch {}
          }
        } else {
          setPresets(presetList);
        }
        if (active) { setSelectedId(active.id); onPresetChange(active); }
        if (fp) setFeaturePresets(fp);
      } catch (err) {
        setFormError(`后端连接失败：${err.message}\n请确认服务器已启动`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setFormError(''); setTestStatus('idle'); setModelList([]);
    if (selectedId === 'new') {
      setForm(DEFAULT_FORM);
    } else if (selectedId) {
      const preset = presets.find(p => p.id === selectedId);
      if (preset) setForm({ ...DEFAULT_FORM, ...preset });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [selectedId, presets]);

  // 切换 provider 时自动填充 baseURL（若当前为空或是其他 provider 的默认值）
  const selectProvider = (key) => {
    const config = PROVIDER_MAP[key];
    if (!config || config.todo) return;
    const allDefaults = new Set(PROVIDERS.map(p => p.defaultBaseURL).filter(Boolean));
    const isDefaultURL = !form.baseURL || allDefaults.has(form.baseURL);
    setForm(f => ({
      ...f,
      provider: key,
      baseURL: isDefaultURL ? (config.defaultBaseURL || '') : f.baseURL,
      model: '',  // 重置模型，让用户选
    }));
    setModelList([]);
    setTestStatus('idle');
  };

  const handleGetModels = async () => {
    if (!form.apiKey) { setFormError('请先输入 API Key'); return; }
    setModelsLoading(true); setFormError('');
    try {
      const data = await settingsService.getModels(form.apiKey, form.baseURL, form.provider);
      setModelList(data.models);
    } catch {
      setFormError('无法自动获取模型列表（部分服务商不支持），已显示预设列表，请手动选择');
    } finally {
      setModelsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!form.apiKey) { setFormError('请先输入 API Key'); return; }
    if (!form.model)  { setFormError('请先选择一个模型'); return; }
    setTestStatus('testing'); setFormError('');
    try {
      await settingsService.testConnection(form.apiKey, form.baseURL, form.model, form.provider);
      setTestStatus('success');
    } catch (err) {
      setTestStatus('error'); setFormError(err.message);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('配置名称不能为空'); return; }
    if (!form.apiKey.trim()) { setFormError('API Key 不能为空'); return; }
    const isDuplicate = presets.some(p => p.name.trim().toLowerCase() === form.name.trim().toLowerCase() && p.id !== selectedId);
    if (isDuplicate) { setFormError('该配置名称已存在'); return; }
    try {
      let savedPreset;
      if (selectedId && selectedId !== 'new') {
        savedPreset = await settingsService.updatePreset(selectedId, form);
        setPresets(ps => ps.map(p => p.id === savedPreset.id ? savedPreset : p));
      } else {
        savedPreset = await settingsService.createPreset(form);
        setPresets(ps => [...ps, savedPreset]);
      }
      await activatePreset(savedPreset);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const activatePreset = async (preset) => {
    try {
      if (preset) {
        await settingsService.setActivePreset(preset.id);
        setSelectedId(preset.id);
        onPresetChange(preset);
      } else {
        await settingsService.clearActivePreset();
        setSelectedId('');
        onPresetChange(null);
      }
    } catch (err) {
      setFormError(err.message);
    }
  };

  const deletePreset = async (id, e) => {
    e.stopPropagation();
    try {
      await settingsService.deletePreset(id);
      setPresets(ps => ps.filter(p => p.id !== id));
      if (selectedId === id) await activatePreset(null);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const saveFeaturePreset = async (featureKey, presetId) => {
    const next = { ...featurePresets, [featureKey]: presetId || null };
    setFeaturePresets(next);
    setFeatureSaving(true);
    try {
      await settingsService.setFeaturePresets(next);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFeatureSaving(false);
    }
  };

  const currentProvider = PROVIDER_MAP[form.provider] || PROVIDER_MAP.openai;
  // 模型候选：自动获取到的列表 > provider 预设列表
  const suggestedModels = modelList.length > 0
    ? modelList.map(m => ({ id: m.id, label: m.id }))
    : currentProvider.models.map(m => ({ id: m, label: m }));

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="h-14 bg-white border-b flex items-center px-4 shadow-sm shrink-0 gap-3">
        <button onClick={onBack}><ChevronLeft /></button>
        <span className="font-bold flex-1">API 设置</span>
        {featureSaving && <span className="text-xs text-blue-400 animate-pulse">保存中…</span>}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b shrink-0 flex px-4">
        {[{ id: 'presets', label: '配置管理' }, { id: 'features', label: '副 API 分配' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-32 text-gray-400 text-sm">加载中…</div>
        ) : tab === 'presets' ? (
          /* ── 配置管理 Tab ── */
          <div className="w-full max-w-sm mx-auto bg-white rounded-xl border shadow-sm p-4 space-y-4">
            <div>
              <h3 className="font-bold text-gray-800">主 API 配置</h3>
              <p className="text-xs text-gray-400 mt-0.5">保存后自动激活为主 API</p>
            </div>

            {formError && !selectedId && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-2.5 whitespace-pre-line leading-relaxed">{formError}</p>
            )}

            <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setFormError(''); }}
              className="w-full p-2 text-sm border rounded bg-gray-50">
              <option value="">选择一个配置...</option>
              {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="new">＋ 新建配置</option>
            </select>

            {selectedId && (
              <div className="space-y-5 pt-2">

                {/* ── Provider 选择 ── */}
                <div>
                  <label className="text-xs text-gray-500 block mb-2">服务商</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PROVIDERS.map(p => (
                      <button
                        key={p.key}
                        onClick={() => selectProvider(p.key)}
                        disabled={p.todo}
                        title={p.todo ? '适配器开发中，敬请期待' : p.name}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors relative
                          ${p.todo ? 'opacity-40 cursor-not-allowed border-gray-200 text-gray-400 bg-gray-50' :
                            form.provider === p.key
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 bg-white'}
                        `}
                      >
                        {p.name}
                        {p.todo && <span className="ml-1 text-[9px] opacity-60">开发中</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500">name</label>
                  <input type="text" placeholder="为这组配置命名" value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full text-sm bg-transparent border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1" />
                </div>

                {/* ── 端点 URL ── */}
                <div>
                  <div className="flex items-baseline justify-between mb-0.5">
                    <label className="text-xs text-gray-500">url</label>
                    <span className="text-[10px] text-gray-400">留空使用官方端点，也可填反向代理地址</span>
                  </div>
                  <input type="text"
                    placeholder={currentProvider.defaultBaseURL || '输入 API 端点…'}
                    value={form.baseURL}
                    onChange={e => setForm({ ...form, baseURL: e.target.value })}
                    className="w-full text-sm bg-transparent border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1" />
                </div>

                <div className="relative">
                  <label className="text-xs text-gray-500">key</label>
                  <input type={showKey ? 'text' : 'password'} placeholder="输入你的 API Key" value={form.apiKey}
                    onChange={e => setForm({ ...form, apiKey: e.target.value })}
                    className="w-full text-sm bg-transparent border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1 pr-8" />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-0 bottom-1 text-gray-400 hover:text-gray-600">
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* ── 模型选择 ── */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-gray-500">model</label>
                    <button onClick={handleGetModels} disabled={modelsLoading || !form.apiKey}
                      className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 disabled:opacity-40">
                      {modelsLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      从服务商获取列表
                    </button>
                  </div>
                  {/* 建议模型芯片 */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {suggestedModels.map(m => (
                      <button key={m.id} onClick={() => setForm(f => ({ ...f, model: m.id }))}
                        className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors
                          ${form.model === m.id ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 bg-white'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {/* 手动输入 */}
                  <input type="text"
                    placeholder="或手动输入模型名…"
                    value={form.model}
                    onChange={e => setForm({ ...form, model: e.target.value })}
                    className="w-full text-sm bg-transparent border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1" />
                </div>

                <div>
                  {(() => {
                    const tMax = PROVIDER_MAP[form.provider]?.temperatureMax ?? 2;
                    const tVal = Math.min(form.params?.temperature ?? 0.7, tMax);
                    return <>
                      <label className="text-xs text-gray-600">Temperature: {tVal} <span className="text-gray-400">(0 – {tMax})</span></label>
                      <input type="range" min="0" max={tMax} step="0.05" value={tVal}
                        onChange={e => setForm({ ...form, params: { ...form.params, temperature: parseFloat(e.target.value) } })}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                    </>;
                  })()}
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">上下文模式</label>
                  <select value={form.contextMode || 'flexible'}
                    onChange={e => setForm({ ...form, contextMode: e.target.value })}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                    <option value="flexible">宽松（允许连续同角色消息，推荐）</option>
                    <option value="strict">严格交替（合并连续同角色，适合部分模型）</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-600">流式输出（打字机效果）</label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, stream: !f.stream }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.stream ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.stream ? 'translate-x-4' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={handleTestConnection} className="text-sm text-gray-500 hover:text-black">测试连接</button>
                    <div className={`w-3 h-3 rounded-full transition-colors
                      ${testStatus === 'idle'    ? 'bg-gray-300' : ''}
                      ${testStatus === 'testing' ? 'bg-yellow-400 animate-pulse' : ''}
                      ${testStatus === 'success' ? 'bg-green-500' : ''}
                      ${testStatus === 'error'   ? 'bg-red-500' : ''}
                    `} />
                  </div>
                  {selectedId !== 'new' && (
                    <button onClick={e => deletePreset(selectedId, e)} className="text-xs text-red-500 hover:underline">删除</button>
                  )}
                </div>
                {formError && <p className="text-xs text-red-500 text-center">{formError}</p>}
                <button onClick={handleSave} className="w-full bg-blue-500 text-white font-bold py-2.5 rounded-lg hover:bg-blue-600 transition-colors">
                  保存并激活为主 API
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── 副 API 分配 Tab ── */
          <div className="w-full max-w-sm mx-auto space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-600 leading-relaxed">
              副 API 让不同功能使用不同的 AI 模型，不选则使用主 API。
            </div>
            {presets.length === 0 && (
              <div className="text-xs text-gray-400 text-center py-4">请先在「配置管理」中添加 API 配置</div>
            )}
            {FEATURE_LIST.map(feat => (
              <div key={feat.key} className="bg-white rounded-xl border shadow-sm p-4 space-y-2">
                <div>
                  <p className="font-semibold text-sm text-gray-800">{feat.label}</p>
                  <p className="text-xs text-gray-400">{feat.desc}</p>
                </div>
                <select
                  value={featurePresets[feat.key] || ''}
                  onChange={e => saveFeaturePreset(feat.key, e.target.value || null)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">用主 API（默认）</option>
                  {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {featurePresets[feat.key] && (
                  <p className="text-xs text-blue-500">
                    当前：{presets.find(p => p.id === featurePresets[feat.key])?.name || '未知配置'}
                  </p>
                )}
              </div>
            ))}
            {formError && <p className="text-xs text-red-500 text-center">{formError}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsApp;
