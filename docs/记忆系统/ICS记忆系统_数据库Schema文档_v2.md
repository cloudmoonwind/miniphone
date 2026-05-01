# ICS 记忆系统 · 数据库 Schema 文档

**版本**：v2.0  
**日期**：2026-04-25  
**变更**：从单表方案改为分 zone 建表，每张表只保留对该 zone 有意义的字段  
**依赖**：ICS记忆系统_检索架构设计文档-v4

---

## 一、表结构总览

```
memories_episodic     ← episodic_short + episodic_long（zone 字段区分）
memories_semantic     ← semantic（从情节蒸发的抽象认知）
memories_implicit     ← implicit（内隐行为指令，不走检索）
working_memories      ← working（当前状态和近期计划，独立生命周期）
character_drive_core  ← 驱动核（人格向量 + 检索偏好 + 连锁激活风格）
```

**分表理由**：每个 zone 的字段需求不同，强行合并会导致大量无意义的 NULL 列，也失去了各自演化字段的灵活性。implicit 不需要向量，semantic 不需要时间和地点，拆开后各自清晰，以后要给某个 zone 加实验性字段直接加，不影响其他表。

**episodic 合并理由**：episodic_short 和 episodic_long 字段完全相同，本质是「同一件事的不同成熟阶段」，用 zone 字段区分就够了，没有独立建表的必要。

---

## 二、技术选型

| 组件 | 选型 |
|------|------|
| 关系库 | PostgreSQL 16+ |
| 向量扩展 | pgvector 0.7+（HNSW 索引） |
| Embed 模型 | bge-m3（本地，768维，中文友好） |
| ID 格式 | ULID 带前缀（`ep_` / `se_` / `im_` / `wm_`） |

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 三、`memories_episodic` — 情节记忆表

覆盖 `episodic_short`（短期未巩固）和 `episodic_long`（巩固后的长期情节）。

### 3.1 建表

