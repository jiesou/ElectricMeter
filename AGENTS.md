# AGENTS.md — 项目定义

> AGENTS.md 只定义项目当下状态，不放路线选择等过程性研究
> 过程性研究文稿，讨论纪要放在 `./.agents/notes/*`

## 文档可信度分级（重要）

**只有本文件记的东西，以及用户在工作区里明确点头承认过的东西，才算数。**

`.agents/notes/*` 下的东西默认是 **agent 生成的草稿**，不是本项目的实际架构：

| 标记 | 含义 |
|---|---|
| 无标记 | agent 草稿。**可以参考，不可作为依据**。照它实现之前必须先问用户 |
| `⛔ 已弃用` | 用户明确判定不是他定义的，作废，不要再引用 |
| `agent 产出` | subagent 的调研 / 评估稿，仅供查证 |
| 用户确认 | 用户说过「就这样」「按这个」之类，才算数 |

**agent 不得把自己的推演写进 notes 再当成「项目原本的定义」来引用。**
拿任何一份 notes 当依据之前，先看它有没有「用户确认」标记。

## 开发原则

- 我们要的是精简可维护原型，不是过度工程，不是工业化项目，我们要的是“它能跑起来演示”，而不是“能落地”
- 涉及到的全部时间，都直接使用 number 秒级时间戳，不使用任何特定时间格式，便于客户机单片机处理
- 保护性代码几乎不需要，message.error 都可以少一点，“it just work”即可，确保代码实现极度可读、代码量少、简单高效。代码的“简单，不overengineered”非常非常重要
- 不要 Overengineering！不要 Overengineering！不要 Overengineering！保持代码实现简短简单。如果可能，减少代码的更改
- 这是个 Bun 项目，不要换成 Node
- 中文注释

## 项目是什么

**面向老旧民宿的智能用电管理与节能系统。**

用 RS485 电能表 + 直流交流断路器 + ESP32 作为硬件下位机侧，云端信息平台统计用电量、研判用电行为并下发通断指令，覆盖平板 / 手机 / 电脑多端。

## 功能特性

- **能源管理 + 智能控制**。主线就是 采集 → 计量 → 统计 → 研判 → 通断 → 节能核算。
- **电能计量 / 远程抄表**
- **断路器** —— 可控通断，云端研判结果落到**真的拉闸/合闸**，是"管得住"的执行端
- **摄像头人员进出统计** —— 跨线计数判房间内人数，是"人来上电、人走断电"的触发依据（**未实现**，见「已规划」）

## 通信协议

**协议基座就这四条，任何业务消息都从它展开。不要另立消息体系。**

```ts
export interface WSMessage {
  type: string;
  ts?: number; // 秒
  [key: string]: unknown;
}
export type WSMessageHandler = (client: Client, socket: WebSocket, message: WSMessage) => void;

/* XX PostMessage      客户机->服务器 post新数据 */
/* XX PostAckMessage   客户机<-服务器 回馈成功失败 */
/* XX GetMessage       客户机->服务器 get数据 */
/* XX GetAckMessage    客户机<-服务器 返回数据 */
```

配套约定：
- 下位机只出站，`ws://host/ws?deviceId=xxx` 建连时绑定身份，**消息里不再重复带 deviceId**
- `WSMessageHandler` 数组，谁关心谁注册；不做按角色的 switch 分流
- 没有 `hello` / `welcome` 这类握手消息，身份在 URL，能力在第一条 Post
- 线上就四种消息：`post_entities`（设备自报有什么）/ `post_state`（500ms 采样）/
  `post_relay`（服务器下令）/ `post_ack`（回执），外加 `ping` 应用层心跳
- 回执不做关联，收到几个算几个

## 数据模型

身份只有一层：**`ref = deviceId:key`**，例如 `esp-301:light`。deviceId 是一台 ESP32，key 是设备内的回路号，
name 是显示名，随便改，服务器不较劲。

