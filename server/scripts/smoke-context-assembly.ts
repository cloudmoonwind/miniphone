/**
 * 上下文组装 smoke test（阶段 1.4 验收）。
 *
 * 运行：cd server && npx tsx scripts/smoke-context-assembly.ts
 *
 * 调用 assembleMessages 用真实数据库里现有的角色组装一次完整 prompt，
 * 打印每条 message 的角色 + 摘要，便于肉眼检查：
 *   1. 占位符是否被新解析器替换
 *   2. sys-variables 槽是否保留原样（不被错误解析）
 *   3. 各槽位是否都正常
 *
 * 注意：这是 read-only smoke test，不写入任何数据。
 */

import { registerBuiltinNamespaces } from '../services/builtinNamespaces.js';
import { assembleMessages } from '../services/context.js';
import { getDb } from '../db/database.js';

const TEST_CHAR_ID = 'char_legacy_ally';

(async () => {
  // 触发 db migration（与 server 启动同样的预热）
  getDb();
  registerBuiltinNamespaces();

  console.log(`[smoke-context] 组装上下文：char=${TEST_CHAR_ID}`);

  // 在 char.core 字段临时塞个占位符做 e2e 测试是不行的（会写库）。
  // 改为：直接在新用户消息里塞一个 prompt，让 history 末尾追加，看是否能跑完整路径。
  const newUserMsg = '现在好感度是 {{val:affection}}（{{val:affection:stage}}），天气{{world:weather}}。';
  // 注意：newUserContent 不会过 placeholder 解析（设计：用户输入不解析）。
  // 这个字段只是观察末尾 user 消息是否如实写入。

  const { messages } = await assembleMessages(TEST_CHAR_ID, null, newUserMsg, { contextMode: 'flexible' });

  console.log(`\n共 ${messages.length} 条 messages：\n${'━'.repeat(60)}`);

  let hasPlaceholderLeak = false;
  let hasResolvedToken  = false;

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const preview = m.content.length > 200
      ? m.content.slice(0, 100) + ' …… ' + m.content.slice(-80)
      : m.content;
    console.log(`[${String(i).padStart(2, '0')}] ${m.role.padEnd(9)} (${m.content.length} chars)`);
    for (const line of preview.split('\n').slice(0, 5)) {
      console.log(`     ${line.length > 100 ? line.slice(0, 100) + '…' : line}`);
    }
    if (preview.split('\n').length > 5) console.log(`     ... +${preview.split('\n').length - 5} 行`);

    // 检测：除了最后一条新用户消息（含原始占位符故意保留），不应有未解析的 {{val/char/user/world/...}}
    if (i < messages.length - 1) {
      const namespacedPlaceholder = m.content.match(/\{\{(?:val|char|user|world|wb|time|util|mode|evt|mem|preset):[^}]+\}\}/);
      if (namespacedPlaceholder) {
        console.log(`     \x1b[33m! 检测到未解析占位符: ${namespacedPlaceholder[0]}\x1b[0m`);
        hasPlaceholderLeak = true;
      }
    }
    // 检测：是否有任何已解析迹象（找几个稳定特征）
    if (m.content.includes('艾莉') || m.content.includes('好感度')) hasResolvedToken = true;
  }

  console.log('━'.repeat(60));
  console.log('\n结果：');
  console.log(`  - 总 messages 数：${messages.length}`);
  console.log(`  - 检测到已解析特征（角色名"艾莉"或变量名"好感度"）：${hasResolvedToken ? '\x1b[32m是\x1b[0m' : '\x1b[33m否（可能 char-core/desc 槽未启用）\x1b[0m'}`);
  console.log(`  - 占位符泄漏（除新用户消息外）：${hasPlaceholderLeak ? '\x1b[31m是 ✗\x1b[0m' : '\x1b[32m否 ✓\x1b[0m'}`);

  // 单独打印最后一条 user 消息，确认它是原样保留（用户输入不解析）
  const lastUser = messages[messages.length - 1];
  if (lastUser?.role === 'user') {
    console.log(`\n最后一条 user 消息（应保留原始占位符——用户输入不解析）：`);
    console.log(`  "${lastUser.content}"`);
    if (lastUser.content === newUserMsg) {
      console.log('  \x1b[32m✓ 原样保留\x1b[0m');
    } else {
      console.log('  \x1b[33m! 内容被改动\x1b[0m');
    }
  }

  process.exit(hasPlaceholderLeak ? 1 : 0);
})().catch(err => {
  console.error('[smoke-context] 失败：', err);
  process.exit(1);
});
