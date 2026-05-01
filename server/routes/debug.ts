import { Router } from 'express';
import {
  characterStore, charStatStore, itemStore, timelineStore,
  skillStore, relationStore, activeStore,
} from '../storage/index.js';
import { genId } from '../storage/FileStore.js';
import { seedValueEventData } from '../services/seed.js';
import { listDates, readByDate, deleteByDate, deleteEntryById } from '../services/aiLogStore.js';
import {
  listTraceDates, readTracesByDate, deleteTracesByDate, deleteTraceById,
} from '../services/traceStore.js';

const router = Router();

function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// GET /api/debug/ai-log?date=YYYY-MM-DD  — 不带 date 默认取今天
router.get('/ai-log', async (req, res) => {
  const date = (req.query.date as string) || todayKey();
  const entries = await readByDate(date);
  // 最新在前，与旧接口语义一致
  res.json(entries.slice().reverse());
});

// GET /api/debug/ai-log/dates — 倒序的可用日期列表
router.get('/ai-log/dates', async (_req, res) => {
  res.json(await listDates());
});

// DELETE /api/debug/ai-log?date=YYYY-MM-DD  — 不带 date 默认删今天
router.delete('/ai-log', async (req, res) => {
  const date = (req.query.date as string) || todayKey();
  const ok = await deleteByDate(date);
  res.json({ ok });
});

// DELETE /api/debug/ai-log/:id?date=YYYY-MM-DD — 删除指定日期内的一条日志
router.delete('/ai-log/:id', async (req, res) => {
  const date = (req.query.date as string) || todayKey();
  const ok = await deleteEntryById(date, req.params.id);
  res.json({ ok });
});

// GET /api/debug/traces?date=YYYY-MM-DD — 不带 date 默认取今天
router.get('/traces', async (req, res) => {
  const date = (req.query.date as string) || todayKey();
  const entries = await readTracesByDate(date);
  res.json(entries.slice().reverse());
});

// GET /api/debug/traces/dates — 倒序的可用日期列表
router.get('/traces/dates', async (_req, res) => {
  res.json(await listTraceDates());
});

// DELETE /api/debug/traces?date=YYYY-MM-DD — 删除指定日期 trace
router.delete('/traces', async (req, res) => {
  const date = (req.query.date as string) || todayKey();
  const ok = await deleteTracesByDate(date);
  res.json({ ok });
});

// DELETE /api/debug/traces/:id?date=YYYY-MM-DD — 删除单条 trace
router.delete('/traces/:id', async (req, res) => {
  const date = (req.query.date as string) || todayKey();
  const ok = await deleteTraceById(date, req.params.id);
  res.json({ ok });
});

/* ═══════════════════════════════════════════════════════════════════════
 * POST /api/debug/seed/:charId — 为角色注入演示数据
 *
 * 生成：状态、时间线、物品、技能、关系，让原型有血有肉。
 * 已有数据不会被覆盖（幂等：跳过已存在的同名条目）。
 * ═══════════════════════════════════════════════════════════════════ */
