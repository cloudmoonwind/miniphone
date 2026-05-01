/**
 * OpenAI-compatible provider adapter
 * 支持所有兼容 OpenAI Chat Completions API 的服务商：
 * OpenAI / 智谱 GLM / DeepSeek / Grok (xAI) 等
 *
 * 所有 API 调用在此层统一写入 aiLogStore，
 * 任何绕过 services/ai.ts 的代码（如 settings 测试连接）也会被记录。
 */
import OpenAI from 'openai';
import {
  appendEntry,
  type AiLogEndpoint,
  type AiLogErrorPhase,
  type AiLogStreamAbortType,
} from '../services/aiLogStore.js';

interface CallContext {
  /** 关联到本轮触发链路；本期暂未填充，保留字段 */
  traceId?: string | null;
  /** 调用语义；testConnection 等特殊入口可显式覆盖 */
  endpoint?: AiLogEndpoint;
  /** 业务来源：chat.respond / dream.generate / settings.testConnection 等 */
  source?: string | null;
  /** 流式 SSE 场景下由路由层告知浏览器是否已断开 */
  isClientDisconnected?: () => boolean;
}

export class OpenAICompatProvider {
  private _client: OpenAI;
  readonly providerName: string;
  readonly baseURL: string;

  constructor({ apiKey, baseURL, providerName = 'openai-compat' }: { apiKey: string; baseURL: string; providerName?: string }) {
    this.providerName = providerName;
    this.baseURL = baseURL;
    this._client = new OpenAI({ apiKey, baseURL });
  }

  // ── 非流式 ──────────────────────────────────────────────────────────────
  async chatCompletion(
    messages: any[],
    { model = 'gpt-4o-mini', temperature = 0.8, max_tokens = 1500 }: Record<string, any> = {},
    ctx: CallContext = {},
  ) {
    const t0 = Date.now();
    const endpoint: AiLogEndpoint = ctx.endpoint ?? 'chat';
    try {
      const result = await this._chatCompletionInner(messages, { model, temperature, max_tokens });
      appendEntry({
        traceId: ctx.traceId ?? null,
        endpoint, source: ctx.source ?? null,
        provider: this.providerName, baseURL: this.baseURL, model,
        durationMs: Date.now() - t0,
        inputMessages: messages,
        output: result.content,
        usage: result.usage,
        streamChunks: null, streamAborted: null,
        streamCompleted: null, streamAbortType: null,
        error: null, status: null, errorPhase: null,
      });
      return result.content;
    } catch (err: any) {
      appendEntry({
        traceId: ctx.traceId ?? null,
        endpoint, source: ctx.source ?? null,
        provider: this.providerName, baseURL: this.baseURL, model,
        durationMs: Date.now() - t0,
        inputMessages: messages,
        output: null, usage: null,
        streamChunks: null, streamAborted: null,
        streamCompleted: null, streamAbortType: null,
        error: err?.message ?? String(err),
        status: err?.status ?? err?.statusCode ?? null,
        errorPhase: 'before-call',
      });
      throw err;
    }
  }

  /** 原 chatCompletion 的核心逻辑，处理思考型模型与各种 finish_reason */
  private async _chatCompletionInner(
    messages: any[],
    { model, temperature, max_tokens }: { model: string; temperature: number; max_tokens: number },
  ): Promise<{ content: string; usage: any | null }> {
    const res = await this._client.chat.completions.create({ model, messages, temperature, max_tokens });
    const choice = res.choices[0];
    // 兼容思考型模型（GLM-4.7 thinking / DeepSeek-reasoner 等）：
    // 这类模型把推理过程放在 reasoning_content，实际回复在 content
    // 若 content 为空但 reasoning_content 有内容，说明 max_tokens 在思考阶段就耗尽了
    const content = choice?.message?.content ?? '';
    const reasoning = (choice?.message as any)?.reasoning_content ?? '';
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

    throw new Error(
      `模型返回了空回复（finish_reason: ${finishReason}）。` +
      `请检查模型名称是否正确，或该模型是否支持当前请求格式。`
    );
  }

