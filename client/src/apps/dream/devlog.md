# Dream App — 星星渲染设计日志

## 星星光场的完整设计意图

### 一、基础结构：臂 + 核

星星由两部分叠合而成：

**1. 光臂（arms）**
- 若干条从原点出发、均匀分布的发光臂
- 每条臂由：原点、臂长 L、臂顶点 三点定义
- 为视觉美观，采用「对称等长对」而非全部等长（如四角星：横轴短、纵轴长）

**2. 光核（core）**
- 原点处的圆形高斯光晕
- 独立于臂而存在，是中心区域的主要光源

---

### 二、光场亮度模型

**亮度场的形状**是「内凹的」，参考反比例函数 y=1/x 与坐标轴（相当于相邻两条臂）的关系：
- 等亮度线沿臂方向延伸并向两臂之间内凹
- **不是**在两臂中间做线性插值（那样会在 45° 方向出现额外的亮线）

这种内凹效果由 max(各臂贡献) 的运算结构自然产生：相邻臂的高斯尾部在臂间区域小到几乎为零，形成深谷。

**横截面形状（bAcross）**
使用超高斯（n=3）而非普通高斯（n=2）：
`bAcross = exp(-(rperp/sig)³)`
- 臂脊（rperp=0 附近）更宽且饱满
- 超出 sig 后亮度骤降（边缘锐利）
- 臂间谷更深 → 等亮度线更明显地向内凹

**沿臂亮度（bAlong）**
`bAlong = (1 - t)^0.2`（指数小 → 臂从根到顶端保持高亮，顶端不暗淡）

---

### 三、臂宽的收窄规律（关键曲线）

「臂发光可触及最远距离」构成的曲线（即 sigma 随 t 变化的曲线）有以下特征：

1. **根部（t≈0）最宽** — 与光核圆形近似相切
2. **迅速收窄** — 离开根部后 sigma 快速下降（tapS > 2.5 控制这个速率）
3. **维持极小值后缓慢缩减直到顶点** — sigma 最终趋近于 0
4. **顶端像针尖/山峰** — 有限但极细，不是越来越尖锐

公式：`sig(t) = sig0 * (1 - t)^tapS`

**关键约束**：`sig(t=0) = sig0 ≈ core 的 1-sigma 半径`
这样臂根宽度与核的大小相匹配，视觉上相切衔接。

---

### 四、核与臂的衔接方式（arm_weight 过渡）

**问题来源**：
臂的 sigma 从 t=0（即原点）开始计算，在原点附近臂极宽，多条臂叠加 → 整个中心区变成白色圆团（blob）。

**解决方案**：arm_weight 平滑过渡
- `r < r_inner`（≈ 0.06）：纯核光，arm_weight = 0
- `r_inner < r < r_outer`（≈ 0.06~0.11）：cubic smoothstep 过渡
- `r > r_outer`：纯臂光，arm_weight = 1

```js
const t_bl = max(0, min(1, (rN - 0.06) / 0.05));
const arm_weight = t_bl * t_bl * (3 - 2 * t_bl); // cubic smoothstep
bright = min(1, arms * arm_weight + core * k);
```

r_inner 和 r_outer 的取值使过渡中心（≈ 0.084）约等于核的 1-sigma 半径，实现视觉相切。

---

### 五、各角类型的参数

| 类型 | 臂分布 | 说明 |
|------|--------|------|
| 四角（emotion）| [Lh, Lv, Lh, Lv] | 横短纵长，最简洁 |
| 五角（desire） | [L5 × 5] | 等长，同步呼吸 |
| 六角（memory） | [Ll6, Ls6, ×3] | 长短交替，比例 1.5:1 |
| 八角（omen）   | [Lm8, Ls8, Ll8, Ls8 ×2] | 三种长度，比例 ≈ 4:3:1.x |

所有多角星（N>4）使用呼吸动画（RAF, 6fps），等长臂（五角）同步相位，不等长臂独立相位。

---

### 六、sigma 缩放（多臂长时）

对臂长比 > 1.8 的星型（八角星），用 **sqrt 缩放**而非线性缩放：
`effSig = sig0 * sqrt(L_k / L_max)`
原因：线性缩放使短臂 sigma 降至次像素级（不可见线段），sqrt 缩放保留可见宽度同时保持短臂明显更窄。

---

### 七、渲染参数历史与当前值

