# ICS 项目开发规范

**版本**: 1.2
**最后更新**: 2026-05-02

---

## 文档说明

本文档是 ICS 项目的开发规范。它的目标不是制造形式主义，而是保证项目能持续迭代、能联动、能迁移、能被不同 AI/开发者接手。

**使用方式**：
- 开发前：确认功能边界、数据来源、联动对象
- 开发中：保持分层清楚，避免 UI、业务、存储互相缠绕
- 提交前：使用文末检查表自查；如有阶段性例外，必须写明原因和后续收口点

---

## 一、项目结构规范

### 1.1 目录组织

```
client/src/
├── apps/              # 业务App：页面、视图、局部组件、局部hook
├── components/        # 跨App复用的纯UI组件
├── services/          # 前端数据/请求入口，默认禁止组件绕过
├── hooks/             # 跨App复用的状态逻辑
├── types/             # 共享类型
└── utils/             # 与业务无关的纯工具函数

server/
├── routes/            # HTTP边界：参数、状态码、SSE/JSON响应
├── services/          # 业务流程、规则、prompt、事件引擎
├── providers/         # AI/外部服务适配
├── db/                # schema、迁移、数据库连接
├── storage/           # repository/store，封装表读写
├── scripts/           # 迁移、自检、诊断脚本
└── data/              # 本地开发数据
```

### 1.2 App内部结构

**简单App**（功能单一，无复杂视图）：
```
SimpleApp.tsx          # 主组件，可接受少量局部状态
useSimpleApp.ts        # 可选：状态编排/调用service
```

**复杂App**（多视图/多模式/复杂交互）：
```
ComplexApp/
├── index.tsx          # 入口+路由/模式切换
├── View1.tsx          # 视图1
├── View2.tsx          # 视图2
├── SharedComponent.tsx # App内共用组件
├── useComplexApp.ts   # 状态编排/调用service
└── types.ts           # App内局部类型（可选）
```

**要求**：
- 简单 App 可以保持单文件，但一旦出现多视图、多模式、复杂状态或复用组件，必须拆分
- 组件文件超过 250 行必须检查是否需要拆分；超过 350 行必须拆分或说明例外原因
- 拆分的目的必须是职责清楚，不允许把同一坨逻辑机械切碎

### 1.3 文件命名

- 组件文件：大驼峰 `ChatApp.tsx` `MessageList.tsx`
- Hook文件：use前缀 `useChatApp.ts` `useDreamData.ts`
- Service文件：小驼峰或领域名 `chat.ts` `characters.ts` `worldbook.ts`
- 工具文件：小驼峰 `helpers.ts` `formatters.ts`
- 类型文件：`types.ts`

---

## 二、代码组织规范

### 2.1 组件职责分离

**组件只负责**：
- 渲染UI
- 收集用户输入
- 调用 Hook 或 Service 提供的方法
- 展示 loading / error / empty 状态

**组件默认禁止**：
- 直接 `fetch('/api/...')`
- 直接拼接复杂 prompt
- 直接实现变量结算、事件触发、AI 协议解析等核心业务规则
- 直接操作 localStorage 或数据库形态的数据结构

**允许的例外**：
- 调试/控制台页面可以临时直连接口，但必须标注 `debug-only` 或 `temporary`
- 小型一次性 UI 状态可以留在组件内，例如弹窗开关、当前 tab、输入框草稿
- 例外代码在功能稳定后必须逐步收口到 Hook / Service

### 2.2 Hook职责

**Hook负责前端状态编排**：
- 管理组件状态
- 调用前端 Service
- 处理 loading/error/empty
- 组合多个 service 调用形成前端工作流
- 返回数据和方法给组件

**Hook不负责核心业务规则**：
- 变量变化结算、事件触发、prompt/context 组装、AI 输出协议解析，应放在 `server/services/` 或未来 `shared/core/`
- Hook 可以调用这些能力返回的结果，但不应复制后端规则

