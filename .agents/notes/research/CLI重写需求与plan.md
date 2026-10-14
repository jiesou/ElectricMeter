# CLI（em）重写：需求与 plan

> 状态：**已按此执行完毕**（选型：commander + picocolors + cli-table3）。plan 属推演仍留在 research/，用户确认后可挪 decisions/。

## 背景与结论

旧 CLI（手写 argv 解析，220 行）已整体删除。它引用的 `/api/actions`、`/api/events`、`/api/statistics`、`/api/history` 服务端从未实现，是长期编译红的根源。

**定界（用户确认）：服务端没实现的，CLI 先不做。** 新 CLI 只消费已实现的接口：

| 接口 | 形态 |
|---|---|
| `GET /api/rooms`、`/api/rooms/stream` | REST + 每秒 SSE 快照 |
| `GET /api/devices`、`/api/devices/stream` | REST + SSE |
| `GET /api/entities[?device=]`、`/api/entities/stream` | REST + SSE |
| `GET /api/entities/:device_id/:id` | REST，404 返回 `{error}` |

动作下发（on/off/toggle）、功率曲线、开关历史、事件流：服务端均未实现，CLI 不做、help 里也不出现（文档一致性：help 只列真实可用的命令）。

## 需求（从 CLI 用户出发）

### 用户与场景

1. **民宿老板/运维**：终端敲一条命令看全店用电。最高频动作是「看一眼」→ 无参数即总览，零学习成本。
2. **开发者联调**：起 server + simulator 后用 CLI 验证数据链路通不通。
3. **脚本 / MCP 机读**：`--json` 拿原始 JSON；将来包一层 MCP server 就是现成工具描述。

### 命令集

| 命令 | 接口 | 输出 |
|---|---|---|
| `em` | `/api/rooms` | 客房总览：房名、在线、当前功率、累计电量，末尾合计行（只合计在线房功率；电量全计，只增不减——与 web 端口径一致） |
| `em devices` | `/api/devices` | 设备表：ID、名称、IP、在线、最后上线（`lastSeen` 秒级时间戳转可读） |
| `em entities [--device=<id>]` | `/api/entities` | 实体表：`device/entity` 引用、名称、类型、状态（开关=通电/断开，电表=W）、累计电量 |
| `em show <device/entity>` | `/api/entities/:d/:e` | 单实体详情：类型、状态/功率、电量、最后上报时间 |
| `em watch [--device=<id>]` | `/api/rooms/stream` 或 `/api/entities/stream` | 实时快照流：每秒刷新，逐行打印一行一房（或一实体）；`--json` 时每条快照输出一行紧凑 JSON（JSONL） |

实体引用格式全站统一写作 `esp-301/light`（设备 ID/实体 ID），与 web 端、共享模型一致。

### 全局约定

- `--json`：机读输出；其余情况人读表格。两者互斥，`--json` 时禁用颜色与表格装饰。
- 服务器地址优先级：`--host` > `EM_HOST` 环境变量 > `http://localhost:8080`。
- `--help`：框架生成，逐命令可用；`--version`。
- 颜色：非 TTY / `NO_COLOR` 自动关闭（管道进 jq、cron 场景不出转义码）。
- 错误与退出码：连不上服务器 → 提示当前 EM_HOST 与启动方式（`bun run --cwd server dev`）；实体不存在 → 「未知实体 esp-301/nope」（照抄服务端 404 文案）；参数缺失 → 打印该命令 usage；一律退出码 1。
- 中文文案与 web 端用词一致：客房、电表、开关、通电/断开、在线/离线、累计电量。
- 数值：功率 W 最多一位小数，电量 kWh 两位小数（与 web 端一致）；缺失读数显示 `—`，`0`/`false` 如实显示。

### 明确不做

远程通断、`em power` 曲线、`em history`、`em events`（服务端未实现）；TUI 全屏交互界面（需求未出现）；配置文件（一个环境变量够用）。

## 框架选型

**commander@15 + picocolors@1.1.1 + cli-table3@0.6.5**，不引入 TUI/交互库；SSE 用 Bun 原生 fetch 流（Bun 无 EventSource）。对比、实测证据与排除理由见 [CLI 框架选型](CLI框架选型.md)（cac 未知命令静默 exit 0、citty 的 --json 不传播 + CJK 对齐错、gunshi 太早、yargs/oclif 过重、ink 拖 React）。

实现期两个可复用的坑：

- cli-table3 的 `push()` 返回的是数组新长度不是 `this`，不能链式 `.push(...).toString()`（会打印出行数数字）
- bun test 进程内 `spawnSync` 会冻结事件循环，同进程 `Bun.serve` 就无法应答子进程请求，互相等死——子进程测试必须异步 `Bun.spawn`

## 结构与实现

- 重建 `cli/` workspace：`package.json`（`bin: { em: "index.ts" }`，依赖 `@em/shared`）+ `tsconfig.json`，Bun 直接跑 TS。
- `api.ts`：REST/SSE 客户端（fetch + host 解析 + 错误文案一处收口）。
- 命令一文件或一函数，渲染与取数分离，便于 `--json` 分叉。
- 时间戳显示：项目数据层全是 number 秒级时间戳；仅 CLI 渲染层转 `HH:MM:SS`（与 web 端「界面格式化不受协议约束」同款取舍）。

## 验收

1. 根 typecheck / `bun test` 全绿（含 cli 测试）。
2. cli 测试：进程内起 stub JSON server（约 20 行），直接调用 CLI 入口断言表格与 `--json` 输出；一条子进程 smoke test 验证 bin 入口。
3. 手动验收：起真 server + 两个模拟器，逐条实跑全部命令与 `--json`，核对与 web 端数字口径一致。
4. AGENTS.md「已实现」更新 CLI 段落。

## 执行顺序

1. 框架选型落定 → 建 cli 骨架（bin 入口、help、错误处理）
2. api client → 命令逐个实现（总览 → devices → entities → show → watch）
3. 测试 + typecheck
4. 真 server 联调验收 → 文档收口
