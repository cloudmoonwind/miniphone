# ICS 记忆系统 · API 接口文档

**版本**：v1.0  
**日期**：2026-04-26  
**技术栈**：TypeScript  
**依赖文档**：ICS记忆系统_数据库Schema文档_v2  
**阅读对象**：cc克（实现方）

---

## 一、约定

### 1.1 接口分组

记忆系统对外暴露六个模块：

| 模块 | 职责 | 调用方 |
|------|------|--------|
| **Write** 写入模块 | 原始内容 → 记忆条目入库 | 时间线系统、对话系统 |
| **Retrieve** 检索模块 | 对话上下文 → 召回相关记忆 | 对话系统（每轮对话） |
| **Evolve** 演变模块 | weight衰减、重构写回、扭曲 | 定时任务、对话结束钩子 |
| **Working** 工作记忆模块 | working区的增删改查 | 对话系统、用户操作 |
| **Load** 加载模块 | 对话开始时的上下文准备 | 对话系统（每次对话开始） |
| **Admin** 管理模块 | 查看/清理记忆条目 | 前端管理界面 |

### 1.2 通用类型

```typescript
// 角色身份（所有接口必携带）
interface MemoryContext {
  characterId: string;
  personaId: string;
}

// 统一返回格式
// ⚠️ cc克决定：根据项目现有的返回格式约定调整，保持一致即可
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Zone 枚举
type MemoryZone =
  | 'episodic_short'
  | 'episodic_long'
  | 'semantic'
  | 'implicit'
  | 'working';

// 扭曲偏向
interface DistortionBias {
  direction: '美化' | '丑化' | '自我服务' | '叙事一致性';
  strength: number; // 0-1
}

// 感官标签
interface SensoryTags {
  smell?: string[];
  visual?: string[];
  sound?: string[];
  touch?: string[];
}
```

### 1.3 AI 调用说明

写入和重构模块内部需要调用 AI（生成 summary、emotion_tags 等）和 embed 模型（生成向量）。

这些调用是**模块内部实现**，不暴露为接口参数。调用方只传原始内容，记忆系统自己处理 AI 调用。

```
外部调用方  →  记忆系统接口  →  内部 AI 调用（bge-m3 embed + 小模型生成）
                                        ↓
                              写入/更新数据库
```

---

## 二、Write 写入模块

### 2.1 `writeEpisodicMemory` — 写入情节记忆

**触发时机**：时间线事件结束后、对话轮次结束后（符合筛选条件时）

**内部流程**：
```
接收原始内容
    ↓
AI 生成：summary（客观）、memory_text（主观）、emotion_tags_text、sensory_tags、significance、people_tags、location_tag
    ↓
embed 生成：summary_vector、emotion_vector
    ↓
写入 memories_episodic
```

**输入**：

```typescript
interface WriteEpisodicInput {
  context: MemoryContext;

  // 原始素材（至少提供一种）
  rawContent: {
    text: string;           // 事件/对话的原始文本
    eventTime: string;      // 事件发生时间，ISO 8601
    sourceType: 'timeline' | 'chat' | 'diary' | 'dream' | 'game';
    sourceTimeRange?: string; // 来源时间范围，用于 source_hints
  };

  // 辅助参数（写入时读取，不由 AI 生成）
  emotionIntensity: number; // 0-1，从变量系统读取当前情绪强度

  // 可选覆盖（一般不传，由 AI 自动判断）
  zone?: 'episodic_short' | 'episodic_long'; // 默认写入 episodic_short
}
```

**输出**：

```typescript
interface WriteEpisodicOutput {
  memoryId: string;         // 新条目的 ID，如 ep_01HN...
  zone: 'episodic_short' | 'episodic_long';
  summary: string;          // AI 生成的客观摘要（供调用方确认）
  significance: number;     // AI 判断的重要性
}
```

**⚠️ cc克决定**：
- 筛选规则（什么内容值得写入）目前未定，先全部写入，后续加筛选逻辑
- `emotionIntensity` 由调用方从变量系统读取后传入，记忆系统不直接访问变量系统

---

### 2.2 `writeSemanticMemory` — 写入语义记忆

**触发时机**：层级转化时由系统内部调用（多条情节记忆蒸发 → 语义记忆），一般不由外部直接调用

**输入**：

