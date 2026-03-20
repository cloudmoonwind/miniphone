/**
 * OpenAI-compatible provider adapter
 * 支持所有兼容 OpenAI Chat Completions API 的服务商：
 * OpenAI / 智谱 GLM / DeepSeek / Grok (xAI) 等
 */
import OpenAI from 'openai';

export class OpenAICompatProvider {
  constructor({ apiKey, baseURL }) {
    this._client = new OpenAI({ apiKey, baseURL });
  }

  async chatCompletion(messages, { model = 'gpt-4o-mini', temperature = 0.8, max_tokens = 1500 } = {}) {
    const res = await this._client.chat.completions.create({ model, messages, temperature, max_tokens });
    const choice = res.choices[0];
    const content = choice?.message?.content ?? '';
    const finishReason = choice?.finish_reason ?? 'unknown';
    if (!content.trim()) {
      const hint = finishReason === 'content_filter'
        ? '内容被模型安全策略拦截（content_filter）'
        : `模型返回了空内容（finish_reason: ${finishReason}）`;
      throw new Error(hint);
    }
    return { content, usage: res.usage || null };
  }

  async chatCompletionStream(messages, { model = 'gpt-4o-mini', temperature = 0.8, max_tokens = 1500 } = {}) {
    return await this._client.chat.completions.create({ model, messages, temperature, max_tokens, stream: true });
  }

  async listModels() {
    const res = await this._client.models.list();
    return res.data;
  }
}