```sql
CREATE TABLE memories_episodic (

  -- ── 身份 ─────────────────────────────────────────────────────
  id                TEXT        PRIMARY KEY,
  -- 格式：ep_{ULID}

  character_id      TEXT        NOT NULL,
  persona_id        TEXT        NOT NULL,
  -- 马甲隔离：同一角色对不同马甲的记忆完全分区

  zone              TEXT        NOT NULL,
  -- episodic_short → 高可塑，未巩固，细节完整
  -- episodic_long  → 低可塑，巩固后，细节开始模糊，情绪轮廓保留
  -- 写入后不可变。层级转化是「生长新条目」而不是「修改 zone」

  -- ── 检索层（客观，永不扭曲）─────────────────────────────────
  summary           TEXT        NOT NULL,
  -- 50-150字，第三方客观视角，无情绪色彩，写入后永不修改
  -- 是 memory_text 的客观锚点，summary 不变则检索位置不变

  summary_vector    vector(768) NOT NULL,
  -- 由 bge-m3 对 summary embed 生成，summary 不变则不变

  -- ── 生成层（主观，随演变漂移）────────────────────────────────
  memory_text       TEXT        NOT NULL,
  -- 角色第一人称主观描述，有情绪色彩，可能不准确
  -- 随重构/扭曲缓慢漂移

  -- ── 情绪层 ───────────────────────────────────────────────────
  emotion_tags_text TEXT,
  -- 情绪词空格分隔，如「焦虑 压抑 委屈」，AI 写入
  -- 扭曲积累时可更新，更新后需重新生成 emotion_vector

  emotion_vector    vector(768),
  -- 对 emotion_tags_text embed 生成

  emotion_intensity REAL        NOT NULL DEFAULT 0.5,
  -- 0-1，写入时从变量系统读取，之后静态不变
  -- 影响：clarity 初始值 / emotion_processed 上升阻力 / 闯入性记忆概率

  emotion_processed REAL        NOT NULL DEFAULT 0.0,
  -- 0-1，初始为 0，动态上升
  -- 上升速度由变量系统的情绪强度 + 情绪类型决定
  -- 低值 + 高 emotion_intensity → 闯入性记忆、回避行为概率上升

  -- ── 感官层 ───────────────────────────────────────────────────
  sensory_tags      JSONB       NOT NULL DEFAULT '{}',
  -- {"smell":["松木"],"visual":["金色光斑"],"sound":["虫鸣"],"touch":["凉意"]}
  -- AI 写入，用于感官精确匹配检索

  -- ── 索引标签 ─────────────────────────────────────────────────
  people_tags       TEXT[]      NOT NULL DEFAULT '{}',
  -- NPC ID 列表，如 ["NPC_小李"]，精确匹配

  location_tag      TEXT,
  -- 标准化地点，写入时 AI 统一粒度：「星巴克三里屯」→「咖啡厅」

  time              TIMESTAMPTZ NOT NULL,
  -- 事件发生时间（不是写入时间，写入时间在 created_at）
  -- episodic 记忆必有具体时间

  -- ── 重要性与权重 ─────────────────────────────────────────────
  significance      REAL        NOT NULL DEFAULT 0.5,
  -- 0-1，AI 写入时判断，之后静态不变
  -- weight 初始值 = significance

  weight            REAL        NOT NULL,
  -- 0-1，动态变化：激活→上升，时间/压制/被吸收→下降
  -- 汇总层综合打分的输入之一

  -- ── 清晰度 ───────────────────────────────────────────────────
  detail_clarity    REAL        NOT NULL DEFAULT 1.0,
  -- 0-1，细节清晰度，衰减快
  -- 低值 → AI 呈现「记不太清了，好像是...」

  emotion_clarity   REAL        NOT NULL DEFAULT 1.0,
  -- 0-1，情绪清晰度，衰减慢（约为 detail_clarity 衰减速度的 1/3）
  -- 低值 → AI 呈现「感觉也淡了，说不清是什么情绪」

  -- ── 演变追踪 ─────────────────────────────────────────────────
  distortion_bias   JSONB       NOT NULL DEFAULT '[]',
  -- 扭曲偏向数组，支持多方向并存
  -- [{"direction":"美化","strength":0.6},{"direction":"自我服务","strength":0.3}]
  -- direction 枚举：美化 | 丑化 | 自我服务 | 叙事一致性
  -- 初始为空，触发扭曲时追加/更新

  reconstructed_count INTEGER    NOT NULL DEFAULT 0,
  -- 重构并写回的次数（偏差超过阈值才算一次写回）
  -- 影响 detail_clarity 衰减加速系数

  -- ── 激活统计 ─────────────────────────────────────────────────
  activation_count          INTEGER     NOT NULL DEFAULT 0,
  recent_activation_density REAL        NOT NULL DEFAULT 0.0,
  -- 近 30 天激活次数 ÷ 30，单位：次/天
  -- weight 衰减公式的核心输入

  last_activated_at         TIMESTAMPTZ,
  last_modified_at          TIMESTAMPTZ,
  -- last_modified_at：memory_text 重构写回时更新，不是激活时更新
  -- detail_clarity / emotion_clarity 衰减从此字段算起

  -- ── 层级转化 ─────────────────────────────────────────────────
  derived_from      TEXT[]      NOT NULL DEFAULT '{}',
  -- 此条目从哪些条目巩固/蒸发而来（可跨表引用，存 ID 字符串）

  absorbed_by       TEXT[]      NOT NULL DEFAULT '{}',
  -- 被哪些上层条目吸收，有值时 weight 随 absorption_level 自动下压

  absorption_level  REAL        NOT NULL DEFAULT 0.0,
  -- 0-1，被上层记忆覆盖的程度，高值时 weight 自动下调

  -- ── 网络效应（RIF）───────────────────────────────────────────
  -- ⚠️ cluster_id / suppression_count 已废弃，见「十一、字段废弃说明」
  -- RIF 改为实时相似度查询实现，不需要预先打标签

  -- ── 来源关联 ─────────────────────────────────────────────────
  source_hints      JSONB       NOT NULL DEFAULT '[]',
  -- [{"type":"timeline","time_range":"2026-03-10"},{"type":"chat","time_range":"..."}]
  -- type 枚举：timeline | chat | diary | dream | game
  -- 仅用于调试/溯源，找不到对应原文是正常的

  -- ── 元数据 ───────────────────────────────────────────────────
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()

);
```

### 3.2 约束

