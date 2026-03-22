import React, { useState, useEffect } from 'react';
import { ChevronLeft, Eye, EyeOff, Loader2, RefreshCw, X } from 'lucide-react';
import { settingsService } from '../services/settings.js';

const FEATURE_LIST = [
  { key: 'summaries',  label: '聊天总结',     desc: '折叠段落时自动生成摘要',           promptFeature: 'summaries' },
  { key: 'charSystem', label: '角色系统',     desc: '时间线生成 / 数值提取 / 生活日志',  promptFeature: 'charSystem' },
  { key: 'life',       label: '角色生活生成',  desc: '角色系统自主生活内容生成',          promptFeature: 'life' },
  { key: 'dafu',       label: '大富翁主持',   desc: '大富翁游戏 AI 主持',               promptFeature: null },
];

const PROMPT_PRESET_KEYS = {
  summaries: [
    { key: 'segment',  label: '段落总结',   hint: '手动折叠段落时' },
    { key: 'daily',    label: '日总结',     hint: '按日期查找时' },
    { key: 'mode',     label: '模式段总结', hint: '切换线上/线下时' },
    { key: 'periodic', label: '定期总结',   hint: '自动按条数触发' },
  ],
  life: [
    { key: 'systemExtension', label: '附加系统指令', hint: '追加到角色定义之后，可定义输出风格、字数、格式' },
  ],
  charSystem: [
    { key: 'extraction',   label: '聊天提取',    hint: '聊天后从对话提取状态/物品/关系' },
    { key: 'timelineEval', label: '时间线评估',   hint: '判断总结是否值得写入时间线' },
    { key: 'lifeExtract',  label: '生活数据提取', hint: '从生活日志提取事件/物品/技能' },
  ],
};

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

