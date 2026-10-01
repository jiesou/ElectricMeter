# AGENTS.md — 项目定义

> AGENTS.md 只定义项目当下状态，不放路线选择等过程性研究
> 过程性研究文稿，讨论纪要放在 `./.agents/notes/*`

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

## 数据模型（学 HA 的理念，不抄它的结构）

身份只有一层：**`ref = deviceId:key`**，例如 `esp-301:light`。deviceId 是一台 ESP32，key 是设备内的回路号，
name 是显示名，随便改，服务器不较劲。

| 我们的 | Home Assistant | 说明 |
|---|---|---|
| `device` | device registry | 一台 ESP32 = 一个 device。**在线/离线是 device 的属性，不是实体** |
| entity | entity | 设备内的一个可观测/可控制对象，挂在 device 下 |
| `area` | area | 房间。扁平、不可嵌套、可独立寻址（整房断电） |
| `domain` | domain | 只有 `switch`（可通断回路）和 `sensor`（只读读数）两种 |
| `device_class` | device_class | `outlet` / `power`(W) / `energy`(kWh)，单位照抄 HA |
| `state_class` | state_class | `measurement`（瞬时量）/ `total_increasing`（累计读数） |
| action | service | `switch.turn_on` / `turn_off` / `toggle`，`POST /api/services/switch/*` |
| `requested` | —（HA 无） | 服务器下的令。与 `state` 对不上就是接触器粘连 |

**明确不学 HA 的**：`config_entry` / `integration` / `platform` 装载机制、entity registry 的二十来个字段、
`unique_id` + `entity_id` + `device_id` + `area_id` 四层 ID、area 嵌套与 zone、`context` 因果链、
`restored` 语义。那套东西是给「几千个实体、几百个集成」的平台设计的。

调研过程见 [.agents/notes/ha-recorder-statistics-research.md](.agents/notes/ha-recorder-statistics-research.md)。

## 记录下的技术决策

- **全栈 Bun** —— HTTP / WebSocket / SSE / SQLite / 测试全在 `bun` 一个进程里，运行期只依赖 `hono` + `@hono/bun`
- **bun workspaces** —— 根 `package.json` 声明 `shared` / `server` / `cli` 三个成员，
  共享类型走 `@em/shared` 一条 import 路径，client 将来接入也不用改配置
- **Prisma 只管结构，不管查询** —— `prisma/schema.prisma` 是表结构声明，`core/db.ts` 手写建表与查询
- **上位机先行** —— 硬件没到货前用模拟器顶替下位机，软件侧先把闭环跑通
- **实体注册表只在内存** —— 设备连上时以它自报的清单为准，不再上报的实体直接摘掉，落库是浪费
- **演示优先，500ms 采样 / 5 秒落盘** —— 模拟器 `INTERVAL=0.5`，服务器收到就往 SSE 推，实时曲线顺滑；
  收到采样只改内存里未闭合的 **5 秒桶**，桶闭合才写一次库。30 天约 1 GB，这个体积换得起
  原始样本一律不落盘：每 500ms 一行、20 个实体，一个月就是几千万行
- **均值按时间加权** —— `Σ(值 × 持续秒) / 窗口秒`，不是 `AVG()`。电水壶这种占空比负载两者能差 1.5 倍
- **功率积分就是电量** —— `sum` 存瓦秒，÷ 3.6e6 得 kWh，比电表 0.01kWh 的分辨率细得多
- **states 表只记开关** —— 高频读数一律进 statistics，states 只留「什么时候开的、什么时候关的」
- **下位机只出站** —— `ws://host/ws?deviceId=xxx`，房间归属由**服务器**按 deviceId 认领，板子不必知道自己在哪个房间
- **SSE 与 WS 分工** —— 观察者（CLI watch / 后续前端）走 SSE 只读流，不占下位机的 WebSocket
- **代码结构参照** [ElectricDriveSystem](../ElectricDriveSystem) —— `app.ts`(Hono) + `routes/` + `core/` + `simulator/`

### 明确不做