```sql
ALTER TABLE memories_episodic ADD CONSTRAINT ep_zone_check
  CHECK (zone IN ('episodic_short', 'episodic_long'));

ALTER TABLE memories_episodic ADD CONSTRAINT ep_significance_range
  CHECK (significance BETWEEN 0.0 AND 1.0);

ALTER TABLE memories_episodic ADD CONSTRAINT ep_weight_range
  CHECK (weight BETWEEN 0.0 AND 1.0);

ALTER TABLE memories_episodic ADD CONSTRAINT ep_detail_clarity_range
  CHECK (detail_clarity BETWEEN 0.0 AND 1.0);

ALTER TABLE memories_episodic ADD CONSTRAINT ep_emotion_clarity_range
  CHECK (emotion_clarity BETWEEN 0.0 AND 1.0);

ALTER TABLE memories_episodic ADD CONSTRAINT ep_emotion_intensity_range
  CHECK (emotion_intensity BETWEEN 0.0 AND 1.0);

ALTER TABLE memories_episodic ADD CONSTRAINT ep_emotion_processed_range
  CHECK (emotion_processed BETWEEN 0.0 AND 1.0);

ALTER TABLE memories_episodic ADD CONSTRAINT ep_absorption_level_range
  CHECK (absorption_level BETWEEN 0.0 AND 1.0);
```

### 3.3 索引

```sql
-- 基础查询
CREATE INDEX idx_ep_char_persona_zone
  ON memories_episodic (character_id, persona_id, zone);

-- 向量检索（HNSW）
CREATE INDEX idx_ep_summary_vector
  ON memories_episodic USING hnsw (summary_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_ep_emotion_vector
  ON memories_episodic USING hnsw (emotion_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 标量过滤
CREATE INDEX idx_ep_weight
  ON memories_episodic (character_id, persona_id, weight DESC);

CREATE INDEX idx_ep_time
  ON memories_episodic (character_id, persona_id, time);

CREATE INDEX idx_ep_location
  ON memories_episodic (character_id, persona_id, location_tag)
  WHERE location_tag IS NOT NULL;

CREATE INDEX idx_ep_last_activated
  ON memories_episodic (character_id, persona_id, last_activated_at DESC)
  WHERE last_activated_at IS NOT NULL;

-- 数组包含（GIN）
CREATE INDEX idx_ep_people_tags   ON memories_episodic USING gin (people_tags);
CREATE INDEX idx_ep_cluster_id    ON memories_episodic USING gin (cluster_id);
CREATE INDEX idx_ep_derived_from  ON memories_episodic USING gin (derived_from);
CREATE INDEX idx_ep_absorbed_by   ON memories_episodic USING gin (absorbed_by);

-- JSONB 感官
CREATE INDEX idx_ep_sensory_tags
  ON memories_episodic USING gin (sensory_tags jsonb_path_ops);
```

---

## 四、`memories_semantic` — 语义记忆表

从大量情节中蒸发出来的抽象认知，脱离具体事件，无时间地点。

**与 episodic 的字段差异**：

| 字段 | episodic | semantic | 原因 |
|------|----------|----------|------|
| time | ✅ NOT NULL | ❌ 无此字段 | 语义记忆无具体时间 |
| location_tag | ✅ | ❌ 无此字段 | 语义记忆无具体地点 |
| emotion_intensity | ✅ | ❌ 无此字段 | 语义记忆是抽象认知，无单次情绪强度 |
| emotion_processed | ✅ | ❌ 无此字段 | 同上 |
| zone | 枚举两值 | 固定为 'semantic' | 表即 zone |

### 4.1 建表