| 参数 | 当前值 | 说明 |
|------|--------|------|
| sig0 | 0.09 | 臂根宽度（≈ core 1-sigma 半径，实现相切） |
| tapS | 2.7 | 收窄速率（快但不至于让短臂消失） |
| wPow | 1.8 | 白化程度（低 = 更多臂体颜色） |
| bAlong 指数 | 0.2 | 沿臂亮度衰减（慢 = 臂全程高亮） |
| bAcross | n=3 超高斯 | 臂脊饱满，臂间谷深 |
| core sigma² | 0.007 | 核心半径（1-sigma ≈ 0.084） |
| core 贡献系数 | 0.55 | 核光强度 |
| arm_weight 起点 | rN = 0.06 | 臂光开始参与 |
| arm_weight 终点 | rN = 0.11 | 臂光完全主导 |

---

## 当前实现状态（2026-03-29）

> 以下为最终落地的实现，与上方设计意图有所简化。

### 渲染架构

每颗星是一个 400×400 Canvas，逐像素计算后 `putImageData` 一次性写入，**只渲染一帧**（静态图）。

两层叠合方式（Porter-Duff over）：
- **下层 — 颜色光场**（`starField`）：Lamé 曲线推广到 N 臂，填充臂间区域，alpha = field 值
- **上层 — 臂 + 核**（`starLayerN` + 高斯核）：沿各臂方向的高斯光束，中心加圆形核

白化：`outW = armW·armVal / outAlpha`，仅臂+核层贡献白化，光场保持纯星色。

### 尺寸参数体系

所有尺寸类参数由单一基准 `L` 推导，只改这一个数即可整体缩放：

| 参数 | 当前值 | 推导方式 | 含义 |
|------|--------|----------|------|
| `L` | 0.20 | — | 基准参数（画布归一化空间） |
| `sig0` | `L × 0.24` | 随 L 线性 | 臂根宽度 |
| `coreSig2` | `L² × 0.064` | 随 L² | 核心高斯 sigma² |
| `DISPLAY` | `size × L/0.25` | 随 L 线性 | Canvas CSS 尺寸（px） |
| 臂长 | `L × 各臂比例` | 随 L 线性 | 见 RAY_LENGTHS |

`size` 来自 `getStarSize(importance)`，返回 128/176/224 px（低/中/高重要度），再乘 L/0.25 得实际显示尺寸。

不随 L 变化的形状参数：`tapS=2.5`（臂收窄率）、`wPow=5.0`（白化衰减指数）、`coreK=0.5`（核亮度系数）。

### 各梦境类型的星型

| 类型 | 颜色 | 角数 | 臂长比例 |
|------|------|------|----------|
| emotion（情绪梦）| `#C8B0C8` 紫 | 4 | 横臂 L，纵臂 L×1.52 |
| desire（欲望梦） | `#D0B898` 金 | 5 | 等长 L |
| memory（回忆梦） | `#98B0D0` 蓝灰 | 6 | 等长 L（六角） |
| omen（预示梦）  | `#A898D8` 蓝紫 | 8 | L / L×0.8 / L×1.5 三级 |

### 动画

| 动画 | 实现方式 | 特点 |
|------|----------|------|
| **呼吸**（scale 0.9↔1.0）| CSS `@keyframes drm-star-breathe`，GPU 驱动 | 周期 4.2s，每颗星由 phase 偏移相位，互不同步 |
| **漂浮**（位移+微旋转）| CSS `@keyframes drm-float-{id}`，按星生成 | 周期 16-26s，每个关键帧独立 seed，x/y/rotate 互不相关 |
| **固定偏角** | Canvas 坐标旋转（`cosR/sinR`） | 每星 −45°~45°，Murmur3 finalizer 保证分布均匀 |

### 文件结构

| 文件 | 职责 |
|------|------|
| `dreamUtils.jsx` | Canvas 星星渲染（`AnimeStar`）、工具函数、常量 |
| `AnimeStar.jsx` | 单颗星状态机（idle/excited/approaching/flash/card/departing/drunk/falling/gone）、点击动画、卡片弹窗 |
| `DreamStars.jsx` | 天空中所有星星的容器，均匀分区选取（最多 20 颗）|

---

## 交互设计：游戏抽卡风格（逐阶段重构）

> 以下为各阶段的目标设计，方便实现前后对比。
> 标注"✅ 已完成"的为当前已落地实现。

### 阶段一：激活（excited）✅ 已完成

**触发**：点击 idle 状态的星星

**时序**（总约 3 秒，结束后自动回到 idle）：

