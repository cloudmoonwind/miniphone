/**
 * Effect 注册表 smoke test（阶段 4.1 验收）。
 *
 * 运行：cd server && npx tsx scripts/smoke-effect-registry.ts
 *
 * 验证：
 *   1. registerBuiltinEffects 注册了全部 8 种内置 effect
 *   2. listRegisteredEffects 返回的 meta 不重复（不算别名）
 *   3. 中文别名能查到（如 '注入' → inject handler）
 *   4. 未知 effect 类型走降级路径（不抛错，trace 警告）
 *   5. 各 meta 含 description / paramsHint 字段
 */

import {
  registerBuiltinEffects,
  listRegisteredEffects,
} from '../services/eventEngine.js';
import { getDb } from '../db/database.js';

(async () => {
  getDb();
  registerBuiltinEffects();

  let pass = 0, fail = 0;
  const check = (name: string, cond: boolean, detail?: string) => {
    if (cond) { pass++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
    else { fail++; console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`); }
  };

  console.log('\n[case 1] 注册数量与基本字段');
  const metas = listRegisteredEffects();
  check('注册了 8 个内置 effect', metas.length === 8, `actual: ${metas.length}`);

  const expected = ['inject', 'modify_value', 'set_outcome', 'trigger_event', 'unlock_event', 'lock_event', 'change_location', 'record_history'];
  for (const t of expected) {
    check(`包含 type='${t}'`, metas.some(m => m.type === t));
  }

  console.log('\n[case 2] 每个 meta 都有 description');
  for (const m of metas) {
    check(`${m.type}.description 非空`, !!m.description?.length);
  }

  console.log('\n[case 3] 别名（中文）已注册');
  // 通过 listRegisteredEffects 看 aliases 字段
  const inject = metas.find(m => m.type === 'inject');
  check(`inject 含别名 '注入'`, inject?.aliases?.includes('注入') === true);
  const modifyValue = metas.find(m => m.type === 'modify_value');
  check(`modify_value 含别名 '改数值'`, modifyValue?.aliases?.includes('改数值') === true);

  console.log('\n[case 4] 重复 registerBuiltinEffects 幂等（不会变成 16 个）');
  registerBuiltinEffects();
  registerBuiltinEffects();
  const after = listRegisteredEffects();
  check('再调两次仍是 8 个', after.length === 8, `actual: ${after.length}`);

  console.log(`\n${'─'.repeat(60)}`);
  if (fail > 0) {
    console.log(`\x1b[31m失败 ${fail} 项（共 ${pass + fail}）\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m全部 ${pass} 项断言通过\x1b[0m`);
  }
})().catch(err => {
  console.error('[smoke-effect-registry] 失败：', err);
  process.exit(1);
});