```sql
CREATE TABLE memories_semantic (

  id                TEXT        PRIMARY KEY,
  -- 格式：se_{ULID}

  character_id      TEXT        NOT NULL,
  persona_id        TEXT        NOT NULL,

  -- zone 固定为 'semantic'，建表时写死默认值，查询时保持接口一致
  zone              TEXT        NOT NULL DEFAULT 'semantic'
                                CHECK (zone = 'semantic'),

  -- ── 检索层 ───────────────────────────────────────────────────
  summary           TEXT        NOT NULL,
  -- 客观描述这条语义认知的内容，如「她不擅长表达委屈，习惯自己吞下去」

  summary_vector    vector(768) NOT NULL,

  -- ── 生成层 ───────────────────────────────────────────────────
  memory_text       TEXT        NOT NULL,
  -- 角色视角的主观表述，可能更有温度：「她就是那种会把委屈藏起来的人」

  -- ── 情绪层 ───────────────────────────────────────────────────
  -- 语义记忆有情绪色彩（「她总让我心疼」），但不来自单次事件，无强度和处理程度
  emotion_tags_text TEXT,
  emotion_vector    vector(768),

  -- ── 索引标签 ─────────────────────────────────────────────────
  -- 语义记忆可以关联人物（这条认知是关于谁的）
  people_tags       TEXT[]      NOT NULL DEFAULT '{}',
  -- 无 location_tag 和 time（语义记忆脱离具体场景）

  -- ── 重要性与权重 ─────────────────────────────────────────────
  significance      REAL        NOT NULL DEFAULT 0.5,
  weight            REAL        NOT NULL,

  -- ── 清晰度 ───────────────────────────────────────────────────
  -- 语义记忆几乎不衰减，但保留字段允许极端情况下的模糊
  detail_clarity    REAL        NOT NULL DEFAULT 1.0,
  emotion_clarity   REAL        NOT NULL DEFAULT 1.0,

  -- ── 演变追踪 ─────────────────────────────────────────────────
  distortion_bias   JSONB       NOT NULL DEFAULT '[]',
  reconstructed_count INTEGER   NOT NULL DEFAULT 0,

  -- ── 激活统计 ─────────────────────────────────────────────────
  activation_count            INTEGER     NOT NULL DEFAULT 0,
  recent_activation_density   REAL        NOT NULL DEFAULT 0.0,
  last_activated_at           TIMESTAMPTZ,
  last_modified_at            TIMESTAMPTZ,

  -- ── 层级转化 ─────────────────────────────────────────────────
  derived_from      TEXT[]      NOT NULL DEFAULT '{}',
  -- 记录从哪些情节记忆蒸发而来，如 ["ep_xxx","ep_yyy","ep_zzz"]

  absorbed_by       TEXT[]      NOT NULL DEFAULT '{}',
  absorption_level  REAL        NOT NULL DEFAULT 0.0,

  -- ── 感官层 ───────────────────────────────────────────────────
  sensory_tags      JSONB       NOT NULL DEFAULT '{}',
  -- 语义记忆也可携带感官信息，如「她身上总有一股香皂味」
  -- 格式与 episodic 相同：{"smell":[],"visual":[],"sound":[],"touch":[]}

  -- ── 网络效应（RIF）───────────────────────────────────────────
  -- ⚠️ cluster_id / suppression_count 已废弃，见「十一、字段废弃说明」

  -- ── 来源关联 ─────────────────────────────────────────────────
  source_hints      JSONB       NOT NULL DEFAULT '[]',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()

);
```

### 4.2 约束与索引

```sql
ALTER TABLE memories_semantic ADD CONSTRAINT se_weight_range
  CHECK (weight BETWEEN 0.0 AND 1.0);
ALTER TABLE memories_semantic ADD CONSTRAINT se_significance_range
  CHECK (significance BETWEEN 0.0 AND 1.0);
ALTER TABLE memories_semantic ADD CONSTRAINT se_detail_clarity_range
  CHECK (detail_clarity BETWEEN 0.0 AND 1.0);
ALTER TABLE memories_semantic ADD CONSTRAINT se_emotion_clarity_range
  CHECK (emotion_clarity BETWEEN 0.0 AND 1.0);
ALTER TABLE memories_semantic ADD CONSTRAINT se_absorption_level_range
  CHECK (absorption_level BETWEEN 0.0 AND 1.0);

-- 索引
CREATE INDEX idx_se_char_persona
  ON memories_semantic (character_id, persona_id);

CREATE INDEX idx_se_summary_vector
  ON memories_semantic USING hnsw (summary_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_se_emotion_vector
  ON memories_semantic USING hnsw (emotion_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_se_weight
  ON memories_semantic (character_id, persona_id, weight DESC);

CREATE INDEX idx_se_people_tags   ON memories_semantic USING gin (people_tags);
CREATE INDEX idx_se_derived_from  ON memories_semantic USING gin (derived_from);
CREATE INDEX idx_se_sensory_tags
  ON memories_semantic USING gin (sensory_tags jsonb_path_ops);
```

---

## 五、`memories_implicit` — 内隐记忆表

行为倾向指令，不走检索，常驻角色 prompt 配置层。

