# 统计页与角色切换 plan

> 性质：agent 产出的方案，用户未确认，供调整。定下来之后落 `decisions/`。

## 要加的两样东西

1. **统计数据页** `/stats`：在住客房的本次入住（按天 + 24 小时用电区间 + 设备构成）、办理入住 / 办理退房、客户用电情况记录表（含「超过 XX% 的客人」）。
2. **右上角角色切换**：访客（默认）/ 保洁 / 管理，决定客房管理页的电闸能不能动。

现有客房管理页、视频监控页不动。下位机通断这轮不做，闸点了仍只切本地状态。

## 用电量是一个数字，做差就行

一块电表从装上到拆掉，**只有一条单调递增的累计电量**。任何「这段时间用了多少电」都是两次取值相减：

```
用了多少 = 结束那一刻的累计值 − 开始那一刻的累计值
```

所以：

- 不预分桶、不建汇总表、不存账单数字；`EnergyUsageTime` 只记起止，用多少一律现查。
- 查询永远不扫区间，只做「某时刻的值」：`where device_id = ? and id = ? and ts <= ? order by ts desc limit 1`，直接走 `(device_id, id, ts)` 主键，一次几十微秒。按天 = 每天问一次，24 小时区间 = 每小时问一次，退房账单 = 问两次。
- 下位机归零（`delta < 0`）在写入时就并进累计值，所以取出来相减永远是对的，读的人不用管归零。

## 表

身份用现成的，关联交给外键，别手写、也别多造号。三张表：

```prisma
// 不动，跟现在一样：身份就是 device_id + id，device_id 是到 Device 的外键
model Entity {
  device_id String
  id        String // 报文里的名字：light / light-meter
  name      String // 显示名：灯 / 灯功率
  type      String
  state     Boolean?
  powerW    Float?
  energyKwh Float?
  inCount   Int?
  outCount  Int?
  netCount  Int?
  ts        Int?
  device    Device          @relation(fields: [device_id], references: [id], onDelete: Cascade)
  history   EntityHistory[]

  @@id([device_id, id])
}

// 账本：某块电表某一秒的读数。只加一列 energyKwh，主键与外键沿用现在的
model EntityHistory {
  device_id String
  id        String
  ts        Int
  powerW    Float?  // 实时曲线要
  energyKwh Float?  // 累计电量：这一个数字就是这块表从生到死的用量
  entity    Entity  @relation(fields: [device_id, id], references: [device_id, id], onDelete: Cascade)

  @@id([device_id, id, ts])
}

// 一次入住 = 一段起止时间。身份天然是「哪间房 + 什么时候开始的」，不另造号，房名从关系里取
model EnergyUsageTime {
  device_id String
  start_ts  Int
  end_ts    Int? // 退房填上；在住时为 null
  device    Device @relation(fields: [device_id], references: [id], onDelete: Cascade)

  @@id([device_id, start_ts])
}
```

`EntityHistory` 的主键 `(device_id, id, ts)` 本身就是「某块表某一秒」的索引，取某时刻的值直接走它，不用另建索引。`Device` 不动：`esp-301` 是下位机自己报的身份。

现有 `EntityHistory` 的 10 分钟 `DELETE` 去掉（行要一直留着），实时曲线改成查询时取最近 600 秒。删房靠外键级联清账本与入住记录，`decisions/房间管理.md` 的验收不变。

## 时间只有一个出处，还能快进（NTP）

`server/core/util.ts` 现在就只有一行 `now()`，把偏移加进去，它就成了全服务器的时间源：

```ts
let offset = 0;

/** 服务器的时间。快进过就是快进后的时间 */
export const now = () => Math.floor(Date.now() / 1000) + offset;

/** 把服务器这台表往前拨一天 */
export const nextDay = () => (offset += 86400);
```

- 服务器所有落盘、快照、心跳、健康检查的时间都走它，拨一下整体前进；`POST /api/clock/next-day` 就是 `nextDay()`。
- 浏览器向服务器对表：`GET /api/health` 已经返回 `ts`，`data.ts` 连上时取一次记下偏移，曲线的点与页面上的时间都用它，跟 NTP 客户端一个道理。
- 统计里的「天」就是服务器时间里的当地 0 点，不用另造分组键、不用结算动作。
- 拨表后客房管理页那条 10 分钟曲线会瞬间空掉（旧行掉出窗口），下一页数据就长回来。

## 每秒写一次

挂在 `server/index.ts` 现有的 `setInterval(save, 1000)` 里，不新增定时器：每块电表写一行，`powerW` 取内存读数，`energyKwh` 写服务器侧累计值。

- 内存里记着每块表上次收到的原始读数：`delta = raw - last`，**`delta < 0` 就是下位机归零，`delta = raw`**，累加进 total。
- **启动时 total 从账本最新一行接上**（`order by ts desc limit 1` 拿 `energyKwh`，没有就从 0 起），这样样本历史与实时数据是一条连续的线，跨启动、跨样本相减都对。
- 重启后若账本为空，第一笔只做基线（不补差）。

