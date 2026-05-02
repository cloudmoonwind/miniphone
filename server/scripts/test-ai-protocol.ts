/**
 * AI 协议解析器 self-test。
 *
 * 运行：cd server && npx tsx scripts/test-ai-protocol.ts
 *
 * 覆盖：标准格式 / 缺 <sys> / 未闭合 / 大小写飘移 / 元数据 / 失败降级 等
 */

import { parseAIOutput } from '../services/aiProtocol.js';

interface TestCase {
  name: string;
  run: () => void;
}

const cases: TestCase[] = [];
function defineTest(name: string, run: () => void): void { cases.push({ name, run }); }

function assertEq(actual: unknown, expected: unknown, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ?? 'assertion failed'}\n  expected: ${e}\n  actual:   ${a}`);
}

// ── 测试 ─────────────────────────────────────────────────────

defineTest('1. 完全无 <sys> 块时返回原文不变', () => {
  const out = parseAIOutput('这是一段普通对话。\n没有任何协议块。');
  assertEq(out.cleanContent, '这是一段普通对话。\n没有任何协议块。');
  assertEq(out.varUpdates, []);
  assertEq(out.events, []);
  assertEq(out.emotion, null);
  assertEq(out.diagnostics.sysBlockFound, false);
});

defineTest('2. 标准 <sys> 块解析', () => {
  const input = `角色回复正文。

<sys>
<var>
affection: 30→35
sanity: 50→48
</var>
<event>
evt_confession: success
</event>
</sys>`;
  const out = parseAIOutput(input);
  assertEq(out.cleanContent, '角色回复正文。');
  assertEq(out.varUpdates.length, 2);
  assertEq(out.varUpdates[0], { variableName: 'affection', oldValue: 30, newValue: 35 });
  assertEq(out.varUpdates[1], { variableName: 'sanity', oldValue: 50, newValue: 48 });
  assertEq(out.events.length, 1);
  assertEq(out.events[0], { eventId: 'evt_confession', outcome: 'success' });
});

defineTest('3. 数值行带 | 原因: 元数据', () => {
  const input = `<sys><var>
affection: 30→35 | 原因: 用户主动分享了童年回忆
</var></sys>`;
  const out = parseAIOutput(input);
  assertEq(out.varUpdates[0], {
    variableName: 'affection',
    oldValue: 30,
    newValue: 35,
    reason: '用户主动分享了童年回忆',
  });
});

defineTest('4. 情绪行解析（百分比之和=100）', () => {
  const input = `<sys><var>
情绪: 温暖 50% | 紧张 30% | 怀念 20%
</var></sys>`;
  const out = parseAIOutput(input);
  assertEq(out.emotion, {
    raw: '温暖 50% | 紧张 30% | 怀念 20%',
    parts: [
      { word: '温暖', pct: 50 },
      { word: '紧张', pct: 30 },
      { word: '怀念', pct: 20 },
    ],
  });
});

defineTest('5. 情绪行百分比之和 ±5 容忍', () => {
  // 97
  const a = parseAIOutput('<sys><var>情绪: 喜悦 60% | 紧张 37%</var></sys>');
  assertEq(a.emotion?.parts?.length, 2);
  // 88（超出容忍 → 跳过）
  const b = parseAIOutput('<sys><var>情绪: 喜悦 60% | 紧张 28%</var></sys>');
  assertEq(b.emotion, null);
  assertEq(b.diagnostics.skippedLines.length, 1);
});

defineTest('6. 大小写不敏感（<SYS> <VAR> <Event>）', () => {
  const input = `<SYS>
<VAR>
affection: 10→15
</VAR>
<Event>
evt_x: ok
</Event>
</SYS>`;
  const out = parseAIOutput(input);
  assertEq(out.varUpdates[0].variableName, 'affection');
  assertEq(out.events[0].eventId, 'evt_x');
});

defineTest('7. → / -> / —> 都接受', () => {
  const out = parseAIOutput(`<sys><var>
