# WS 通信架构：ESP32 与香橙派两个 device 的关系

> ## ⛔ 已弃用
>
> **2026-10-01 用户判定：这份不是他定义的，是 agent 生成的，不作为本项目的实际架构。**
> **不照它实现，也不要再拿它当依据引用。**
>
> 弃用理由：它假设「一个 WS 入口、三种 role、双 device」，那是 agent 为多端场景推演出来的复杂度。
> 本项目已经收敛成「一台 ESP32 管一间房、下位机只出站」，role 分流、香橙派感知域、
> `welcome` 里的 `snapshot` 全部不成立。
>
> 保存在这里只为留个出处。协议以 `shared/protocol.ts` 和用户本人的定义为准。
>
> ---
>
> 状态：规划稿。落地时按「改动清单」逐条搬。
> 起因：老项目 `slintui` 用 REST 每 2s 轮询拉后端状态，延迟高、状态会撕裂、请求浪费。这份稿子把它换成 WebSocket，并顺手把两个 device 的职责理清。

---

## 一、先回答那个问题：两个 device 是什么关系？

ESP32 和香橙派大屏**不是同类 device**，是这个系统里两个不同域的端点。它们之间**没有直接通信**，谁也不认识谁，所有关联都由服务器按 `room` 建立。

```
                    ┌────────────────────────────────────┐
                    │      服务器 (Bun + Hono)             │
                    │   融合 · 研判 · 记账 · 下令 · 留痕    │
                    └───▲───────────────▲──────────────────┘
         WS 上行       │               │       WS 下行(令)
                        │               │
      ┌─────────────────┴──┐        ┌───┴──────────────────┐
      │  感知域  香橙派      │        │  执行域  ESP32         │
      │  摄像头 + RKNN NPU  │        │  RS485 电能表 + 断路器  │
      │  数人 · 图像告警     │        │  采集功率/电量 · 通断     │
      │  ── Slint 大屏 UI   │        │                        │
      └────────────────────┘        └────────────────────────┘
```

| | ESP32 | 香橙派 |
|---|---|---|
| 域 | 执行域 | 感知域（兼人机界面） |
| 唯一权威数据 | `power` / `energy`（电表读数）、`relays`（断路器实际状态） | `occupants`（房间内人数）、图像告警 |
| 硬件前提 | RS485 + 可控断路器 | 摄像头 + NPU。**没有 NPU 就没有人数** |
| 房间归属 | 服务器按 device_id 认领，板子不知道自己在哪间房 | 同上 |

**关键推论：`occupants` 的生产者不是 ESP32，是香橙派。**

现在的 `server/types.ts` 把 `occupants` 挂在 ESP32 的 `telemetry` 里，这是从"摄像头接在 ESP32 上"的假设来的 —— 但 RKNN NPU 在香橙派上，摄像头也接在香橙派上，ESP32 拿不到人形框。协议必须把这个错位纠正过来（见「改动清单」第 1 条）。

### 为什么摄像头不能接 ESP32

1. ESP32 没有 NPU，跑不了 RKNN；跑 TFLite-Micro 也是 30fps 都悬，跨线计数要的恰恰是稳定帧率
2. 「跨线计数」需要跟踪多目标的连续轨迹，是有状态算法，ESP32 上做纯属为难自己
3. 摄像头 + 断路器共处一个弱电箱，走 USB/排线，电磁环境本来就该分开

### 一个香橙派管几个房间？

MVP：**一间房一个香橙派**，镜头对准房门，与该房的 ESP32 一一对应。理由是「跨线计数」天然是房间级的 —— 计数线画在哪扇门框上，就天然决定了归属哪间房。协议上留口子（服务器按 device_id 认领房间，板子不必知道自己在哪间房），多房间是后面加 `sites` 字段的事，现在不加。

---

## 二、现状的问题（不只是「轮询烂」）

| # | 问题 | 后果 |
|---|---|---|
| 1 | `/ws` 只认 `device_id`，没有 role | **这是真 bug**：大屏按现在的接法连上去会被注册成下位机，收到 relay 命令，它的 telemetry 会被当电表读数写进 `samples` 表 |
| 2 | 观察者只有 SSE (`/api/events`)，单向 | 大屏没法下发通断令，只能靠另开一条 REST |
| 3 | OPI 侧 REST 轮询 2s | 状态撕裂（多个 GET 拿到不同时刻的快照）、2s 延迟、无效请求 |
| 4 | 没有重连退避 | 拔网线/服务器重启后要手动重启进程 |
| 5 | 没有应用层心跳 | TCP 层察觉不到「拔网线」这种半开连接，`lastSeen` 会骗人 |

---

## 三、方案：一个 WS 入口，三种 role

```
ws://host/ws?role=meter&device_id=esp32-301       # 执行域
ws://host/ws?role=sense&device_id=opi-301         # 感知域
ws://host/ws?role=console&clientId=bigscreen-1   # 控制台（大屏 UI）
```

**一条连接一种角色，不混用。** 香橙派同时是 `sense` 和 `console`，但它是**两条独立连接** —— 混在一根连接上会让「上行数据源」和「下行渲染端」的语义打架，服务器广播时还得排除自己，是 bug 温床。

### 3.1 消息模型：snapshot + delta

- 连上 → 服务器立刻下发 `welcome`，**自带全量快照**（房间列表 / 通道 / 在线状态 / 今日电量 / 已省电）
- 之后全是增量 `event`
- 断线重连 → 重新拿 `welcome` 全量

**刻意不做 seq 断点续传。** 丢包补偿要处理 seq、乱序、去重、重放窗口，对「能跑起来演示」是过度工程。快照兜底重连是 10 行代码且永远不会错的做法。唯一代价是重连瞬间多一次全量查询 —— 一台服务器几十个房间，这个开销可以忽略。

