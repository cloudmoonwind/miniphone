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
    // 兼容思考型模型（GLM-4.7 thinking / DeepSeek-reasoner 等）：
    // 这类模型把推理过程放在 reasoning_content，实际回复在 content
    // 若 content 为空但 reasoning_content 有内容，说明 max_tokens 在思考阶段就耗尽了
    const content = choice?.message?.content ?? '';
    const reasoning = choice?.message?.reasoning_content ?? '';
    const finishReason = choice?.finish_reason ?? 'unknown';

    if (content.trim()) {
      return { content: content.trim(), usage: res.usage || null };
    }

    if (finishReason === 'content_filter') {
      throw new Error('内容被模型安全策略拦截（content_filter）');
    }

    if (finishReason === 'length') {
      if (reasoning.trim()) {
        throw new Error(
          `模型在思考阶段就耗尽了 max_tokens（当前 ${max_tokens}），未能输出回复。` +
          `请在设置中选用支持更大 max_tokens 的模型，或在预设中调低 temperature / 关闭思考模式。`
        );
      }
      throw new Error(
        `模型输出被截断（max_tokens=${max_tokens} 不足），回复为空。请增大 max_tokens 或缩短输入。`
      );
    }

    // content 为空但 finish_reason 是 stop：模型确实输出了空字符串
    throw new Error(
      `模型返回了空回复（finish_reason: ${finishReason}）。` +
      `请检查模型名称是否正确，或该模型是否支持当前请求格式。`
    );
  }

  async chatCompletionStream(messages, { model = 'gpt-4o-mini', temperature = 0.8, max_tokens = 1500 } = {}) {
    return await this._client.chat.completions.create({ model, messages, temperature, max_tokens, stream: true });
  }

  async listModels() {
    const res = await this._client.models.list();
    return res.data;
  }
}
