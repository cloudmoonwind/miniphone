/**
 * 占位符解析器 self-test
 *
 * 运行：cd server && npx tsx scripts/test-placeholders.ts
 *
 * 不依赖测试框架。每条 case 自校验，最后打印通过/失败汇总。
 */

import {
  registerNamespace,
  resolvePlaceholders,
  listRegistered,
  __clearRegistry,
  type Resolver,
} from '../services/placeholders.js';

interface TestCase {
  name: string;
  run: () => void;
}

const cases: TestCase[] = [];

function defineTest(name: string, run: () => void): void {
  cases.push({ name, run });
}

function assertEq(actual: unknown, expected: unknown, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg ?? 'assertion failed'}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

function assertThrows(fn: () => void, msgPart?: string): void {
  let threw = false;
  let actualMsg = '';
  try {
    fn();
  } catch (err: any) {
    threw = true;
    actualMsg = err?.message ?? String(err);
  }
  if (!threw) throw new Error(`expected throw, but did not throw`);
  if (msgPart && !actualMsg.includes(msgPart)) {
    throw new Error(`expected throw message containing "${msgPart}", got: "${actualMsg}"`);
  }
}

const ctx = { characterId: 'char_test', personaId: null };

// ── 测试用 fixture resolver ──────────────────────────────────────

const valValues: Record<string, { current: number; stage: string; desc: string }> = {
  affection: { current: 65, stage: '朋友', desc: '态度温和' },
  sanity: { current: 50, stage: '清醒', desc: '理性正常' },
};

const valResolver: Resolver = (id, mod) => {
  const v = valValues[id];
  if (!v) return null;
  if (!mod) return String(v.current);
  if (mod === 'stage') return v.stage;
  if (mod === 'desc') return v.desc;
  return null;
};

const charResolver: Resolver = (id) => {
  if (id === 'name') return '小明';
  if (id === 'core') return '一个普通学生';
  return null;
};

const throwingResolver: Resolver = () => {
  throw new Error('resolver crashed');
};

// ── 测试 case ─────────────────────────────────────────────────────

defineTest('1. 单变量替换', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => []);
  const out = resolvePlaceholders('好感度: {{val:affection}}', ctx);
  assertEq(out, '好感度: 65');
});

defineTest('2. 三段式 modifier', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => []);
  const out = resolvePlaceholders('阶段是 {{val:affection:stage}}', ctx);
  assertEq(out, '阶段是 朋友');
});

defineTest('3. 多个混合替换（跨命名空间）', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => []);
  registerNamespace('char', charResolver, () => []);
  const out = resolvePlaceholders('{{char:name}}的好感度是{{val:affection}}', ctx);
  assertEq(out, '小明的好感度是65');
});

defineTest('4. 同变量重复出现', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => []);
  const out = resolvePlaceholders('{{val:affection}}-{{val:affection}}', ctx);
  assertEq(out, '65-65');
});

defineTest('5. 未注册命名空间', () => {
  __clearRegistry();
  const out = resolvePlaceholders('{{xxx:yyy}}', ctx);
  assertEq(out, '[未知命名空间:xxx]');
});

defineTest('6. 已注册命名空间但未知 identifier', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => []);
  const out = resolvePlaceholders('{{val:notexist}}', ctx);
  assertEq(out, '[未知字段:val:notexist]');
});

defineTest('7. 已注册 identifier 但未知 modifier', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => []);
  const out = resolvePlaceholders('{{val:affection:badmod}}', ctx);
  assertEq(out, '[未知字段:val:affection:badmod]');
});

defineTest('8. resolver 抛异常时降级标记', () => {
  __clearRegistry();
  registerNamespace('boom', throwingResolver, () => []);
  const out = resolvePlaceholders('{{boom:anything}}', ctx);
  assertEq(out, '[解析错误:boom:anything]');
});

defineTest('9. 一个错误不影响其他变量', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => []);
  registerNamespace('boom', throwingResolver, () => []);
  const out = resolvePlaceholders('{{val:affection}}/{{boom:x}}/{{val:sanity}}', ctx);
  assertEq(out, '65/[解析错误:boom:x]/50');
});

defineTest('10. 空模板原样返回', () => {
  __clearRegistry();
  assertEq(resolvePlaceholders('', ctx), '');
});

