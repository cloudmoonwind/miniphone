import { Router } from 'express';
import { messageStore, summaryStore, presetStore, activeStore } from '../storage/index.js';
import { getClient, chatCompletion, chatCompletionStream } from '../services/ai.js';
import { assembleMessages, MSG_SEP } from '../services/context.js';
import { genId } from '../storage/FileStore.js';
import { triggerExtraction } from '../services/extraction.js';
import { checkAndFireEvents, parseOutcomeFromAIResponse, tickCooldowns } from '../services/eventEngine.js';
import { consumeInjectionTurns } from '../services/events.js';
import { extractVarBlock, parseAndApplyVarBlock } from '../services/values.js';
import { runWithTrace, traceSummary } from '../services/trace.js';

// 同一发送者 5 分钟内的消息合并为一条
const GROUP_TIMEOUT_MS = 5 * 60 * 1000;

const router = Router();

// ── 内部工具：解析总结用的 AI 客户端 ──────────────────────────────
async function resolveSummaryClient() {
  const active = await activeStore.getObject();
  const featurePresetId = active?.featurePresets?.summaries;
  const primaryId       = active?.primaryPresetId ?? active?.activePresetId;
  const resolvedId      = featurePresetId || primaryId;
  if (!resolvedId) return null;
  const preset = await presetStore.getById(resolvedId);
  if (!preset?.apiKey) return null;
  return { client: getClient(preset), model: preset.model };
}

// ── 内部工具：生成一段消息的总结并存储 ───────────────────────────
async function generateAndStoreSummary(charId, msgs, extraFields = {}) {
  if (!msgs.length) return;
  const ai = await resolveSummaryClient();
  if (!ai) return; // 没有配置 API，静默跳过

  const convText = msgs.map(m => `${m.sender === 'user' ? '用户' : '角色'}：${m.content}`).join('\n');
  const promptMessages = [
    { role: 'system', content: '你是一个对话总结助手。用简洁的中文总结以下对话的关键信息，重点记录情感变化、重要事件和关键细节，100字以内。' },
    { role: 'user', content: convText },
  ];

  const content = await chatCompletion(
    ai.client,
    promptMessages,
    { model: ai.model || 'gpt-3.5-turbo', max_tokens: 300 },
    { source: 'summary.auto' },
  );
  const period  = { from: msgs[0].timestamp, to: msgs[msgs.length - 1].timestamp };

  await summaryStore.create({
    id: genId('sum'), charId, personaId: null,
    sourceIds: msgs.map(m => m.id),
    content, period, importance: 5, keywords: [],
    createdAt: new Date().toISOString(),
    ...extraFields,
  });
}

// ── 后台自动总结触发器（不阻塞聊天响应）─────────────────────────
async function triggerAutoSummaries(charId) {
  try {
    const active   = await activeStore.getObject();
    const settings = (active?.summarySettings || {}) as any;

    // 获取所有消息（按时间升序，过滤临时消息）
    const allMsgs = (await messageStore.getAll(m => m.charId === charId))
      .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
      .filter(m => !String(m.id).startsWith('tmp-'));

    if (allMsgs.length < 2) return;

    // ── 按条数触发（periodic）──
    if (settings.periodicEnabled) {
      const N     = settings.periodicInterval || 20;
      const count = allMsgs.length;
      if (count % N === 0) {
        const targetMsgs = allMsgs.slice(-N);
        const firstId    = targetMsgs[0].id;
        // 防止重复生成
        const existing = await summaryStore.getAll(s =>
          s.charId === charId && s.type === 'periodic' && (s.sourceIds || []).includes(firstId)
        );
        if (!existing.length) {
          generateAndStoreSummary(charId, targetMsgs, { type: 'periodic', level: 'segment' })
            .catch(e => console.error('[auto-periodic]', e.message));
        }
      }
    }

    // ── 按模式触发（mode）──
    if (settings.modeSummaryEnabled) {
      const lastMsg = allMsgs[allMsgs.length - 1];
      const prevMsg = allMsgs[allMsgs.length - 2];
      if (prevMsg.mode !== lastMsg.mode) {
        // 找出前一个模式段（连续相同 mode，结束于 prevMsg）
        const prevMode = prevMsg.mode;
        const segMsgs  = [];
        for (let i = allMsgs.length - 2; i >= 0; i--) {
          if (allMsgs[i].mode !== prevMode) break;
          segMsgs.unshift(allMsgs[i]);
        }
        if (segMsgs.length > 0) {
          const startId = segMsgs[0].id;
          const endId   = segMsgs[segMsgs.length - 1].id;
          const existing = await summaryStore.getAll(s =>
            s.charId === charId && s.type === 'mode' && s.startMsgId === startId
          );
          if (!existing.length) {
            generateAndStoreSummary(charId, segMsgs, {
              type: 'mode', level: 'segment',
              modeType: prevMode, startMsgId: startId, endMsgId: endId,
            }).catch(e => console.error('[auto-mode]', e.message));
          }
        }
      }
    }
  } catch (e) {
    console.error('[triggerAutoSummaries]', e.message);
  }
}