**与 episodic/semantic 的根本区别**：implicit 存的不是「发生了什么」，而是「遇到什么情况就怎么做」——格式更接近 prompt 片段，不需要向量化，不参与 RIF，没有清晰度概念。

### 5.1 建表

```sql
CREATE TABLE memories_implicit (

  id                TEXT        PRIMARY KEY,
  -- 格式：im_{ULID}

  character_id      TEXT        NOT NULL,
  -- implicit 记忆是角色层级的（行为模式不因马甲而异）
  -- 但如果某个行为模式是与特定马甲互动中形成的，persona_id 可记录来源
  persona_id        TEXT,
  -- 允许 NULL：NULL 表示此隐性行为是角色的普遍倾向（非特定马甲触发形成）

  zone              TEXT        NOT NULL DEFAULT 'implicit'
                                CHECK (zone = 'implicit'),

  -- ── 核心字段（替代 summary + memory_text）───────────────────
  trigger_condition TEXT        NOT NULL,
  -- 什么情况下触发，自然语言，AI 写入
  -- 如：「对方长时间沉默超过 30 秒」
  --     「用户迟到或让角色等待」
  --     「对话中出现争吵迹象」

  behavior_response TEXT        NOT NULL,
  -- 触发时角色的行为倾向，格式接近 prompt 指令
  -- 如：「不追问，先转移话题说别的，等她自己开口」
  --     「表现平静，但话会变少，等对方先道歉」

  -- ── 权重（用于筛选注入哪些 implicit 记忆）───────────────────
  significance      REAL        NOT NULL DEFAULT 0.5,
  weight            REAL        NOT NULL,
  -- implicit 没有检索，但有多条时按 weight 排序决定注入哪些

  -- ── 激活统计 ─────────────────────────────────────────────────
  activation_count            INTEGER     NOT NULL DEFAULT 0,
  recent_activation_density   REAL        NOT NULL DEFAULT 0.0,
  last_activated_at           TIMESTAMPTZ,
  last_modified_at            TIMESTAMPTZ,
  -- implicit 记忆会随经历更新（trigger_condition / behavior_response 可被改写）
  -- last_modified_at 记录上次改写时间

  -- ── 层级转化 ─────────────────────────────────────────────────
  derived_from      TEXT[]      NOT NULL DEFAULT '{}',
  -- 从哪些情节记忆的行为模式积累形成
  -- 如：["ep_xxx","ep_yyy"] 多次等待场景积累 → 形成此内隐行为

  absorbed_by       TEXT[]      NOT NULL DEFAULT '{}',
  absorption_level  REAL        NOT NULL DEFAULT 0.0,
  -- 新的 implicit 条目可以吸收/覆盖旧的（行为模式被更新的习惯取代）

  -- ── 来源关联 ─────────────────────────────────────────────────
  source_hints      JSONB       NOT NULL DEFAULT '[]',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()

  -- 注意：以下字段在 implicit 中不存在（与 episodic/semantic 的差异）
  -- summary / summary_vector → 不走检索，不需要
  -- memory_text              → 由 trigger_condition + behavior_response 替代
  -- emotion_tags_text / emotion_vector → 行为指令无情绪向量
  -- emotion_intensity / emotion_processed → 无适用语义
  -- sensory_tags / location_tag / time → 无适用语义
  -- detail_clarity / emotion_clarity    → 行为指令没有清晰度概念
  -- distortion_bias / reconstructed_count → implicit 的演变是改写而非扭曲
  -- cluster_id / suppression_count       → 不参与 RIF

);
```

### 5.2 约束与索引

```sql
ALTER TABLE memories_implicit ADD CONSTRAINT im_weight_range
  CHECK (weight BETWEEN 0.0 AND 1.0);
ALTER TABLE memories_implicit ADD CONSTRAINT im_significance_range
  CHECK (significance BETWEEN 0.0 AND 1.0);
ALTER TABLE memories_implicit ADD CONSTRAINT im_absorption_level_range
  CHECK (absorption_level BETWEEN 0.0 AND 1.0);

-- 主查询：角色配置层加载时，按 weight 取 top N 条注入 prompt
CREATE INDEX idx_im_char_weight
  ON memories_implicit (character_id, weight DESC);

-- 按来源 persona 筛选（可选）
CREATE INDEX idx_im_char_persona
  ON memories_implicit (character_id, persona_id)
  WHERE persona_id IS NOT NULL;

CREATE INDEX idx_im_derived_from ON memories_implicit USING gin (derived_from);
```