defineTest('11. 无占位符的纯文本', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => []);
  const out = resolvePlaceholders('这是一段普通文本，没有任何占位符。', ctx);
  assertEq(out, '这是一段普通文本，没有任何占位符。');
});

defineTest('12. 不完整的占位符（缺冒号）原样保留', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => []);
  // 裸名 {{user}} 不应被解析 —— 设计原则：禁止裸名
  const out = resolvePlaceholders('{{user}} 不会被解析', ctx);
  assertEq(out, '{{user}} 不会被解析');
});

defineTest('13. 单大括号原样保留', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => []);
  const out = resolvePlaceholders('{val:affection} 单括号也不解析', ctx);
  assertEq(out, '{val:affection} 单括号也不解析');
});

defineTest('14. resolver 返回空字符串视为成功', () => {
  __clearRegistry();
  registerNamespace('emp', () => '', () => []);
  const out = resolvePlaceholders('前[{{emp:x}}]后', ctx);
  assertEq(out, '前[]后');
});

defineTest('15. resolver 返回 null/undefined 视为未知字段', () => {
  __clearRegistry();
  registerNamespace('null', () => null, () => []);
  registerNamespace('und', () => undefined, () => []);
  assertEq(resolvePlaceholders('{{null:x}}', ctx), '[未知字段:null:x]');
  assertEq(resolvePlaceholders('{{und:x}}', ctx), '[未知字段:und:x]');
});

defineTest('16. 命名空间名不合法时注册抛错', () => {
  __clearRegistry();
  assertThrows(() => registerNamespace('Bad-Name', valResolver, () => []), 'invalid namespace');
  assertThrows(() => registerNamespace('1bad', valResolver, () => []), 'invalid namespace');
  assertThrows(() => registerNamespace('', valResolver, () => []), 'invalid namespace');
});

defineTest('17. 同名重复注册覆盖（启动钩子幂等）', () => {
  __clearRegistry();
  registerNamespace('val', () => 'first', () => []);
  registerNamespace('val', () => 'second', () => []);
  assertEq(resolvePlaceholders('{{val:x}}', ctx), 'second');
});

defineTest('18. listRegistered 返回正确结构', () => {
  __clearRegistry();
  registerNamespace('val', valResolver, () => [
    { identifier: 'affection', description: '好感度', modifiers: ['stage', 'desc'] },
  ]);
  registerNamespace('char', charResolver, () => [
    { identifier: 'name' },
    { identifier: 'core' },
  ]);
  const list = listRegistered();
  assertEq(list.length, 2);
  const valEntry = list.find(x => x.namespace === 'val')!;
  assertEq(valEntry.identifiers.length, 1);
  assertEq(valEntry.identifiers[0].identifier, 'affection');
  assertEq(valEntry.identifiers[0].modifiers, ['stage', 'desc']);
});

defineTest('19. listRegistered list() 抛异常时降级为空数组', () => {
  __clearRegistry();
  registerNamespace('boom', valResolver, () => { throw new Error('list crashed'); });
  const list = listRegistered();
  assertEq(list.length, 1);
  assertEq(list[0].identifiers, []);
});

defineTest('20. resolver 收到的 ctx 完整透传', () => {
  __clearRegistry();
  let captured: any = null;
  registerNamespace('cap', (_id, _mod, c) => { captured = c; return 'x'; }, () => []);
  resolvePlaceholders('{{cap:y}}', { characterId: 'C1', personaId: 'P1', messageId: 'M1' });
  assertEq(captured, { characterId: 'C1', personaId: 'P1', messageId: 'M1' });
});

// ── 运行 ──────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures: Array<{ name: string; error: string }> = [];

console.log(`\n占位符解析器 self-test (${cases.length} cases)\n${'─'.repeat(50)}`);

for (const c of cases) {
  try {
    c.run();
    pass++;
    console.log(`  ✓  ${c.name}`);
  } catch (err: any) {
    fail++;
    const msg = err?.message ?? String(err);
    failures.push({ name: c.name, error: msg });
    console.log(`  ✗  ${c.name}`);
    for (const line of msg.split('\n')) console.log(`       ${line}`);
  }
}

console.log(`${'─'.repeat(50)}`);
console.log(`通过 ${pass} / ${cases.length}，失败 ${fail}`);

if (fail > 0) {
  process.exit(1);
}
