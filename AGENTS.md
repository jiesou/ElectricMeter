# AGENTS.md — 项目定义

> AGENTS.md 只定义项目当下状态，即 **做什么**，不放细节实现和过程性研究
> 细节实现和过程性研究参考 `.agents/notes/AGENTS.md`

## 开发原则

- 我们要的是精简，易读可维护原型，不是工业化项目，我们要的是“它能跑起来演示”，而不是“能落地”
  - 想象一个初级程序员， **不看注释** 能不能轻松读懂代码。将这个设为标准
  - 不要堆砌文档和注释！让代码自己说话
  - 不要造名词——Entities 和 Devices 就够了，observers、conns、live 这种稀奇古怪的名词只会让人读不懂
- **已规划** 的东西是长期目标，“已规划”不是 TODO list。用户没有敲定就不要主动去实现规划中的东西
- 涉及到的全部时间，都直接使用 number 秒级时间戳，不使用任何特定时间格式，便于客户机单片机处理
- 保护性代码几乎不需要，message.error 都可以少一点，“it just work”即可，确保代码实现极度可读、代码量少、简单高效。代码的“简单，不overengineered”非常非常重要
- 不要 Overengineering！不要 Overengineering！不要 Overengineering！保持代码实现简短简单。如果可能，减少代码的更改
- 这是个 Bun 项目，不要换成 Node
- 注释用中文，只补充有助于理解的内容

## 项目是什么

**面向老旧民宿的智能用电管理与节能系统。**

用 RS485 电能表 + 直流交流断路器 + ESP32 作为硬件下位机侧，云端信息平台统计用电量、研判用电行为并下发通断指令，覆盖平板 / 手机 / 电脑多端。

## 已实现

> 这里只列项目结构，具体有什么直接读源码。 **不要赘述，不要累赘**

> 结构实现细节，重点学习 **老项目** `~/Documents/dev/Projects/ElectricDriveSystem`
> 各种代码都可以直接从老代码copy过来

