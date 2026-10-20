# WebGPU 着色器库 shaders 评估
> **性质：agent 产出，用户未确认，仅作参考。**

> 结论：能用，但只能当**装饰层**，且必须自备兜底。值得用的只有纸纹 / 颗粒 / 暗角这几种；200 多个预设的配色和动势是「设计感 SaaS」风，跟本项目「纸与木 + 琥珀」不是一路。
> 试验代码未入库（`shaders` 依赖与 `/#/lab` 试验页都不在仓库里），**未写入 decisions**。

---

## 是什么

[shader-effects-inc/shaders](https://github.com/shader-effects-inc/shaders) —— WebGPU 效果组件库，`npm i shaders`，一份引擎出 React / Vue / Svelte / Solid / 纯 JS 五种绑定，MIT。Vue 用法：

```html
<Shader class="frame">
  <SolidColor color="#F5F2EC" />
  <Paper :roughness="0.45" />
  <FilmGrain :strength="0.1" />
</Shader>
```

`<Shader>` 出一个 div + 铺满的 canvas，子组件是图层，自上而下在 GPU 上混合。每个图层除了自己的参数，都带 `blendMode` / `opacity` / `mask` / `transform`。

## 实测（web2 + shaders 4.0.4）

| 项 | 实测结果 |
|---|---|
| 规格 | 4.0.4，MIT，唯一依赖 `typegpu@0.12.3`；落到 node_modules **37 MB** |
| 类型 | `shaders/vue` 的 props 有 d.ts（从 `shaders/core/*` 生成），`vue-tsc --noEmit` **通过** |
| 产物体积 | 用 2 个组件：**2.65 MB / gzip 729 kB**；加到 6 个组件：2.67 MB / 730 kB —— 引擎是固定成本，组件本身几乎不计 |
| 渲染 | Chrome 155 (macOS) WebGPU 下正常出图 |
| 参数响应 | `rooms` 每秒的快照能直接带动 props（实测 3368 W → 3277 W，画面跟着变），不需要重建场景 |
| 无显卡时 | `<Shader>` 抛 `unavailable` 事件，reason `no-adapter`；**不崩**，但画布留空，页面上是几个空框 |
| 控制台 | typegpu 的 `external-omitted` / `deprecated` 警告若干，不影响运行 |
| 联网 | `disableTelemetry` 默认 **false**，会 POST `https://shaders.com/api/telemetry`；现场断网时是一次无效请求 |

## 与「纸与木 + 琥珀」的匹配度

| 组件 | 结论 |
|---|---|
| `Paper` | **贴**。纸纹质感直接对，能替掉一张背景图 |
| `FilmGrain` / `Vignette` | **贴**。做旧、压角，强度调低即可 |
| `MeshGradient` | 默认停靠色是 `#1a0533 → #6d2fd1 → #e04b9e → #ff8c42 → #ffdf8e`（紫粉橙黄），跟琥珀不搭；**显式传 `stops`** 才像样 |
| `ContourLines` | 本想当「后山等高线」用，实测线条爬满噪点，**不可用**；要干净等值线得自己写 WGSL |
| 其余 200 个（Aurora / Holographic / LiquidMetal…） | 动势和配色都是设计感 SaaS 风，与本项目克制的调性冲突 |

## 风险

- **WebGPU 是硬门槛**：桌面 Chrome / Edge 113+；Safari 要 **26+**（17.4–25 藏在 flag 后）；Android Chrome 121+ 且要求 **Android 12+ 与高通 / ARM GPU**；Firefox 的 Linux 与 Android 还没有。安卓另有「有 Vulkan 但初始化失败」的假阳性。
  - 现场若用 360 / QQ 之类的旧 Chromium 内核浏览器，直接没有 WebGPU。
- **没有 WebGL 兜底**：库只有 WebGPU 一条路，没有兜底就是管理页开天窗。
- **730 kB gzip 的引擎成本**：局域网演示能接受，手机首屏解析要花钱。
- 编辑器 / CLI / MCP / agent skill 都要登录 shaders.com 并联网，现场不可依赖；而且预设配色本来就不合用。

## 建议的用法（待定）

- 只在**介绍页与大屏**当背景层，管理页不引（与 three 同一套动态 `import()` 纪律）。
- 降级走**双保险**：特性检测 + `@unavailable` 事件，失败退回 CSS 渐变，与 3D 页那张静态 SVG 平面图同思路。
- 只用 `Paper` / `FilmGrain` / `Vignette` + 一份自己写的 `stops`；不用预设调色。
- 真要做「等高线纸山」这类效果，用 `defineShader` 自己写 WGSL，比调预设省事。

## 试验代码（未入库，以下文件均不在仓库里）

- `web2/src/pages/ShaderLabPage.vue` —— 四张试验片：暖纸底纹 / 夜色琥珀 / 等高线后山 / 读数驱动
- `web2/src/router.ts` —— `/#/lab` 路由
- `web2/package.json` —— `shaders` 依赖
