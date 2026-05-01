/**
 * 大富翁 API — 完整实现
 *
 * 三模式：益智(华尔街征途) / 恋爱(约会之旅) / 十八禁(欲望迷宫)
 * 双AI：主持人(host) + 角色(char)，各自独立预设和上下文
 * 棋盘：图结构（带分叉路径），每格有 SVG 坐标
 * 阶段机：roll → moving → narrative → (choice|special) → chat → turn_end → roll
 */
import { Router } from 'express';
import {
  dafuStore, presetStore, activeStore,
  characterStore,
  timelineStore, messageStore, lifeStore,
} from '../storage/index.js';
import { genId } from '../storage/FileStore.js';
import { getClient, chatCompletion } from '../services/ai.js';
import {
  getActivatedEntries, getAllBooks, getEntriesByBook,
  createBook, createEntry,
} from '../services/worldbook.js';

const router = Router();

// ── 棋盘格子图结构 ──────────────────────────────────────────────────────────
// 路径：起点(0) → 主路 → 分叉点(8) → 内路(9-13)或外路(14-18) → 汇合(19) → 终点(24)
// x,y: SVG 渲染坐标（单位：格，6×9 网格，CELL_W=40）
export const DEFAULT_CELLS = [
  // 底边：起点到分叉
  { id: 0,  name: '起点',     type: 'start',    next: [1],      x: 5, y: 8, price: 0 },
  { id: 1,  name: '邂逅广场', type: 'event',    next: [2],      x: 4, y: 8, price: 0 },
  { id: 2,  name: '机遇',     type: 'chance',   next: [3],      x: 3, y: 8, price: 0 },
  { id: 3,  name: '命运',     type: 'fate',     next: [4],      x: 2, y: 8, price: 0 },
  { id: 4,  name: '咖啡厅',   type: 'property', next: [5],      x: 1, y: 8, price: 120 },
  { id: 5,  name: '左下角',   type: 'corner',   next: [6],      x: 0, y: 8, price: 0 },
  // 左边向上
  { id: 6,  name: '书店',     type: 'property', next: [7],      x: 0, y: 7, price: 150 },
  { id: 7,  name: '公园',     type: 'event',    next: [8],      x: 0, y: 6, price: 0 },
  // 分叉点
  { id: 8,  name: '十字路口', type: 'branch',   next: [9, 14],  x: 0, y: 5, price: 0 },
  // 内路（左侧中间）
  { id: 9,  name: '图书馆',   type: 'property', next: [10],     x: 1, y: 4, price: 120 },
  { id: 10, name: '机遇',     type: 'chance',   next: [11],     x: 2, y: 4, price: 0 },
  { id: 11, name: '车站',     type: 'station',  next: [12],     x: 3, y: 4, price: 0 },
  { id: 12, name: '命运',     type: 'fate',     next: [13],     x: 3, y: 3, price: 0 },
  { id: 13, name: '电影院',   type: 'property', next: [19],     x: 2, y: 3, price: 200 },
  // 外路（经过左上角）
  { id: 14, name: '禁闭所',   type: 'jail',     next: [15],     x: 0, y: 4, price: 0 },
  { id: 15, name: '餐厅',     type: 'property', next: [16],     x: 0, y: 3, price: 180 },
  { id: 16, name: '左上角',   type: 'corner',   next: [17],     x: 0, y: 2, price: 0 },
  { id: 17, name: '游乐场',   type: 'property', next: [18],     x: 1, y: 2, price: 200 },
  { id: 18, name: '商场',     type: 'property', next: [19],     x: 2, y: 2, price: 260 },
  // 汇合点
  { id: 19, name: '广场汇合', type: 'event',    next: [20],     x: 3, y: 2, price: 0 },
  // 顶边向右到终点
  { id: 20, name: '机遇',     type: 'chance',   next: [21],     x: 4, y: 2, price: 0 },
  { id: 21, name: '酒店',     type: 'property', next: [22],     x: 5, y: 2, price: 300 },
  { id: 22, name: '命运',     type: 'fate',     next: [23],     x: 5, y: 3, price: 0 },
  { id: 23, name: '停车场',   type: 'parking',  next: [24],     x: 5, y: 4, price: 0 },
  { id: 24, name: '终点',     type: 'end',      next: [],       x: 5, y: 5, price: 0 },
];

