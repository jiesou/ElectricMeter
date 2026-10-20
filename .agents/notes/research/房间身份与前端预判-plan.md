# 房间身份与前端预判 plan

> 性质：agent 产出的方案，用户未确认，供调整。定下来之后落 `decisions/`。

## 结论先说

「谁算一间房」原来在三个地方各判一次，判据还不一样：

| 位置 | 原来的判据 | 结果 |
|---|---|---|
| `web/src/views/RoomsView.vue` | `entities.length > 0` | 没报过实体的设备不画卡 |
| `server/core/stats.ts` | `metersOf(id).length > 0` | 没电表的设备不进统计页 |
| `cli/index.ts`（`em rooms`）、`slintui/power.py` | 不判 | 大屏、CLI 把 bigscreen 也当一间房（大屏画成 `^_^` 空卡） |

现在收敛成一条：**只有 `id === "bigscreen"` 不算房，前端与后端别处不再做任何排除**。

## 一、房间身份（已按其落地）

判据落一处，`server/core/util.ts` 出 `isRoom(id)`（`device_id !== "bigscreen"`），谁要房间列表谁用它。

- `server/routes/rooms.ts` 的 `snapshot()` 过滤掉 bigscreen —— REST `/api/rooms`、SSE `/api/rooms/stream` 和 CLI `em rooms` / `em watch` 一次全对。
- `server/core/stats.ts` 的 `report()` 用 `isRoom(id)` 取代原来的「有没有电表」判据。
- `web/src/views/RoomsView.vue` 的 `entities.length` 过滤删掉（API 已经保证）。
- `slintui/power.py`、`server/simulator/stays.ts` 不动：它们本来就照单全收，语义正好一致。

行为变化（都是有意的）：在线但还没报实体的设备，现在会在网页上画出一张「这间房还没有实体上报」的空卡，在统计页出现一行 0 kWh 的房。

## 二、其余预判清单

拎出来的都是「数据源头没给，前端自己猜」的东西。分类后只有 A 类要动，B/C 类是真分歧，D 类保留。

### A. 房间身份判定 —— 已落地，见上一节

### B. 派生口径两套，待定

| 预判 | 位置 | 问题 |
|---|---|---|
| 回路配色按「开关在实体表里的顺序」编号，电表靠 id 去掉 `-meter` 后缀认开关 | `web/src/color.ts:7,14,15` | 电表 id 不一定带 `-meter`，配不上就落第 1 条回路 |
| 回路配色按「设备列表 id 排序后的序号」编号 | `web/src/views/StatsView.vue:51` | 跟客房页那套不是同一个序号，同一间房两页颜色对不上 |
| 净人数取 `netCount` | `web/src/components/PeopleCounter.vue:10`、`slintui/power.py:65` | —— |
| 净人数用 `inCount - outCount` 现算 | `slintui/people/page.py:174`（标定页行）、`slintui/people/reporter.py`（上报源） | 上报源自己算没问题；标定页也自己算，跟服务器口径并行 |

处置建议：颜色统一成一套（谁简单用谁，倾向「按 id 排序取模」，不需要 `-meter` 约定）；标定页那行 net 是本地计数器，可以保留。

### C. 名字派生，建议保留

| 预判 | 位置 |
|---|---|
| 房号取房名第一段：`"301 电表箱".split()[0]` | `slintui/people/page.py:171` |
| 房 id 兜底用房名 | `slintui/people/page.py:167` |
| mock 里 id 由房名反推 `"esp-" + name.split()[0]` | `slintui/mock.py:22` |

都是演示/标定页的显示动作，不回流给服务器，动了没收益。

### D. 缺失值补齐与量程，保留

| 预判 | 位置 | 说明 |
|---|---|---|
| `powerW ?? 0` / `energyKwh ?? 0` | `web/src/history.ts:35,52`、`slintui/power.py:80,81` | 缺读数时画 0 还是断线？现在统一画 0 |
| `state ?? false`（未上报 = 断开）、`reported` 用来淡化 | `web/src/components/RoomCard.vue:28,29` | 视觉淡化区分「真断开」和「没报过」 |
| 功率表满量程 2000 W，超出夹到顶 | `web/src/components/PowerGauge.vue:5,16`、`slintui/ui/components/power-gauge.slint` | 量程写死，实际回路可能超 |
| 曲线窗口 10 分钟，前后端各写一遍 | `web/src/history.ts:6` 与 `server/routes/rooms.ts` 默认 600 000 | 两处常量重复 |
| 曲线 < 2 个点不画、Y 轴自动取上下界并留 5% 余量 | `web/src/components/RoomChart.vue:67,139` | 显示策略，无异议 |
| 设备构成横条分母 `Math.max(…, 0.001)` | `web/src/views/StatsView.vue:45` | 防除零 |

### E. 前端自算的聚合口径，保留但要知道

| 预判 | 位置 |
|---|---|
| 整房总闸 = 全部开关 `every(state)` 才是 on，点一下全切 | `web/src/components/RoomCard.vue:39,43` |
| 有电表才显示房级总表与曲线 | `web/src/components/RoomCard.vue:17` |
| CLI 合计功率只算在线房，电量全算 | `cli/render.ts:27,28` |
| 统计页「第 N 天」= `days.length`、日均 = `kwh / days.length` | `web/src/views/StatsView.vue:122,125`（后端 `bills()` 里是另一套 `dayStart` 相减） |
| 统计页默认选房：上次选的 → 第一间在住 → 第一间 | `web/src/views/StatsView.vue:34-36` |
| 设备构成里 `top` 取 kwh 最大者 | `server/core/stats.ts:86`、`web/src/mock.ts` 同形 |

### F. 乐观更新（先翻本地，等 SSE 覆盖），保留

- `web/src/data.ts:117` 翻闸先改内存 `e.state`
- `web/src/data.ts:149,160` 入住 / 退房先改 `room.occupied`
- `web/src/data.ts:108` 改房名先改内存再写库

### G. 「大屏」这个身份本身也有一份预判

`slintui/settings.py:12` 的 `DEFAULT_DEVICE_ID = "bigscreen"`、`server/simulator/bigscreen.ts:9` 的 `DEVICE_ID` 默认值 —— 三个地方各自默认成同一串字符，才是第一节那条规则能成立的前提，动的时候一起看。

## 三、动手顺序

1. ~~判据落到 `isRoom`，`routes/rooms.ts` 与 `core/stats.ts` 用它，`RoomsView.vue` 删掉二次过滤~~ 已完成。
2. B 类配色统一（待定）。
3. 验证：`bun run --cwd server test`（`rooms.test.ts`、`stats.test.ts` 各补了一条 bigscreen 用例）；`bun run --cwd server check`；客户端 `em rooms` 不再出现 bigscreen。

## 依据

- [项目定义](../../../AGENTS.md)
- [房间管理](../decisions/房间管理.md)、[人数监控与判定线标定](../decisions/人数监控与判定线标定.md)、[网页前端设计](../decisions/网页前端设计.md)