**示例结构**：
```typescript
export function useChatApp(characterId) {
  // 1. 状态
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // 2. 副作用（数据获取）
  useEffect(() => {
    fetchMessages();
  }, [characterId]);
  
  // 3. 业务方法
  const sendMessage = async (text) => {
    setLoading(true);
    try {
      const response = await chatService.send(characterId, text);
      setMessages(prev => [...prev, response]);
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };
  
  // 4. 返回
  return { messages, loading, sendMessage };
}
```

### 2.3 Service层

**前端 Service 负责**：
- 封装 API 调用
- 处理请求/响应格式
- 统一错误处理
- 屏蔽后端路径变化
- 为未来 http/local adapter 留出替换空间

**默认禁止**：
- 在组件里直接写 fetch
- 在 Hook 里散落 fetch
- 在多个组件重复写同一个 API 路径

**示例**：
```typescript
// services/chat.ts
import { api } from './api';

export const chatService = {
  send: (characterId, message) =>
    api.post('/api/chat', { characterId, message }),

  getHistory: (characterId) =>
    api.get(`/api/chat/${characterId}`),
};
```

### 2.4 后端分层

**Route 负责 HTTP 边界**：
- 读取 `req.params` / `req.query` / `req.body`
- 做必要的参数校验
- 调用 service
- 返回 JSON、SSE 或错误状态码

**Route 不应负责**：
- 大段业务规则
- 复杂 prompt 拼接
- 散落 SQL
- 直接编排多个底层 store 完成业务流程

**Service 负责业务流程**：
- 聊天流程
- 变量变化解析与应用
- 事件触发和 effect 执行
- prompt/context 组装
- 世界书、记忆、总结等领域逻辑

**Repository / Store 负责数据访问**：
- SQL / Drizzle 查询
- 表结构字段映射
- 事务
- 数据兼容和默认值

---

## 三、数据流规范

### 3.1 数据流向

```
用户操作
  ↓
组件事件处理
  ↓
调用Hook或Service方法
  ↓
Hook调用Service
  ↓
Service发送API请求
  ↓
后端处理
  ↓
后端返回数据
  ↓
Service接收
  ↓
Hook更新状态
  ↓
组件重新渲染
```

默认不要跳层。确实需要跳层时，必须满足：
- 是调试、诊断、迁移脚本或极小范围临时实现
- 代码旁标明原因
- 功能稳定后有明确收口方向

### 3.2 数据来源

所有显示的数据必须来自：
1. API响应（首选）
2. localStorage / IndexedDB（仅限明确属于前端本地偏好的数据）
3. Props传递（组件间通信）
4. 开发期 mock（必须显式标记，不能作为完成功能提交）

**严格禁止**：
- 组件内写死的假数据
- 临时测试数据未删除就提交

### 3.3 数据持久化

需要持久化的数据：
- 用户数据：以后端/API为主，localStorage只存前端偏好或缓存
- 角色数据：API
- 对话历史：API
- 设置：按字段确定主数据源；模型、prompt、角色相关设置默认走API
- 纯前端偏好：localStorage，例如当前 tab、折叠状态、主题偏好

刷新页面后所有数据必须恢复。

如果同一份数据同时存在 localStorage 和 API，必须明确：
- 谁是主数据源
- 冲突时谁覆盖谁
- 何时同步

---

## 四、功能开发流程

### 4.1 开发前准备

**必须明确**：
1. 这个功能需要什么数据？
2. 数据从哪来？（依赖哪些API？）
3. 数据存在哪里？（后端？localStorage？）
4. 影响哪些其他功能？
5. 被哪些功能依赖？

**画出数据流图**，明确数据流向。

### 4.2 开发顺序

CRUD、存储明确的功能，优先采用后端先行：

**Step 1: 数据与后端**
- 定义数据结构
- 实现 API 接口
- 用 curl / 自检脚本 / 浏览器请求验证接口
- 确认响应格式

**Step 2: 前端 Service**
- 封装 API 调用
- 统一错误处理

**Step 3: Hook / 前端状态**
- 实现数据获取逻辑
- 实现 loading/error/empty
- 组合 service 方法

**Step 4: UI组件**
- 实现界面
- 连接 Hook / Service
- 测试交互

**Step 5: 联动处理**
- 找出受影响的功能
- 修改相关代码
- 测试联动