// ── 三模式世界书内容（按格子 id 索引） ───────────────────────────────────────
const WB_CONTENT = {
  '益智': [
    '回到起点获得经费，主持人可抛出一道开场知识小问题，答对有额外奖励。',
    '邂逅广场：两人在城市广场相遇，主持人描述一个商业事件，引出本轮主题。',
    '机遇卡：随机商业机遇，主持人出一道市场判断题，答对获得资金奖励。',
    '命运卡：市场波动，主持人描述一场经济事件，玩家需判断应对策略。',
    '咖啡厅：商务洽谈场景，主持人出一道谈判策略题，成功谈成可获地产分红。',
    '左下角：路口，主持人描述城市一角，稍作休整。',
    '书店：知识积累，主持人出一道文学或科技知识题，答对获学识加成。',
    '公园：户外放松，主持人设计一道自然知识小问，答对有轻松奖励。',
    '十字路口：抉择时刻，主持人描述两条截然不同的商业路线，各有风险与机遇。',
    '图书馆：深度研究，主持人出一道较难的逻辑推理或数学题，答对大奖。',
    '机遇卡：捡到重要商业情报，随机事件，主持人出题判断真假。',
    '车站：转折点，主持人提出一个行业前景判断，玩家各自选择押注。',
    '命运卡：政策变动，主持人描述一项法规，考验玩家对规则的理解。',
    '电影院：创意灵感，主持人出一道创意类开放题，主持根据答案质量给分。',
    '禁闭所：违规处罚，需回答一道合规题才可提前释放，否则停留一轮。',
    '餐厅：商务宴请，主持人出一道礼仪和商务场景题。',
    '左上角：路口，主持人描述城市繁华一隅，稍事休息。',
    '游乐场：轻松娱乐，主持人出一道趣味脑筋急转弯，正确有小奖励。',
    '商场：消费决策，主持人出一道理财计算题，考验资金管理能力。',
    '广场汇合：两条路线在此汇聚，主持人总结各自路线上的商业成就。',
    '机遇卡：最后冲刺阶段的大机遇，随机高风险高回报事件。',
    '酒店：豪华住宿，主持人出一道最终挑战——综合战略决策题，答对重奖。',
    '命运卡：终局命运，主持人安排最后一次随机事件，或奖或惩。',
    '停车场：终点前的最后休整，主持人点评整局策略得失。',
    '终点：旅途结束！主持人进行总结点评，宣布最终成绩。',
  ],
  '恋爱': [
    '回到起点，角色以温柔的微笑和轻声的"又回来了"迎接，氛围温馨甜蜜。',
    '邂逅广场：两人在人群中偶遇，阳光洒落，角色向你伸出手："要一起走吗？"',
    '机遇卡：命运的相遇！主持人安排一个甜蜜的小互动——意外的眼神交流或特别的巧合。',
    '命运卡：命运的考验。可能是一个甜蜜的赌注，或需要两人共同面对的小挑战。',
    '咖啡厅：灯光昏黄的午后，角色托着下巴看着你，低声说了一句意味深长的话。',
    '左下角：路口，夕阳将两人的影子拉得很长，角色问你想去哪里。',
    '书店：两人各自挑了一本书，竟然不约而同选了同一本——这是命中注定的相似。',
    '公园：黄昏漫步，角色指着天上的云问你看到了什么，笑声在空气里散开。',
    '十字路口：角色停下脚步，认真地看着你："左边是热闹，右边是安静，你想去哪边？"',
    '图书馆：安静的图书馆，角色轻轻在你旁边坐下，悄悄夹了一张写字的纸条给你。',
    '机遇卡：命运的礼物！主持人随机安排一个温馨的甜蜜惊喜场景。',
    '车站：等候时，角色站在你身边，轻声说"不管去哪里，只要你在就够了"。',
    '命运卡：命运的转折点。一件意想不到的小事发生，两人的距离悄悄改变。',
    '电影院：黑暗中，角色偷偷侧过头，目光停在你脸上，比屏幕更专注。',
    '禁闭所：因一次小争吵被"关"在一起，必须和解才能继续，和好时的微笑格外珍贵。',
    '餐厅：烛光晚餐，角色精心安排了一个小惊喜，气氛越来越暧昧温柔。',
    '左上角：路口，夜晚的城市灯光闪烁，角色靠近说"这里的夜景只想和你一起看"。',
    '游乐场：角色借口"怕你走丢"握住你的手，一直没有放开，脸上有淡淡的红晕。',
    '商场：角色帮你试搭配，眼神中满是欣赏，轻声说"你穿什么都好看"。',
    '广场汇合：两条路在此相遇，角色看着你走来，眼里有一种特别的光。',
    '机遇卡：最动心的时刻！主持人安排一个让心跳加速的甜蜜场景。',
    '酒店：夜晚的城市在窗外流光溢彩，角色转向你，欲言又止，眼里藏着什么。',
    '命运卡：终局命运——一个关键的浪漫时刻，将决定这段旅途最后的记忆。',
    '停车场：夜晚停在路边，城市灯火点点，两人陷入意味深长的沉默，都不愿先离开。',
    '终点：旅途走到这里，角色握着你的手，轻声说"谢谢你陪我走完这一路"。',
  ],
  '十八禁': [
    '回到起点，角色用一个热情的欢迎拥抱开场，语气里藏着让人心跳加速的期待。',
    '邂逅广场：两人在人群中相遇，角色靠近低声说了一句让你耳根发热的话。',
    '机遇卡：命运转盘！主持人随机安排一个大胆的互动请求，测试两人的默契与胆量。',
    '命运卡：命运的玩笑！主持人给出一个大胆的挑战，完成则奖励丰厚。',
    '咖啡厅：角落里的独处，角色刻意靠近，低声在耳边说了一句令你脸红心跳的话。',
    '左下角：路口，夜晚安静下来，角色的视线落在你身上，带着某种意味。',
    '书店：私密角落，角色拉着你看一本"特别"的书，两人的距离不知不觉越来越近。',
    '公园：夜晚的公园，远离人群，角色主动靠近，月光下气氛越来越暧昧。',
    '十字路口：角色停下，眼神里有些危险的光："你更想往哪边走——刺激的，还是更刺激的？"',
    '禁区入口：越过这里就没有回头路了，角色用询问的眼神看着你，等待你的选择。',
    '机遇卡：命运的大胆礼物！主持人安排一个让人心跳加速的亲密场景。',
    '车站：等车的间隙，角色把你带到了僻静的角落，说有话要悄悄告诉你。',
    '命运卡：氛围升级——一个让理智悄悄松动的关键时刻。',
    '电影院：黑暗的放映厅里，角色开始了一段超越观影的亲密互动。',
    '惩罚格：被单独关押在一起，必须通过完成一个大胆的挑战才能获释。',
    '私密包厢：烛光与美食之外，角色的眼神和动作都在传递着强烈的信号。',
    '左上角：夜晚更深了，角色靠近说"这里只有我们两个人"，语气意味深长。',
    '私密空间：角色拉住你，说"这里有个秘密地方想带你去看"，眼神带着邀请。',
    '试衣间：角色主动走进来，说要帮你"参谋一下"，门在身后悄悄关上。',
    '汇合点：两条路在此相遇，角色看着你，氛围在沉默中悄悄升温。',
    '最后机遇：高风险高回报的最后一次大胆挑战，氛围已经很难控制了。',
    '酒店：门一关上，角色直接说"今晚我们不需要那么多规矩"，眼神专注而直接。',
    '终局命运：最后的命运一掷，将决定今晚以什么方式结束。',
    '停车场：车窗上的哈气越来越浓，两人在黑暗中越来越近。',
    '终点：旅途走到终点，角色用手轻轻托起你的下巴，低声说"终于走到这里了"。',
  ],
};