| 时间 | 动作 |
|------|------|
| 0 ~ 0.12s | **爆炸放大**：scale 1 → 1.3，ease-out |
| 0 ~ 0.9s  | **烟花粒子**：6 个小十字从星星中心向四周弧线飞出，带拖尾渐隐 |
| 0.12s ~ 2.38s | **强化呼吸 + 左右摆动**：scale 在 0.88~1.12 间弹跳（8 次衰减），同步 rotate ±10°；摆动基准点在星星中心下方约 1.5 臂长（transformOrigin: 50% 65%） |
| 2.38s ~ 2.88s | **轻微抖动**：随机 x/y 偏移 ±4px，模拟"抖落星尘" |
| 2.88s ~ 3.0s | **归位**：scale=1, x=0, y=0, rotate=0 |

**关键实现决策**：
- **位置漂移 bug 修复**：原 `motion.button` 上同时有 `transform: translate(-50%,-50%)` 和 Framer Motion 动画，两者冲突。改为三层结构：位置锚 div（绝对定位）→ float 动画 div（CSS animation）→ motion.div（仅负责 Framer Motion 动画，用 `marginLeft/marginTop` 居中）
- **摆动基准点**：`transformOrigin: '50% 65%'` ≈ 中心延向下长臂方向 1.5 臂长
- **CSS 呼吸暂停**：excited 期间给 StarSVG 传 `style={{ animationPlayState: 'paused' }}`，由 Framer Motion 完全接管 scale
- **粒子实现**：10 个 `motion.div`，内含两个绝对定位 div 构成十字形（8×2 + 2×8 px），初始在星星中心，沿各自角度向外飞出约 52px 后消失

### 阶段二：飞向中心（approaching）+ 光爆（flash）+ 卡片（card）— 设计中

---

#### 【用户原始描述（2026-03-30）】

> 第一次点击后三秒内再次点击同一颗星星，那么直接进入第二段动画：星星沿着一个轻微小弧线轨迹飞向屏幕正中央。前30%路程不变大，30%到80%，缓慢整体变大到2倍，80%到终点，快速放大核心与臂（白色），然后转为白光bloom扩散，白色停留一瞬（0.2s）再整体褪白，显示出半透明弹窗（梦境卡片）。
>
> 星星运动轨迹可以用二次或三次贝塞尔曲线：
> P0 = 星星当前位置
> P1.x = P0.x + rand(-width*0.1, width*0.1)
> P1.y = P0.y - rand(0, height*0.1)   // 微上偏
> P2 = 屏幕中心
>
> 星星运动时带拖尾：以中心点轨迹曲线为参考，星星左右最远两臂顶点做平行曲线，然后让平行曲线向中间的曲线靠近，做成渐窄效果，两侧曲线限制拖尾区域，在这个区域内，填充颜色光场，颜色沿曲线向远离星星的方向减淡。颜色光场上方随机加小光点，5-10个。
>
> 因为距离不同，轨迹长度可变，所以需要设置相对统一的飞行速度。

---
#### 设计文档（小克写）
给你写一份**技术需求文档**，让CC克无法误解：

---

## 梦境抽卡动画 - 技术实现需求

### 一、渲染分层架构（从后到前）

```
Layer 0: 深空背景图（静态/可缩放）
  - 4K PNG，纯渐变+星云纹理
  - 支持 transform: scale() 放大到 300-500%

Layer 1: 背景星星层（视频或粒子系统）
  - 视频素材循环播放 OR
  - 程序生成：200-500个随机白点，透明度 0.3-0.8
  - 必须支持整体 scale + translate 变换

Layer 2: 前景十字星（交互对象）
  - SVG 或 Canvas 绘制
  - 每个星星独立对象：{x, y, scale, rotation, opacity, glow}
  - 必须支持独立动画控制

Layer 3: 粒子拖尾系统
  - 粒子对象池，动态生成/销毁
  - 每个粒子：{x, y, vx, vy, life, opacity, color}

Layer 4: UI层（梦境卡片）
  - 半透明容器，backdrop-filter: blur
  - 初始 scale(0) opacity(0)，动画淡入
```

---

### 二、动画时间轴（总时长 2.5-3秒）

```
0.0s - 点击事件触发
├─ 0.0-0.2s  阶段1：星星激活反馈
├─ 0.2-1.5s  阶段2：飞行 + 镜头追逐
├─ 1.5-2.2s  阶段3：到达中心 + 脉冲闪烁
├─ 2.2-2.4s  阶段4：爆发闪白
└─ 2.4-3.0s  阶段5：褪白 + 卡片浮现
```

