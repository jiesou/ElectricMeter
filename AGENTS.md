# AGENTS.md — 项目定义

> AGENTS.md 只定义项目当下状态，即 **做什么**，不放细节实现和过程性研究
> 细节实现和过程性研究参考 `.agents/notes/AGENTS.md`

> 本存储库：上位机
> 下位机请见 `~/Documents/dev/Projects/PlatformIOProjects/ElectricMeterDevice`

> “上位机老项目”请见 `~/Documents/dev/Projects/ElectricDriveSystem`
> “下位机老项目”请见 `~/Documents/dev/Projects/PlatformIOProjects/ElectricDriveClient`

## 开发原则

- 我们要的是精简，易读可维护原型，不是工业化项目，我们要的是“它能跑起来演示”，而不是“能落地”，只考虑功能能跑起来。不要考虑实际各种边缘场景，不要为实际场景中的问题做过度工程
  - 想象一个初级程序员， **不看注释** 能不能轻松读懂代码。将这个设为标准
  - 不要堆砌文档和注释！让代码自己说话
  - 不要造名词——Entities 和 Devices 就够了，observers、conns、live 这种稀奇古怪的名词只会让人读不懂
- **已规划** 的东西是长期目标，“已规划”不是 TODO list。用户没有敲定就不要主动去实现规划中的东西
- 涉及到的全部时间，都直接使用 number 秒级时间戳，不使用任何特定时间格式，便于客户机单片机处理
- 保护性代码几乎不需要，message.error 都可以少一点，“it just work”即可，确保代码实现极度可读、代码量少、简单高效。代码的“简单，不overengineered”非常非常重要
- 不要 Overengineering！不要 Overengineering！不要 Overengineering！保持代码实现简短简单。如果可能，减少代码的更改
- 这是个 Bun 项目，不要换成 Node
- 注释用中文，只补充有助于理解的内容
- 若无必要，不跑simulator，simulator会污染很多数据，启动simulator之后及时停掉

## 项目是什么

**面向老旧民宿的智能用电管理与节能系统。**

用 RS485 电能表 + 直流交流断路器 + ESP32 作为硬件下位机侧，云端信息平台统计用电量、研判用电行为并下发通断指令，覆盖平板 / 手机 / 电脑多端。

## 已实现

> 这里只列项目结构，具体有什么直接读源码。 **不要赘述，不要累赘**
> 结构实现细节，重点学习 **老项目** `~/Documents/dev/Projects/ElectricDriveSystem`
> 各种代码都可以直接从老代码copy过来

- **shared/**
  - `types.ts`
- **server/**
  - `app.ts` —— `/ws` 接下位机（只出站）、`/api/*` 挂 REST 与 SSE
  - `core/hub.ts`
  - `routes/api.ts`
  - `routes/devices.ts` / `routes/entities.ts` / `routes/rooms.ts`
  - `core/sse.ts`
  - `core/history.ts`
  - `core/db.ts`
  - `*.test.ts`
  - `simulator/esp32.ts`
  - `simulator/bigscreen.ts`
  - `core/udp_camera.ts`
  - `routes/cv.ts`
  - action 下通断令：`routes/entities.ts` 下发 `pub_action_switch`，`core/hub.ts` 收 `ack_action_switch` 落 state
- **cli/**
  TODO
- **slintui/**
  - `main.py`
  - `people/`
  - `camera_service.py`
  - `vision/` —— `detector.py`
  - `power.py`
  - `ui/` —— `app-window.slint`
  - `rust/frame_sender/` —— Rust 写的 Python 扩展（maturin）：UDP图传
  - `run_video.py` 离线跑视频出人数、`check_udp.py` UDP 图传端到端验收、`scripts/export_yolo11n.py` 导出 ONNX
- **web/**
  - `src/data.ts`
  - `src/views/*`
  - 设计意图见 `.agents/notes/decisions/网页前端设计.md`

## 已规划

> 实现后挪到上方，然后从这里删除，不留

- **统计分析** —— 实时功率曲线、退房页（24小时用电分布与百分位）；怎么做见 `.agents/notes/decisions/历史记录与统计.md`
- **业务逻辑** 一个业务一份代码 `core/*.ts` —— 人走断电 / 人来上电 / 空房大功率告警 / 长时间零用电告警
- **CLI 接入 MCP** —— 已有 `--json`，包一层 MCP server 就是现成的工具描述
- **语音** —— 房间内语音助手：开灯、播报当日用电（如"今天已用 3.75 千瓦时"）
- **数字孪生** —— 房间 3D 数字孪生大屏（Three.js），灯、空调、插座随真实状态动作
- **部署网络** —— 每房间一个 AP + 机房服务器机柜，服务跑在 **Ubuntu Server + Docker**