// ── 机遇/命运事件池（模式通用基础，主持人会在此基础上发挥） ──────────────
const CHANCE_EVENTS = [
  { text: '好运降临，前进2格！', type: 'move', value: 2 },
  { text: '意外收获！', type: 'score', value: 100 },
  { text: '贵人相助，下一次选择可重选！', type: 'item', item: 'reroll' },
  { text: '小小惊喜，加分！', type: 'score', value: 50 },
  { text: '随机传送！前进或后退随机格。', type: 'move', value: null },
];
const FATE_EVENTS = [
  { text: '小小挫折，后退1格。', type: 'move', value: -1 },
  { text: '命运不佳，扣分。', type: 'score', value: -50 },
  { text: '停留一轮，等待下一回合。', type: 'skip', value: 1 },
  { text: '命运翻转——反而变成好事！', type: 'score', value: 80 },
  { text: '随机命运，主持人决定接下来发生什么。', type: 'host_decides', value: 0 },
];

// ── 工具函数 ──────────────────────────────────────────────────────────────
function mkLog(type, playerId, text, meta = {}) {
  return { type, playerId, text, timestamp: new Date().toISOString(), ...meta };
}

async function getActiveGame() {
  const games = await dafuStore.getAll();
  return games.find(g => g.status === 'active') || null;
}

async function getPreset(id) {
  if (!id) {
    // Fall back to primary preset when no specific preset configured
    const active = await activeStore.getObject();
    const fallbackId = active?.primaryPresetId || active?.activePresetId;
    if (!fallbackId) return null;
    return presetStore.getById(fallbackId).catch(() => null);
  }
  return presetStore.getById(id).catch(() => null);
}

/** 获取角色AI需要的完整上下文 */
async function getCharContext(charId) {
  const ctx = { messages: [], worldbook: [], life: null };
  if (!charId) return ctx;
  try {
    // 最近10条真实聊天消息
    const msgs = await messageStore.getAll(m => m.charId === charId);
    ctx.messages = msgs
      .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
      .slice(-10)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    // 世界书激活条目
    ctx.worldbook = await getActivatedEntries(charId, ctx.messages);
    // 最近生活日志
    const life = await lifeStore.getAll(l => l.charId === charId);
    if (life.length > 0) ctx.life = life.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))[0];
  } catch { /* 失败不阻断游戏 */ }
  return ctx;
}

/** 游戏创建时：把世界书内容嵌入格子 */
async function embedWbContent(cells, wbBookId, mode) {
  const fallback = WB_CONTENT[mode] || [];
  if (!wbBookId) return cells.map((c, i) => ({ ...c, wbContent: fallback[i] || '' }));
  try {
    const entries = getEntriesByBook(wbBookId).filter(e => e.enabled);
    return cells.map((c, i) => {
      const keys = [c.name, `格子${c.id}`, String(c.id)];
      const kws = (kw: string) => { try { return JSON.parse(kw) as string[]; } catch { return []; } };
      const match = entries.find(e =>
        keys.includes(e.memo || '') || kws(e.keywords || '[]').some(kw => keys.includes(kw))
      );
      return { ...c, wbContent: match?.content || fallback[i] || '' };
    });
  } catch {
    return cells.map((c, i) => ({ ...c, wbContent: fallback[i] || '' }));
  }
}

// ── 模式配置 ──────────────────────────────────────────────────────────────
const MODE_CONFIG = {
  '益智': {
    title: '华尔街征途',
    hostStyle: '博学幽默，像一位见多识广的商业顾问，时常抛出知识点，对玩家的选择给予专业点评',
    scoreLabel: '资金',
    scoreIcon: 'coin',
    specialCell: 'property', // 策略题触发
    winMetric: '资金最多者胜',
  },
  '恋爱': {
    title: '约会之旅',
    hostStyle: '温柔细腻，像一位浪漫的旁白者，善于捕捉情感互动的微妙瞬间，语气温馨甜蜜',
    scoreLabel: '心动值',
    scoreIcon: 'heart',
    specialCell: 'corner', // 告白点触发
    winMetric: '心动值最高者胜',
  },
  '十八禁': {
    title: '欲望迷宫',
    hostStyle: '大胆撩人，语言充满暧昧张力，善于渲染氛围，描写细节，成人向，尺度随氛围条升高',
    scoreLabel: '氛围值',
    scoreIcon: 'flame',
    specialCell: 'jail', // 惩罚格触发真心话
    winMetric: '氛围值最高者胜',
  },
};

// ── 主持人 AI ─────────────────────────────────────────────────────────────
async function callHostAI(game, preset, eventDesc, options: Record<string, any> = {}) {
  if (!preset) return null;
  const cfg = MODE_CONFIG[game.mode] || MODE_CONFIG['恋爱'];
  const playCtx = game.playType === '线下'
    ? `${game.charName}和${game.userName}面对面在一起玩`
    : `${game.charName}和${game.userName}在线上连麦玩`;
  const cell = game.cells?.find(c => c.id === (options.cellId ?? game.players?.find(p => p.id === game.players[game.currentPlayerIndex]?.id)?.position));
  const wbContent = cell?.wbContent || '';
  const maxTokens = options.maxTokens || 200;

  const system = `你是"${cfg.title}"棋盘游戏的主持人/旁白。
风格：${cfg.hostStyle}
游戏情境：${playCtx}
模式：${game.mode}
${wbContent ? `\n【当前场景】${wbContent}` : ''}

叙事要求：
- 语言沉浸感强，有画面感，符合${game.mode}模式的氛围
- 直接叙述，不要旁白标签和自我介绍
- 结合格子场景文字与刚发生的游戏事件，续写故事
${options.generateChoices
  ? `- 叙事后另起一行生成2-3个选项，格式严格为：【选项】A:选项文字|B:选项文字|C:选项文字
- 选项要有实质差异，能影响故事走向，符合当前场景`
  : `- 用2-4句话描述当前场景与氛围，为玩家铺垫下一步`}`;

  try {
    const history = (game.hostHistory || []).slice(-10);
    const msgs = [{ role: 'system', content: system }, ...history, { role: 'user', content: eventDesc }];
    const client = getClient(preset);
    return await chatCompletion(
      client,
      msgs,
      { model: preset.model, max_tokens: maxTokens, temperature: 0.92 },
      { source: 'dafu.hostNarrative' },
    );
  } catch { return null; }
}