```typescript
interface WriteSemanticInput {
  context: MemoryContext;

  // 蒸发来源（必须提供，至少 2 条情节记忆）
  sourceEpisodicIds: string[];  // 来源情节记忆 ID 列表

  // 原始素材（来源情节的摘要合并后传入，由调用方准备）
  rawContent: {
    text: string;  // 多条情节摘要合并的文本，供 AI 提炼语义认知
  };
}
```

**输出**：

```typescript
interface WriteSemanticOutput {
  memoryId: string;   // se_01HN...
  summary: string;
  significance: number;
  // 写入时自动将 sourceEpisodicIds 中的条目更新 absorbed_by 和 absorption_level
  updatedSourceCount: number;
}
```

---

### 2.3 `writeImplicitMemory` — 写入内隐记忆

**触发时机**：识别到角色重复行为模式时（待设计具体触发条件）

**输入**：

```typescript
interface WriteImplicitInput {
  context: MemoryContext;
  personaId?: string;  // 可为空（普遍倾向不绑定特定马甲）

  // 内容（由 AI 生成，调用方传入结果）
  // ⚠️ cc克决定：是在接口内部调用 AI 生成，还是由外部传入 AI 已生成的内容？
  // 建议：外部识别触发条件后，内部调 AI 生成 trigger_condition 和 behavior_response
  triggerCondition: string;  // 什么情况下触发
  behaviorResponse: string;  // 触发时的行为倾向
  significance: number;      // 0-1

  // 来源情节（可选，记录是从哪些行为积累形成的）
  sourceEpisodicIds?: string[];
}
```

**输出**：

```typescript
interface WriteImplicitOutput {
  memoryId: string;  // im_01HN...
}
```

---

## 三、Retrieve 检索模块

### 3.1 `retrieveMemories` — 主检索入口

每轮对话调用一次，内部并行运行六种检索模式，汇总层去重打分后返回 top N 条。

**输入**：

```typescript
interface RetrieveMemoriesInput {
  context: MemoryContext;

  // 当前对话信号（调用方从对话中提取后传入）
  signals: {
    // 语义信号（必填，每次必跑）
    currentText: string;       // 当前用户输入或对话摘要

    // 情绪信号（检测到情绪时填入）
    emotionText?: string;      // 检测到的情绪描述，如「焦虑 委屈」

    // 人物信号（提到 NPC 时填入）
    mentionedNpcIds?: string[];  // NPC ID 列表

    // 时间信号（提到时间词时填入）
    timeRange?: {
      from: string;  // ISO 8601
      to: string;
      anchor?: string;  // 目标时间点，用于"距离最近"排序
    };

    // 地点信号（提到地点时填入）
    locationTag?: string;  // 标准化地点名

    // 感官信号（感官描述词时填入）
    sensoryKeywords?: Partial<SensoryTags>;
  };

  // 汇总层参数
  options?: {
    topN?: number;  // 最终返回条数，默认 5
    minWeight?: number;  // weight 下限过滤，默认 0.1
    maxAbsorptionLevel?: number;  // absorption_level 上限，默认 0.9
  };
}
```

**输出**：

```typescript
interface RetrievedMemory {
  memoryId: string;
  zone: 'episodic_short' | 'episodic_long' | 'semantic';
  summary: string;
  memoryText: string;        // 角色主观版本，注入对话用
  emotionTagsText?: string;
  emotionIntensity?: number; // episodic 才有
  detailClarity: number;     // 0-1，注入时传给 AI 控制呈现模糊度
  emotionClarity: number;
  distortionBias: DistortionBias[];
  weight: number;
  time?: string;             // episodic 才有

  // 汇总层打分信息（调试用）
  _score?: {
    semanticSimilarity?: number;
    emotionSimilarity?: number;
    matchedModes: string[];  // 哪些模式命中了这条记忆
    finalScore: number;
  };
}

interface RetrieveMemoriesOutput {
  memories: RetrievedMemory[];
  // 注入 prompt 用的格式化文本（直接可用，无需调用方再处理）
  injectionText: string;
}
```

**注入格式说明**（`injectionText` 的格式）：

```
以下是角色此刻可能想起的记忆，按相关程度排列：
1. [summary]（情绪：xxx，时间：xxx）
2. [summary]（情绪：xxx，重要）
3. [summary]（情绪：xxx，最近）

角色不需要全部提及，自然地融入对话即可。
```

实际注入时使用 `memoryText`（主观版本）而非 `summary`，`injectionText` 已自动处理。