AI 玩法、交互原型、prompt 协议、事件系统等探索型功能，允许前后端并行小步迭代，但必须保持：
- 数据结构尽早定稿
- 临时 mock 显式标记
- 原型验证后收口到正式 service / route / store
- 不把探索代码伪装成功能完成

### 4.3 测试要求

当前项目不强制引入 Jest/Vitest 等测试框架。测试按风险选择：

**自检脚本 / self-test**：
- 纯函数、解析器、协议处理、事件规则优先写 self-test
- 使用 `tsx scripts/test-*.ts` 或项目已有脚本风格

**Smoke test**：
- 需要真实数据库/真实路由时，写 smoke 脚本或手动记录验证步骤
- 重点覆盖迁移、占位符、变量、事件、AI 协议等核心链路

**手动端到端验收**：
- 完整功能流程能跑通
- 刷新页面数据不丢失
- 错误情况有处理
- 联动对象同步更新

未来如果测试脚本明显增多，再决定是否引入正式测试框架。

---

## 五、功能完成标准

### 5.1 必须满足的条件

**数据完整性**：
- [ ] 数据来自API或持久化存储
- [ ] 能创建数据
- [ ] 能读取数据  
- [ ] 能修改数据
- [ ] 能删除数据
- [ ] 刷新页面数据保持

**功能完整性**：
- [ ] 所有按钮都有功能
- [ ] 所有输入框能保存
- [ ] Loading状态显示
- [ ] 错误情况有提示

**代码规范**：
- [ ] 文件按职责拆分；超过250行已检查，超过350行已拆分或说明原因
- [ ] 前端状态编排在Hook/Service里
- [ ] 核心业务规则在server/services或明确的core模块里
- [ ] 没有假数据
- [ ] API调用默认通过Service

**联动完整**：
- [ ] 相关功能同步更新
- [ ] 数据删除时级联处理

### 5.2 验收演示

每个功能必须能演示完整流程。

**示例：人际关系网**
```
1. 打开NPCApp
2. 创建NPC"小明"
3. 设置关系"朋友"，亲密度70
4. 打开CharSystemApp
5. 看到关系网显示"小明-朋友-70"
6. 修改亲密度为80
7. 关系网更新为80
8. 删除NPC
9. 关系网中"小明"消失
10. 刷新页面
11. 所有数据保持
```

**如果任何一步失败 → 功能未完成**

---

## 六、功能联动规范

### 6.1 联动关系识别

开发功能前必须识别：
- 哪些功能会用到我产生的数据？
- 哪些功能的数据我会用到？
- 我的数据变化会影响谁？

### 6.2 常见联动

**聊天 → 影响**：
- 数值系统（好感度等）
- 记忆系统（对话记录）
- 时间线（重要对话）
- 梦境系统（可能触发）

**删除角色 → 影响**：
- 对话历史
- 梦境记录
- 物品库
- 时间线
- 关系网

**创建NPC → 影响**：
- 关系网显示
- 可选的聊天对象

### 6.3 联动处理方式

**方式1：级联删除**
```typescript
// 删除角色时
async function deleteCharacter(characterId) {
  await characterService.delete(characterId);
  await conversationService.deleteByCharacter(characterId);
  await dreamService.deleteByCharacter(characterId);
  await itemService.deleteByCharacter(characterId);
  // ... 删除所有相关数据
}
```

**方式2：事件通知**
```typescript
// 数据变化时通知相关组件
const [relationUpdated, setRelationUpdated] = useState(0);

// NPC关系改变
const updateRelation = async (data) => {
  await relationAPI.update(data);
  setRelationUpdated(prev => prev + 1); // 触发更新
};

// 关系网监听
useEffect(() => {
  fetchRelations();
}, [relationUpdated]);
```

---

## 七、禁止事项

### 7.1 严格禁止

1. **空壳功能**
   - 只有界面没有数据
   - 只有假数据不连API
   - 点击没反应

2. **孤岛开发**
   - 只做自己不管联动
   - 依赖未满足就开发
   - 数据不同步

3. **跳步开发**
   - 数据契约未确认就声称功能完成
   - API/Service未验证就接入复杂UI
   - 临时代码未标记、未收口