/** 解析主持人输出中的选项 */
function parseChoices(text) {
  if (!text) return { narrative: text, choices: null };
  const idx = text.indexOf('【选项】');
  if (idx === -1) return { narrative: text, choices: null };
  const narrative = text.slice(0, idx).trim();
  const choiceStr = text.slice(idx + 4).trim();
  const choices = choiceStr.split('|').map(s => {
    const m = s.match(/^([A-C])[:：](.+)$/);
    return m ? { key: m[1], text: m[2].trim() } : null;
  }).filter(Boolean);
  return { narrative, choices: choices.length > 0 ? choices : null };
}

// ── 角色 AI ────────────────────────────────────────────────────────────────
async function callCharAI(game, preset, userMsg, charInfo, charCtx: Record<string, any> = {}) {
  if (!preset) return null;
  const cfg = MODE_CONFIG[game.mode] || MODE_CONFIG['恋爱'];
  const uPlayer = game.players.find(p => p.id === 'user');
  const cPlayer = game.players.find(p => p.id === 'char');

  const wbText = (charCtx.worldbook || [])
    .map(e => e.content).filter(Boolean).join('\n');
  const lifeText = charCtx.life
    ? `【近期生活】${charCtx.life.content?.slice(0, 200) || ''}` : '';

  const curCell = game.cells?.find(c => c.id === cPlayer?.position);
  const userCell = game.cells?.find(c => c.id === uPlayer?.position);
  const gameCtx = `【游戏背景】你和${game.userName}正在玩"${cfg.title}"（${game.mode}模式，${game.playType}），第${game.round}轮。你的${cfg.scoreLabel}：${cPlayer?.score ?? 0}，${game.userName}的${cfg.scoreLabel}：${uPlayer?.score ?? 0}。你在「${curCell?.name || '？'}」，${game.userName}在「${userCell?.name || '？'}」。用你的性格自然回应，不要超过3句话。`;
  const sysBase = charInfo?.description || charInfo?.persona || `你是${game.charName}。`;
  const system = [sysBase, wbText, lifeText, gameCtx].filter(Boolean).join('\n');

  try {
    const history = [
      ...(charCtx.messages || []),
      ...(game.charHistory || []),
    ].slice(-16);
    const msgs = [{ role: 'system', content: system }, ...history, { role: 'user', content: userMsg }];
    const client = getClient(preset);
    return await chatCompletion(
      client,
      msgs,
      { model: preset.model, max_tokens: 200, temperature: 0.88 },
      { source: 'dafu.charReply' },
    );
  } catch { return null; }
}

// ── 解析AI是否接受邀请 ──────────────────────────────────────────────────
function parseAcceptance(text) {
  if (!text) return true;
  const refuseWords = ['拒绝', '不想', '不行', '不去', '算了', '没心情', '不要', '不愿', '不参加', '不太想', '不方便', '改天'];
  return !refuseWords.some(w => text.includes(w));
}

// ── 格子效果处理 ──────────────────────────────────────────────────────────
function applyCellEffect(game, player) {
  const cell = game.cells.find(c => c.id === player.position);
  if (!cell) return { updatedPlayers: game.players, extraEffect: null, eventText: '' };

  let scoreDelta = 0;
  let extraEffect = null;
  let eventText = '';
  let updatedPlayers = [...game.players];

  switch (cell.type) {
    case 'start':
      scoreDelta = 200;
      eventText = `经过起点，获得200分！`;
      break;
    case 'chance': {
      const evt = CHANCE_EVENTS[Math.floor(Math.random() * CHANCE_EVENTS.length)];
      eventText = evt.text;
      if (evt.type === 'score') scoreDelta = evt.value;
      else if (evt.type === 'move' && evt.value !== null) extraEffect = { type: 'move_extra', steps: evt.value };
      else if (evt.type === 'item') extraEffect = { type: 'gain_item', item: evt.item };
      break;
    }
    case 'fate': {
      const evt = FATE_EVENTS[Math.floor(Math.random() * FATE_EVENTS.length)];
      eventText = evt.text;
      if (evt.type === 'score') scoreDelta = evt.value;
      else if (evt.type === 'move') extraEffect = { type: 'move_extra', steps: evt.value };
      else if (evt.type === 'skip') extraEffect = { type: 'skip_turn', turns: evt.value };
      break;
    }
    case 'property':
      eventText = `来到「${cell.name}」。`;
      extraEffect = { type: 'property_event', cellId: cell.id, price: cell.price };
      break;
    case 'jail':
      eventText = `进入「${cell.name}」，需要完成挑战才能离开！`;
      extraEffect = { type: 'special_event', eventType: 'jail_challenge' };
      break;
    case 'branch':
      eventText = `来到「${cell.name}」，需要选择前进的方向！`;
      extraEffect = { type: 'branch', options: cell.next };
      break;
    case 'corner':
      eventText = `来到「${cell.name}」，关键时刻！`;
      extraEffect = { type: 'special_event', eventType: 'corner_event' };
      break;
    case 'station':
      eventText = `来到「${cell.name}」，可以快速移动到任意格子！`;
      extraEffect = { type: 'special_event', eventType: 'station_teleport' };
      break;
    case 'parking':
      scoreDelta = 50;
      eventText = `来到「${cell.name}」，安全休息，+50分！`;
      break;
    case 'end':
      scoreDelta = 500;
      eventText = `抵达终点！获得500分奖励，绕回起点继续出发。`;
      break;
    default:
      eventText = `停在「${cell.name}」。`;
  }

  updatedPlayers = updatedPlayers.map(p =>
    p.id === player.id ? { ...p, score: (p.score || 0) + scoreDelta } : p
  );

  if (extraEffect?.type === 'skip_turn') {
    updatedPlayers = updatedPlayers.map(p =>
      p.id === player.id ? { ...p, skipTurns: (p.skipTurns || 0) + extraEffect.turns } : p
    );
  }

  return { updatedPlayers, extraEffect, eventText, scoreDelta };
}