router.post('/seed/:charId', async (req, res) => {
  try {
    const { charId } = req.params;
    const char = await characterStore.getById(charId);
    if (!char) return res.status(404).json({ error: '角色不存在' });

    const now = new Date();
    const ts = (daysAgo, h = 14) => {
      const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(h, 0, 0, 0);
      return d.toISOString();
    };
    const charName = char.name;

    const results = { stats: false, timeline: 0, items: 0, skills: 0, relations: 0 };

    // ── 角色状态 ──
    const existingStats = (await charStatStore.getAll(s => s.charId === charId))[0];
    if (!existingStats?.statusInfo?.moodColors?.length) {
      const statusInfo = {
        moodColors: ['#818cf8', '#f472b6'],
        location: '街角的咖啡店',
        outfit: '米白色针织衫，黑色长裤',
        statusDesc: '窗边的位置，翻着一本读了一半的书。偶尔抬头看看窗外。',
        innerThoughts: '今天的拿铁比昨天好喝一点…大概是心情的关系吧。',
        lastUpdated: ts(0, 10),
      };
      const stats = {
        mood: 72, energy: 65, relationship: 58, trust: 45, stress: 30,
      };
      if (existingStats) {
        await charStatStore.update(existingStats.id, { statusInfo, stats: { ...existingStats.stats, ...stats } });
      } else {
        await charStatStore.create({
          id: genId('cs'), charId, stats, statusInfo, createdAt: ts(0),
        });
      }
      results.stats = true;
    }

    // ── 时间线 ──
    const existingTL = await timelineStore.getAll(t => t.charId === charId);
    const seedTimeline = [
      {
        title: '初次见面', content: '在一个平凡的下午，命运安排了这场相遇。虽然只是简短的对话，但某种微妙的感觉留了下来。',
        type: 'milestone', timestamp: ts(30, 15), linkedItemIds: [], linkedEventId: null,
      },
      {
        title: '雨天的伞', content: '突然下起了雨，正好只有一把伞。一起走过的那段路，比想象中短了很多。',
        type: 'event', timestamp: ts(22, 18), linkedItemIds: [], linkedEventId: null,
      },
      {
        title: '深夜的长对话', content: '聊到凌晨三点，从星座聊到人生意义。那晚说出了一些平时不会说的话。',
        type: 'chat', timestamp: ts(14, 23), linkedItemIds: [], linkedEventId: null,
      },
      {
        title: '收到了一份礼物', content: '一个小小的钥匙扣，上面刻着一个只有两个人懂的暗号。',
        type: 'item', timestamp: ts(7, 16), linkedItemIds: [], linkedEventId: null,
      },
      {
        title: '一起看了日落', content: '天台上，橘红色的光把一切都染上了暖色。没有说太多话，但那种安静很舒服。',
        type: 'event', timestamp: ts(3, 17), linkedItemIds: [], linkedEventId: null,
      },
      {
        title: '学会了做蛋糕', content: '虽然第一次做出来的形状有点歪，但味道意外地不错。约好了下次再做一个更好的。',
        type: 'milestone', timestamp: ts(1, 14), linkedItemIds: [], linkedEventId: null,
      },
    ];
    for (const ev of seedTimeline) {
      if (existingTL.some(t => t.title === ev.title)) continue;
      await timelineStore.create({ id: genId('tl'), charId, ...ev, extractedSource: 'seed' });
      results.timeline++;
    }

    // ── 物品 ──
    const existingItems = await itemStore.getAll(i => i.charId === charId);
    const seedItems = [
      {
        name: '星星钥匙扣', emoji: '🗝️', description: '银色的钥匙扣，上面有一颗小星星。是很重要的东西。',
        category: 'keepsake',
        source: { type: 'gift', from: '你', occasion: '没什么特别的日子，但记得很清楚' },
        emotionalValue: 92, condition: 85, status: 'active', location: '总是带在身上',
        characterNotes: '每次看到它都会想起那天的阳光。', obtainedAt: ts(7, 16),
      },
      {
        name: '半读完的书', emoji: '📖', description: '《小王子》，书页间夹着一片干燥的银杏叶。',
        category: 'other',
        source: { type: 'bought', from: '路过的旧书店' },
        emotionalValue: 60, condition: 70, status: 'active', location: '包里',
        characterNotes: '那片叶子是散步时捡的。', obtainedAt: ts(20, 11),
      },
      {
        name: '手织围巾', emoji: '🧣', description: '淡蓝色的围巾，有些地方针脚不太整齐。',
        category: 'clothing',
        source: { type: 'crafted', from: '自己', occasion: '冬天想做点什么' },
        emotionalValue: 75, condition: 90, status: 'stored', location: '衣柜第二层',
        characterNotes: '织了三个晚上。虽然不完美但很暖和。', obtainedAt: ts(45, 20),
      },
      {
        name: '碎掉的杯子', emoji: '☕', description: '只剩下碎片了。曾经是最喜欢的马克杯。',
        category: 'keepsake',
        source: { type: 'gift', from: '某个重要的人' },
        emotionalValue: 40, condition: 5, status: 'stored', location: '抽屉深处',
        characterNotes: '舍不得扔掉。', obtainedAt: ts(90, 12),
      },
    ];
    for (const item of seedItems) {
      if (existingItems.some(i => i.name === item.name)) continue;
      await itemStore.create({
        id: genId('item'), charId, ...item,
        linkedTimelineIds: [], extractedSource: 'seed',
      });
      results.items++;
    }

    // ── 技能 ──
    const existingSkills = await skillStore.getAll(s => s.charId === charId);
    const seedSkills = [
      { name: '聆听', category: 'emotion', level: 3, experience: 5, description: '善于倾听他人的心声' },
      { name: '烘焙', category: 'life', level: 2, experience: 3, description: '能做出像样的蛋糕了' },
      { name: '写作', category: 'work', level: 4, experience: 7, description: '文字有温度' },
      { name: '察言观色', category: 'emotion', level: 2, experience: 2.5, description: '能感知到微妙的情绪变化' },
      { name: '料理', category: 'life', level: 1, experience: 1, description: '至少不会烧厨房了' },
      { name: '绘画', category: 'work', level: 1, experience: 0.5, description: '刚开始学的涂鸦' },
    ];
    for (const sk of seedSkills) {
      if (existingSkills.some(s => s.name === sk.name)) continue;
      await skillStore.create({
        id: genId('sk'), charId, ...sk, extractedSource: 'seed',
      });
      results.skills++;
    }

    // ── 关系 ──
    const existingRels = await relationStore.getAll(r => r.charId === charId);
    // 同组角色
    const allChars = await characterStore.getAll();
    const groupChars = allChars.filter(c => c.id !== charId && c.group && c.group === char.group);

    const seedRelations = [
      {
        targetName: '你', targetEmoji: '💙', type: 'friend', closeness: 62,
        notes: '很重要的人。虽然有时候不太会表达，但一直都在。',
      },
    ];
    // 同组角色自动加入
    for (const gc of groupChars.slice(0, 3)) {
      seedRelations.push({
        targetName: gc.name, targetEmoji: gc.avatar || '👤',
        type: 'colleague', closeness: 30 + Math.floor(Math.random() * 25),
        notes: `认识但不算太熟。偶尔会打个招呼。`,
      });
    }

    for (const rel of seedRelations) {
      if (existingRels.some(r => r.targetName === rel.targetName)) continue;
      await relationStore.create({
        id: genId('rel'), charId, ...rel, extractedSource: 'seed',
      });
      results.relations++;
    }

    res.json({ ok: true, charId, charName, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════════
 * POST /api/debug/seed-values/:charId — 为角色注入新数值/事件系统示例数据
 *
 * 生成：5 个数值（含阶段+规则）、6 个事件（含标签+连接）、5 条世界状态。
 * 幂等：已有数据不会被覆盖。
 * ═══════════════════════════════════════════════════════════════════ */
router.post('/seed-values/:charId', async (req, res) => {
  try {
    const { charId } = req.params;
    const char = await characterStore.getById(charId);
    if (!char) return res.status(404).json({ error: '角色不存在' });

    const result = seedValueEventData(charId);
    res.json({ ok: true, charId, charName: char.name, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/debug/char-system-settings — 获取角色系统设置
router.get('/char-system-settings', async (_req, res) => {
  const active = await activeStore.getObject();
  res.json({
    extractionEnabled: false,
    summaryToTimelineEnabled: true,
    statEventsEnabled: true,
    lifeToTimelineEnabled: true,
    ...(active?.charSystemSettings || {}),
    // 同时返回专用预设信息
    charSystemPresetId: active?.featurePresets?.charSystem || null,
  });
});

// PUT /api/debug/char-system-settings — 更新角色系统设置
router.put('/char-system-settings', async (req, res) => {
  const active = await activeStore.getObject();
  const { charSystemPresetId, ...settings } = req.body;
  const updated = {
    ...active,
    charSystemSettings: { ...(active?.charSystemSettings || {}), ...settings },
  };
  // 如果提供了预设 ID，更新 featurePresets
  if (charSystemPresetId !== undefined) {
    updated.featurePresets = { ...(updated.featurePresets || {}), charSystem: charSystemPresetId };
  }
  await activeStore.setObject(updated);
  res.json({
    ...updated.charSystemSettings,
    charSystemPresetId: updated.featurePresets?.charSystem || null,
  });
});

export default router;