a: 1→2
b: 3->4
c: 5—>6
</var></sys>`);
  assertEq(out.varUpdates.length, 3);
  assertEq(out.varUpdates.map(u => [u.oldValue, u.newValue]), [[1,2],[3,4],[5,6]]);
});

defineTest('8. 中文冒号 / 英文冒号都接受', () => {
  const out = parseAIOutput(`<sys><var>
affection：30→35
sanity: 50→48
</var></sys>`);
  assertEq(out.varUpdates.length, 2);
});

defineTest('9. 单行格式错不影响其他行', () => {
  const out = parseAIOutput(`<sys><var>
affection: 30→35
random: garbage line
sanity: 50→48
</var></sys>`);
  assertEq(out.varUpdates.length, 2);
  assertEq(out.diagnostics.skippedLines.length, 1);
  assertEq(out.diagnostics.skippedLines[0].block, 'var');
});

defineTest('10. <sys> 块未闭合 → 整段忽略 + 错误诊断', () => {
  // 真正的未闭合：起始 <sys> 之后没有任何 </sys> 字符串
  const input = `正文部分。

<sys>
<var>
affection: 30→35
</var>
（这段缺少结束标签，整段应该被忽略）`;
  const out = parseAIOutput(input);
  assertEq(out.varUpdates, []);
  assertEq(out.diagnostics.sysBlockFound, true);
  // cleanContent 应去掉 <sys 起始之后所有内容
  if (!out.cleanContent.includes('正文部分')) throw new Error(`cleanContent 应保留正文，实际：${out.cleanContent}`);
  if (out.cleanContent.includes('<sys>')) throw new Error(`cleanContent 不应残留 <sys>，实际：${out.cleanContent}`);
});

defineTest('11. 未识别子标签忽略', () => {
  const input = `<sys>
<var>
a: 1→2
</var>
<weird>
something here
</weird>
</sys>`;
  const out = parseAIOutput(input);
  assertEq(out.varUpdates.length, 1);
  assertEq(out.diagnostics.skippedSubBlocks.length, 1);
  assertEq(out.diagnostics.skippedSubBlocks[0].name, 'weird');
});

defineTest('12. 多个 <sys> 块取最后一个', () => {
  const input = `<sys><var>a: 1→2</var></sys>

中间正文

<sys><var>b: 3→4</var></sys>`;
  const out = parseAIOutput(input);
  assertEq(out.varUpdates.length, 1);
  assertEq(out.varUpdates[0].variableName, 'b');
});

defineTest('13. <sys> 内为空 → 无更新但合法', () => {
  const out = parseAIOutput('正文。\n<sys></sys>');
  assertEq(out.varUpdates, []);
  assertEq(out.events, []);
  assertEq(out.diagnostics.sysBlockFound, true);
  assertEq(out.cleanContent, '正文。');
});

defineTest('14. event 行带原因', () => {
  const input = `<sys><event>
evt_x: success | 原因: 用户没拒绝
</event></sys>`;
  const out = parseAIOutput(input);
  assertEq(out.events[0], { eventId: 'evt_x', outcome: 'success', reason: '用户没拒绝' });
});

defineTest('15. event outcome 含中文', () => {
  const input = `<sys><event>
evt_x: 圆满结局
</event></sys>`;
  const out = parseAIOutput(input);
  assertEq(out.events[0], { eventId: 'evt_x', outcome: '圆满结局' });
});

defineTest('16. 未识别元数据 key 忽略但不阻塞主更新', () => {
  const input = `<sys><var>
affection: 30→35 | 原因: 测试 | 来源: evt_xxx
</var></sys>`;
  const out = parseAIOutput(input);
  // "原因" 被识别，"来源" 暂未识别但不阻塞
  assertEq(out.varUpdates[0], {
    variableName: 'affection',
    oldValue: 30,
    newValue: 35,
    reason: '测试',
  });
});

defineTest('17. 负值与小数', () => {
  const out = parseAIOutput(`<sys><var>
