/**
 * AI 调用 facade
 *
 * 真正的日志逻辑在 providers/openai-compat.ts —— 任何走 provider 的调用
 * （包括绕过本文件的 settings 测试连接）都自动写入 aiLogStore。
 *
 * 本文件只保留薄壳，让多数路由代码不必直接写 provider 调用样板。
 */
import { getProvider } from '../providers/index.js';

// 兼容旧用法：路由层 import getClient
export function getClient(preset) {
  return getProvider(preset);
}

// 非流式
export async function chatCompletion(provider, messages, options: Record<string, any> = {}, ctx: Record<string, any> = {}) {
  return await provider.chatCompletion(messages, options, ctx);
}

/**
 * 流式：返回 { stream, model, messages, t0 }，与历史接口形状一致。
 * stream 是已经包好日志的 AsyncGenerator，调用方按 for-await 消费即可。
 * 失败/中断时 provider 层会自动写日志，路由不再需要手动 finalize。
 */
export async function chatCompletionStream(provider, messages, options: Record<string, any> = {}, ctx: Record<string, any> = {}) {
  const model = options.model || 'gpt-4o-mini';
  const t0 = Date.now();
  const stream = await provider.chatCompletionStream(messages, options, ctx);
  return { stream, model, messages, t0 };
}

export async function listModels(provider, ctx: Record<string, any> = {}) {
  return provider.listModels(ctx);
}