```ts
kind: "relay"   // 一路可通断的回路
      | "meter" // 一只读数
```

**没有 `unit` 字段。** 瞬时功率和累计电量天生就是两个量，设备各发各的：

| key 后缀 | 含义 | 单位 |
|---|---|---|
| `xxx_power` | 实时功率 | 瓦 |
| `xxx_energy` | 自上电以来的累计电量 | 千瓦时 |

下位机把电量在板上就累加好了，服务器只管存。少一个字符串，MCU 的内存和 JSON 拼接都省一份——
字符串拼接解析在单片机上是实打实的工作量，这块能少就少。

服务器按 key 后缀判断读数语义（`isTotal()` / `deviceTotals()`），代价只在服务端。

**明确不做**（用户 2026-10-01 判定为过度工程）：

- `domain` / `device_class` / `state_class` 三层分类 —— 东西就那么一些，不搞 HA 的分类学
- HA 的 `config_entry` / `integration` / `platform`、`entity registry` 的二十来个字段、四层 ID
- `area` 注册表、`context` 因果链、`restored` 语义
- `service` 概念 —— **已经有 action，不要再来一个**
- **`requested` 与粘连判定** —— ESP32 自己并不知道接触器粘没粘，服务器拿 `requested ≠ state` 判粘连是错的。
  真要判只能看「下了动作之后功率有没有变」，而且**现在不做这个判定**
- 消息里的 `ref` / `callId` 关联 —— 回执不做关联，收到几个算几个
- **`unit` 字段** —— 用字符串区分单位在单片机上是负担，改成「瓦」和「千瓦时」两个独立字段

## 记录下的技术决策

- **全栈 Bun** —— HTTP / WebSocket / SSE / SQLite / 测试全在 `bun` 一个进程里，运行期只依赖 `hono` + `@hono/bun`
- **bun workspaces** —— 根 `package.json` 声明 `shared` / `server` / `cli` 三个成员，
  共享类型走 `@em/shared` 一条 import 路径，client 将来接入也不用改配置
- **Prisma 只管结构，不管查询** —— `prisma/schema.prisma` 是表结构声明，`core/db.ts` 手写建表与查询
- **上位机先行** —— 硬件没到货前用模拟器顶替下位机，软件侧先把闭环跑通
- **实体注册表只在内存** —— 设备连上时以它自报的清单为准，不再上报的实体直接摘掉，落库是浪费
- **演示优先，500ms 采样 / 5 秒落盘** —— 模拟器 `INTERVAL=500`（毫秒），服务器收到就往 SSE 推，实时曲线顺滑；
  收到采样只改内存里未闭合的 **5 秒桶**，桶闭合才写一次库。30 天约 1 GB，这个体积换得起
  原始样本一律不落盘：每 500ms 一行、20 个实体，一个月就是几千万行
- **均值按时间加权** —— `Σ(值 × 持续秒) / 窗口秒`，不是 `AVG()`。电水壶这种占空比负载两者能差 1.5 倍
- **电量两个来源** —— 板上累加的 `*_energy` 累计读数（权威），和服务端对 `*_power` 的时间积分（分辨率更细）
- **states 表只记开关** —— 高频读数一律进 statistics，states 只留「什么时候开的、什么时候关的」
- **下位机只出站** —— `ws://host/ws?deviceId=xxx`，一个连接一个身份，建连时绑定不可中途改
- **动作入口只有一个** —— `POST /api/actions/{turn_on,turn_off,toggle}`，body 里 target 是 `entity` 或 `device`
- **SSE 与 WS 分工** —— 观察者（CLI watch / 后续前端）走 SSE 只读流，不占下位机的 WebSocket
- **代码结构参照** [ElectricDriveSystem](../ElectricDriveSystem) —— `app.ts`(Hono) + `routes/` + `core/` + `simulator/`

### 明确不做

- 不做 NILM / 负荷辨识 / 电器指纹 —— 与"能源管理"定位无关，是外来的噱头。
- 不做卫星通信 / 北斗 —— 放弃卫星通信那一类岗位群的加分，靠故事性与技能分赢。