sanity: -10→-5
mood: 0.5→1.5
</var></sys>`);
  assertEq(out.varUpdates.length, 2);
  assertEq(out.varUpdates[0], { variableName: 'sanity', oldValue: -10, newValue: -5 });
  assertEq(out.varUpdates[1], { variableName: 'mood', oldValue: 0.5, newValue: 1.5 });
});

defineTest('18. 变量名含中文（displayName）', () => {
  const out = parseAIOutput(`<sys><var>
好感度: 30→35
</var></sys>`);
  assertEq(out.varUpdates[0].variableName, '好感度');
});

defineTest('19. 空模板', () => {
  const out = parseAIOutput('');
  assertEq(out.cleanContent, '');
  assertEq(out.diagnostics.sysBlockFound, false);
});

defineTest('20. 仅有正文末尾跟 <sys> — 正文与协议干净分离', () => {
  const input = '这是给用户看的内容。\n<sys><var>a: 1→2</var></sys>';
  const out = parseAIOutput(input);
  assertEq(out.cleanContent, '这是给用户看的内容。');
  assertEq(out.varUpdates.length, 1);
});

defineTest('21. 旧格式 <var> 顶层（不带 <sys>）→ 不再识别', () => {
  // 阶段 2 落地后旧格式直接当正文处理
  const input = `回复正文。
<var>
affection: 30→35
</var>`;
  const out = parseAIOutput(input);
  assertEq(out.varUpdates, []);  // 没有 <sys> 包裹 → 不识别
  assertEq(out.diagnostics.sysBlockFound, false);
  // <var> 块作为正文残留（未被解析）
  if (!out.cleanContent.includes('<var>')) {
    throw new Error('未识别的旧 <var> 顶层应保留在 cleanContent 中');
  }
});

defineTest('22. 旧格式 [EVENT:id:outcome] 内联 → 不再识别（保留在正文）', () => {
  const input = '正文 [EVENT:evt_x:success] 末尾';
  const out = parseAIOutput(input);
  assertEq(out.events, []);
  if (!out.cleanContent.includes('[EVENT:')) {
    throw new Error('旧格式内联标签应保留在正文');
  }
});

defineTest('23. <sys> 块前后空行整理', () => {
  const input = '正文。\n\n\n<sys><var>a: 1→2</var></sys>\n\n';
  const out = parseAIOutput(input);
  assertEq(out.cleanContent, '正文。');
});

defineTest('24. 同一变量更新行多个 | 段中只识别 原因', () => {
  const input = `<sys><var>
a: 1→2 | 原因: r1 | 原因: r2
</var></sys>`;
  const out = parseAIOutput(input);
  // 后面的 原因 覆盖前面的（map 写入语义）
  assertEq(out.varUpdates[0].reason, 'r2');
});

defineTest('25. 情绪行不能挂 | 原因（设计上不支持）', () => {
  // 情绪行的 | 用于分隔多个情绪段，不能再用作元数据
  const input = `<sys><var>
情绪: 温暖 50% | 紧张 50%
</var></sys>`;
  const out = parseAIOutput(input);
  assertEq(out.emotion?.parts.length, 2);
  // 不会有 reason 字段
});

// ── 运行 ─────────────────────────────────────────────────────

let pass = 0, fail = 0;
console.log(`\nAI 协议解析器 self-test (${cases.length} cases)\n${'─'.repeat(60)}`);
for (const c of cases) {
  try {
    c.run();
    pass++;
    console.log(`  ✓  ${c.name}`);
  } catch (err: any) {
    fail++;
    console.log(`  ✗  ${c.name}`);
    for (const line of (err?.message ?? String(err)).split('\n')) {
      console.log(`       ${line}`);
    }
  }
}
console.log(`${'─'.repeat(60)}`);
console.log(`通过 ${pass} / ${cases.length}，失败 ${fail}`);
if (fail > 0) process.exit(1);
