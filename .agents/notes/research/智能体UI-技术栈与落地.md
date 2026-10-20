# 智能体 UI：技术栈与落地

## 结论

- 界面：assistant-ui 的 Vue 绑定 + 它的注册表成品组件（**上游原样副本**，不自己画消息框）
- 模型：AI SDK 的 provider 注册制（`@ai-sdk/deepseek` 官方；任何 OpenAI 兼容网关用 `@ai-sdk/openai-compatible`）
- 多模型：**服务端一行一个**，请求体里带 `model` 用哪个就用哪个，不带就用默认
- 不做模型选择器：assistant-ui 的 `ModelSelector` 只有 React 版（`elements/model-selector.tsx`），
  Vue 注册表里没有 elements，按「不是自带的就不自己写」的规矩，前端不摆下拉
- 兜底：右上角「演示模式」，不联网也能把界面演完

## 技术栈关系

```
web/（Vue 3.5 + Vite）
  AuiProvider :config="AuiConfig({ threads: AISDKThreads() })"   ← @assistant-ui/vue
    ├─ AISDKThreads：内部跑 @ai-sdk/react 的 useChat，默认打到 /api/chat
    └─ UI：web/src/components/assistant-ui/*.vue（注册表组件，剪进项目）
         thread / message / markdown-text / reasoning / tool-fallback / thread-list

server/（Bun + Hono）
  POST /api/chat → streamText({ model: models[model ?? 默认], system, tools }) → UI message stream
    模型：server/agent/models.ts 里注册
    工具： em（跑本项目 CLI 拿实时数据）
```

分层的意义：assistant-ui 把「界面」和「模型」拆成两层，中间只认 AI SDK 的 UI message stream。
换后端（Next / Nitro / 我们的 Hono）不影响前端，换前端（Vue / React）也不影响后端，
换模型只是注册表里多一行。

## 版本与边界（2026-10-18 快照）

| 包 | 版本 | 说明 |
|---|---|---|
| `@assistant-ui/vue` | 0.0.4 | 2026-10-06 才发的第一版，只出 primitives 与 provider |
| `@assistant-ui/ai-sdk` | 0.0.13 | 框架无关运行时，内部用 React hook，所以 `react` 是必装的 peer |
| `@assistant-ui/core` / `store` | 0.3.29 / 0.3.21 | 类型与 `Suggestions` 从这儿来 |
| `ai` | 7.0.143 | `streamText` / `convertToModelMessages` / `stepCountIs` / `tool` / `simulateReadableStream` |
| `@ai-sdk/deepseek` | 3.0.67 | DeepSeek 官方 |
| `@ai-sdk/openai-compatible` | 3.0.71 | 任何 OpenAI 兼容网关（本地 8317 那台也是） |
| `zod` | 4.6.7 | 工具的入参 schema |
| `tailwindcss` + `@tailwindcss/vite` | 4.3.3 | 注册表组件用 Tailwind 类，取色接在本项目 `--bg/--text/--primary` 上 |

两个写法上的坑：

- `result.toUIMessageStreamResponse()` 在 7.0.143 已弃用（编辑器会划掉），现在写
  `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`
- Vue 版没有的（官方明说）：语音/听写、mention 与 slash 命令、引用、模态框、DevTools、以及
  React 侧那批 `elements/*`（模型选择器就在里面）；用不上就不管

## 落地清单

- `web/src/components/assistant-ui/*.vue` —— assistant-ui 注册表的成品组件，**上游原样副本，一个字节都不改**（溯源见下）
- `web/src/views/AgentView.vue` —— 独立页面：会话列表 + 对话 + 演示模式开关
- `web/src/mock-agent.ts` —— 演示模式用的假 transport（不联网）
- `web/src/App.vue` / `router.ts` —— 侧边栏「AI智能体」入口，路由 `/agent`
- `server/agent/models.ts` —— 模型注册表（现场演示加模型的地方）
- `server/agent/index.ts` —— 系统提示词 + 工具（`em`：跑本项目 CLI）
- `server/routes/chat.ts` —— `POST /api/chat`
- `server/.env`（不入库）—— `DEEPSEEK_API_KEY`（取自 `~/.dsh/.credentials.yaml`）、`GATEWAY_BASE_URL` / `GATEWAY_API_KEY`（本地网关）

## 模型是怎么注册的

就一行一个：

```ts
const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });

export const models: Record<string, LanguageModel> = {
  "deepseek-flash": deepseek("deepseek-flash"),
  "deepseek-v4-pro": deepseek("deepseek-v4-pro"),
};
```

`chat.ts` 里 `models[model ?? defaultModel]`：请求体带 `model` 就用它，不带就用默认。
**没有别的配置了** —— 想要选择器就得自己写 UI，而那是 React 侧 `elements/model-selector` 的活，Vue 侧不做。

## 现场演示

起点：`models.ts` 里只有 DeepSeek 官方两个模型，文件里留了一行注释标好位置。

现场写的就是"注册一个新供应商 + 它的模型"（本地网关那台，实测 `deepseek-v3-2-volc`、
`kimi-k2.8-preview` 都能调 `em` 工具）：

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const gateway = createOpenAICompatible({
  name: "gateway",
  baseURL: process.env.GATEWAY_BASE_URL!,
  apiKey: process.env.GATEWAY_API_KEY,
});

