/**
 * Provider 注册表 + 工厂
 *
 * 每个 provider 描述：
 *   name          显示名称
 *   defaultBaseURL 官方默认端点（用户留空时使用）
 *   models        常用模型列表（供前端展示建议）
 *   todo          若设置则表示适配器尚未实现，调用时抛错
 */
import { OpenAICompatProvider } from './openai-compat.js';

export const PROVIDER_CONFIGS = {
  openai: {
    name: 'OpenAI',
    defaultBaseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'gpt-3.5-turbo'],
  },
  zhipu: {
    name: 'Z.AI (智谱)',
    defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5-turbo', 'glm-5', 'glm-4.7', 'glm-4.7-flash', 'glm-4.7-flashx', 'glm-4.6', 'glm-4.5-air', 'glm-4.5-airx', 'glm-4.5-flash'],
    temperatureMax: 1,
  },
  deepseek: {
    name: 'DeepSeek',
    defaultBaseURL: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  grok: {
    name: 'Grok (xAI)',
    defaultBaseURL: 'https://api.x.ai/v1',
    models: ['grok-2', 'grok-2-latest', 'grok-beta'],
  },
  anthropic: {
    name: 'Anthropic Claude',
    defaultBaseURL: 'https://api.anthropic.com',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    todo: true,
  },
  gemini: {
    name: 'Google Gemini',
    defaultBaseURL: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    todo: true,
  },
};

/**
 * 根据 preset 返回对应的 Provider 实例
 * @param {object} preset - { provider?, apiKey, baseURL? }
 */
export function getProvider(preset) {
  const providerKey = preset?.provider || 'openai';
  const config = PROVIDER_CONFIGS[providerKey];

  if (!config) throw new Error(`未知的 Provider: ${providerKey}`);
  if (config.todo) throw new Error(`${config.name} 适配器尚未实现，敬请期待`);

  const apiKey = preset?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('未配置 API Key，请先去设置中添加 API 配置并保存');

  // 用户自定义 URL 优先（支持反向代理），否则用该 provider 的官方默认端点
  // 去掉末尾斜杠，防止 OpenAI SDK 拼接成 .../v4//chat/completions
  const rawURL = preset?.baseURL?.trim() || config.defaultBaseURL;
  const baseURL = rawURL.replace(/\/+$/, '');

  // 目前所有已实现的 provider 均使用 OpenAI 兼容格式
  return new OpenAICompatProvider({ apiKey, baseURL });
}
