/**
 * 内置命名空间 smoke test（连真实 db）。
 *
 * 运行：cd server && npx tsx scripts/smoke-builtin-namespaces.ts
 *
 * 用真实数据库里现有的角色 char_legacy_ally 跑一遍占位符解析，
 * 打印结果让人肉眼检查。少数稳定 case 做断言。
 *
 * 阶段 1.3 验收用：确认 6 个 resolver 能正确从真实数据库取值。
 *
 * 注意：建议在 dev server 关闭时运行（避免 WAL 写竞争产生噪音；只读应该无影响）。
 */

import { registerBuiltinNamespaces } from '../services/builtinNamespaces.js';
import { resolvePlaceholders, listRegistered, type ResolveContext } from '../services/placeholders.js';

const TEST_CHAR_ID = 'char_legacy_ally';
const ctx: ResolveContext = { characterId: TEST_CHAR_ID, personaId: null };

function header(t: string): void {
  console.log(`\n${'━'.repeat(60)}\n  ${t}\n${'━'.repeat(60)}`);
}

function check(template: string, expectFn?: (out: string) => true | string): void {
  const out = resolvePlaceholders(template, ctx);
  let status = '   ';
  let note = '';
  if (expectFn) {
    const result = expectFn(out);
    if (result === true) {
      status = '\x1b[32m ✓ \x1b[0m';
    } else {
      status = '\x1b[31m ✗ \x1b[0m';
      note = ` (expected: ${result})`;
      assertionFailures++;
    }
  }
  console.log(`${status} ${template.padEnd(40)} → ${out}${note}`);
}

let assertionFailures = 0;

// ────────────────────────────────────────────────────────────────

console.log('\n[smoke] 注册内置命名空间...');
registerBuiltinNamespaces();

const registered = listRegistered(ctx);
console.log(`[smoke] 已注册 ${registered.length} 个命名空间：${registered.map(r => r.namespace).join(', ')}`);

header('1. char 命名空间');
check('{{char:name}}',        out => out.length > 0 && !out.startsWith('[') || `非空、不是错误标记，实际：${out}`);
check('{{char:core}}');
check('{{char:persona}}');
check('{{char:description}}');
check('{{char:sample}}');
check('{{char:nonexistent}}', out => out === '[未知字段:char:nonexistent]' || `应返回未知字段标记`);

header('2. user 命名空间（personas 表为空，应都返回未知字段）');
check('{{user:name}}',    out => out === '[未知字段:user:name]' || `应返回未知字段（无激活 persona）`);
check('{{user:persona}}', out => out === '[未知字段:user:persona]' || `应返回未知字段`);
check('{{user:badmod}}',  out => out === '[未知字段:user:badmod]' || `应返回未知字段`);

header('3. val 命名空间');
check('{{val:affection}}',         out => /^\d+(\.\d+)?$/.test(out) || `应为数字，实际：${out}`);
check('{{val:affection:name}}',    out => out === '好感度' || `应为"好感度"`);
check('{{val:affection:stage}}',   out => out.length > 0 || `应为非空阶段名`);
check('{{val:affection:desc}}');
check('{{val:affection:prompt}}');
check('{{val:affection:min}}',     out => /^-?\d+(\.\d+)?$/.test(out) || `应为数字`);
check('{{val:affection:max}}',     out => /^\d+(\.\d+)?$/.test(out) || `应为数字`);
check('{{val:mood}}',              out => /^\d+(\.\d+)?$/.test(out) || `应为数字`);
check('{{val:nonexistent}}',       out => out === '[未知字段:val:nonexistent]' || `应未知字段`);
check('{{val:affection:badmod}}',  out => out === '[未知字段:val:affection:badmod]' || `应未知字段`);

header('4. world 命名空间（world_state 表）');
check('{{world:weather}}',     out => out === 'sunny' || `应为'sunny'`);
check('{{world:location}}',    out => out === 'school' || `应为'school'`);
check('{{world:time_period}}', out => out === 'afternoon' || `应为'afternoon'`);
check('{{world:season}}',      out => out === 'spring' || `应为'spring'`);
check('{{world:nonexistent}}', out => out === '[未知字段:world:nonexistent]' || `应未知字段`);

header('5. time 命名空间');
check('{{time:now}}',     out => /\d{4}-\d{2}-\d{2}T/.test(out) || `应为 ISO 时间字符串`);
check('{{time:date}}',    out => /^\d{4}-\d{2}-\d{2}$/.test(out) || `应为 YYYY-MM-DD`);
check('{{time:hour}}',    out => /^\d+$/.test(out) || `应为数字`);
check('{{time:weekday}}', out => /^周[一二三四五六日]$/.test(out) || `应为中文周几`);
check('{{time:year}}',    out => /^\d{4}$/.test(out) || `应为四位年份`);
check('{{time:badident}}', out => out === '[未知字段:time:badident]' || `应未知字段`);

header('6. wb / util 命名空间（占位，无 identifier）');
check('{{wb:active}}',    out => out === '[未知字段:wb:active]' || `应未知字段`);
check('{{util:random}}',  out => out === '[未知字段:util:random]' || `应未知字段`);

header('7. 未注册命名空间');
check('{{xxx:yyy}}', out => out === '[未知命名空间:xxx]' || `应未知命名空间`);

header('8. 混合替换（真实使用场景）');
check('你是{{char:name}}，对用户的好感度是{{val:affection:stage}}（{{val:affection}}）。今天天气{{world:weather}}。');
check('当前时间：{{time:date}} {{time:weekday}} {{time:hour}}时');

header('9. listRegistered 摘要（带 ctx 的动态列表）');
for (const reg of listRegistered(ctx)) {
  console.log(`  ${reg.namespace}:  ${reg.identifiers.length} identifiers`);
  for (const id of reg.identifiers.slice(0, 5)) {
    const mods = id.modifiers ? `  [${id.modifiers.join('|')}]` : '';
    console.log(`    - ${id.identifier}${mods}${id.description ? ` — ${id.description}` : ''}`);
  }
  if (reg.identifiers.length > 5) console.log(`    … 还有 ${reg.identifiers.length - 5} 个`);
}

console.log(`\n${'━'.repeat(60)}`);
if (assertionFailures > 0) {
  console.log(`\x1b[31m断言失败 ${assertionFailures} 项\x1b[0m`);
  process.exit(1);
} else {
  console.log(`\x1b[32m所有断言通过\x1b[0m`);
}