## 已实现

**采集 → 计量 → 统计 → 通断**，全链路闭环，硬件没到货先用模拟器顶替

- **shared/** 纯类型零依赖，`@em/shared` 一个包同时被 server 和 cli 引用
  - `types.ts` —— 全部类型一个文件：协议基座 + 业务消息 + 领域
- **server/**（Bun + Hono）
  - `app.ts` —— `/ws` 接下位机（只出站）、`/api/*` 挂 REST 与 SSE
  - `core/db.ts` —— 三张表（`device` / `state` / `statistics`）建表与手写查询
  - `core/hub.ts` —— 在线连接表 + 内存实体注册表 + `WSMessageHandler` 数组（谁关心谁注册）
  - `core/stats.ts` —— 5 秒时间桶，时间加权均值与功率积分
  - `routes/api.ts` —— REST + SSE
  - `simulator/esp32.ts` —— 下位机模拟器，500ms 一采：三路（照明 / 插座 / 空调），每路 relay + `_power` + `_energy`
    三个实体，加一个 `total_energy` 总表；电量在板上累加，电水壶占空比，断路器真实合闸分闸，应用层 ping 30s 一次
- **cli/**（`em`，运行期零依赖）
  默认总览（设备在线 / 当前功率 / 今日用电）/ 实体清单 / 实体详情 / 远程通断（`--device=` 整房）/
  功率波形 + 分时电量 / 开关时间线 / 实时事件流，全局 `--json` 输出原始 JSON，为将来包 MCP 铺路
- **REST**
  `GET /api/health`、`GET /api/devices`（带 power / energy 的总览）、`GET /api/entities?kind=&device=`、
  `GET /api/entities/:ref`、`GET /api/history/:ref`、`GET /api/statistics/:ref?from=&to=`、
  `POST /api/actions/{turn_on,turn_off,toggle}`（target 为 `entity` 或 `device`）
- **SSE** `GET /api/events` —— 事件自带 `kind` 与 `name`，观察者不用回查就能渲染
- **测试** `bun test` 十一条：post_entities 登记、实体摘除、开关只记变化、时间加权均值、
  功率积分折电量、下发与回执、令下得去但不动作时按实际状态记账、按 device 整房展开、
  离线不下令、重启靠 states 恢复初值、ping 有来有回
- **端口** server `8080`，`PORT` / `EM_HOST` / `WS` 可覆盖

## 已规划

> 实现后挪到上方，然后从这里删除，不留

- **研判引擎** `core/policy.ts` —— 人走断电 / 人来上电 / 空房大功率告警 / 长时间零用电告警
- **前端页面** —— 桌面 / 平板 / 手机多端，数据接口已就绪（见「已实现」的 REST + SSE）
  客房管理 + 客房监控：一个 ESP32 管一个客房，一个客房两三路（照明 / 插座 / 空调）
- **摄像头人数感知** —— 香橙派端侧 AI，人体框从判定线进=人进、从线出=人出，累计房间内人数
  - 复用民宿**现有监控**，不额外布传感器，毫米波雷达评委看烂了
  - 人数由香橙 Pi 产出，ESP32 只管电表和断路器，两者互不通信
- **CLI 接入 MCP** —— 已有 `--json`，包一层 MCP server 就是现成的工具描述
- **硬件下位机落地** —— RS485 电能表 + 可控断路器 + ESP32 接真实回路替换掉模拟器，协议与服务器都不用改
- **Rust 前端智能屏** —— 香橙派上用 Slint，对比 Qt
- **语音** —— 房间内语音助手：开灯、播报当日用电（如"今天已用 3.75 千瓦时"）
- **数字孪生** —— 房间 3D 数字孪生大屏（Three.js），灯、空调、插座随真实状态动作
- **部署网络** —— 每房间一个 AP + 机房服务器机柜，服务跑在 **Ubuntu Server + Docker**