// 再加进 models：
"gateway/deepseek-v3-2-volc": gateway("deepseek-v3-2-volc"),
"gateway/kimi-k2.8-preview": gateway("kimi-k2.8-preview"),
```

怎么看到效果（前端没有选择器，所以用请求体指定）：

```sh
curl -sN localhost:8080/api/chat -H 'content-type: application/json' \
  -d '{"model":"gateway/kimi-k2.8-preview","messages":[{"id":"1","role":"user","parts":[{"type":"text","text":"现在有哪些客房在线？"}]}]}'
```

想让它出现在页面上，最薄的做法是前端从地址栏读一下（两行）：`?model=gateway/kimi-k2.8-preview`
塞进请求体。要不要加等用户定。

## Plan B：演示模式（不联网）

现场 API 万一不通，按右上角「演示模式」继续演，**不产生任何 HTTP 请求**，输出是写死的一段段吐出来。

原理：`AISDKThreads({ transport })` 换成假 transport —— 实现 AI SDK 的
`ChatTransport.sendMessages()`（外加一个返回 `null` 的 `reconnectToStream`），用 AI SDK 自带的
`simulateReadableStream({ chunks, initialDelayInMs, chunkDelayInMs })` 把写好的 UI chunks 逐段吐出去。
思考过程、`调用工具: em` 的卡片都能假。实现就在 `web/src/mock-agent.ts`。

页面里一个开关：`AuiProvider :key="demo ? 'demo' : 'real'"` 重挂载换 config，按钮在卡片右上角。

实测：真实模式问一句发 1 次 `/api/chat`；切演示模式问同一句，`/api/chat` 请求数为 **0**，
界面上照样有思考过程、工具卡片、逐字流出来的 markdown 表格 —— 看不出是假的。

## 那 6 个 .vue 是上游副本，不是我们写的

- 来源：`github.com/assistant-ui/assistant-ui` → `packages/ui/src/components/vue/assistant-ui/`
  （本机核对用的克隆在 `/tmp/agents/assistant-ui`，commit `8aab1c9`）
- 核对：`for f in web/src/components/assistant-ui/*.vue; do diff -q <上游>/$f的basename "$f"; done`，无输出即一致
- 上游更新时：重跑 `npx shadcn-vue@latest add @assistant-ui/thread @assistant-ui/thread-list`，或从克隆里重新 `cp`
- 代价：界面文案是上游英文默认值（`New Thread`、`Search threads`、`Main Thread`、`Reasoning`、`Used tool:`、
  `Send a message...`、空态标题 `How can I help you today?`）。保持英文是有意为之——改它就得动副本
- 主题是我们自己的：取色、圆角、markdown 表格排版都写在 `web/src/styles.css`，
  照抄官方示例的 `@theme inline` + `@custom-variant dark` 写法

## 踩过的坑

- key 用 **DSH 本地凭据**：`~/.dsh/.credentials.yaml` 里的 `DEEPSEEK_API_KEY`（官方 API）。
  老项目那张阿里云百炼 key 上 DeepSeek 系全部 `Arrearage`（欠费），已经不用了。
- 改完 `.env` 要**真的重启一次服务进程**：Bun 的 `--watch` 会重启 app，但不一定重读 `.env`，
  会拿旧地址发请求（踩过：`ECONNREFUSED`）。演示前 5 分钟用 `curl POST /api/chat` 自检一发。
- assistant-ui 的 Vue 运行时必须装 `react`（内部跑 `@ai-sdk/react`），Vue 只负责渲染。
- 注册表组件用 Tailwind 类，本项目原来没有 Tailwind；`styles.css` 顶部 `@import "tailwindcss"` 并把
  `--color-*` 接到项目已有调色板上，页面才不像贴上去的。
- 我们自己的元素级重置（`button`、`body`、`h1`…）必须放进 `@layer base`：无层样式优先级高于 Tailwind
  utilities，会把组件自己的 `bg-primary`/`text-primary-foreground` 压掉（踩过：发送按钮图标变黑）。
- 本地网关（`http://192.168.11.192:8317/v1`）上不是每个模型都能用：`glm-5.3` 返回空、
  `claude-sonnet-4-5-intl` 报配置缺失、`gemini-3.1-flash-lite` 报地区不支持；
  `deepseek-v3-2-volc` / `kimi-k2.8-preview` / `minimax-m3` 可用且支持工具调用。
- `em show` 要的是 `设备/实体`（`48aff3/dryer-meter`），模型第一次会写成设备 id，多一轮就学会了。

## 参考

- assistant-ui Vue 文档：`/docs/vue/quickstart`、`/docs/vue/installation`、`/docs/vue/components`
- assistant-ui 的 elements（React 侧，含模型选择器）：`/docs/elements/model-selector`
- 源码（比文档准）：`github.com/assistant-ui/assistant-ui` → `packages/vue`、`packages/ai-sdk`、`packages/ui/src/components/{vue,react}`
- AI SDK：`ai-sdk.dev` → `streamText`、`tool`、`createUIMessageStreamResponse`、`simulateReadableStream`
