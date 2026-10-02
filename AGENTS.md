# AGENTS.md — 项目定义

> AGENTS.md 只定义项目当下状态，不放路线选择等过程性研究
> 过程性研究文稿，讨论纪要参考 `.agents/notes/AGENTS.md`

## 开发原则

- 我们要的是精简，易读可维护原型，不是工业化项目，我们要的是“它能跑起来演示”，而不是“能落地”
  - 想象一个初级程序员，不看注释能不能轻松读懂代码。将这个设为标准
- 涉及到的全部时间，都直接使用 number 秒级时间戳，不使用任何特定时间格式，便于客户机单片机处理
- 保护性代码几乎不需要，message.error 都可以少一点，“it just work”即可，确保代码实现极度可读、代码量少、简单高效。代码的“简单，不overengineered”非常非常重要
- 不要 Overengineering！不要 Overengineering！不要 Overengineering！保持代码实现简短简单。如果可能，减少代码的更改
- 这是个 Bun 项目，不要换成 Node
- 中文注释

## 项目是什么

**面向老旧民宿的智能用电管理与节能系统。**

用 RS485 电能表 + 直流交流断路器 + ESP32 作为硬件下位机侧，云端信息平台统计用电量、研判用电行为并下发通断指令，覆盖平板 / 手机 / 电脑多端。

### 明确不做

- NILM、负荷辨识、电器指纹
- 卫星通信、北斗

## 已实现

**采集 → 计量 → 统计 → 通断**，全链路闭环，硬件没到货先用模拟器顶替

- **shared/**
  - `types.ts`
- **server/**
  - `app.ts` —— `/ws` 接下位机（只出站）、`/api/*` 挂 REST 与 SSE
  - `core/db.ts` —— 三张表（`device` / `state` / `statistics`）建表与手写查询
  - `core/hub.ts` —— 在线连接表 + 内存实体注册表 + `WSMessageHandler` 数组（谁关心谁注册）
  - `core/stats.ts` —— 5 秒时间桶，时间加权均值与功率积分
  - `routes/api.ts` —— REST + SSE
  - `simulator/esp32.ts` —— 下位机模拟器，1000ms 一采：三路（照明 / 插座 / 空调），每路 relay + `_power` + `_energy`
    三个实体，加一个 `total_energy` 总表；电量在板上累加，电水壶占空比，断路器真实合闸分闸，应用层心跳 30s 一次
- **cli/**（`em`，运行期零依赖）
  默认总览（设备在线 / 当前功率 / 今日用电）/ 实体清单 / 实体详情 / 远程通断（`--device=` 整房）/
  功率波形 + 分时电量 / 开关时间线 / 实时事件流，全局 `--json` 输出原始 JSON
- **REST**
  `GET /api/health`、`GET /api/devices`（带 power / energy 的总览）、`GET /api/entities?kind=&device=`、
  `GET /api/entities/:ref`、`GET /api/history/:ref`、`GET /api/statistics/:ref?from=&to=`、
  `POST /api/actions/{turn_on,turn_off,toggle}`（target 为 `entity` 或 `device`）
- **SSE** `GET /api/events` —— 事件自带 `kind` 与 `name`，观察者不用回查就能渲染
- **测试** `bun test`
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