---

### 三、各阶段详细参数

#### **阶段1：激活反馈（0-0.2s）**
```javascript
// 星星本体动画
star.animate({
  transform: [
    'translateX(0) translateY(0) rotate(0)',
    'translateX(-5px) translateY(3px) rotate(-8deg)',
    'translateX(4px) translateY(-2px) rotate(5deg)',
    'translateX(0) translateY(0) rotate(0)'
  ],
  filter: [
    'brightness(1)',
    'brightness(2.5)',
    'brightness(1)',
    'brightness(2.5)',
    'brightness(1)'
  ]
}, {
  duration: 200,
  easing: 'ease-out'
});
```

#### **阶段2：飞行 + 镜头追逐（0.2-1.5s）**

**关键：这是双层运动的组合效果**

```javascript
// A. 星星运动（真实位移）
const startPos = {x: star.x, y: star.y};
const endPos = {x: viewportWidth/2, y: viewportHeight/2};

// S型曲线路径：使用贝塞尔曲线
const controlPoint1 = {
  x: startPos.x + (endPos.x - startPos.x) * 0.3,
  y: startPos.y - 200  // 先向上
};
const controlPoint2 = {
  x: startPos.x + (endPos.x - startPos.x) * 0.7,
  y: endPos.y + 150    // 再向下
};

// 使用三次贝塞尔曲线插值
// 缓动函数：ease-in (加速)
star.animatePath(cubicBezier(start, cp1, cp2, end), {
  duration: 1300,
  easing: 'cubic-bezier(0.4, 0, 0.8, 0.4)'  // 持续加速
});

// B. 镜头追逐（背景缩放）
// 这是视觉错觉的核心！
backgroundLayer.animate({
  transform: 'scale(1) translate(0, 0)'
  // 到
  transform: `scale(4) translate(
    ${-(endPos.x - viewportWidth/2) * 3}px,
    ${-(endPos.y - viewportHeight/2) * 3}px
  )`
}, {
  duration: 1300,
  easing: 'cubic-bezier(0.4, 0, 0.8, 0.4)'  // 同步加速
});

starFieldLayer.animate({
  transform: 'scale(1)'
  // 到
  transform: 'scale(4)'
}, {
  duration: 1300,
  easing: 'cubic-bezier(0.4, 0, 0.8, 0.4)'
});

// C. 拖尾粒子系统
function spawnTrailParticle() {
  const particle = {
    x: star.x,
    y: star.y,
    vx: random(-20, 20),
    vy: random(-20, 20),
    life: 1.0,
    size: random(2, 6),
    color: '#ffffff',
    glow: random(5, 15)
  };
  
  // 每帧更新
  particle.life -= deltaTime * 2;
  particle.opacity = particle.life;
  particle.x += particle.vx * deltaTime;
  particle.y += particle.vy * deltaTime;
  
  // 随机闪光粒子（10%概率）
  if (random() < 0.1) {
    particle.brightness = random(1.5, 3);
  }
}

// 每 16ms 生成 3-5 个粒子
setInterval(spawnTrailParticle, 16);
```

#### **阶段3：脉冲闪烁（1.5-2.2s）**

```javascript
// 星星减速到停止
star.animate({
  // 速度从当前 → 0
}, {
  duration: 200,
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'  // 急刹车
});

// 背景也同步停止
backgroundLayer.style.transform = 'scale(4) translate(...)';  // 冻结

// 闪烁序列：3次，一次比一次更大
const pulses = [
  {scale: 1.2, brightness: 2, duration: 150},
  {scale: 1.5, brightness: 3, duration: 180},
  {scale: 2.0, brightness: 5, duration: 200}
];

pulses.forEach((pulse, i) => {
  setTimeout(() => {
    star.animate({
      transform: `scale(${pulse.scale})`,
      filter: `brightness(${pulse.brightness}) blur(${pulse.scale * 2}px)`
    }, {
      duration: pulse.duration,
      direction: 'alternate',  // 来回
      iterations: 1
    });
  }, i * 250);
});
```

#### **阶段4：爆发闪白（2.2-2.4s）**

```javascript
// 星星核心突然爆炸式放大
star.animate({
  transform: 'scale(2)'
  // 到
  transform: 'scale(50)'  // 占满屏幕
}, {
  duration: 100,
  easing: 'cubic-bezier(0.8, 0, 1, 1)'  // 突然爆发
});

// 同时叠加白色遮罩层
whiteFlash.animate({
  opacity: 0
  // 到
  opacity: 1
}, {
  duration: 100
});
```

