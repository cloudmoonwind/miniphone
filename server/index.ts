import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import { getDb } from './db/database.js';
import { seedAllCharacters } from './services/seed.js';
import { registerBuiltinNamespaces } from './services/builtinNamespaces.js';
import { listRegistered } from './services/placeholders.js';

import sessionsRouter    from './routes/sessions.js';
import charactersRouter  from './routes/characters.js';
import chatRouter        from './routes/chat.js';
import settingsRouter    from './routes/settings.js';
import memoriesRouter    from './routes/memories.js';
import summariesRouter   from './routes/summaries.js';
import dreamsRouter      from './routes/dreams.js';
import { dreamStore }   from './storage/index.js';
import mapsRouter        from './routes/maps.js';
import lifeRouter        from './routes/life.js';
import debugRouter       from './routes/debug.js';
import promptsRouter     from './routes/prompts.js';
import worldbookRouter   from './routes/worldbook.js';
import charStatsRouter   from './routes/charstats.js';
import personasRouter    from './routes/personas.js';
import diaryRouter       from './routes/diary.js';
import itemsRouter       from './routes/items.js';
import timelineRouter    from './routes/timeline.js';
import skillsRouter      from './routes/skills.js';
import relationsRouter   from './routes/relations.js';
import suixiangRouter    from './routes/suixiang.js';
import calendarRouter    from './routes/calendar.js';
import dafuRouter        from './routes/dafu.js';
import valuesRouter      from './routes/values.js';
import eventsRouter, { injectionsRouter, eventBooksRouter } from './routes/events.js';
import worldstateRouter  from './routes/worldstate.js';
import capabilitiesRouter from './routes/capabilities.js';
import { checkAndFireEvents, tickCooldowns, registerBuiltinEffects } from './services/eventEngine.js';
import { registerTriggerListener, dispatchTrigger } from './services/triggerBus.js';
import { purgeOlderThan as purgeAiLogs } from './services/aiLogStore.js';
import { purgeOlderThan as purgeTraceLogs } from './services/traceStore.js';

const PORT = 3000;
const app  = express();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// ── Routes ──────────────────────────────────────────────────────────────
app.use('/api/characters',                   charactersRouter);
app.use('/api/chat',                         chatRouter);
app.use('/api/settings',                     settingsRouter);

// Backward-compat aliases (old client calls /api/models, /api/test-connection)
app.use('/api/models',          (req, res, next) => { req.url = '/models';          settingsRouter(req, res, next); });
app.use('/api/test-connection', (req, res, next) => { req.url = '/test-connection'; settingsRouter(req, res, next); });

// GET /api/dreams — 所有角色梦境（全局聚合，max 100 条，按时间倒序）
app.get('/api/dreams', async (req, res) => {
  try {
    const all = await dreamStore.getAll();
    res.json(all.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)).slice(0, 100));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Character-scoped sub-resources
app.use('/api/characters/:charId/memories',  memoriesRouter);
app.use('/api/characters/:charId/summaries', summariesRouter);
app.use('/api/characters/:charId/dreams',    dreamsRouter);
app.use('/api/characters/:charId/life',      lifeRouter);

// Chat sub-routes for messages (GET/DELETE /api/characters/:charId/messages)
app.use('/api',                              chatRouter);

app.use('/api/maps',                         mapsRouter);
app.use('/api/debug',                        debugRouter);
app.use('/api/prompt',                       promptsRouter);
app.use('/api/worldbook',                    worldbookRouter);
app.use('/api/charstats',                    charStatsRouter);
app.use('/api/personas',                     personasRouter);
app.use('/api/diary',                        diaryRouter);
app.use('/api/characters/:charId/sessions',  sessionsRouter);
app.use('/api/characters/:charId/items',     itemsRouter);
app.use('/api/characters/:charId/timeline',  timelineRouter);
app.use('/api/characters/:charId/skills',    skillsRouter);
app.use('/api/characters/:charId/relations', relationsRouter);
app.use('/api/suixiang',                     suixiangRouter);
app.use('/api/calendar',                     calendarRouter);
app.use('/api/dafu',                         dafuRouter);
app.use('/api/values',                       valuesRouter);
app.use('/api/event-books',                  eventBooksRouter);
app.use('/api/events',                       eventsRouter);
app.use('/api/injections',                   injectionsRouter);
app.use('/api/worldstate',                   worldstateRouter);
app.use('/api/capabilities',                 capabilitiesRouter);

// ── Error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

// ── 启动 ────────────────────────────────────────────────────────────────
(async () => {
  // getDb() 内部会自动运行 drizzle migrations
  getDb();

  // 占位符变量管道：注册所有内置命名空间
  registerBuiltinNamespaces();
  console.log(`[ICS server] 已注册命名空间: ${listRegistered().map(r => r.namespace).join(', ')}`);

  // 事件系统：注册所有内置 effect 类型
  registerBuiltinEffects();

  // Trigger 总线：把 eventEngine.checkAndFireEvents 注册为唯一 listener
  // 未来后处理规则系统等成为消费者时，直接 registerTriggerListener 即可
  registerTriggerListener(checkAndFireEvents);

  // 为所有角色注入数值/事件种子数据（幂等，已有则跳过）
  try {
    await seedAllCharacters();
  } catch (err: any) {
    console.error('[ICS server] 种子数据注入失败:', err.message);
  }

  // 清理超过保留期的 AI 调用日志（默认 3 天，可用 AI_LOG_RETENTION_DAYS 调整）
  purgeAiLogs().catch(err => console.error('[ICS server] AI 日志清理失败:', err.message));
  purgeTraceLogs().catch(err => console.error('[ICS server] Trace 日志清理失败:', err.message));

  app.listen(PORT, () => {
    console.log(`[ICS server] listening on http://localhost:${PORT}`);
  });

  // ── 时间流逝定时器（time_pass_hourly / time_pass_daily）──────────────────
  function getActiveCharIds(): string[] {
    try {
      return (getDb().prepare('SELECT DISTINCT character_id FROM character_values').all() as { character_id: string }[])
        .map(r => r.character_id);
    } catch { return []; }
  }

  // 每小时触发：time_pass_hourly
  const HOUR_MS = 60 * 60 * 1000;
  setInterval(() => {
    const charIds = getActiveCharIds();
    for (const charId of charIds) {
      try {
        dispatchTrigger(charId, { trigger: 'time_pass_hourly' });
      } catch (e: any) { console.error('[time_pass_hourly]', charId, e.message); }
    }
    if (charIds.length) console.log('[time_pass_hourly] checked', charIds.length, 'characters');
  }, HOUR_MS);

  // 每天触发：time_pass_daily（每24小时）
  const DAY_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    const charIds = getActiveCharIds();
    for (const charId of charIds) {
      try {
        dispatchTrigger(charId, { trigger: 'time_pass_daily' });
        tickCooldowns(charId, 'days');
      } catch (e: any) { console.error('[time_pass_daily]', charId, e.message); }
    }
    if (charIds.length) console.log('[time_pass_daily] checked', charIds.length, 'characters');
  }, DAY_MS);
})();