// ── 移动逻辑（图结构，支持分叉） ──────────────────────────────────────────
function moveAlongGraph(cells, fromId, steps, preferredBranch = null) {
  let currentId = fromId;
  let stepsLeft = steps;
  const path = [currentId];
  let branchEncountered = null;

  while (stepsLeft > 0) {
    const cell = cells.find(c => c.id === currentId);
    // 终点格子没有next，绕回起点继续
    const nextOptions = cell?.next?.length > 0 ? cell.next : [0];

    if (nextOptions.length > 1 && cell.type === 'branch') {
      // 遇到分叉
      if (preferredBranch !== null && nextOptions.includes(preferredBranch)) {
        currentId = preferredBranch;
      } else {
        // 需要玩家选择
        branchEncountered = { cellId: currentId, options: nextOptions, stepsLeft: stepsLeft - 1 };
        break;
      }
    } else {
      currentId = nextOptions[0];
    }
    path.push(currentId);
    stepsLeft--;
  }

  return { finalPosition: currentId, path, branchEncountered, stepsLeft };
}

// ── 核心掷骰逻辑 ──────────────────────────────────────────────────────────
async function doRoll(game, playerId, branchChoice = null) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) throw new Error('无效玩家');

  if (player.skipTurns > 0) {
    const updatedPlayers = game.players.map(p =>
      p.id === playerId ? { ...p, skipTurns: p.skipTurns - 1 } : p
    );
    return {
      die1: 1, die2: 0, steps: 0,
      updatedPlayers,
      newLogs: [mkLog('roll', playerId, `${player.name} 被迫跳过本回合（剩余 ${player.skipTurns - 1} 回合）。`)],
      extraEffect: null, waitingFor: 'turn_end',
      hostNarrative: null, choices: null,
      charReaction: null, newHostHistory: game.hostHistory,
      newCharHistory: game.charHistory,
    };
  }

  const die1 = Math.ceil(Math.random() * 6);
  const die2 = Math.ceil(Math.random() * 6);
  const steps = die1 + die2;

  // 移动（图结构）
  const { finalPosition, path, branchEncountered } = moveAlongGraph(
    game.cells, player.position, steps, branchChoice
  );

  // 如果遇到分叉需要选择
  if (branchEncountered) {
    const updatedPlayers = game.players.map(p =>
      p.id === playerId
        ? { ...p, pendingBranch: { dice: [die1, die2], steps, branchInfo: branchEncountered } }
        : p
    );
    const cell = game.cells.find(c => c.id === player.position);
    return {
      die1, die2, steps,
      updatedPlayers,
      newLogs: [mkLog('roll', playerId, `${player.name} 掷出 ${die1}+${die2}=${steps}，来到分叉路口，需要选择方向！`, { dice: [die1, die2] })],
      extraEffect: { type: 'branch', options: branchEncountered.options },
      waitingFor: 'branch_choice',
      hostNarrative: null, choices: null,
      charReaction: null, newHostHistory: game.hostHistory,
      newCharHistory: game.charHistory,
    };
  }

  // 更新位置
  let updatedPlayers = game.players.map(p =>
    p.id === playerId ? { ...p, position: finalPosition, pendingBranch: null } : p
  );
  const cell = game.cells.find(c => c.id === finalPosition);
  const rollText = `${player.name} 掷出 ${die1}+${die2}=${steps}，移动到「${cell?.name || '??'}」。`;
  const newLogs = [mkLog('roll', playerId, rollText, { dice: [die1, die2], position: finalPosition })];

  // 格子效果
  const movedPlayer = updatedPlayers.find(p => p.id === playerId);
  const { updatedPlayers: afterEffect, extraEffect, eventText, scoreDelta } = applyCellEffect(
    { ...game, players: updatedPlayers }, movedPlayer
  );
  if (eventText) newLogs.push(mkLog('event', 'host', eventText, { cellId: finalPosition }));
  updatedPlayers = afterEffect;

  // 主持人 AI
  const hostPreset = await getPreset(game.hostPresetId);
  const needsChoices = extraEffect?.type === 'special_event' || extraEffect?.type === 'property_event';
  const hostResult = await callHostAI(
    { ...game, players: updatedPlayers },
    hostPreset,
    `${rollText} ${eventText}`,
    { cellId: finalPosition, generateChoices: needsChoices, maxTokens: needsChoices ? 350 : 200 }
  );
  const { narrative: hostNarrative, choices } = parseChoices(hostResult);

  let newHostHistory = [...(game.hostHistory || [])];
  if (hostNarrative) {
    newLogs.push(mkLog('narrative', 'host', hostNarrative));
    newHostHistory = [...newHostHistory,
      { role: 'user', content: `${rollText} ${eventText}` },
      { role: 'assistant', content: hostNarrative },
    ].slice(-20);
  }

  // 角色 AI 反应
  let charReaction = null;
  let newCharHistory = [...(game.charHistory || [])];
  const charPreset = await getPreset(game.charPresetId);
  const charInfo = game.charId ? await characterStore.getById(game.charId).catch(() => null) : null;
  const charCtx = await getCharContext(game.charId);

  const charPrompt = playerId === 'char'
    ? `（游戏事件）你刚掷出 ${die1}+${die2}=${steps}，移动到「${cell?.name}」。${eventText} 主持人说：${hostNarrative || ''}。用1-2句话，用你的性格自然地回应这个情况。`
    : `（旁观游戏）${game.userName} 掷出 ${die1}+${die2}=${steps}，移动到「${cell?.name}」。${eventText} 主持人说：${hostNarrative || ''}。用1句话以角色身份自然评论或互动。`;

  charReaction = await callCharAI(
    { ...game, players: updatedPlayers }, charPreset, charPrompt, charInfo, charCtx
  );
  if (charReaction) {
    newLogs.push(mkLog('chat', 'char', charReaction));
    newCharHistory = [...newCharHistory,
      { role: 'user', content: charPrompt },
      { role: 'assistant', content: charReaction },
    ].slice(-20);
  }

  // 确定下一状态
  let waitingFor = 'turn_end';
  if (choices && choices.length > 0) waitingFor = 'choice';
  else if (extraEffect?.type === 'special_event') waitingFor = 'special';

  return {
    die1, die2, steps, finalPosition, path,
    updatedPlayers, newLogs, extraEffect, waitingFor,
    hostNarrative, choices, charReaction,
    newHostHistory, newCharHistory,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// 路由
// ══════════════════════════════════════════════════════════════════════════

// GET /game
router.get('/game', async (req, res) => {
  try { res.json(await getActiveGame()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /game — 创建游戏
router.post('/game', async (req, res) => {
  try {
    const {
      mode = '恋爱', playType = '线上',
      charId, charName = '角色', userName = '我',
      hostPresetId, charPresetId, wbBookId = null,
      maxRounds = 15,
    } = req.body;

    // 清除旧活跃游戏
    const existing = await dafuStore.getAll();
    for (const g of existing.filter(g => g.status === 'active')) await dafuStore.delete(g.id);

    // Auto-find mode-appropriate worldbook if none specified
    let resolvedWbBookId = wbBookId;
    if (!resolvedWbBookId) {
      const allBooks = getAllBooks();
      const modeKeywords = { '益智': '华尔街', '恋爱': '约会之旅', '十八禁': '欲望迷宫' };
      const keyword = modeKeywords[mode] || mode;
      const matchBook = allBooks.find(b => b.enabled && b.name.includes('大富翁') && (b.name.includes(keyword) || b.name.includes(mode)));
      resolvedWbBookId = matchBook?.id || null;
    }
    const cells = await embedWbContent(DEFAULT_CELLS, resolvedWbBookId, mode);
    const cfg = MODE_CONFIG[mode] || MODE_CONFIG['恋爱'];
    const now = new Date().toISOString();
    const logs = [];

    // 开局叙事
    if (playType === '线下') {
      const cPreset = await getPreset(charPresetId);
      const char = charId ? await characterStore.getById(charId).catch(() => null) : null;
      if (cPreset && char) {
        try {
          const sys = char.description || char.persona || `你是${charName}。`;
          const prompt = `（游戏叙事）今天你和${userName}约好一起玩"${cfg.title}"（${mode}模式）。请用1-2句话，用第一人称，自然描述你下班/放学后前往${userName}家里的过程，语气符合你的性格。`;
          const client = getClient(cPreset);
          const narrative = await chatCompletion(client,
            [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
            { model: cPreset.model, max_tokens: 100, temperature: 0.9 },
            { source: 'dafu.openingNarrative' },
          );
          if (narrative) logs.push(mkLog('chat', 'char', narrative));
        } catch { /* 叙事失败不阻断 */ }
      }
      if (!logs.length) logs.push(mkLog('system', 'system', `${charName}来到了${userName}家，准备开始"${cfg.title}"！`));
    } else {
      logs.push(mkLog('system', 'system', `${charName} 上线了！"${cfg.title}"（${mode}模式）开始。`));
    }
    logs.push(mkLog('system', 'system', `游戏开始！${mode}模式 · ${playType} · ${userName}先行。`));

    const game = await dafuStore.create({
      id: genId('dafu'),
      status: 'active',
      mode, playType,
      charId: charId || null, charName, userName,
      hostPresetId: hostPresetId || null,
      charPresetId: charPresetId || null,
      wbBookId,
      cells,
      players: [
        { id: 'user', name: userName, position: 0, score: 0, skipTurns: 0, items: [], color: '#60a5fa' },
        { id: 'char', name: charName, position: 0, score: 0, skipTurns: 0, items: [], color: '#f472b6' },
      ],
      currentPlayerIndex: 0,
      round: 1,
      phase: 'roll',
      waitingFor: 'roll',
      log: logs,
      hostHistory: [],
      charHistory: [],
      maxRounds,
      createdAt: now, updatedAt: now,
    });

    res.status(201).json(game);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /invite — 角色邀请响应
router.post('/invite', async (req, res) => {
  try {
    const { charId, mode = '恋爱', playType = '线上' } = req.body;
    if (!charId) return res.status(400).json({ error: '需要指定角色' });
    const char = await characterStore.getById(charId);
    if (!char) return res.status(404).json({ error: '角色不存在' });

    const active = await activeStore.getObject();
    const presetId = active?.featurePresets?.dafuChar || active?.primaryPresetId;
    const preset = await getPreset(presetId);

    let reply = '好啊，一起来玩吧！';
    let accepted = true;

    if (preset) {
      const cfg = MODE_CONFIG[mode] || MODE_CONFIG['恋爱'];
      const gameDesc = playType === '线下' ? `去你家一起玩"${cfg.title}"` : `线上连麦一起玩"${cfg.title}"`;
      const charCtx = await getCharContext(charId);
      const sys = [
        char.description || char.persona || `你是${char.name}。`,
        ...(charCtx.worldbook || []).map(e => e.content).filter(Boolean),
        charCtx.life ? `【近期生活】${charCtx.life.content?.slice(0, 150)}` : '',
      ].filter(Boolean).join('\n');
      try {
        const client = getClient(preset);
        reply = await chatCompletion(client,
          [...charCtx.messages, { role: 'system', content: sys }, { role: 'user', content: `用户邀请你${gameDesc}（${mode}模式）。用角色的语气自然地回应，要符合你的性格。` }],
          { model: preset.model, max_tokens: 150, temperature: 0.9 },
          { source: 'dafu.inviteReply' },
        );
        accepted = parseAcceptance(reply);
      } catch { /* fallback */ }
    }

    res.json({ reply, accepted, charName: char.name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /game/roll — 用户掷骰
router.post('/game/roll', async (req, res) => {
  try {
    const game = await getActiveGame();
    if (!game) return res.status(404).json({ error: '没有进行中的游戏' });
    if (game.waitingFor !== 'roll') return res.status(400).json({ error: `当前状态：${game.waitingFor}，不可掷骰` });
    const playerId = game.players[game.currentPlayerIndex].id;
    const result = await doRoll(game, playerId);

    const updated = await dafuStore.update(game.id, {
      players: result.updatedPlayers,
      log: [...game.log, ...result.newLogs],
      hostHistory: result.newHostHistory,
      charHistory: result.newCharHistory,
      waitingFor: result.waitingFor,
      phase: result.waitingFor === 'choice' ? 'choice' : result.waitingFor === 'special' ? 'special' : 'narrative',
      currentNarrative: result.hostNarrative,
      currentChoices: result.choices || null,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      game: updated,
      roll: { die1: result.die1, die2: result.die2, steps: result.steps },
      narrative: result.hostNarrative,
      choices: result.choices,
      extraEffect: result.extraEffect,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /game/char-turn — 角色自动回合
router.post('/game/char-turn', async (req, res) => {
  try {
    const game = await getActiveGame();
    if (!game) return res.status(404).json({ error: '没有进行中的游戏' });
    if (game.waitingFor !== 'roll') return res.status(400).json({ error: '当前不是掷骰状态' });
    if (game.players[game.currentPlayerIndex].id !== 'char')
      return res.status(400).json({ error: '当前不是角色的回合' });

    const result = await doRoll(game, 'char');
    let { updatedPlayers, newLogs, waitingFor } = result;

    // 角色在分叉时自动选第一条路
    if (waitingFor === 'branch_choice') {
      const charPlayer = updatedPlayers.find(p => p.id === 'char');
      const branch = charPlayer.pendingBranch;
      if (branch) {
        const reRoll = await doRoll(
          { ...game, players: updatedPlayers },
          'char',
          branch.branchInfo.options[0]
        );
        updatedPlayers = reRoll.updatedPlayers;
        newLogs = [...newLogs, ...reRoll.newLogs];
        waitingFor = reRoll.waitingFor;
      }
    }

    // 角色遇到属性格/特殊格自动处理（给分/跳过，不做复杂决策）
    if (waitingFor === 'choice' || waitingFor === 'special') {
      waitingFor = 'turn_end';
    }

    const updated = await dafuStore.update(game.id, {
      players: updatedPlayers,
      log: [...game.log, ...newLogs],
      hostHistory: result.newHostHistory,
      charHistory: result.newCharHistory,
      waitingFor,
      phase: waitingFor,
      currentNarrative: result.hostNarrative,
      currentChoices: null,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      game: updated,
      roll: { die1: result.die1, die2: result.die2, steps: result.steps },
      narrative: result.hostNarrative,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /game/branch — 玩家选择分叉路
router.post('/game/branch', async (req, res) => {
  try {
    const { chosenCellId } = req.body;
    const game = await getActiveGame();
    if (!game) return res.status(404).json({ error: '没有进行中的游戏' });
    if (game.waitingFor !== 'branch_choice') return res.status(400).json({ error: '当前不是分叉选择状态' });

    const player = game.players[game.currentPlayerIndex];
    const branch = player.pendingBranch;
    if (!branch) return res.status(400).json({ error: '没有待处理的分叉' });

    // 用玩家选择的路继续移动
    const result = await doRoll(
      { ...game, players: game.players.map(p => p.id === player.id ? { ...p, pendingBranch: null } : p) },
      player.id,
      chosenCellId
    );

    const updated = await dafuStore.update(game.id, {
      players: result.updatedPlayers,
      log: [...game.log, ...result.newLogs],
      hostHistory: result.newHostHistory,
      charHistory: result.newCharHistory,
      waitingFor: result.waitingFor,
      phase: result.waitingFor,
      currentNarrative: result.hostNarrative,
      currentChoices: result.choices || null,
      updatedAt: new Date().toISOString(),
    });

    res.json({ game: updated, narrative: result.hostNarrative, choices: result.choices });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /game/choice — 玩家做出选项选择
router.post('/game/choice', async (req, res) => {
  try {
    const { choiceKey, choiceText } = req.body;
    const game = await getActiveGame();
    if (!game) return res.status(404).json({ error: '没有进行中的游戏' });
    if (game.waitingFor !== 'choice') return res.status(400).json({ error: '当前不是选择状态' });

    const player = game.players[game.currentPlayerIndex];
    const newLogs = [mkLog('chat', player.id, `选择了：${choiceText || choiceKey}`)];

    // 主持人根据选择继续叙事
    const hostPreset = await getPreset(game.hostPresetId);
    const followUp = await callHostAI(game, hostPreset,
      `玩家${player.name}选择了选项${choiceKey}：${choiceText}。请继续叙述后续发展和结果。`,
      { cellId: player.position, generateChoices: false, maxTokens: 200 }
    );
    if (followUp) newLogs.push(mkLog('narrative', 'host', followUp));

    // 根据选择给予分数奖励（简单规则：A通常最优，C通常最保守）
    const scoreBonus = choiceKey === 'A' ? 80 : choiceKey === 'B' ? 50 : 20;
    const updatedPlayers = game.players.map(p =>
      p.id === player.id ? { ...p, score: (p.score || 0) + scoreBonus } : p
    );
    if (scoreBonus > 0) newLogs.push(mkLog('event', 'host', `选择奖励 +${scoreBonus}分！`));

    const newHostHistory = [...(game.hostHistory || []),
      { role: 'user', content: `玩家${player.name}选择：${choiceText}` },
      { role: 'assistant', content: followUp || '' },
    ].slice(-20);

    const updated = await dafuStore.update(game.id, {
      players: updatedPlayers,
      log: [...game.log, ...newLogs],
      hostHistory: newHostHistory,
      waitingFor: 'turn_end',
      phase: 'chat',
      currentChoices: null,
      updatedAt: new Date().toISOString(),
    });

    res.json({ game: updated, followUp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /game/chat — 游戏内聊天
router.post('/game/chat', async (req, res) => {
  try {
    const game = await getActiveGame();
    if (!game) return res.status(404).json({ error: '没有进行中的游戏' });
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: '消息不能为空' });

    const newLogs = [mkLog('chat', 'user', message.trim())];
    const charPreset = await getPreset(game.charPresetId);
    const charInfo = game.charId ? await characterStore.getById(game.charId).catch(() => null) : null;
    const charCtx = await getCharContext(game.charId);
    const charReply = await callCharAI(game, charPreset, message.trim(), charInfo, charCtx);

    const newCharHistory = [...(game.charHistory || []),
      { role: 'user', content: message.trim() },
    ];
    if (charReply) {
      newLogs.push(mkLog('chat', 'char', charReply));
      newCharHistory.push({ role: 'assistant', content: charReply });
    }

    const updated = await dafuStore.update(game.id, {
      log: [...game.log, ...newLogs],
      charHistory: newCharHistory.slice(-20),
      updatedAt: new Date().toISOString(),
    });
    res.json({ game: updated, charReply });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /game/end-turn — 结束当前回合
router.post('/game/end-turn', async (req, res) => {
  try {
    const game = await getActiveGame();
    if (!game) return res.status(404).json({ error: '没有进行中的游戏' });
    if (!['turn_end', 'chat', 'narrative', 'special'].includes(game.waitingFor))
      return res.status(400).json({ error: `当前状态：${game.waitingFor}` });

    const nextIndex = (game.currentPlayerIndex + 1) % game.players.length;
    const nextRound = nextIndex === 0 ? game.round + 1 : game.round;

    // 游戏结束条件：超过最大回合数
    const isOver = nextRound > (game.maxRounds || 15);
    // TODO: 胜者判定逻辑未实现，占位声明
    const endPlayer: any = undefined;

    const updated = await dafuStore.update(game.id, {
      currentPlayerIndex: nextIndex,
      round: nextRound,
      waitingFor: isOver ? 'game_end' : 'roll',
      phase: isOver ? 'game_end' : 'roll',
      currentNarrative: null,
      currentChoices: null,
      updatedAt: new Date().toISOString(),
    });
    res.json({ game: updated, gameOver: isOver, winner: endPlayer?.id || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /game/end — 结束游戏并归档
router.post('/game/end', async (req, res) => {
  try {
    const game = await getActiveGame();
    if (!game) return res.status(404).json({ error: '没有进行中的游戏' });

    const now = new Date().toISOString();
    const userP = game.players.find(p => p.id === 'user');
    const charP = game.players.find(p => p.id === 'char');
    const winner = (userP?.score || 0) >= (charP?.score || 0) ? 'user' : 'char';

    const archived = await dafuStore.update(game.id, {
      status: 'completed',
      completedAt: now, updatedAt: now, winner,
      finalScore: { user: userP?.score || 0, char: charP?.score || 0 },
    });

    // 角色时间线记录
    if (game.charId) {
      try {
        const cfg = MODE_CONFIG[game.mode] || {};
        const winnerName = winner === 'user' ? game.userName : game.charName;
        await timelineStore.create({
          id: genId('tl'), charId: game.charId,
          title: `与${game.userName}玩了"${cfg.title || '棋盘游戏'}"（${game.mode}·${game.playType}）`,
          content: `${winnerName}获胜。${game.userName}：${userP?.score || 0}分，${game.charName}：${charP?.score || 0}分。共${game.round}轮。`,
          type: 'event',
          timestamp: game.createdAt,
          linkedItemIds: [],
        });
      } catch { /* 失败不影响主流程 */ }
    }

    res.json(archived);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /records
router.get('/records', async (req, res) => {
  try {
    const all = await dafuStore.getAll();
    res.json(all.filter(g => g.status === 'completed')
      .sort((a, b) => +new Date(b.completedAt || b.createdAt) - +new Date(a.completedAt || a.createdAt)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/records/:id', async (req, res) => {
  try {
    const r = await dafuStore.getById(req.params.id);
    if (!r || r.status !== 'completed') return res.status(404).json({ error: 'Not found' });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /init-worldbooks — 初始化三套测试世界书
router.post('/init-worldbooks', async (req, res) => {
  try {
    const books = getAllBooks();
    const BOOK_DEFS = [
      { name: '大富翁·华尔街征途（益智）', mode: '益智' },
      { name: '大富翁·约会之旅（恋爱）', mode: '恋爱' },
      { name: '大富翁·欲望迷宫（十八禁）', mode: '十八禁' },
    ];
    const results = [];
    for (const def of BOOK_DEFS) {
      const existing = books.find(b => b.name === def.name);
      if (existing) { results.push({ book: existing, created: false }); continue; }
      const book = createBook({
        name: def.name,
        description: `${def.mode}模式专用棋盘格子内容`,
      });
      const content = WB_CONTENT[def.mode] || [];
      for (let i = 0; i < DEFAULT_CELLS.length; i++) {
        const cell = DEFAULT_CELLS[i];
        createEntry(book.id, {
          memo: `${cell.name}(格子${cell.id})`,
          content: content[i] || `${cell.name}格子事件`,
          keywords: JSON.stringify([cell.name, `格子${cell.id}`, String(cell.id)]),
          strategy: 'keyword',
          enabled: 1,
          orderNum: cell.id,
          position: 'system-bottom',
          noRecurse: 0,
          noFurtherRecurse: 1,
        } as any);
      }
      results.push({ book, created: true });
    }
    res.json({
      results,
      message: `完成：${results.filter(r => r.created).length} 本新建，${results.filter(r => !r.created).length} 本已存在`,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET/PUT /config
router.get('/config', async (req, res) => {
  try {
    const active = await activeStore.getObject();
    const fp = active?.featurePresets || {};
    res.json({ hostPresetId: fp.dafuHost || null, charPresetId: fp.dafuChar || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/config', async (req, res) => {
  try {
    const { hostPresetId, charPresetId } = req.body;
    const active = await activeStore.getObject();
    await activeStore.setObject({
      ...active,
      featurePresets: {
        ...(active.featurePresets || {}),
        dafuHost: hostPresetId ?? active?.featurePresets?.dafuHost ?? null,
        dafuChar: charPresetId ?? active?.featurePresets?.dafuChar ?? null,
      },
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