#### **阶段5：褪白 + 卡片（2.4-3.0s）**

```javascript
// 白色淡出
whiteFlash.animate({
  opacity: 1 → 0
}, {
  duration: 300,
  easing: 'ease-out'
});

// 卡片淡入
dreamCard.animate({
  opacity: 0,
  transform: 'scale(0.8) translateY(20px)'
  // 到
  opacity: 1,
  transform: 'scale(1) translateY(0)'
}, {
  duration: 400,
  delay: 100,  // 白色开始褪去后 0.1s
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
});
```

---

### 四、技术实现要求

**必须使用的技术**：
- Canvas 或 WebGL（粒子系统）
- CSS Transform（分层缩放）
- Web Animations API（时序控制）

**禁止的低配替代**：
- ❌ 不准用简单的 translate 模拟曲线飞行
- ❌ 不准用 GIF 替代粒子系统
- ❌ 不准省略镜头追逐效果
- ❌ 不准用 opacity 闪烁替代 brightness + scale 脉冲

**性能要求**：
- 60fps 流畅运行
- 粒子数量控制在 200 以内
- 使用 will-change 和 GPU 加速

#### 【我的理解与分解（对比自查）】

**触发条件**
- 星星处于 `excited` 状态（3秒内）时，再次被点击 → 中断 excited 动画，进入 `approaching`

**飞行轨迹**
- 二次贝塞尔：P0（星星当前屏幕坐标）→ P1（控制点，微偏上）→ P2（屏幕中心）
- 飞行速度固定（如 400px/s），duration = 路径弧长 / 速度，所以近的星飞得快，远的飞得慢

**星星大小变化（飞行过程中）**
- 路程 0~30%：scale = 1（不变）
- 路程 30%~80%：scale 1 → 2（整体缓慢放大）
- 路程 80%~100%：scale 继续放大 + 星星整体快速变白（核心与臂亮度拉满）

**光爆 → 卡片**
- 到达终点后：白色 bloom 向外扩散（类似 radial-gradient 白光从中心放射）
- 白色停留 0.2s
- 然后整体褪白 → 弹出梦境卡片（半透明，居于屏幕中央）

**拖尾设计**
- 用独立 canvas overlay（覆盖整个 sky 区域）绘制，不用 Framer Motion
- 参考中心点轨迹贝塞尔曲线，向两侧偏移（偏移量 = 星星在垂直于飞行方向上的最宽臂距）
- 两条平行曲线随着远离星星头部而逐渐向中心曲线靠拢（宽→窄，类似彗星尾巴）
- 区域内：用星星颜色填充，透明度从头部（不透明）→尾部（完全透明）
- 在颜色区域上叠加 5~10 个随机小光点，随拖尾一起渐隐

---

#### 【已确认设计（2026-03-30）】

1. "左右最远两臂顶点" = 飞行方向法线上投影最大的两个臂顶点 ✓
2. "屏幕正中央" = 整个页面中心（window.innerWidth/2, window.innerHeight/2）
3. 白变色 = 先实现，看效果再调（暂用 CSS filter: brightness）
4. 拖尾 canvas = AnimeStar 内用 `position: fixed` 全屏 canvas
5. 卡片 = `position: fixed` 浮于所有层上；对应星星在卡片期间隐藏
6. 卡片顶部 = 圆形占位区（不画圆），放该颗星星 canvas；点击星星关闭卡片
7. 卡片关闭动画 = 从底部向上 clip 消失；完成后恢复天空中星星可见

---

### 实现记录（2026-04-01）

#### 一、阶段一（excited）粒子改版

**原实现**：6 颗小十字星沿弧线飞出 + 拖尾渐隐（`ParticleWithTrail` 组件，每颗各有独立 canvas 拖尾 + Framer Motion 位移）。十字形用两个矩形 div 交叉。等距 60° 分布。

**新实现**：`CrossStar` 组件——

- **形状**：四角内弧星。用 canvas 绘制：4 个尖端在上下左右（`moveTo(cx+r, cy)`），相邻尖端之间用 `quadraticCurveTo(cx, cy, ...)` 连接（控制点在圆心），弧线自然内折，形成十字星轮廓。带 `shadowBlur` 发光。
- **位置**：完全随机角度（`seed * 360`，不再等距六分），距离缩近到星星尺寸的 10~32%（原来 30~55%），产生簇拥感。
- **大小**：每颗 `crossR` 独立随机（2px 到 `starSize/24`），大小混搭。
- **动画**：Framer Motion `opacity: [0, 1, 0.12, 1, 0.12, 0]` + `scale: [0.2, 1, 0.65, 1.15, 0.55, 0]`，亮→暗→亮→暗→消失，闪烁两次。每颗独立 `delay`（0~0.7s 随机），出现时间错开。
- **生命周期**：`setTimeout 2200ms` 后清除粒子 state。