---

## 六、`working_memories` — 工作记忆表

跨对话的「此刻需要记着的事」，不是过去事件，是当下状态和近期计划。

每次对话开始时全量扫描 active 条目注入上下文，不走向量检索。

```sql
CREATE TABLE working_memories (

  id                TEXT        PRIMARY KEY,
  -- 格式：wm_{ULID}

  character_id      TEXT        NOT NULL,
  persona_id        TEXT        NOT NULL,

  zone              TEXT        NOT NULL DEFAULT 'working'
                                CHECK (zone = 'working'),

  -- ── 内容 ─────────────────────────────────────────────────────
  memory_text       TEXT        NOT NULL,
  -- 自然语言，直接拼入上下文
  -- 如：「用户这几天感冒，昨天说有好转」
  --     「用户明天要出差，周五回来」
  --     「角色答应帮用户查一件事，还没做」

  relevance_type    TEXT        NOT NULL,
  -- current_state  → 当前进行中的状态
  -- near_plan      → 近期确定的计划或约定
  -- pending_action → 待处理的事项

  -- ── 时效管理 ─────────────────────────────────────────────────
  expires_at        TIMESTAMPTZ,
  -- 到期后程序自动将 status → expired
  -- NULL 表示无明确截止时间，靠 resolve_condition 触发

  resolve_condition JSONB,
  -- 结构化触发条件（可程序化判断，不是自然语言）
  -- {"type": "keyword", "value": "感冒好了"}  → 对话出现关键词
  -- {"type": "time",    "value": "2026-04-28"} → 特定日期
  -- {"type": "manual"}                         → 用户手动标记
  -- {"type": "ai_judge"}                       → AI 每轮判断（成本最高，慎用）

  -- ── 注入控制 ─────────────────────────────────────────────────
  priority          REAL        NOT NULL DEFAULT 0.5,
  -- 0-1，全量注入时的排序依据

  status            TEXT        NOT NULL DEFAULT 'active',
  -- active   → 有效，每次对话自动注入
  -- expired  → 时间到期，停止注入，保留记录
  -- resolved → 触发条件满足，停止注入，保留记录
  -- 失效后不删除，打标记保留，支持审查和回退

  -- ── 来源 ─────────────────────────────────────────────────────
  created_by        TEXT        NOT NULL DEFAULT 'system',
  -- user      → 用户手动创建（如备忘录功能）
  -- character → 角色在对话中自动创建（「我提醒你...」）
  -- system    → 系统根据日程/时间线事件自动生成

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- updated_at 在 status 变更时更新

);

-- 约束
ALTER TABLE working_memories ADD CONSTRAINT wm_relevance_type_check
  CHECK (relevance_type IN ('current_state', 'near_plan', 'pending_action'));

ALTER TABLE working_memories ADD CONSTRAINT wm_status_check
  CHECK (status IN ('active', 'expired', 'resolved'));

ALTER TABLE working_memories ADD CONSTRAINT wm_priority_range
  CHECK (priority BETWEEN 0.0 AND 1.0);

ALTER TABLE working_memories ADD CONSTRAINT wm_created_by_check
  CHECK (created_by IN ('user', 'character', 'system'));

-- 索引
-- 主查询：每次对话开始时的全量扫描
CREATE INDEX idx_wm_active
  ON working_memories (character_id, persona_id, priority DESC)
  WHERE status = 'active';

-- 到期扫描：定时任务检查过期
CREATE INDEX idx_wm_expires
  ON working_memories (expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;
```

---

## 七、`character_drive_core` — 驱动核表

角色记忆系统的运行参数层，决定检索偏好和连锁激活风格。每个角色一条记录。

