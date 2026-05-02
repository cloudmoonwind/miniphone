/**
 * ConversationMode 端到端 smoke test（阶段 3.6 验收）。
 *
 * 运行：cd server && npx tsx scripts/smoke-mode-switch.ts
 *
 * 验证：
 *   1. assembleMessages 接收 mode 参数后，sys-mode 槽注入对应模板
 *   2. 切换 online ↔ offline，prompt 中的模板段确实变了
 *   3. 缺失 mode（mode='dream' 但 sys-mode content 没配 dream）不报错，跳过
 *   4. {{mode:name}} 占位符在槽内被正确替换为当前 mode
 *
 * 不写库（只读取上下文组装结果），无回滚负担。
 */

import { registerBuiltinNamespaces } from '../services/builtinNamespaces.js';
import { assembleMessages } from '../services/context.js';
import { getDb } from '../db/database.js';

const TEST_CHAR_ID = 'char_legacy_ally';

(async () => {
  getDb();
  registerBuiltinNamespaces();

  let pass = 0, fail = 0;
  const check = (name: string, cond: boolean, detail?: string) => {
    if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
    else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
  };

  // 找到 sys-mode 内容（默认值在 DEFAULT_CONTEXT_ITEMS）
  // 用任何角色组装，sys-mode 槽 content 在默认配置中预填了 online/offline 模板
  const ONLINE_KEYWORD  = '聊天气泡';
  const OFFLINE_KEYWORD = '长文叙事';

  // ── case 1: mode='online' ─────────────────────────────────
  console.log('\n[case 1] mode=online');
  const r1 = await assembleMessages(TEST_CHAR_ID, null, null, { mode: 'online' });
  const allText1 = r1.messages.map(m => m.content).join('\n');
  check('注入了 online 模板（含"聊天气泡"）', allText1.includes(ONLINE_KEYWORD));
  check('未注入 offline 模板', !allText1.includes(OFFLINE_KEYWORD));

  // ── case 2: mode='offline' ────────────────────────────────
  console.log('\n[case 2] mode=offline');
  const r2 = await assembleMessages(TEST_CHAR_ID, null, null, { mode: 'offline' });
  const allText2 = r2.messages.map(m => m.content).join('\n');
  check('注入了 offline 模板（含"长文叙事"）', allText2.includes(OFFLINE_KEYWORD));
  check('未注入 online 模板', !allText2.includes(ONLINE_KEYWORD));

  // ── case 3: mode 切换确实让 prompt 变了 ──────────────────
  console.log('\n[case 3] online vs offline 不同');
  check('online 与 offline 组装结果不同', allText1 !== allText2);

  // ── case 4: mode='dream' （未配置） ─────────────────────────
  console.log('\n[case 4] mode=dream（默认配置无此 mode）');
  const r4 = await assembleMessages(TEST_CHAR_ID, null, null, { mode: 'dream' });
  const allText4 = r4.messages.map(m => m.content).join('\n');
  check('未注入任何 mode 模板（无 online/offline 关键词）',
    !allText4.includes(ONLINE_KEYWORD) && !allText4.includes(OFFLINE_KEYWORD));
  check('其他槽位仍正常组装（含角色名"艾莉"）', allText4.includes('艾莉'));

  // ── case 5: 不传 mode ─────────────────────────────────────
  console.log('\n[case 5] 不传 mode 参数');
  const r5 = await assembleMessages(TEST_CHAR_ID, null, null, {});
  const allText5 = r5.messages.map(m => m.content).join('\n');
  check('未注入任何 mode 模板',
    !allText5.includes(ONLINE_KEYWORD) && !allText5.includes(OFFLINE_KEYWORD));

  // ── case 6: {{mode:name}} 占位符被正确替换 ────────────────
  console.log('\n[case 6] {{mode:name}} 命名空间求值');
  // 目前 sys-mode 槽 content 是默认 JSON 没用 {{mode:name}}，但 wb-pre 等其他槽如果作者写了应该能替换
  // 这里手动构造测试（不动数据库）：通过 placeholders 直接调用
  const { resolvePlaceholders } = await import('../services/placeholders.js');
  const resolvedOnline = resolvePlaceholders(
    '当前模式: {{mode:name}}',
    { characterId: TEST_CHAR_ID, mode: 'online' }
  );
  check('{{mode:name}} 正确求值为 "online"',
    resolvedOnline === '当前模式: online',
    `actual: "${resolvedOnline}"`);
  const resolvedOffline = resolvePlaceholders(
    '模式={{mode:name}}',
    { characterId: TEST_CHAR_ID, mode: 'offline' }
  );
  check('切换 mode 后求值跟着变',
    resolvedOffline === '模式=offline',
    `actual: "${resolvedOffline}"`);
  const resolvedNoMode = resolvePlaceholders(
    '模式={{mode:name}}',
    { characterId: TEST_CHAR_ID }
  );
  check('无 mode 时返回 [未知字段:...]',
    resolvedNoMode.includes('[未知字段:mode:name]'),
    `actual: "${resolvedNoMode}"`);

  console.log(`\n${'─'.repeat(60)}`);
  if (fail > 0) {
    console.log(`\x1b[31m断言失败 ${fail} 项（共 ${pass + fail}）\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m全部 ${pass} 项断言通过\x1b[0m`);
  }
})().catch(err => {
  console.error('[smoke-mode] 失败：', err);
  process.exit(1);
});
