# 变量编辑器前端设计文档

## 界面结构（meta/ValueEditor → meta/value/）

```
MetaApp
└── ValueEditor（orchestrator）
    ├── SidebarDrawer（变量列表抽屉）
    ├── ValueDetail（选中变量的详情+编辑）
    │   ├── RangeBar（液体玻璃管 + 双滑块）
    │   ├── StageManager（阶段管理，受滑块范围过滤）
    │   └── RuleManager（规则管理，受滑块范围过滤）
    └── ValueModal（新建/编辑变量的弹窗）
```

---

## 变量（Value）字段

| 字段 | 说明 |
|------|------|
| name | 显示名，如"好感度" |
| variableName | 变量名，用于占位符，如 affection |
| category | 分类（情感关系/心理状态/生理状态/能力成长/世界状态） |
| valueType | continuous（连续）/ discrete（离散） |
| currentValue | 当前值 |
| minValue / maxValue | 范围（离散变量无意义） |
| sortOrder | 排列顺序 |
| groupName | 分组名（可选，侧边栏按此分组） |

---

## 阶段（Stage）字段

| 字段 | 说明 |
|------|------|
| rangeMin / rangeMax | 值区间（离散变量用 index） |
| stageName | 阶段名，如"朋友" |
| description | 人类可读描述（UI展示用） |
| promptSnippet | ★ AI提示词片段（最重要！通过占位符注入上下文） |

**promptSnippet 是核心**，它是 `{{v:affection:prompt}}` 占位符替换的实际内容。

---

## 规则（Rule）字段——待改造

**当前（错误）：**
- triggerOn, operation, amount → 服务端自动执行逻辑（错误方向）

**应改为：**
| 字段 | 说明 |
|------|------|
| rangeMin / rangeMax | 该规则适用的值范围（可选，空=全范围） |
| ruleText | ★ 自然语言规则文本（必填），注入给 AI 告知如何更新 |
| enabled | 是否启用 |

**ruleText 示例：**
```
过于亲密接触减3-8，冷淡减1-2，感觉对方自由自主进退有礼加1-3
```

---

## 双滑块逻辑

- 轨道：全范围 minValue~maxValue，展示阶段分布
- 当前值：轨道上的标记点（不可拖动，通过 ±5 按钮或手动输入调节）
- 左滑块（viewLeft）+ 右滑块（viewRight）：定义"查看范围"
- 查看范围过滤：StageManager 和 RuleManager 只显示与该范围重叠的条目
- 当视图范围 = 全范围时显示全部，是默认状态

---

## 视觉风格（浅色星云玻璃）

- 背景：periwinkle 渐变（MetaApp 提供），不在 ValueEditor 内重新设背景
- 面板：`bg-white/28 backdrop-blur-xl border border-white/50 rounded-2xl`（inline style）
- 文字：slate-700 / slate-500 / slate-400（深色，因为背景浅）
- 滑块轨道：液体玻璃管，阶段分界线用透明竖线，不用彩色圆角条
- 不滥用圆角卡片包裹每一个信息块

---

## 规则编辑 UI（待重新设计）

当前 UI 展示 triggerOn/operation/amount 下拉框——这些字段要废弃。
新 UI 应该：
1. 主输入框：ruleText（多行文本，必填，大字段）
2. 次要字段：rangeMin / rangeMax（两个数字输入，可选）
3. 启用/禁用 toggle