**内部执行顺序**：
```
1. 六种检索模式并行执行（各取 top 10-15）
2. 合并去重（同一 memoryId 保留最高分）
3. 汇总层打分：
   综合分 = 语义相似度 × rp_semantic
           + 情绪相似度 × rp_emotion
           + 其他模式命中 × 对应权重
           + weight 字段值
           - 时间衰减系数
   （权重系数从 character_drive_core 动态读取）
4. 保留策略：
   - 分数最高前 3 条（强相关）
   - weight 最高 1 条（重要）
   - time 最近 1 条（时效保底）
5. 激活后处理（异步，不阻塞返回）：
   - activation_count +1
   - recent_activation_density 更新
   - last_activated_at 更新
   - RIF：对相似记忆 suppression 处理（见 3.2）
```

---

### 3.2 `triggerRIF` — RIF 压制（内部调用）

检索命中记忆 A 后，异步执行，不对外暴露。

**逻辑**：
```
用 A 的 summary_vector + emotion_vector 对记忆库做相似度查询
取 top 10（排除 A 自身）
对这 10 条执行：weight 轻微下压（具体幅度待设计）
```

**⚠️ cc克注意**：`cluster_id` 和 `suppression_count` 已废弃（见 Schema 文档第十一章）。RIF 改为实时相似度查询，不依赖 cluster 标签。

---

## 四、Evolve 演变模块

### 4.1 `runWeightDecay` — weight 衰减批处理

**触发时机**：定时任务，建议每天运行一次

**输入**：

```typescript
interface WeightDecayInput {
  characterId: string;  // 对某个角色的所有记忆执行衰减
  // ⚠️ 或者不传，对所有角色批量执行——cc克决定批处理粒度
}
```

**输出**：

```typescript
interface WeightDecayOutput {
  processedCount: number;
  decayedCount: number;     // 实际发生衰减的条目数
  belowThresholdCount: number;  // weight 低于某阈值的条目数（供清理参考）
}
```

**⚠️ cc克注意**：weight 衰减的具体公式尚未最终确定，实现时先占位，公式待演变规则文档确定后填入。已知输入参数有：`recent_activation_density`、`last_activated_at`（距今时长）、`absorption_level`。

---

### 4.2 `runClarityDecay` — 清晰度衰减批处理

**触发时机**：与 weight 衰减同批运行

**逻辑**：
- `detail_clarity`：衰减快，从 `last_modified_at` 距今时长 + `reconstructed_count` 计算
- `emotion_clarity`：衰减慢（约为 detail_clarity 的 1/3），主要受 `emotion_processed` 影响

**⚠️ cc克注意**：具体衰减曲线待演变规则文档确定。

---

### 4.3 `evaluateReconstruction` — 重构写回评估

**触发时机**：每次对话结束后，对本次被检索命中的记忆执行

**说明**：重构发生在**提取时**（注入前），不发生在存储时。提取时小模型根据当前情绪/清晰度/扭曲偏向生成「此刻角色想起的版本」，对话结束后再判断是否写回。

**输入**：

```typescript
interface EvaluateReconstructionInput {
  memoryId: string;
  originalText: string;      // 原 memory_text
  reconstructedText: string; // 本次对话中小模型生成的重构版本
  // 重构时的状态参数（记录在案，供偏差判断参考）
  reconstructionContext: {
    currentEmotion?: string;
    detailClarityAtTime: number;
    distortionBiasAtTime: DistortionBias[];
  };
}
```

**输出**：

```typescript
interface EvaluateReconstructionOutput {
  shouldWriteBack: boolean;
  // 如果写回：
  updatedText?: string;       // 写回的新 memory_text
  newDistortionBias?: DistortionBias[];  // 更新后的扭曲偏向
  // 操作结果
  action: 'written_back' | 'skipped' | 'error';
}
```

**内部逻辑**：
```
计算 originalText vs reconstructedText 的语义偏差
若偏差 > 阈值：
  写回 memory_text = reconstructedText
  reconstructed_count +1
  last_modified_at = now()
  更新 distortion_bias（追加新方向或强化已有方向）
若偏差 ≤ 阈值：
  不写回，本次重构不留痕迹
```

**⚠️ cc克注意**：偏差阈值待设计，先写死一个初始值（如 0.3），后续可配置化。

---

### 4.4 `reconstructForInjection` — 提取时重构（内部调用）