// POST /api/chat/message – 仅保存用户消息，不触发 AI（支持五分钟内合并）
router.post('/message', async (req, res) => {
  const { content, mode = 'online', characterId, personaId = null } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '消息内容不能为空' });
  if (!characterId)     return res.status(400).json({ error: '缺少 characterId' });

  try {
    const nowMs = Date.now();

    // 查最近一条消息（任意 sender），判断是否可以合并
    const allRecent = (await messageStore.getAll(m =>
      m.charId === characterId && !String(m.id).startsWith('tmp-')
    )).sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

    const lastMsg = allRecent[0];
    const canMerge =
      lastMsg &&
      lastMsg.sender === 'user' &&
      lastMsg.mode === mode &&
      (nowMs - new Date(lastMsg.timestamp).getTime()) < GROUP_TIMEOUT_MS;

    if (canMerge) {
      // 追加到已有消息（用 MSG_SEP 分隔）
      const updated = await messageStore.update(lastMsg.id, {
        content: lastMsg.content + MSG_SEP + content.trim(),
      });
      return res.json({ ...updated, merged: true });
    }

    // 新建消息
    const now = new Date().toISOString();
    const msg = await messageStore.create({
      id: genId('msg'), charId: characterId, personaId,
      sender: 'user', content: content.trim(), mode,
      timestamp: now, userTimestamp: now, charTimestamp: null,
    });
    res.json({ ...msg, merged: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/respond – 用已存消息触发 AI 回复（支持流式 SSE 和非流式）
router.post('/respond', async (req, res) => {
  const {
    characterId, personaId = null, mode = 'online',
    apiKey, baseURL, model, provider, params, contextMode,
    stream: requestStream = false,
  } = req.body;
  if (!characterId) return res.status(400).json({ error: '缺少 characterId' });

  return await runWithTrace({
    source: 'chat.respond',
    characterId,
    metadata: { personaId, mode, requestStream, contextMode },
  }, async () => {
  try {
    let aiKey = apiKey, aiBase = baseURL, aiModel = model, aiParams = params;
    let aiContextMode = contextMode || 'flexible';
    let presetStream = requestStream;
    let aiPreset = null;

    if (!aiKey) {
      const active    = await activeStore.getObject();
      const primaryId = active?.primaryPresetId ?? active?.activePresetId;
      if (primaryId) {
        const preset = await presetStore.getById(primaryId);
        if (preset) {
          aiPreset = preset;
          aiKey = preset.apiKey; aiBase = preset.baseURL;
          aiModel = preset.model; aiParams = preset.params;
          if (preset.contextMode) aiContextMode = preset.contextMode;
          if (preset.stream !== undefined && !requestStream) presetStream = preset.stream;
        }
      }
    }

    const { messages } = await assembleMessages(characterId, personaId, null, { contextMode: aiContextMode });
    const client = getClient(aiPreset || { apiKey: aiKey, baseURL: aiBase, provider });

    // ── 流式 SSE ──────────────────────────────────────────────────────
    if (presetStream) {
      let clientDisconnected = false;
      req.on('close', () => {
        if (!res.writableEnded) clientDisconnected = true;
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const { stream } = await chatCompletionStream(client, messages, {
        model: aiModel || 'gpt-3.5-turbo',
        temperature: aiParams?.temperature ?? 0.8,
        max_tokens: aiPreset?.maxReplyTokens ?? 3000,
      }, {
        source: 'chat.respond',
        isClientDisconnected: () => clientDisconnected,
      });

      let fullContent = '';
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || '';
          if (delta) {
            fullContent += delta;
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
        }
      } catch (streamErr) {
        res.write(`data: ${JSON.stringify({ error: streamErr.message })}\n\n`);
        res.end();
        return;
      }

      if (!fullContent.trim()) {
        res.write(`data: ${JSON.stringify({ error: '模型返回了空内容，可能被安全策略拦截或参数有误' })}\n\n`);
        res.end();
        return;
      }

      // 提取并移除 <var> 块，保留干净内容
      const { cleanContent: streamClean, varBlock: streamVarBlock } = extractVarBlock(fullContent);

      const aiNow = new Date().toISOString();
      const aiMsg = await messageStore.create({
        id: genId('msg'), charId: characterId, personaId,
        sender: 'character', content: streamClean, mode,
        timestamp: aiNow, userTimestamp: aiNow, charTimestamp: null,
      });

      // 应用变量更新，将快照写回消息
      let streamChangedVars: ReturnType<typeof parseAndApplyVarBlock>['changedVariables'] = [];
      if (streamVarBlock) {
        try {
          const result = parseAndApplyVarBlock(characterId, streamVarBlock);
          streamChangedVars = result.changedVariables;
          await messageStore.update(aiMsg.id, { variableSnapshot: result.snapshot } as any);
        } catch (e) { console.error('[chat/var-block]', e.message); }
      } else {
        traceSummary('variables', 'var.parse.summary', 'no <var> block', {
          reason: 'missing-var-block',
          appliedCount: 0,
          failedLines: 0,
        });
      }

      res.write(`data: ${JSON.stringify({ done: true, id: aiMsg.id, timestamp: aiMsg.timestamp })}\n\n`);
      res.end();
      triggerAutoSummaries(characterId);
      triggerExtraction(characterId).catch(e => console.error('[extraction]', e.message));
      // 事件引擎：先为每个 AI 改动的变量触发 value_change（与 /api/values/.../adjust 路径对称），
      // 再解析结果标签 + 触发 chat_end + 消耗注入轮次
      try {
        for (const change of streamChangedVars) {
          checkAndFireEvents(characterId, {
            trigger: 'value_change',
            changedVariable: change.variableName,
            newValue: change.newValue,
          });
        }
        parseOutcomeFromAIResponse(streamClean);
        checkAndFireEvents(characterId, { trigger: 'chat_end', chatContent: streamClean });
        tickCooldowns(characterId, 'turns');
        consumeInjectionTurns(characterId);
      } catch (e) { console.error('[chat/event-engine]', e.message); }
      return;
    }

    // ── 非流式 ────────────────────────────────────────────────────────
    const aiContent = await chatCompletion(client, messages, {
      model: aiModel || 'gpt-3.5-turbo',
      temperature: aiParams?.temperature ?? 0.8,
      max_tokens: aiPreset?.maxReplyTokens ?? 3000,
    }, {
      source: 'chat.respond',
    });

    // 提取并移除 <var> 块
    const { cleanContent, varBlock } = extractVarBlock(aiContent);

    const aiNow = new Date().toISOString();
    const aiMsg = await messageStore.create({
      id: genId('msg'), charId: characterId, personaId,
      sender: 'character', content: cleanContent, mode,
      timestamp: aiNow, userTimestamp: aiNow, charTimestamp: null,
    });

    // 应用变量更新，将快照写回消息
    let changedVars: ReturnType<typeof parseAndApplyVarBlock>['changedVariables'] = [];
    if (varBlock) {
      try {
        const result = parseAndApplyVarBlock(characterId, varBlock);
        changedVars = result.changedVariables;
        await messageStore.update(aiMsg.id, { variableSnapshot: result.snapshot } as any);
      } catch (e) { console.error('[chat/var-block]', e.message); }
    } else {
      traceSummary('variables', 'var.parse.summary', 'no <var> block', {
        reason: 'missing-var-block',
        appliedCount: 0,
        failedLines: 0,
      });
    }

    triggerAutoSummaries(characterId);
    triggerExtraction(characterId).catch(e => console.error('[extraction]', e.message));
    // 事件引擎：先为每个 AI 改动的变量触发 value_change（与 /api/values/.../adjust 路径对称），
    // 再解析结果标签 + 触发 chat_end + 消耗注入轮次
    try {
      for (const change of changedVars) {
        checkAndFireEvents(characterId, {
          trigger: 'value_change',
          changedVariable: change.variableName,
          newValue: change.newValue,
        });
      }
      parseOutcomeFromAIResponse(cleanContent);
      checkAndFireEvents(characterId, { trigger: 'chat_end', chatContent: cleanContent });
      tickCooldowns(characterId, 'turns');
      consumeInjectionTurns(characterId);
    } catch (e) { console.error('[chat/event-engine]', e.message); }
    res.json({ id: aiMsg.id, sender: 'character', content: cleanContent, mode, timestamp: aiMsg.timestamp });
  } catch (err) {
    traceSummary('route', 'chat.respond.error', err.message, { error: err.message });
    console.error('[chat/respond]', err.message);
    res.status(500).json({ error: err.message });
  }
  });
});

// POST /api/chat  – 主聊天接口（保留兼容旧流程）
router.post('/', async (req, res) => {
  const {
    content, mode = 'online',
    characterId, characterName, characterPersona,
    personaId = null,
    apiKey, baseURL, model, provider, params,
  } = req.body;

  if (!content?.trim()) return res.status(400).json({ error: '消息内容不能为空' });

  try {
    // 解析 AI preset：请求体优先，否则取 active preset
    let aiKey = apiKey, aiBase = baseURL, aiModel = model, aiProvider = provider, aiParams = params;
    if (!aiKey) {
      const active    = await activeStore.getObject();
      const primaryId = active?.primaryPresetId ?? active?.activePresetId;
      if (primaryId) {
        const preset = await presetStore.getById(primaryId);
        if (preset) { aiKey = preset.apiKey; aiBase = preset.baseURL; aiModel = preset.model; aiProvider = preset.provider; aiParams = preset.params; }
      }
    }

    let openAIMessages;

    if (characterId) {
      const assembled = await assembleMessages(characterId, personaId, content.trim());
      openAIMessages  = assembled.messages;
    } else {
      const systemContent = [
        characterName ? `你是${characterName}。` : '你是一个AI助手。',
        characterPersona || '',
      ].filter(Boolean).join('\n');
      openAIMessages = [
        { role: 'system', content: systemContent },
        { role: 'user', content: content.trim() },
      ];
    }

    const client    = getClient({ apiKey: aiKey, baseURL: aiBase, provider: aiProvider });
    const aiContent = await chatCompletion(client, openAIMessages, {
      model: aiModel || 'gpt-3.5-turbo',
      temperature: aiParams?.temperature ?? 0.8,
    }, {
      source: 'chat.legacy',
    });

    const now = new Date().toISOString();

    if (characterId) {
      await messageStore.create({
        id: genId('msg'), charId: characterId, personaId,
        sender: 'user', content: content.trim(), mode,
        timestamp: now, userTimestamp: now, charTimestamp: null,
      });
      const aiNow = new Date().toISOString();
      const aiMsg = await messageStore.create({
        id: genId('msg'), charId: characterId, personaId,
        sender: 'character', content: aiContent, mode,
        timestamp: aiNow, userTimestamp: aiNow, charTimestamp: null,
      });

      // 异步触发自动总结 + 数据提取，不等待
      triggerAutoSummaries(characterId);
      triggerExtraction(characterId).catch(e => console.error('[extraction]', e.message));

      return res.json({ id: aiMsg.id, sender: 'character', content: aiContent, mode, timestamp: aiMsg.timestamp });
    }

    res.json({ id: genId('msg'), sender: 'character', content: aiContent, mode, timestamp: now });
  } catch (err) {
    console.error('[chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/characters/:id/messages
router.get('/characters/:charId/messages', async (req, res) => {
  try {
    const { charId } = req.params;
    const { personaId, limit = 500 } = req.query;
    const msgs = await messageStore.getAll(
      m => m.charId === charId && (!personaId || m.personaId === personaId || !m.personaId)
    );
    const sorted = msgs.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)).slice(-+limit);
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/messages/:id
router.delete('/messages/:id', async (req, res) => {
  try {
    const ok = await messageStore.delete(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/messages/:id
router.put('/messages/:id', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '内容不能为空' });
    const updated = await messageStore.update(req.params.id, { content: content.trim() });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/characters/:id/messages
router.delete('/characters/:charId/messages', async (req, res) => {
  try {
    const { charId } = req.params;
    const { personaId } = req.query;
    const count = await messageStore.deleteMany(
      m => m.charId === charId && (!personaId || m.personaId === personaId)
    );
    res.json({ ok: true, deleted: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