```sql
CREATE TABLE character_drive_core (

  character_id      TEXT        PRIMARY KEY,

  -- ── 人格向量 ─────────────────────────────────────────────────
  personality_vector  vector(768),
  -- 描述角色性格的语义向量，初始化方式待设计
  -- 漂移极慢（月/年级别），由长期激活积累触发

  -- ── 检索偏好（六种检索模式的权重系数）──────────────────────
  -- 不同性格的角色，被情绪 vs 画面 vs 语义激活的倾向不同
  -- 汇总层从驱动核动态读取，不硬编码
  rp_semantic       REAL        NOT NULL DEFAULT 0.400,
  rp_emotion        REAL        NOT NULL DEFAULT 0.300,
  rp_sensory        REAL        NOT NULL DEFAULT 0.150,
  rp_people         REAL        NOT NULL DEFAULT 0.100,
  rp_time           REAL        NOT NULL DEFAULT 0.025,
  rp_location       REAL        NOT NULL DEFAULT 0.025,
  -- 六项之和约为 1.0，由应用层保证（不在 DB 层 CHECK，允许浮点微差）

  -- ── 连锁激活风格 ─────────────────────────────────────────────
  chain_activation_style  TEXT  NOT NULL DEFAULT 'secure',
  -- avoidant → 相关记忆 weight 不升反降，话题漂移，越聊越模糊
  -- anxious  → 连锁过度激活，记忆大量涌出，难以控制
  -- secure   → 平稳浮现，越聊越清晰

  -- ── 习惯模式摘要 ─────────────────────────────────────────────
  habit_patterns_summary  TEXT,
  -- 从所有 implicit 记忆定期重新生成（如每周一次）
  -- 直接注入角色配置层，NULL 表示尚未生成

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT drive_core_chain_style_check
    CHECK (chain_activation_style IN ('avoidant', 'anxious', 'secure'))

);
```

---

## 八、各表字段对比

| 字段 | episodic | semantic | implicit | working |
|------|:--------:|:--------:|:--------:|:-------:|
| id / character_id / persona_id | ✅ | ✅ | ✅ | ✅ |
| zone | short/long | 固定 | 固定 | 固定 |
| summary + summary_vector | ✅ | ✅ | ❌ | ❌ |
| memory_text | ✅ | ✅ | ❌ | ❌ |
| trigger_condition + behavior_response | ❌ | ❌ | ✅ | ❌ |
| memory_text（working） | ❌ | ❌ | ❌ | ✅ |
| emotion_tags_text + emotion_vector | ✅ | ✅ | ❌ | ❌ |
| emotion_intensity + emotion_processed | ✅ | ❌ | ❌ | ❌ |
| sensory_tags | ✅ | ✅ | ❌ | ❌ |
| people_tags | ✅ | ✅ | ❌ | ❌ |
| location_tag | ✅ | ❌ | ❌ | ❌ |
| time | ✅ | ❌ | ❌ | ❌ |
| significance + weight | ✅ | ✅ | ✅ | ❌ |
| detail_clarity + emotion_clarity | ✅ | ✅ | ❌ | ❌ |
| distortion_bias + reconstructed_count | ✅ | ✅ | ❌ | ❌ |
| activation 统计字段 | ✅ | ✅ | ✅ | ❌ |
| derived_from + absorbed_by + absorption_level | ✅ | ✅ | ✅ | ❌ |
| ~~cluster_id + suppression_count~~（已废弃） | ❌ | ❌ | ❌ | ❌ |
| source_hints | ✅ | ✅ | ✅ | ❌ |
| relevance_type + expires_at + resolve_condition | ❌ | ❌ | ❌ | ✅ |
| priority + status + created_by | ❌ | ❌ | ❌ | ✅ |

---

## 九、典型查询示例