- 不做 NILM / 负荷辨识 / 电器指纹 —— 与"能源管理"定位无关，是外来的噱头。
- 不做卫星通信 / 北斗 —— 放弃卫星通信那一类岗位群的加分，靠故事性与技能分赢。

## 已实现

**采集 → 计量 → 统计 → 通断**，全链路闭环，硬件没到货先用模拟器顶替

- **shared/** 纯类型零依赖，`@em/shared` 一个包同时被 server 和 cli 引用
  - `domain.ts` —— Device / Entity / Area / StatSeries / Event / Action
  - `protocol.ts` —— 下位机上下行消息；`state` / `ack` 是上行的，`welcome` / `action` / `ping` 是下行的
- **server/**（Bun + Hono）
  - `app.ts` —— `/ws` 接下位机（只出站）、`/api/*` 挂 REST 与 SSE
  - `core/db.ts` —— 四张表（`area` / `device` / `state` / `statistics`）建表与手写查询
  - `core/hub.ts` —— 在线设备表 + 内存实体注册表 + 统一下令通道（`requested` 与 `state` 在这里对账）
  - `core/stats.ts` —— 5 秒时间桶，时间加权均值与功率积分
  - `routes/api.ts` —— REST + SSE
  - `simulator/esp32.ts` —— 下位机模拟器，500ms 一采：三路（照明 / 插座 / 空调）+ RS485 电能表、
    电水壶占空比、断路器真实合闸分闸，`FAULT=1` 可注入接触器粘连
- **cli/**（`em`，运行期零依赖）
  区域总览 / 设备清单 / 实体清单 / 实体详情 / 远程通断（含整房）/ 功率波形 + 分时电量 / 开关时间线 / 实时事件流，
  全局 `--json` 输出原始 JSON，为将来包 MCP 铺路
- **REST**
  `GET /api/health`、`GET /api/areas`、`PUT /api/areas/:id`、`GET /api/devices`、`PUT /api/devices/:id`、
  `GET /api/entities?area=&domain=&device=`、`GET /api/entities/:ref`、`GET /api/history/:ref`、
  `GET /api/statistics/:ref?from=&to=`、`POST /api/services/switch/{turn_on,turn_off,toggle}`
- **SSE** `GET /api/events` —— 事件自带 `domain` 与 `name`，观察者不用回查就能渲染
- **测试** `bun test` 十二条：hello 登记与房间继承、实体摘除、开关只记变化、时间加权均值、
  功率积分折电量、下发回执、粘连检测、整房展开、离线失败、重连不丢状态不残留旧命令、重启靠 states 恢复初值
- **端口** server `8080`，`PORT` / `EM_HOST` / `WS` 可覆盖

## 已规划

> 实现后挪到上方，然后从这里删除，不留

- **研判引擎** `core/policy.ts` —— 人走断电 / 人来上电 / 空房大功率告警 / 长时间零用电告警
- **前端页面** —— 桌面 / 平板 / 手机多端，数据接口已就绪（见「已实现」的 REST + SSE）
  客房管理 + 客房监控：一个 ESP32 管一个客房，一个客房两三路（照明 / 插座 / 空调）
- **摄像头人数感知** —— 香橙派端侧 AI，人体框从判定线进=人进、从线出=人出，累计房间内人数
  - 复用民宿**现有监控**，不额外布传感器，毫米波雷达评委看烂了
  - 协议已留口子：人数由香橙派（感知域）产出，ESP32（执行域）只管电表和断路器
- **CLI 接入 MCP** —— 已有 `--json`，包一层 MCP server 就是现成的工具描述
- **硬件下位机落地** —— RS485 电能表 + 可控断路器 + ESP32 接真实回路替换掉模拟器，协议与服务器都不用改
- **Rust 前端智能屏** —— 香橙派上用 Slint，对比 Qt
- **语音** —— 房间内语音助手：开灯、播报当日用电（如"今天已用 3.75 千瓦时"）
- **数字孪生** —— 房间 3D 数字孪生大屏（Three.js），灯、空调、插座随真实状态动作
- **部署网络** —— 每房间一个 AP + 机房服务器机柜，服务跑在 **Ubuntu Server + Docker**