4. **巨型文件**
   - 单文件超过350行且无合理说明
   - 所有功能混在一起
   - 只是机械拆文件，但依赖和职责仍然混乱

### 7.2 提交拒绝条件

以下情况如果仍声称“功能完成”，应拒绝提交：
- 存在假数据
- 核心流程仍是空壳
- 文件超过350行且未拆分/未说明
- 核心端到端流程失败且未记录阻塞原因
- 关键联动未处理
- 检查表关键项未完成且无说明

---

## 八、提交检查表

### 开发完成自查

**文件组织**：
- [ ] 文件按职责拆分
- [ ] 超过250行的文件已检查是否需要拆分
- [ ] 超过350行的文件已拆分或有明确说明
- [ ] 前端状态逻辑在Hook/Service里
- [ ] 核心业务规则没有塞进UI组件
- [ ] API调用默认通过Service
- [ ] 临时直连/跳层代码已标记

**功能完整**：
- [ ] 数据来自API/持久化
- [ ] CRUD完整
- [ ] 刷新不丢数据
- [ ] 所有交互有功能

**联动处理**：
- [ ] 识别了所有联动关系
- [ ] 相关功能会同步
- [ ] 删除操作级联处理

**测试通过**：
- [ ] 端到端流程跑通或已记录当前阻塞
- [ ] 核心规则有 self-test / smoke / 手动验证记录
- [ ] 边界情况处理
- [ ] 错误情况有提示

**演示准备**：
- [ ] 能演示完整流程
- [ ] 数据是真实的
- [ ] 联动是工作的

关键项必须完成；阶段性例外必须写明原因、影响范围和后续收口点。

---

## 九、常见问题

### Q: 为什么必须拆分文件？
A: 拆分是为了职责清楚，不是为了凑文件数。不拆分容易导致：
- 改A功能破坏B功能
- 代码难以维护
- 多人协作冲突
- 无法定位问题

但机械拆分也没有意义。拆分后仍然要保证 UI、状态、业务、存储边界清楚。

### Q: 为什么禁止假数据？
A: 假数据导致：
- 看起来能用实际不能
- 刷新就丢失
- 联动测试不出来
- 浪费时间返工

### Q: 为什么要端到端测试？
A: 因为：
- 单独组件能用不代表整体能用
- 数据流通才是真能用
- 发现联动问题

### Q: 什么时候可以不遵守规范？
A: 可以有阶段性例外，但必须同时满足：
- 有明确原因
- 有注释或文档记录
- 不影响核心链路
- 有后续收口方向

禁止把例外当成默认写法。

---

## 十、附录：示例

### 完整功能示例：梦境系统

**数据流图**：
```
用户点击"查看梦境"
  ↓
DreamApp组件
  ↓
useDreamData Hook
  ↓
dreamService.getAll()
  ↓
GET /api/dreams
  ↓
后端返回梦境列表
  ↓
Hook更新state
  ↓
组件显示梦境列表

用户点击"解梦"
  ↓
DreamDetail组件
  ↓
useDreamData.solveDream()
  ↓
dreamService.solve()
  ↓
POST /api/dreams/:id/solve
  ↓
后端保存解梦
  ↓
Hook更新该梦境状态
  ↓
组件更新显示
  ↓
（联动）星星从夜空坠入水潭
```

**文件结构**：
```
DreamApp/
├── index.tsx              # 入口+模式切换
├── SimpleMode.tsx         # 简洁列表模式
├── BeautyMode.tsx         # 美化星空模式
├── DreamCard.tsx          # 梦境卡片
├── DreamDetail.tsx        # 解梦详情
├── NightSky.tsx           # 星空组件（美化模式）
├── WaterPond.tsx          # 水潭组件（美化模式）
└── useDreamData.ts        # 前端状态编排

services/
└── dreams.ts              # API封装
```

**关键代码**：