### 3.2 图像不走 WS

640×640 JPEG 推 10fps 会把控制通道的心跳和延迟一起拖垮。图像保留老项目的 **UDP 分片旁路**（`slintui/udp_frame_uploader.py` 已经能用，只改了取帧来源），推给服务器做远端查看/存证。

**大屏显示的画面是本地摄像头本地渲染的**，不需要服务器转发 —— 所以 `Event` 里没有任何图像字段，别设计一个用不上的东西。

### 3.3 REST 还留什么

只留「不适合走事件流」的：

| 用途 | 接口 |
|---|---|
| 冷启动快照（welcome 的等价物，给 CLI / curl 调试 / 兜底） | `GET /api/rooms` |
| 历史功率曲线（要查 DB 聚合，不是实时流能算的） | `GET /api/rooms/:room/power?bucket=` |
| 手动通断（大屏走 WS，这里留给 CLI 和脚本） | `POST /api/devices/:id/relay` |
| 告警列表（历史查询） | `GET /api/alarms` |

SSE `/api/events` **保留给 CLI**，不删 —— CLI 是单行 `watch`，SSE 比 WS 简单。但控制台不走它。

### 3.4 心跳与重连

- **应用层 ping**：30s 一次。WS 协议自带的 ping/pong 由 bun/hono 自动应答，检测不到半开连接，所以留一个应用层的
- **重连**：指数退避 `1s → 2s → 4s → 8s → 30s` 封顶，抖动加随机量避免惊群

---

## 四、协议草案

`server/types.ts` 改成：

```ts
/** 三种角色：执行域下位机 / 感知域下位机 / 控制台 */
export type Role = "meter" | "sense" | "console";

/** 上行 */
export type UpMsg =
  // meter
  | { type: "hello"; device_id: string; channels: string[] }
  | { type: "telemetry"; ts: number; readings: Reading[] }   // occupants 移走
  | { type: "relay_state"; ts: number; relays: { channelId: string; on: boolean }[] }
  // sense
  | { type: "presence"; ts: number; occupants: number; inCount: number; outCount: number }
  | { type: "alarm"; ts: number; kind: "intrusion" | "loiter" | "overcrowd"; message: string }
  // console
  | { type: "command"; ts: number; room: string; channelId: string; on: boolean }
  // 共同
  | { type: "ping"; ts: number };

/** 下行 */
export type DownMsg =
  | { type: "welcome"; role: Role; device_id: string; room: string; ts: number; snapshot: Snapshot }
  | { type: "relay"; ts: number; channelId: string; on: boolean }   // 只发给 meter
  | { type: "event"; e: Event }                                   // 只发给 console
  | { type: "ack"; ts: number; ref: string }                      // 命令受理回执
  | { type: "ping"; ts: number };
```

`Event` 扩一条 `presence`：

```ts
| { type: "presence"; ts: number; device_id: string; room: string; occupants: number }
| { type: "alarm"; ts: number; device_id: string; room: string; kind: string; message: string }
```

时间一律 `number` 秒级时间戳，沿用现有约定。

---

## 五、改动清单（按依赖顺序）

| # | 改哪 | 改什么 | 影响 |
|---|---|---|---|
| 1 | `server/types.ts` | `telemetry` 去掉 `occupants`；`Event` 加 `presence`；加 `Role` / 新 `UpMsg` / `DownMsg` | 类型单包，三端共用 |
| 2 | `server/server.ts` | `/ws` 解析 `role`，按 role 分发 handler | 修掉「大屏被当下位机」的 bug |
| 3 | `server/core/hub.ts` | `online` 拆成 `meters` / `senses` 两张表 + `consoles` 集合；`sendTo` 只认 meter；`command()` 收 room 先查表 | 中枢重构 |
| 4 | `server/core/policy.ts` | `judge()` 的 occupants **不再来自本次 telemetry**，改为查 `senses` 里该 room 的最新 presence | **研判逻辑实质改动**，这一步做完「人来上电人走断电」才真正闭环 |
| 5 | `server/core/db.ts` | 加 `presence` / `image_alarm` 落库 | `prisma/` 同步改 schema |
| 6 | `server/routes/api.ts` | SSE 保留给 CLI；不动 | 无 |
| 7 | `server/simulator/esp32.ts` | 去掉 occupants 字段 | 模拟器跟着协议走 |
| 8 | 新 `server/core/wsclient.ts` 或 Python 侧 `slintui/ws_client.py` | 客户端连接 + 指数退避重连 | 见第六节 |

---

## 六、两个 device 的客户端长什么样

**ESP32（meter）** —— 改动最小，连接逻辑几乎照抄现在 `simulator/esp32.ts`：连上 → `hello` → 循环发 `telemetry` + `relay_state` → 收 `relay`。ArduinoJson 那点内存够用。

**香橙派（sense）** —— Python，两条连接：
- `sense`：人形检测线程按固定节奏（如 1s）推 `presence`，只在人数变化时推 `alarm`
- `console`：只收 `event` / `ack`，不发 `telemetry`

---

## 七、待定

- 香橙派 `presence` 上报节奏：固定 1s 推一次，还是「人数变化时立即推 + 5s 心跳保底」？倾向前者（简单，且 `occupants` 本来就是慢变量）
- 跨线计数的状态机放板子上还是服务器上？倾向板子上 —— 帧率数据在本地，丢帧后再补算意义不大
- 图像告警（`intrusion` / `loiter` / `overcrowd`）做不做？MVP 只做人数，告警先复用现有的空房大功率/长时间零用电；图像告警留到后面