```sql
-- 语义检索（episodic + semantic 各走一遍，应用层合并排序）
SELECT 'episodic' AS source, id, summary, memory_text, weight,
       1 - (summary_vector <=> $1::vector) AS similarity
FROM memories_episodic
WHERE character_id = $2 AND persona_id = $3
  AND weight > 0.1 AND absorption_level < 0.9
ORDER BY summary_vector <=> $1::vector
LIMIT 15;

SELECT 'semantic' AS source, id, summary, memory_text, weight,
       1 - (summary_vector <=> $1::vector) AS similarity
FROM memories_semantic
WHERE character_id = $2 AND persona_id = $3
  AND weight > 0.1 AND absorption_level < 0.9
ORDER BY summary_vector <=> $1::vector
LIMIT 10;
-- 结果在应用层合并，汇总层综合打分后取 top 5

-- 人物检索（仅 episodic + semantic）
SELECT 'episodic' AS source, id, summary, memory_text, weight, time
FROM memories_episodic
WHERE character_id = $1 AND persona_id = $2
  AND people_tags @> ARRAY[$3] AND weight > 0.1
ORDER BY weight DESC, time DESC LIMIT 10;

SELECT 'semantic' AS source, id, summary, memory_text, weight
FROM memories_semantic
WHERE character_id = $1 AND persona_id = $2
  AND people_tags @> ARRAY[$3] AND weight > 0.1
ORDER BY weight DESC LIMIT 5;

-- Implicit 加载（角色配置层初始化时）
SELECT id, trigger_condition, behavior_response, weight
FROM memories_implicit
WHERE character_id = $1 AND weight > 0.2
ORDER BY weight DESC
LIMIT 20;

-- Working 全量注入（每次对话开始）
SELECT id, memory_text, relevance_type, priority
FROM working_memories
WHERE character_id = $1 AND persona_id = $2 AND status = 'active'
ORDER BY priority DESC;

-- RIF 压制（命中记忆后，对 episodic + semantic 各执行一次相似度查询）
-- ⚠️ cluster_id / suppression_count 已废弃，RIF 改用实时相似度实现
-- 见「十一、字段废弃说明」
```

---

## 十、待确认问题

Schema 层已为以下问题预留字段，规则由上层逻辑定义：

| # | 问题 | 相关字段 |
|---|------|---------|
| 1 | weight 衰减曲线 | weight / recent_activation_density |
| 2 | detail_clarity / emotion_clarity 衰减速度 | 两字段 + last_modified_at |
| 3 | 重构写回阈值 | reconstructed_count / last_modified_at |
| 4 | personality_vector 初始化方式 | character_drive_core.personality_vector |
| 5 | implicit 记忆是否按 persona 隔离 | memories_implicit.persona_id（当前允许 NULL） |

---

## 十一、字段废弃说明

> ⚠️ 本章记录在 Schema 设计过程中明确废弃的字段。  
> **v4 设计文档及其他文档中仍有这些字段的相关描述，以本文档为准，对应内容需要同步更新。**

---

### `cluster_id` · 记忆簇标签 — 已废弃

**原设计**：给每条记忆打上所属簇的标签（如「咖啡厅」「NPC_小李」），同簇记忆在 RIF 机制中互相竞争，检索到 A 时同簇的 B/C 被压制。

**废弃原因**：

存储方式无法解决的矛盾——存名字需要标准化词表且难以维护，存 ID 需要维护一张 cluster 实体表。更根本的问题是标签静态而记忆关联是动态的，一条记忆随着时间发展与不同线索的关联程度会变化，静态标签反映不了这种变化。

**替代方案**：RIF 机制改为实时相似度计算。检索命中记忆 A 后，用 A 的 `summary_vector` / `emotion_vector` 对记忆库做一次相似度查询，最近的 N 条即为竞争者，`suppression_count` 对这些记忆 +1。相似度本身定义「同类」，不需要预先打标签。

**需要同步更新的位置**：
- v4 设计文档 §3.1 字段列表中的 `cluster_id` 字段
- v4 设计文档 §十三「RIF 与 cluster_id 的逻辑」整章
- v4 设计文档 §十九「待设计模块」第 14 条「cluster_id 的自动生成规则」
- v4 设计文档 §十八「设计疑问」疑问 6

---

### `suppression_count` · RIF 压制次数 — 已废弃

**原设计**：记录某条记忆被 RIF 机制压制的累计次数，作为 weight 衰减公式的输入。

**废弃原因**：依赖 `cluster_id` 实现，cluster_id 废弃后此字段失去计算来源。

**替代方案**：RIF 压制改为实时相似度查询后，压制效果直接反映在 weight 的更新上，不需要单独计数字段。weight 衰减公式的输入改为 `recent_activation_density`（近期激活密度）。

**需要同步更新的位置**：
- v4 设计文档 §3.1 字段列表中的 `suppression_count` 字段
- v4 设计文档 §三点五「字段完整目录」中的 `suppression_count` 条目
- v4 设计文档 §十九「待设计模块」第 11 条「RIF 的具体压制规则」（需注明实现方式变更）
- 本文档「十、待确认问题」第 1 条已同步移除对 suppression_count 的引用

---

*🦀 Agnes × 小克*