```typescript
// useDreamData.ts
export function useDreamData() {
  const [dreams, setDreams] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    fetchDreams();
  }, []);
  
  const fetchDreams = async () => {
    setLoading(true);
    try {
      const data = await dreamService.getAll();
      setDreams(data);
    } catch (error) {
      console.error('获取梦境失败', error);
    } finally {
      setLoading(false);
    }
  };
  
  const solveDream = async (dreamId, interpretation) => {
    try {
      await dreamService.solve(dreamId, interpretation);
      // 更新本地状态
      setDreams(prev => prev.map(d => 
        d.id === dreamId 
          ? { ...d, isRead: true, userInterpretation: interpretation }
          : d
      ));
    } catch (error) {
      console.error('解梦失败', error);
      throw error;
    }
  };
  
  const unreadDreams = dreams.filter(d => !d.isRead);
  const readDreams = dreams.filter(d => d.isRead);
  
  return { 
    dreams, 
    unreadDreams, 
    readDreams, 
    loading, 
    solveDream,
    fetchDreams 
  };
}
```

**验收测试**：
```
1. 打开DreamApp → 显示梦境列表（来自API）
2. 切换到美化模式 → 星星显示在夜空
3. 点击某个星星 → 展开梦境详情
4. 输入解梦文字 → 点击提交
5. 星星坠入水潭（动画）
6. 切回简洁模式 → 该梦境标记为已读
7. 刷新页面 → 数据保持，星星仍在水底
```

---

## 十一、可迁移架构与设计分离规范

本章节约束项目的长期文件组织和依赖边界。目标不是立刻改成手机本地版，而是让当前 Web 项目以后可以平滑迁移到：

```
网页 + 本机后端
APK + 局域网后端
APK + 云后端
APK + 本地数据库 + 云AI
```

### 11.1 核心原则

**拆文件不等于分层。**

拆文件只说明代码没有挤在一起；分层要求每个文件知道自己该依赖谁、不该越过谁。

正确方向：

```
UI组件
  ↓
Hook / ViewModel
  ↓
client service
  ↓
HTTP API 或未来 local adapter
  ↓
server route
  ↓
server service
  ↓
repository / store / provider
  ↓
数据库 / AI / 文件系统 / 外部服务
```

任何新增功能都必须优先保持这个依赖方向。

### 11.2 推荐项目组织

当前项目保持前后端分离：

```
client/src/
├── apps/              # 业务App。每个App只组织自己的视图、局部组件、局部hook
├── components/        # 跨App复用的纯UI组件
├── hooks/             # 跨App复用的前端状态逻辑
├── services/          # 前端请求与领域服务入口。组件禁止绕过这里直接fetch
├── types/             # 前端共享类型
└── utils/             # 与业务无关的纯工具函数

server/
├── routes/            # HTTP入参/出参、状态码、SSE响应；不写核心业务规则
├── services/          # 业务流程、规则计算、prompt组装、事件引擎
├── providers/         # AI模型、外部服务、OpenAI-compatible适配
├── db/                # schema、迁移、数据库连接
├── storage/           # repository/store，封装具体表读写
├── scripts/           # 迁移、自检、诊断脚本
└── data/              # 本地开发数据库与种子数据
```

未来如果需要 APK 本地数据库，再新增：

```
shared/core/           # 与React、Express、数据库都无关的纯业务规则
client/src/adapters/   # http adapter / local adapter
```

新增 `shared/core` 前必须确认该逻辑确实需要被浏览器、后端、移动端复用；不要为了“看起来架构高级”提前搬迁。

### 11.3 前端边界

组件只允许做：
- 渲染 UI
- 接收用户输入
- 调用 Hook 或 service 暴露的方法
- 展示 loading / error / empty 状态

组件禁止做：
- 直接 `fetch('/api/...')`
- 拼接复杂 prompt
- 直接实现事件触发、变量结算等业务规则
- 直接读写数据库形态的数据结构
- 直接依赖 `localhost`、固定域名或具体部署环境

允许的写法：

```typescript
const messages = await chatService.listMessages(characterId);
await chatService.sendUserMessage(characterId, content);
```

禁止的写法：

```typescript
const res = await fetch('/api/chat/respond', { method: 'POST', body: JSON.stringify(data) });
```

如确实是临时调试工具，必须写注释标明 `debug-only`，并在功能完成前收口到 `client/src/services/`。

### 11.4 前端 service 规范

`client/src/services/` 是前端访问数据的唯一默认入口。