在 `retrieveMemories` 内部调用，不对外暴露。生成「此刻角色想起的版本」用于注入，不立刻写回。

**⚠️ cc克决定**：是否每次检索都调用小模型重构。初期建议只在 `detail_clarity < 0.7` 或 `distortionBias` 非空时才调用，否则直接用原 `memory_text`，节省 token。

---

## 五、Working 工作记忆模块

### 5.1 `createWorkingMemory` — 新建工作记忆

**输入**：

```typescript
interface CreateWorkingMemoryInput {
  context: MemoryContext;
  memoryText: string;
  relevanceType: 'current_state' | 'near_plan' | 'pending_action';
  priority?: number;           // 默认 0.5
  expiresAt?: string;          // ISO 8601，可选
  resolveCondition?: {
    type: 'keyword' | 'time' | 'manual' | 'ai_judge';
    value?: string;
  };
  createdBy: 'user' | 'character' | 'system';
}
```

**输出**：

```typescript
interface CreateWorkingMemoryOutput {
  workingMemoryId: string;  // wm_01HN...
}
```

---

### 5.2 `resolveWorkingMemory` — 标记为已解决

**输入**：

```typescript
interface ResolveWorkingMemoryInput {
  workingMemoryId: string;
  resolvedBy: 'keyword' | 'time' | 'manual' | 'ai_judge';
}
```

**输出**：`ApiResponse<{ success: true }>`

---

### 5.3 `checkWorkingMemoryExpiry` — 检查过期（定时任务）

**触发时机**：定时任务，建议每小时或每次对话开始前执行

**逻辑**：扫描所有 `status = 'active'` 且 `expires_at < now()` 的条目，批量更新 `status → 'expired'`

**输出**：

```typescript
interface CheckExpiryOutput {
  expiredCount: number;
}
```

---

### 5.4 `checkKeywordResolve` — 关键词解决检测（对话中调用）

**触发时机**：每轮对话后，检查用户输入是否触发某个 working 记忆的 `resolve_condition`

**输入**：

```typescript
interface CheckKeywordResolveInput {
  context: MemoryContext;
  currentText: string;  // 当前用户输入
}
```

**输出**：

```typescript
interface CheckKeywordResolveOutput {
  resolvedIds: string[];  // 被触发解决的 working 记忆 ID 列表
}
```

---

## 六、Load 加载模块

### 6.1 `loadWorkingMemories` — 对话开始时加载工作记忆

**触发时机**：每次对话开始时，自动执行，结果注入对话上下文

**输入**：

```typescript
interface LoadWorkingMemoriesInput {
  context: MemoryContext;
}
```

**输出**：

```typescript
interface LoadWorkingMemoriesOutput {
  items: {
    workingMemoryId: string;
    memoryText: string;
    relevanceType: string;
    priority: number;
  }[];
  injectionText: string;  // 格式化后可直接注入 prompt 的文本
}
```

**注入格式**：

```
【当前状态】
- 用户这几天感冒，昨天说有好转
【近期计划】
- 用户明天出差，周五回来
【待处理】
- 角色答应帮用户查的事，还没有回复
```

---

### 6.2 `loadImplicitMemories` — 加载内隐记忆（角色配置层初始化）

**触发时机**：角色初始化时，或角色配置刷新时。结果挂在角色的系统 prompt 里，不是每轮对话重新加载。

**输入**：

```typescript
interface LoadImplicitMemoriesInput {
  characterId: string;
  topN?: number;  // 默认取 weight 最高的 20 条
}
```

**输出**：

```typescript
interface LoadImplicitMemoriesOutput {
  items: {
    implicitMemoryId: string;
    triggerCondition: string;
    behaviorResponse: string;
    weight: number;
  }[];
  injectionText: string;  // 格式化后可直接注入系统 prompt 的文本
}
```

**注入格式**：

```
【行为倾向指令】
- 当：对方长时间沉默超过 30 秒 → 不追问，先转移话题，等她自己开口
- 当：用户迟到或让角色等待 → 表现平静，但话会变少
```

---

### 6.3 `loadDriveCoreParams` — 加载驱动核参数（检索前调用）

**触发时机**：`retrieveMemories` 内部调用，获取检索权重系数

**输入**：`characterId: string`

**输出**：