  // ── 流式 ────────────────────────────────────────────────────────────────
  /**
   * 返回一个已包装的 AsyncIterable：
   *   - 创建阶段失败：errorPhase='before-call'，立即写日志并 throw
   *   - 中途失败：errorPhase='mid-stream'，已收到的 chunks/output/usage 仍写入
   *   - 正常完成：写日志，streamAborted=false
   *   - 消费方提前 break：finally 触发，按已收到的内容写日志并标记 abortType
   */
  async chatCompletionStream(
    messages: any[],
    { model = 'gpt-4o-mini', temperature = 0.8, max_tokens = 1500 }: Record<string, any> = {},
    ctx: CallContext = {},
  ) {
    const t0 = Date.now();

    let upstream;
    try {
      upstream = await this._client.chat.completions.create({
        model, messages, temperature, max_tokens, stream: true,
      });
    } catch (err: any) {
      appendEntry({
        traceId: ctx.traceId ?? null,
        endpoint: 'chatStream', source: ctx.source ?? null,
        provider: this.providerName, baseURL: this.baseURL, model,
        durationMs: Date.now() - t0,
        inputMessages: messages,
        output: null, usage: null,
        streamChunks: 0, streamAborted: true,
        streamCompleted: false, streamAbortType: 'before-call-error',
        error: err?.message ?? String(err),
        status: err?.status ?? err?.statusCode ?? null,
        errorPhase: 'before-call',
      });
      throw err;
    }

    const meta = {
      traceId: ctx.traceId ?? null,
      provider: this.providerName,
      baseURL: this.baseURL,
      model,
      messages,
      t0,
      source: ctx.source ?? null,
      isClientDisconnected: ctx.isClientDisconnected,
    };
    return wrapStreamWithLogging(upstream, meta);
  }

  // ── 模型列表 ─────────────────────────────────────────────────────────────
  async listModels(ctx: CallContext = {}) {
    const t0 = Date.now();
    try {
      const res = await this._client.models.list();
      appendEntry({
        traceId: ctx.traceId ?? null,
        endpoint: 'listModels', source: ctx.source ?? null,
        provider: this.providerName, baseURL: this.baseURL, model: '-',
        durationMs: Date.now() - t0,
        inputMessages: null,
        output: { count: res.data.length },
        usage: null,
        streamChunks: null, streamAborted: null,
        streamCompleted: null, streamAbortType: null,
        error: null, status: null, errorPhase: null,
      });
      return res.data;
    } catch (err: any) {
      appendEntry({
        traceId: ctx.traceId ?? null,
        endpoint: 'listModels', source: ctx.source ?? null,
        provider: this.providerName, baseURL: this.baseURL, model: '-',
        durationMs: Date.now() - t0,
        inputMessages: null,
        output: null, usage: null,
        streamChunks: null, streamAborted: null,
        streamCompleted: null, streamAbortType: null,
        error: err?.message ?? String(err),
        status: err?.status ?? err?.statusCode ?? null,
        errorPhase: 'before-call',
      });
      throw err;
    }
  }
}

// ── 流式包装器 ──────────────────────────────────────────────────────────────

interface StreamMeta {
  traceId: string | null;
  provider: string;
  baseURL: string;
  model: string;
  messages: any[];
  t0: number;
  source: string | null;
  isClientDisconnected?: () => boolean;
}

async function* wrapStreamWithLogging(upstream: AsyncIterable<any>, meta: StreamMeta): AsyncGenerator<any> {
  let chunks = 0;
  let output = '';
  let usage: any = null;
  let caughtError: any = null;
  let phase: AiLogErrorPhase = 'mid-stream';
  let completed = false;
  try {
    for await (const chunk of upstream) {
      chunks++;
      const delta = chunk?.choices?.[0]?.delta?.content || '';
      if (delta) output += delta;
      if (chunk?.usage) usage = chunk.usage;
      yield chunk;
    }
    phase = 'after-stream';
    completed = true;
  } catch (err: any) {
    caughtError = err;
    throw err;
  } finally {
    const abortType: AiLogStreamAbortType = caughtError
      ? 'upstream-error'
      : completed
        ? 'none'
        : meta.isClientDisconnected?.()
          ? 'client-disconnect'
          : 'consumer-break';
    appendEntry({
      traceId: meta.traceId,
      endpoint: 'chatStream',
      source: meta.source,
      provider: meta.provider,
      baseURL: meta.baseURL,
      model: meta.model,
      durationMs: Date.now() - meta.t0,
      inputMessages: meta.messages,
      output: output || null,
      usage,
      streamChunks: chunks,
      streamAborted: abortType !== 'none',
      streamCompleted: completed,
      streamAbortType: abortType,
      error: caughtError?.message ?? null,
      status: caughtError?.status ?? caughtError?.statusCode ?? null,
      errorPhase: caughtError ? phase : null,
    });
  }
}
