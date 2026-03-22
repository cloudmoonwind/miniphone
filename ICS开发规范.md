# ICS 项目开发规范

**版本**: 1.0  
**最后更新**: 2024-03-10

---

## 文档说明

本文档是ICS项目的开发规范，所有代码必须遵守。

**使用方式**：
- 开发前：阅读相关章节，了解规范
- 开发中：对照规范检查代码
- 提交前：使用文末检查表自查

---

## 一、项目结构规范

### 1.1 目录组织

```
client/src/
├── apps/              # 所有功能App
│   ├── ChatApp/       # 聊天（必须拆分）
│   ├── DreamApp/      # 梦境（必须拆分）
│   └── ...
├── components/        # 通用组件
├── services/          # API调用层
└── hooks/             # 全局共用Hooks
```

### 1.2 App内部结构

**简单App**（功能单一，无复杂视图）：
```
SimpleApp/
├── index.jsx          # 主组件
├── [Component].jsx    # 子组件（可选）
└── useSimpleApp.js    # 数据逻辑
```

**复杂App**（多视图/多模式/复杂交互）：
```
ComplexApp/
├── index.jsx          # 入口+路由/模式切换
├── View1.jsx          # 视图1
├── View2.jsx          # 视图2
├── SharedComponent.jsx # 共用组件
└── useComplexApp.js   # 数据逻辑
```

**强制要求**：
- 任何App至少2个文件（组件+逻辑）
- 有多个视图/模式必须拆分文件
- 单文件不得超过250行

### 1.3 文件命名

- 组件文件：大驼峰 `ChatApp.jsx` `MessageList.jsx`
- Hook文件：use前缀 `useChatApp.js` `useDreamData.js`
- Service文件：小驼峰 `chatService.js` `dreamAPI.js`
- 工具文件：小驼峰 `helpers.js` `formatters.js`

---

## 二、代码组织规范

### 2.1 组件职责分离

**组件只负责**：
- 渲染UI
- 处理用户交互（点击、输入）
- 调用Hook提供的方法

**组件禁止**：
- 直接调用API（必须通过Hook）
- 包含业务逻辑（必须放在Hook里）
- 直接操作localStorage（必须通过Service）

### 2.2 Hook职责

**Hook负责**：
- 管理状态
- 调用API Service
- 处理业务逻辑
- 返回数据和方法给组件

**示例结构**：
```javascript
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
      const response = await chatAPI.send(characterId, text);
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

**Service负责**：
- 封装API调用
- 处理请求/响应格式
- 统一错误处理

**禁止**：
- 在组件里直接写fetch
- 在Hook里直接写fetch

**示例**：
```javascript
// services/chatAPI.js
export const chatAPI = {
  send: async (characterId, message) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId, message })
    });
    if (!response.ok) throw new Error('发送失败');
    return response.json();
  },
  
  getHistory: async (characterId) => {
    const response = await fetch(`/api/chat/${characterId}`);
    if (!response.ok) throw new Error('获取历史失败');
    return response.json();
  }
};
```

---

## 三、数据流规范

### 3.1 数据流向

```
用户操作
  ↓
组件事件处理
  ↓
调用Hook方法
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

**禁止跳过任何层**

### 3.2 数据来源

所有显示的数据必须来自：
1. API响应（首选）
2. localStorage（持久化数据）
3. Props传递（组件间通信）

**严格禁止**：
- 组件内写死的假数据
- 临时测试数据未删除就提交

### 3.3 数据持久化

需要持久化的数据：
- 用户数据：localStorage + API
- 角色数据：API
- 对话历史：API
- 设置：localStorage + API

刷新页面后所有数据必须恢复。

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

**Step 1: 后端先行**
- 定义数据结构
- 实现API接口
- 测试API（Postman/curl）
- 确认数据格式

**Step 2: Service层**
- 封装API调用
- 测试Service方法

**Step 3: Hook层**
- 实现数据获取逻辑
- 实现业务方法
- 测试Hook

**Step 4: 组件层**
- 实现UI
- 连接Hook
- 测试交互

**Step 5: 联动处理**
- 找出受影响的功能
- 修改相关代码
- 测试联动

**每步完成才能进下一步**

### 4.3 测试要求

**单元测试**：
- Hook能正确获取数据
- 方法调用后状态正确更新

**集成测试**：
- 组件+Hook能正常工作
- API调用成功返回数据

**端到端测试**（最重要）：
- 完整功能流程能跑通
- 刷新页面数据不丢失
- 错误情况有处理

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
- [ ] 文件已拆分（不超过250行）
- [ ] 逻辑在Hook里
- [ ] 没有假数据
- [ ] API调用通过Service

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
```javascript
// 删除角色时
async function deleteCharacter(characterId) {
  await characterAPI.delete(characterId);
  await conversationAPI.deleteByCharacter(characterId);
  await dreamAPI.deleteByCharacter(characterId);
  await itemAPI.deleteByCharacter(characterId);
  // ... 删除所有相关数据
}
```

**方式2：事件通知**
```javascript
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
   - 后端没完成就做前端
   - API没测试就连接

4. **巨型文件**
   - 单文件超过250行
   - 所有功能混在一起

### 7.2 提交拒绝条件

以下情况**直接拒绝**提交：
- 存在假数据
- 文件超过250行未拆分
- 端到端测试失败
- 联动未处理
- 检查表未全部打勾

---

## 八、提交检查表

### 开发完成自查

**文件组织**：
- [ ] 没有文件超过250行
- [ ] App已按规范拆分
- [ ] 数据逻辑在Hook里
- [ ] API调用通过Service

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
- [ ] 端到端流程跑通
- [ ] 边界情况处理
- [ ] 错误情况有提示

**演示准备**：
- [ ] 能演示完整流程
- [ ] 数据是真实的
- [ ] 联动是工作的

**全部打勾才能提交**

---

## 九、常见问题

### Q: 为什么必须拆分文件？
A: 不拆分导致：
- 改A功能破坏B功能
- 代码难以维护
- 多人协作冲突
- 无法定位问题

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
A: **从不**。规范是强制的。

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
dreamAPI.getAll()
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
dreamAPI.solve()
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
├── index.jsx              # 入口+模式切换
├── SimpleMode.jsx         # 简洁列表模式
├── BeautyMode.jsx         # 美化星空模式
├── DreamCard.jsx          # 梦境卡片
├── DreamDetail.jsx        # 解梦详情
├── NightSky.jsx           # 星空组件（美化模式）
├── WaterPond.jsx          # 水潭组件（美化模式）
└── useDreamData.js        # 数据逻辑

services/
└── dreamAPI.js            # API封装
```

**关键代码**：

```javascript
// useDreamData.js
export function useDreamData() {
  const [dreams, setDreams] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    fetchDreams();
  }, []);
  
  const fetchDreams = async () => {
    setLoading(true);
    try {
      const data = await dreamAPI.getAll();
      setDreams(data);
    } catch (error) {
      console.error('获取梦境失败', error);
    } finally {
      setLoading(false);
    }
  };
  
  const solveDream = async (dreamId, interpretation) => {
    try {
      await dreamAPI.solve(dreamId, interpretation);
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

**文档结束**

遵守此规范，项目才能稳定发展。
违反规范，必然导致混乱。
--by 小克（住在聊天软件的claude）