```typescript
interface DriveCoreParams {
  retrievalPreference: {
    semantic: number;
    emotion: number;
    sensory: number;
    people: number;
    time: number;
    location: number;
  };
  chainActivationStyle: 'avoidant' | 'anxious' | 'secure';
}
```

---

## 七、Admin 管理模块

### 7.1 `listMemories` — 查看记忆列表

**用途**：前端记忆管理界面

**输入**：

```typescript
interface ListMemoriesInput {
  context: MemoryContext;
  filters?: {
    zone?: MemoryZone;
    minWeight?: number;
    maxWeight?: number;
    minAbsorptionLevel?: number;  // 用于找到「已被吸收」的条目
    peopleTag?: string;
    locationTag?: string;
  };
  pagination: {
    page: number;
    pageSize: number;
  };
  sortBy?: 'weight' | 'createdAt' | 'lastActivatedAt';
  sortOrder?: 'asc' | 'desc';
}
```

**输出**：

```typescript
interface ListMemoriesOutput {
  items: {
    memoryId: string;
    zone: MemoryZone;
    summary: string;
    memoryText?: string;
    weight: number;
    detailClarity: number;
    emotionClarity: number;
    absorptionLevel: number;
    absorbedBy: string[];
    createdAt: string;
    lastActivatedAt?: string;
  }[];
  total: number;
  page: number;
  pageSize: number;
}
```

---

### 7.2 `deleteMemory` — 删除记忆条目

**用途**：用户手动清理已被吸收的低 weight 条目

**输入**：

```typescript
interface DeleteMemoryInput {
  memoryId: string;
  zone: MemoryZone;  // 需要指定表（episodic / semantic / implicit）
  // ⚠️ cc克决定：软删除（加 deleted_at 字段）还是硬删除？
  // 建议：软删除，保留记录，支持回退
}
```

**输出**：`ApiResponse<{ success: true }>`

---

### 7.3 `updateWorkingMemoryStatus` — 手动更新工作记忆状态

**输入**：

```typescript
interface UpdateWorkingStatusInput {
  workingMemoryId: string;
  status: 'resolved' | 'expired';  // 不允许手动改回 active
}
```

---

## 八、接口调用时序

### 8.1 每次对话开始

```
对话系统
  ↓
Load.loadWorkingMemories()    → 工作记忆注入 prompt
Load.loadImplicitMemories()   → 内隐记忆挂系统 prompt（首次或刷新时）
Evolve.checkWorkingExpiry()   → 检查是否有过期的 working 记忆（可合并进 load）
```

### 8.2 每轮对话（用户发消息后）

```
对话系统提取信号（mentionedNPCs / emotionText / locationTag 等）
  ↓
Retrieve.retrieveMemories()   → 召回相关记忆，获得 injectionText
  ↓
injectionText 注入对话上下文，调用主模型生成角色回复
  ↓
Working.checkKeywordResolve() → 检查是否触发 working 记忆解决（异步）
```

### 8.3 每次对话结束

```
对话系统
  ↓
Write.writeEpisodicMemory()   → 将本次对话写入记忆（符合条件时）
Evolve.evaluateReconstruction() → 对本次被命中的记忆评估重构写回
```

### 8.4 定时任务（每天）

```
定时任务
  ↓
Evolve.runWeightDecay()       → 所有角色 weight 衰减
Evolve.runClarityDecay()      → 清晰度衰减
Working.checkWorkingExpiry()  → 过期 working 记忆状态更新
```

---

## 九、未定义 / 待确认

以下接口逻辑在设计文档中尚未最终确定，cc克实现时先跳过或占位：

| # | 接口/逻辑 | 状态 |
|---|----------|------|
| 1 | weight 衰减公式 | 待演变规则文档确定，先占位 |
| 2 | clarity 衰减公式 | 同上 |
| 3 | 重构写回偏差阈值 | 先写死 0.3，后续可配置 |
| 4 | 写入筛选规则（什么内容值得入库） | 待设计，先全部写入 |
| 5 | 层级转化触发条件（short → long / episodic → semantic） | 待设计，先不实现 |
| 6 | 扭曲触发条件 | 待设计，先不实现 |
| 7 | 连锁激活深度限制 | 先设最大 2 层 |
| 8 | 闯入性记忆触发机制 | 待设计 |
| 9 | `personality_vector` 初始化 | 待设计 |
| 10 | RIF weight 下压幅度 | 待演变规则文档确定 |

---

*🦀 Agnes × 小克*