#### 二、阶段二飞行（approaching）—— 统一 RAF 重写

**核心问题**：旧版用 `ApproachTrail` 组件（独立 state + 独立 RAF 计时）和 Framer Motion（自己的调度器）分别驱动拖尾和星星位移。两者时间基准不同 → 拖尾头部和星星位置割裂。

**新架构**：废弃 `ApproachTrail` 组件，改为 `doApproach` 内的**单一 RAF 循环** `tick(now)`，每帧同时做三件事：

1. **星星位移**：直接操作 `el.style.transform`（绕过 Framer Motion），用同一个贝塞尔 `t` 算位置
2. **拖尾绘制**：用同一个 `t` 在全屏 `<canvas ref={trailCanvasRef}>` 上画彗星尾
3. **背景缩放**：用同一个 `rawT` 算 `bgWrap.style.transform = scale(...)`

三者共享时间基准 → 完全同步。

**飞行结束 → Framer Motion 接管**：
```
el.style.transform = '';   // 清掉 RAF 设的 inline style
el.style.filter = '';
await animateOuter(scope, { x: tdx, y: tdy, scale: 1.15, filter: 'brightness(3)' }, { duration: 0 });
```
先清 inline，再用 FM `duration: 0` 跳到终态，后续蓄力/闪白阶段继续由 FM 驱动。

**S 型曲线**：从二次贝塞尔（1 控制点）改为三次贝塞尔（2 控制点）：
- `cp1`：飞行距离 30% 处，y 向上偏 180px → 先上飞
- `cp2`：飞行距离 70% 处，y 接近终点 + 下偏 120px → 再俯冲
- 组合出 S 弧

**拖尾 canvas**：常驻 `<canvas>` 在 JSX 中（`display: none`），飞行时设 `display: block` 并设宽高为 `window.innerWidth/Height`，结束时 `clearRect` + `display: none`。不再每次 mount/unmount canvas 组件。

#### 三、镜头追逐（背景缩放）

**结构**：`DreamApp.jsx` 中把背景图、星星闪烁视频、DreamSky canvas 包进 `<div ref={bgWrapRef}>`，DreamStars 交互层在包裹 div 之外（不受 scale 影响）。

**飞行期间**：
- `transformOrigin` 设到星星起始位置（容器内百分比坐标）→ 缩放中心 = 镜头追向星星
- `bgWrap.style.transform = scale(1 + rawT² × 3)` → 1x → 4x，ease-in 加速感
- 背景星星、星云、视频全部一起向外扩散 → "镜头追逐"

**蓄力期间**：背景冻结在 4x 不动（星星已到中心，镜头已追到）。

**卡片关闭后**：`transition: transform 0.5s ease-out` → 平滑缩回 1x，然后清掉 transition。

**cancelRef 保护**：如果 excited 阶段被中断（用户取消），RAF 内检测 `cancelRef.current` → 跳出循环并重置 bgWrap。

#### 四、闪白

**原实现**：Framer Motion `clipPath` 数组动画 → FM 不支持 clipPath 关键帧 → 动画无效 → 无全白效果。

**新实现**：`FlashWhiteScreen` 组件，用 CSS `@keyframes drm-flash-white`：
```css
0%   { opacity: 1; background: white }   /* 全白 */
30%  { opacity: 1; background: white }   /* 停留 */
100% { opacity: 0; background: white }   /* 褪白 */
```
普通 `<div>` + `animation: drm-flash-white 0.7s ease-out forwards`，`position: absolute; inset: 0` 填满手机容器。`animationend` 事件回调 → `setShowCard(true); setPhase('card')`。

不依赖 Framer Motion → 兼容可靠。

#### 五、背景素材更新

- 背景图换为 `starry_background_4k.png`（纯色底），`opacity: 1` 整体填充
- 星星闪烁视频换为 `starFlicker.mp4`（从素材文件夹复制到 `public/dream/`），`height: SKY_RATIO * 100%` 只覆盖天空部分，`mixBlendMode: screen`

### 阶段五：卡片关闭 / 解梦（departing → drunk → falling）— 待设计