const DEFAULT_FORM = { name: '', apiKey: '', baseURL: '', model: '', provider: 'openai', params: { temperature: 0.7 }, contextMode: 'flexible', stream: false, maxReplyTokens: 3000 };

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

  // Feature preset assignments (API)
  const [featurePresets, setFeaturePresets] = useState({ summaries: null, charSystem: null, life: null, dafu: null });
  const [featureSaving, setFeatureSaving] = useState(false);

  // Prompt presets
  const [promptPresets, setPromptPresets] = useState([]);  // all user+builtin presets
  const [featurePromptPresets, setFeaturePromptPresets] = useState({ summaries: null, life: null, charSystem: null });

  // Prompt preset editor drawer
  const [editingPromptPreset, setEditingPromptPreset] = useState(null); // null = closed
  const [promptPresetForm, setPromptPresetForm] = useState({});
  const [promptPresetSaving, setPromptPresetSaving] = useState(false);
  const [promptPresetError, setPromptPresetError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [presetList, active, fp, pp, fpp] = await Promise.all([
          settingsService.listPresets(),
          settingsService.getActivePreset(),
          settingsService.getFeaturePresets(),
          settingsService.listPromptPresets(),
          settingsService.getFeaturePromptPresets(),
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
        if (pp) setPromptPresets(pp);
        if (fpp) setFeaturePromptPresets(fpp);
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

  const saveFeaturePromptPreset = async (featureKey, promptPresetId) => {
    const next = { ...featurePromptPresets, [featureKey]: promptPresetId || null };
    setFeaturePromptPresets(next);
    try {
      await settingsService.setFeaturePromptPresets(next);
    } catch (err) {
      setFormError(err.message);
    }
  };

  // ── Prompt preset editor ──────────────────────────────────────────

  const openEditPreset = (preset) => {
    setPromptPresetError('');
    if (preset.builtin) {
      // For builtin, open in "copy to new" mode
      setEditingPromptPreset({ ...preset, _copyMode: true, id: null, name: `${preset.name}（副本）`, builtin: false });
      setPromptPresetForm({ ...preset.prompts });
    } else {
      setEditingPromptPreset(preset);
      setPromptPresetForm({ ...preset.prompts });
    }
  };

  const openNewPreset = (feature) => {
    setPromptPresetError('');
    setEditingPromptPreset({ id: null, name: '', feature, builtin: false, prompts: {} });
    setPromptPresetForm({});
  };

  const closeEditor = () => {
    setEditingPromptPreset(null);
    setPromptPresetForm({});
    setPromptPresetError('');
  };

  const savePromptPreset = async () => {
    if (!editingPromptPreset) return;
    if (!editingPromptPreset.name?.trim()) {
      setPromptPresetError('预设名称不能为空');
      return;
    }
    setPromptPresetSaving(true);
    setPromptPresetError('');
    try {
      const payload = {
        name: editingPromptPreset.name.trim(),
        feature: editingPromptPreset.feature,
        description: editingPromptPreset.description || '',
        prompts: promptPresetForm,
      };
      if (editingPromptPreset.id) {
        // update existing
        const updated = await settingsService.updatePromptPreset(editingPromptPreset.id, payload);
        setPromptPresets(ps => ps.map(p => p.id === updated.id ? updated : p));
      } else {
        // create new
        const created = await settingsService.createPromptPreset(payload);
        setPromptPresets(ps => [...ps, created]);
        // auto-select it for this feature
        await saveFeaturePromptPreset(editingPromptPreset.feature, created.id);
      }
      closeEditor();
    } catch (err) {
      setPromptPresetError(err.message);
    } finally {
      setPromptPresetSaving(false);
    }
  };

  const deletePromptPreset = async (id) => {
    try {
      await settingsService.deletePromptPreset(id);
      setPromptPresets(ps => ps.filter(p => p.id !== id));
      // Clear any feature that was using it
      const next = { ...featurePromptPresets };
      let changed = false;
      for (const k of Object.keys(next)) {
        if (next[k] === id) { next[k] = null; changed = true; }
      }
      if (changed) {
        setFeaturePromptPresets(next);
        await settingsService.setFeaturePromptPresets(next);
      }
    } catch (err) {
      setFormError(err.message);
    }
  };

  const currentProvider = PROVIDER_MAP[form.provider] || PROVIDER_MAP.openai;
  // 模型候选：自动获取到的列表 > provider 预设列表
  const suggestedModels = modelList.length > 0
    ? modelList.map(m => ({ id: m.id, label: m.id }))
    : currentProvider.models.map(m => ({ id: m, label: m }));

  // Group prompt presets by feature for easy lookup
  const promptPresetsByFeature = {};
  for (const pp of promptPresets) {
    if (!promptPresetsByFeature[pp.feature]) promptPresetsByFeature[pp.feature] = [];
    promptPresetsByFeature[pp.feature].push(pp);
  }

  const editorFeature = editingPromptPreset?.feature;
  const editorKeys = editorFeature ? (PROMPT_PRESET_KEYS[editorFeature] || []) : [];

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
        {[
          { id: 'presets',  label: '配置管理' },
          { id: 'features', label: '功能配置' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
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
                <div>
                  <label className="text-xs text-gray-600 block mb-1">AI 回复最大 token 数（max_tokens）</label>
                  <input type="number" min="100" max="32000" step="100"
                    value={form.maxReplyTokens ?? 3000}
                    onChange={e => setForm({ ...form, maxReplyTokens: parseInt(e.target.value) || 3000 })}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <p className="text-xs text-gray-400 mt-0.5">默认 3000。截断问题可能来自此处，增大可得到更长回复。</p>
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
          /* ── 功能配置 Tab ── */
          <div className="w-full max-w-sm mx-auto space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-600 leading-relaxed">
              为不同功能分配独立的 API 配置和提示词预设。不选则使用主 API / 内置默认提示词。
            </div>
            {presets.length === 0 && (
              <div className="text-xs text-gray-400 text-center py-4">请先在「配置管理」中添加 API 配置</div>
            )}
            {FEATURE_LIST.map(feat => {
              const featurePromptList = feat.promptFeature ? (promptPresetsByFeature[feat.promptFeature] || []) : [];
              const activePromptPresetId = feat.promptFeature ? featurePromptPresets[feat.promptFeature] : null;
              const activePromptPreset = featurePromptList.find(p => p.id === activePromptPresetId) || null;

              return (
                <div key={feat.key} className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{feat.label}</p>
                    <p className="text-xs text-gray-400">{feat.desc}</p>
                  </div>

                  {/* API 配置选择 */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">API 配置</label>
                    <select
                      value={featurePresets[feat.key] || ''}
                      onChange={e => saveFeaturePreset(feat.key, e.target.value || null)}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="">用主 API（默认）</option>
                      {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {featurePresets[feat.key] && (
                      <p className="text-xs text-blue-500 mt-1">
                        当前：{presets.find(p => p.id === featurePresets[feat.key])?.name || '未知配置'}
                      </p>
                    )}
                  </div>

                  {/* 提示词预设选择（仅有 promptFeature 的功能） */}
                  {feat.promptFeature && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">提示词预设</label>
                      <div className="flex gap-2 items-center">
                        <select
                          value={activePromptPresetId || ''}
                          onChange={e => saveFeaturePromptPreset(feat.promptFeature, e.target.value || null)}
                          className="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
                        >
                          {featurePromptList
                            .filter(p => p.builtin)
                            .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          {featurePromptList.filter(p => !p.builtin).length > 0 && (
                            <optgroup label="自定义预设">
                              {featurePromptList.filter(p => !p.builtin).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        <button
                          onClick={() => {
                            if (activePromptPreset) {
                              openEditPreset(activePromptPreset);
                            } else {
                              // pick the first (builtin default)
                              const firstPreset = featurePromptList[0];
                              if (firstPreset) openEditPreset(firstPreset);
                              else openNewPreset(feat.promptFeature);
                            }
                          }}
                          className="shrink-0 px-2.5 py-2 text-xs bg-purple-50 border border-purple-200 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors whitespace-nowrap"
                        >
                          编辑预设
                        </button>
                      </div>
                      {/* User presets management */}
                      {featurePromptList.filter(p => !p.builtin).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {featurePromptList.filter(p => !p.builtin).map(p => (
                            <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-purple-50 border border-purple-200 text-purple-700">
                              {p.name}
                              <button
                                onClick={() => deletePromptPreset(p.id)}
                                className="text-purple-400 hover:text-red-500 ml-0.5"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => openNewPreset(feat.promptFeature)}
                        className="mt-1.5 text-xs text-gray-400 hover:text-purple-600"
                      >
                        + 新建自定义预设
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {formError && <p className="text-xs text-red-500 text-center">{formError}</p>}
          </div>
        )}
      </div>

      {/* ── 提示词预设编辑抽屉 ── */}
      {editingPromptPreset && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={closeEditor} />

          {/* Drawer */}
          <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <div>
                <p className="font-semibold text-gray-800 text-sm">
                  {editingPromptPreset.id ? '编辑提示词预设' : (editingPromptPreset._copyMode ? '复制为新预设' : '新建提示词预设')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {FEATURE_LIST.find(f => f.promptFeature === editingPromptPreset.feature)?.label || editingPromptPreset.feature}
                </p>
              </div>
              <button onClick={closeEditor} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">预设名称</label>
                <input
                  type="text"
                  value={editingPromptPreset.name || ''}
                  onChange={e => setEditingPromptPreset(ep => ({ ...ep, name: e.target.value }))}
                  placeholder="为这个预设起个名字"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              {/* Prompt keys */}
              {editorKeys.map(({ key, label, hint }) => (
                <div key={key}>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="text-xs font-medium text-gray-700">{label}</label>
                    <span className="text-[10px] text-gray-400">{hint}</span>
                  </div>
                  <textarea
                    rows={key === 'extraction' || key === 'lifeExtract' || key === 'timelineEval' ? 6 : 4}
                    value={promptPresetForm[key] ?? ''}
                    onChange={e => setPromptPresetForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={`留空则使用内置默认`}
                    className="w-full text-sm border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 bg-gray-50 placeholder:text-gray-300 leading-relaxed font-mono"
                  />
                </div>
              ))}

              {promptPresetError && (
                <p className="text-xs text-red-500">{promptPresetError}</p>
              )}
            </div>

            {/* Drawer footer */}
            <div className="flex gap-2 px-4 py-3 border-t shrink-0">
              <button
                onClick={closeEditor}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={savePromptPreset}
                disabled={promptPresetSaving}
                className="flex-1 py-2.5 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 disabled:opacity-40 transition-colors"
              >
                {promptPresetSaving ? '保存中…' : '保存预设'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsApp;
