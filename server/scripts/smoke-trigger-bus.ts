/**
 * Trigger 总线 smoke test（阶段 4.2 验收）。
 *
 * 运行：cd server && npx tsx scripts/smoke-trigger-bus.ts
 *
 * 验证：
 *   1. registerTriggerListener / dispatchTrigger 基本工作
 *   2. 多个 listener 都能收到同一次 dispatch
 *   3. 单个 listener 抛错不阻塞其他 listener
 *   4. listKnownTriggerTypes 返回非空
 */

import {
  __clearTriggerListeners,
  registerTriggerListener,
  dispatchTrigger,
  getListenerCount,
  listKnownTriggerTypes,
  type TriggerListener,
} from '../services/triggerBus.js';

(async () => {
  let pass = 0, fail = 0;
  const check = (name: string, cond: boolean, detail?: string) => {
    if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
    else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
  };

  console.log('\n[case 1] 单 listener 收到 dispatch');
  __clearTriggerListeners();
  const calls1: any[] = [];
  const lis1: TriggerListener = (charId, ctx) => calls1.push({ charId, ctx });
  registerTriggerListener(lis1);
  check('listenerCount=1', getListenerCount() === 1);

  dispatchTrigger('char_x', { trigger: 'chat_end', chatContent: 'test' });
  check('单次 dispatch 收到 1 次', calls1.length === 1);
  check('charId 正确透传', calls1[0]?.charId === 'char_x');
  check('ctx.trigger 正确透传', calls1[0]?.ctx?.trigger === 'chat_end');

  console.log('\n[case 2] 重复注册同 listener 不会变 2');
  __clearTriggerListeners();
  registerTriggerListener(lis1);
  registerTriggerListener(lis1);
  check('listenerCount=1（去重）', getListenerCount() === 1);

  console.log('\n[case 3] 多 listener 都收到');
  __clearTriggerListeners();
  const a: any[] = [];
  const b: any[] = [];
  const c: any[] = [];
  registerTriggerListener((cid, ctx) => a.push(ctx.trigger));
  registerTriggerListener((cid, ctx) => b.push(ctx.trigger));
  registerTriggerListener((cid, ctx) => c.push(ctx.trigger));
  dispatchTrigger('char_y', { trigger: 'value_change', changedVariable: 'affection', newValue: 50 });
  check('listener a 收到', a[0] === 'value_change');
  check('listener b 收到', b[0] === 'value_change');
  check('listener c 收到', c[0] === 'value_change');

  console.log('\n[case 4] 单个 listener 抛错不阻塞其他');
  __clearTriggerListeners();
  const got: string[] = [];
  registerTriggerListener(() => { throw new Error('boom'); });
  registerTriggerListener((cid, ctx) => got.push(ctx.trigger));
  registerTriggerListener((cid, ctx) => got.push(ctx.trigger + '/2'));
  // 静默 console.error
  const orig = console.error;
  console.error = () => {};
  dispatchTrigger('char_z', { trigger: 'chat_end' });
  console.error = orig;
  check('错误后两个其他 listener 仍收到', got.length === 2);
  check('结果列表正确', got[0] === 'chat_end' && got[1] === 'chat_end/2');

  console.log('\n[case 5] listKnownTriggerTypes 返回非空');
  const known = listKnownTriggerTypes();
  check('已知 trigger 数量 ≥ 8', known.length >= 8, `actual: ${known.length}`);
  check('含 chat_end', known.some(t => t.type === 'chat_end'));
  check('含 value_change', known.some(t => t.type === 'value_change'));
  check('每个 trigger 有 description', known.every(t => !!t.description));

  // 清理：不污染下次测试
  __clearTriggerListeners();

  console.log(`\n${'─'.repeat(60)}`);
  if (fail > 0) {
    console.log(`\x1b[31m失败 ${fail} 项（共 ${pass + fail}）\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m全部 ${pass} 项断言通过\x1b[0m`);
  }
})().catch(err => {
  console.error('[smoke-trigger-bus] 失败：', err);
  process.exit(1);
});
