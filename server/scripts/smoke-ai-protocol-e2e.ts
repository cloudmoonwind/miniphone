/**
 * AI 协议端到端 smoke test（阶段 2.6 验收）。
 *
 * 运行：cd server && npx tsx scripts/smoke-ai-protocol-e2e.ts
 *
 * 走完整链路：parseAIOutput → applyVarBlock，验证：
 *   1. <sys> 块从 cleanContent 中正确移除
 *   2. varUpdates 解析正确
 *   3. applyVarBlock 真实更新数据库 character_values 表
 *   4. snapshot 含 emotion_state
 *   5. 测试结束自动回滚（恢复 affection 初始值）
 *
 * 对 events 子块只做解析层验证（不真实调 applyEventOutcomes，因为需要预先准备测试事件）。
 */

import { parseAIOutput } from '../services/aiProtocol.js';
import { applyVarBlock, getValueByVariable, updateValue } from '../services/values.js';
import { getDb } from '../db/database.js';

const TEST_CHAR_ID = 'char_legacy_ally';

(async () => {
  getDb(); // 触发 migration

  console.log(`[e2e] 测试角色: ${TEST_CHAR_ID}`);

  // ── 步骤 0: 记录初始状态 ─────────────────────────────────────
  const beforeAffection = getValueByVariable(TEST_CHAR_ID, 'affection');
  if (!beforeAffection) {
    console.error('  ✗ 测试角色没有 affection 变量');
    process.exit(1);
  }
  const initialValue = beforeAffection.currentValue;
  console.log(`  → 初始 affection = ${initialValue}`);

  // ── 步骤 1: 构造模拟 AI 输出 ─────────────────────────────────
  // 注意：旧值必须等于当前 db 里的 initialValue
  const newAffection = Math.min(initialValue + 5, beforeAffection.maxValue);
  const aiOutput = `这是给用户看的正文内容。

<sys>
<var>
affection: ${initialValue}→${newAffection} | 原因: e2e smoke 测试
情绪: 测试情绪A 60% | 测试情绪B 40%
</var>
<event>
evt_e2e_dummy: success | 原因: 测试用，不会真触发（事件不存在）
</event>
</sys>`;

  // ── 步骤 2: parseAIOutput ─────────────────────────────────
  const parsed = parseAIOutput(aiOutput);

  let pass = 0, fail = 0;
  function check(name: string, cond: boolean, detail?: string): void {
    if (cond) {
      pass++;
      console.log(`  \x1b[32m✓\x1b[0m ${name}`);
    } else {
      fail++;
      console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`);
    }
  }

  console.log('\n[parseAIOutput 解析结果验证]');
  check('cleanContent 不含 <sys>', !parsed.cleanContent.includes('<sys>'),
    `actual: "${parsed.cleanContent}"`);
  check('cleanContent 保留正文', parsed.cleanContent.includes('这是给用户看的正文内容'));
  check('diagnostics.sysBlockFound = true', parsed.diagnostics.sysBlockFound);
  check('diagnostics.varBlockFound = true', parsed.diagnostics.varBlockFound);
  check('diagnostics.eventBlockFound = true', parsed.diagnostics.eventBlockFound);
  check('varUpdates 长度 = 1', parsed.varUpdates.length === 1, `actual: ${parsed.varUpdates.length}`);
  check('varUpdates[0].variableName = affection', parsed.varUpdates[0]?.variableName === 'affection');
  check(`varUpdates[0].oldValue = ${initialValue}`, parsed.varUpdates[0]?.oldValue === initialValue);
  check(`varUpdates[0].newValue = ${newAffection}`, parsed.varUpdates[0]?.newValue === newAffection);
  check('varUpdates[0].reason 命中', parsed.varUpdates[0]?.reason === 'e2e smoke 测试');
  check('emotion 非 null', parsed.emotion != null);
  check('emotion.parts 长度 = 2', parsed.emotion?.parts.length === 2);
  check('events 长度 = 1', parsed.events.length === 1);
  check('events[0].eventId = evt_e2e_dummy', parsed.events[0]?.eventId === 'evt_e2e_dummy');

  // ── 步骤 3: applyVarBlock ─────────────────────────────────
  console.log('\n[applyVarBlock 应用层验证]');
  const result = applyVarBlock(TEST_CHAR_ID, parsed.varUpdates, parsed.emotion);

  check('changedVariables 长度 = 1', result.changedVariables.length === 1);
  check('changedVariables[0].newValue 正确',
    result.changedVariables[0]?.newValue === newAffection);
  check('emotionState 不为 null', result.emotionState != null);
  check('snapshot.affection 已更新',
    result.snapshot.affection === newAffection,
    `snapshot.affection=${result.snapshot.affection}`);
  check('snapshot.emotion_state 含测试情绪',
    String(result.snapshot.emotion_state).includes('测试情绪A'));

  // ── 步骤 4: 验证数据库真的被更新 ─────────────────────────────
  console.log('\n[数据库实际更新验证]');
  const afterAffection = getValueByVariable(TEST_CHAR_ID, 'affection');
  check(`db.affection.currentValue = ${newAffection}`,
    afterAffection?.currentValue === newAffection,
    `actual: ${afterAffection?.currentValue}`);

  // ── 步骤 5: 回滚 ─────────────────────────────────────────────
  console.log('\n[回滚]');
  updateValue(beforeAffection.id, { currentValue: initialValue });
  const rolledBack = getValueByVariable(TEST_CHAR_ID, 'affection');
  check(`db.affection 已恢复为 ${initialValue}`,
    rolledBack?.currentValue === initialValue);

  // ── 汇总 ────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  if (fail > 0) {
    console.log(`\x1b[31m断言失败 ${fail} 项（共 ${pass + fail}）\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m全部 ${pass} 项断言通过\x1b[0m`);
  }
})().catch(err => {
  console.error('[e2e] 失败：', err);
  process.exit(1);
});