- **shared/**
  - `types.ts` —— 数据模型与协议定义，用户明确定死
- **server/**
  - `app.ts` —— `/ws` 接下位机（只出站）、`/api/*` 挂 REST 与 SSE
  - `core/hub.ts` —— 相当于老项目的 ClientManager：所有设备的内存表（启动从库里全读）+ `WSMessageHandler` 数组（谁关心谁注册）；读数报来就写回库
  - `routes/api.ts` —— API 挂载点 + `/health`
  - `routes/devices.ts` / `routes/entities.ts` / `routes/rooms.ts` —— REST 快照与每秒一次的 SSE 全量快照
  - `core/sse.ts` —— 通用快照 SSE
  - `core/db.ts`
  - `*.test.ts`
  - `simulator/esp32.ts` —— 下位机模拟器（实体增量上报 + 应用层心跳）
  - `core/udp_camera.ts` —— UDP 图传接收：8 字节小端包头分片、重组 JPEG（照老项目 `UdpCameraServer.ts`）
  - `routes/cv.ts` —— `/api/cv/stream` MJPEG 流，把最新一帧推给浏览器 / `<img>`
- **cli/**（`em`，commander + picocolors + cli-table3；选型依据见 `.agents/notes/research/`）
  裸 `em` 客房总览（功率只合计在线房，口径同 web），`devices` / `entities [-d]` / `show <设备/实体>` 读已实现 REST，
  `watch [-d]` 整屏刷新 SSE 快照流。实体引用写作 `esp-301/light`；全局 `--json` 输出原始 JSON（MCP 预留），
  `--host` / `EM_HOST` 指服务器。通断、历史的服务端接口未实现，CLI 未做。`cli/e2e.test.ts` 起真 server 端到端验收
- **slintui/**（香橙派大屏，Python + Slint；壳照老板端 `OPi5-RK3588-ElectricDrive/slintui`）
  - `main.py` —— 只剩装配：起两个流，把窗口和页面绑起来；`settings.json` 配服务器地址 / 模型 / 视频源 / 图传地址 / `cameras[]` 判定线
  - `camera.py` —— 人数监控页：一路画面 + 这台机位的判定线，四个控件（标定 / UDP 图传开关 / 换摄像头 / 清零）
  - `calibration.py` —— 判定线标定：一台机位一组线、每条线绑一间客房（`device_id`）、命中与拖动、完成时落盘
  - `vision/` —— `detector.py`（YOLO11n 人体检测，ONNX 本机 / RKNN 板子双后端）、`tracker.py`（ByteTracker，带 track id）、`counter.py`（判定线跨线计数：死区防抖、换线清状态，一台机位可挂多条）、`pipeline.py` + `sources.py`（推理线程与帧来源）
  - `power.py` —— 客房用电页：接收 `/api/rooms/stream` 客房快照，`Home` 键切 mock（`mock.py` 固定数据）
  - `ui/` —— `app-window.slint`（底部 tab：客房用电 / 人数监控 / 设置）+ 三个页面 + `sizing.slint`；`components/` 放非页面组件：`nav-bar.slint` / `page-header.slint` / `power-gauge.slint` / `camera-viewport.slint`（给出 contain 之后画面自己的矩形，判定线叠加层靠它换算）
  - `rust/frame_sender/` —— Rust 写的 Python 扩展（maturin）：BGR 帧 → JPEG q80 → 8 字节包头分片 → UDP
  - `run_video.py` 离线跑视频出人数、`check_udp.py` UDP 图传端到端验收、`scripts/export_yolo11n.py` 导出 ONNX
- **web/**（民宿用电管理网页，Vue 3 + TS + Vite + Vue Router，普通 CSS，Bun 装依赖跑）
  - `App.vue` —— 搜索与筛选（进出详情不丢）+ 全局 `Home` 键切 mock，全站一份
  - `data.ts` —— 唯一数据入口：`rooms` / `status` / `mock`，按来源连 REST + SSE 或 mock；`api.ts` 负责 REST、EventSource 的创建和关闭
  - `mock.ts` —— 六间房mock，每秒浮动，只被 `data.ts` 使用；切法与注入点见 `.agents/notes/decisions/Mock模式.md`
  - `pages/RoomsPage.vue` / `RoomDetailPage.vue` / `CameraPage.vue` —— 客房总览（汇总 / 搜索 / 筛选 / 房卡）、客房详情（电表读数 + 开关状态）、视频监控（`<img src="/api/cv/stream">` MJPEG，带重新加载与全屏）
  - Hash 路由 `/rooms`、`/rooms/:device_id`、`/camera`；开发服务把 `/api` 代理到 `127.0.0.1:8080`（`VITE_API_TARGET` 可改），`bun run --cwd web dev` / `build`

> 大屏与感知侧的取舍见 `.agents/notes/decisions/摄像头人数感知.md`；板端 RKNN 与真摄像头**尚未上板实测**。
> 判定线怎么标、跟客房怎么挂、人数怎么算见 `.agents/notes/decisions/人数监控与判定线标定.md`。
> 网页第一版的范围与取舍见 `.agents/notes/decisions/网页前端第一版设计.md`。

## 已规划

> 实现后挪到上方，然后从这里删除，不留

- `core/hub.ts` 的失联判定 —— 应该复刻老项目的经验
- action 动作传递系统
- **历史记录与统计分析** —— 怎么做见 `.agents/notes/decisions/历史记录与统计.md`
- **业务逻辑** 一个业务一份代码 `core/*.ts` —— 人走断电 / 人来上电 / 空房大功率告警 / 长时间零用电告警
- **CLI 接入 MCP** —— 已有 `--json`，包一层 MCP server 就是现成的工具描述
- **硬件下位机落地** —— RS485 电能表 + 可控断路器 + ESP32 接真实回路替换掉模拟器，协议与服务器都不用改
- **语音** —— 房间内语音助手：开灯、播报当日用电（如"今天已用 3.75 千瓦时"）
- **网页第二版** —— 介绍页 + 3D 白模沙盘孪生大屏（Three.js，灯、空调、插座随真实状态动作）+ 管理页换肤，设计与实施步骤见 `.agents/notes/decisions/网页前端第二版设计.md`
- **部署网络** —— 每房间一个 AP + 机房服务器机柜，服务跑在 **Ubuntu Server + Docker**
