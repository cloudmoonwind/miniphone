import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import charactersRouter  from './routes/characters.js';
import chatRouter        from './routes/chat.js';
import settingsRouter    from './routes/settings.js';
import memoriesRouter    from './routes/memories.js';
import summariesRouter   from './routes/summaries.js';
import dreamsRouter      from './routes/dreams.js';
import mapsRouter        from './routes/maps.js';
import lifeRouter        from './routes/life.js';
import debugRouter       from './routes/debug.js';
import promptsRouter     from './routes/prompts.js';
import worldbookRouter   from './routes/worldbook.js';
import charStatsRouter   from './routes/charstats.js';
import personasRouter    from './routes/personas.js';
import diaryRouter       from './routes/diary.js';

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
// charstats/defs 作为独立路径暴露（charstats 路由内部已处理 /defs）

// ── Error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`[ICS server] listening on http://localhost:${PORT}`);
});
