import { getProvider } from '../providers/index.js';

// ── 简单的 in-memory 调用日志（最近 30 次）────────────────────────────
const AI_LOG_MAX = 30;
const aiCallLog  = [];

export function getAICallLog() {
  return [...aiCallLog].reverse(); // 最新的在前
}

export function clearAICallLog() {
  aiCallLog.length = 0;
}

function pushLog(entry) {
  aiCallLog.push(entry);
  if (aiCallLog.length > AI_LOG_MAX) aiCallLog.shift();
}

function makeId() {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
}

// ────────────────────────────────────────────────────────────────────────
// getClient 保持原有函数名不变（各路由无需修改导入），返回 Provider 实例
export function getClient(preset) {
  return getProvider(preset);
}

// 非流式调用
export async function chatCompletion(provider, messages, options: Record<string, any> = {}) {
  const model = options.model || 'gpt-4o-mini';
  const t0 = Date.now();
  try {
    const { content, usage } = await provider.chatCompletion(messages, options);
    pushLog({
      id: makeId(), timestamp: new Date().toISOString(),
      stream: false, model, durationMs: Date.now() - t0,
      inputMessages: messages, output: content, usage,
    });
    return content;
  } catch (err) {
    pushLog({
      id: makeId(), timestamp: new Date().toISOString(),
      stream: false, model, durationMs: Date.now() - t0,
      inputMessages: messages, output: null,
      error: err.message, status: err.status ?? err.statusCode ?? null,
    });
    throw err;
  }
}

// 流式调用 —— 返回 { stream, model, messages, t0 }
export async function chatCompletionStream(provider, messages, options: Record<string, any> = {}) {
  const model = options.model || 'gpt-4o-mini';
  const t0 = Date.now();
  try {
    const stream = await provider.chatCompletionStream(messages, options);
    return { stream, model, messages, t0 };
  } catch (err) {
    pushLog({
      id: makeId(), timestamp: new Date().toISOString(),
      stream: true, model, durationMs: Date.now() - t0,
      inputMessages: messages, output: null,
      error: err.message, status: err.status ?? err.statusCode ?? null,
    });
    throw err;
  }
}

// 流式调用结束后写日志（由路由层调用）
export function logStreamCompletion({ model, messages, fullContent, t0, usage = null }) {
  pushLog({
    id: makeId(), timestamp: new Date().toISOString(),
    stream: true, model, durationMs: Date.now() - t0,
    inputMessages: messages, output: fullContent, usage,
  });
}

export async function listModels(provider) {
  return provider.listModels();
}