## 样本数据

放 `server/simulator/stays.ts`（跟 `esp32.ts` / `bigscreen.ts` 并排的演示数据侧）：某台设备连上、账本里还没有它的行，就给它把过去铺出来。

- **就是 `EntityHistory` 行，1 秒一行，从头到尾**，形状跟真实数据完全一样，只是 `powerW` 空着、`energyKwh` 按一条作息曲线（晚上多、凌晨少）单调递增地铺；再给这段历史按天划出若干次入住，写进 `EnergyUsageTime`。
- 用的都是已经接入的真实房间和它的真实电表——不造房间、不造实体、不编 id。
- 写完把内存里的 total 接到样本最后一个值上，实时数据接着往下涨。
- 造的时候直接批量插入（裸 SQL），不走 Prisma 逐条。

剂量（18 块表，每行约 40 B）：

| 铺多久 | 行数 | 体积 | 插入耗时 |
|---|---|---|---|
| 1 天 | 155 万 | ~60 MB | 约 2 秒 |
| 7 天 | 1090 万 | ~400 MB | 约 10 秒 |
| 30 天 | 4660 万 | ~1.8 GB | 约 40 秒 |
| 365 天 | 5.7 亿 | ~22 GB | 约 7 分钟 |

常量 `SEED_DAYS` 控制，先给 7 天，想铺一年就改成 365。后台造，不挡启动。

## 服务器接口

| 接口 | 作用 |
|---|---|
| `POST /api/clock/next-day` | 服务器时间 +86400 |
| `POST /api/rooms/:device_id/checkin` | 开一段 `EnergyUsageTime`（`start_ts` = 现在） |
| `POST /api/rooms/:device_id/checkout` | 填上 `end_ts` |
| `GET /api/stats` | 一次给全：`now`、每间房（`occupied`、本次入住的按天与 24 小时区间、设备构成、累计）、`stays`（记录表，含 `percent`） |

`GET /api/rooms` 快照加一个 `occupied` 字段（服务器内存维护在住区间，启动从库读），客房管理页拿它判空房。

## 前端

- `views/StatsView.vue`：在住/空房列表（房名、入住日、天数、已用 kWh、日均、办理入住/退房）→ 选中一间看本次入住（按天柱状图 + 24 小时区间，与历史入住的平均分布叠一层）→ 下面客户用电情况记录表（房号、起止、天数、总 kWh、日均、主要设备、超过百分之多少的客人）。
- `components/RoleSwitch.vue`、`components/NextDayButton.vue`：放 `PageHeader` 右侧（跟连接状态并排），全局都在。
- 角色规则：**访客**一律锁；**保洁**只对空房可动；**管理**全部可动。锁住的闸灰掉不可点。
- `data.ts` 加 `role`、`stats`（2 秒轮询）与动作；`api.ts` 加四个接口 + 对表。
- `mock.ts` 扩：mock 下统计页整套跟着切（自己的账本、在住、记录表、下一天、入住退房都在内存里，形状一样）。
- `router.ts` 加 `/stats`；`App.vue` 导航加第三项（桌面左栏、窄屏三 tab）。
- 柱状图用 Chart.js 的 bar（已有依赖），24 小时对比用幽灵柱；设备构成用 CSS 横条，不引新库。

## 已知不足

- 本次入住只有几十秒真实数据，24 小时区间图基本只有一根柱；有形状的是历史样本。要本次入住也有形状，得让模拟器按作息曲线给时间戳，这轮不做。

## 要改的文档

- `decisions/历史记录与统计.md`：账本 1 秒一行不删、电量是一个数字做差、时间源可快进、样本数据。
- `decisions/数据模型与协议.md`：`EntityHistory` 加一列累计电量；新增 `EnergyUsageTime`；关联一律走外键，不手写房间名。
- `decisions/网页前端设计.md`：导航两项 → 三项；补统计页与页头右侧（角色 / 下一天）。
- `decisions/Mock模式.md`：「mock 不覆盖历史统计」这句要改（统计页整套跟 mock 切）。

## 验收

- 服务器测试：归零不掉数、任意区间做差、按天与 24 小时取值、拨表换天、入住/退房、百分位、样本不造房间不造实体、`occupied` 跟着入住退房走、删房级联清账本。
- `bun run --cwd web check` + `build` 通过。
- 演示链路：起 server + 模拟器（样本已铺好）→ 管理角色办理入住 → 拨 3 次「下一天」→ 统计页出现柱子、24 小时区间与设备构成 → 办理退房 → 记录表新增一行并给出「超过 XX% 的客人」→ 切保洁，空房可动闸、在住房锁死。