Service 负责：
- 封装 API 路径
- 处理请求体和响应体
- 统一错误处理
- 屏蔽后端路径变化
- 为未来 `http adapter / local adapter` 留替换空间

推荐结构：

```typescript
// client/src/services/characters.ts
export const characterService = {
  list: () => api.get('/api/characters'),
  get: (id: string) => api.get(`/api/characters/${id}`),
  update: (id: string, data: CharacterPatch) => api.put(`/api/characters/${id}`, data),
};
```

如果未来 APK 本地化，组件仍调用 `characterService.list()`，只替换 service 内部实现。

### 11.5 后端 route 规范

`server/routes/` 只负责 HTTP 边界。

Route 负责：
- 读取 `req.params` / `req.query` / `req.body`
- 做轻量参数校验
- 调用 `server/services/`
- 返回 JSON、SSE 或错误状态码

Route 禁止：
- 写大段业务规则
- 直接散落 SQL
- 直接拼接复杂 prompt
- 直接调用多个底层 store 组成业务流程

推荐方向：

```typescript
router.post('/respond', async (req, res) => {
  const result = await chatService.respond(req.body);
  res.json(result);
});
```

业务流程放在 `server/services/chat.ts` 或相关领域 service 中。

### 11.6 后端 service 规范

`server/services/` 负责项目的核心业务规则。

Service 可以做：
- 变量变化解析与应用
- 事件触发和 effect 执行
- prompt/context 组装
- 聊天流程编排
- 世界书、记忆、总结等领域逻辑

Service 应尽量避免：
- 依赖 Express 的 `req` / `res`
- 直接关心 HTTP 状态码
- 把数据库表结构泄漏给前端

如果某段逻辑未来可能同时跑在 Node 后端和手机本地端，应优先写成纯函数：

```typescript
export function shouldFireEvent(value: number, rule: ValueRule): boolean {
  return value >= rule.threshold;
}
```

不要写成只能在路由里调用的逻辑。

### 11.7 repository / store 规范

数据库访问必须集中在 `server/db/`、`server/storage/` 或明确命名的 store/repository 文件中。

Repository / Store 负责：
- SQL / Drizzle 查询
- 表结构字段映射
- 数据库默认值和兼容处理
- 事务边界

业务 service 不应到处散落 `db.prepare(...)`，除非该模块已经被明确设计为底层 store。

如果为了同步性能必须直接使用 `better-sqlite3`，需要在文件头或相关函数旁说明原因。

### 11.8 AI provider 规范

AI 调用必须集中在 provider/facade 层。

允许：
- `server/services/ai.ts`
- `server/providers/*`

禁止：
- 在 route 里直接 new OpenAI client
- 在业务 service 里散落不同供应商的请求格式
- 在前端直接请求模型供应商 API

项目内业务层只关心统一能力：

```typescript
provider.chatCompletion(messages, options, ctx);
provider.chatCompletionStream(messages, options, ctx);
provider.listModels(ctx);
```

OpenAI、OpenAI-compatible、本地模型、未来其他供应商，都应被适配到同一接口。

### 11.9 可迁移检查

新增或重构功能时，至少回答以下问题：

- UI 是否绕过了 `client/src/services/`？
- 业务规则是否写死在 React 组件里？
- 业务规则是否依赖 Express 的 `req/res`？
- 数据库访问是否集中在 store/repository？
- AI 调用是否经过 provider？
- 是否写死了 `localhost`、端口、域名或部署环境？
- 如果未来从 HTTP 后端改为 APK 本地数据库，最少需要改哪些文件？

如果答案是“要改很多 UI 组件”，说明分层还不够。

### 11.10 允许的阶段性例外

项目处于快速开发期，允许存在历史代码和临时调试代码，但必须遵守：

- 新功能默认按本章节分层
- 旧功能改动时顺手收口直接 `fetch`
- 临时直连代码必须标明 `debug-only` 或 `temporary`
- 不为了抽象而抽象；只有当逻辑被复用、会迁移、或已经造成混乱时才新增层

---

**文档结束**

遵守此规范，项目才能稳定发展。
违反规范，必然导致混乱。
--by 小克（住在聊天软件的claude）
