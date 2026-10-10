# HA Recorder / Statistics 机制研究 → 老旧民宿用电持久化方案

> **性质：agent 产出（subagent 调研），用户未确认，仅作参考。**
> 源码基准：`home-assistant/core@89f7f5d`（db schema v53）。仅研究对比，不含实现代码。

---

## 1. 存储分层

HA 是**三层**：原始 `states` → 短期 `statistics_short_term`（5 分钟）→ 长期 `statistics`（1 小时）。
`statistics_meta` 是两张统计表共享的元数据（相当于 "entity 注册表"）；`statistics_runs` 记录每次编译的批次时间戳。

| 表 | 粒度 | 生命周期 | 谁写 |
|---|---|---|---|
| `states` | 每次状态变化（无聚合） | `purge_keep_days`（默认 10 天）后删 | recorder 事件循环，`commit_interval=5s` 批量提交 |
| `statistics_short_term` | 5 分钟 | **同 `purge_keep_days` 一起删**（`purge.py:96`） | 每 5 分钟 `compile_statistics` |
| `statistics` | 1 小时 | **永不自动删** | 每小时（`start.minute==55`）从短期表汇总 |
| `statistics_meta` | 每 statistic_id 一行 | 跟随实体 | 平台注册 |
| `statistics_runs` | 每批一次 | `purge_keep_days` | 编译任务 |

### `statistics_short_term` / `statistics` 完整字段（两表结构完全相同，`db_schema.py:627-735`）

| 列名 | 类型 | 含义 | 索引 |
|---|---|---|---|
| `id` | BIGINT（sqlite INTEGER）PK | 自增主键 | PK |
| `metadata_id` | BIGINT FK→`statistics_meta.id` ON DELETE CASCADE | 哪个 statistic_id | 复合唯一索引成员 |
| `start_ts` | DOUBLE（Unix 秒，含小数） | 桶起点（UTC 对齐到 5 分钟 / 整点） | `ix_*_statistic_id_start_ts`（唯一）+ 单列 `index=True` |
| `created_ts` | DOUBLE | 该聚合行写入数据库的时刻（≠ 桶时间） | — |
| `mean` | DOUBLE NULL | 该桶平均值（时间加权，非算术平均） | — |
| `mean_weight` | DOUBLE NULL | 环形均值（角度/风向）的权重，普通算术平均为 NULL | — |
| `min` | DOUBLE NULL | 桶内最小值 | — |
| `max` | DOUBLE NULL | 桶内最大值 | — |
| `state` | DOUBLE NULL | 桶内**最后一个**状态值（"last" 语义） | — |
| `sum` | DOUBLE NULL | **累计量本身**（单调递增表才写），非桶内增量 | — |
| `last_reset_ts` | DOUBLE NULL | 计量表本周期归零时刻 | — |
| `created` / `start` / `last_reset` | CHAR(0) | 遗留占位列，**全部不用**（只为迁移兼容） | — |

`statistics` 的 `duration = timedelta(hours=1)`、`statistics_short_term` 的 `duration = timedelta(minutes=5)` 写在**类属性**上（`db_schema.py:699/717`），后续所有代码用 `table.duration` 泛化，因此两张表必须同构。

**为什么要拆两张表**（不是一张加 `type` 列）：
1. **粒度语义不同**——`sum`/`state` 在 5 分钟桶里是"当时累计值"，在小时桶里是"该小时最后一个累计值"，小时桶的 `sum` 来自当小时**最后一个** 5 分钟桶（见 §2），不是 12 个桶相加。混在一张表会让"取最新一条"逻辑出现歧义。
2. **保留期不同**——短期表跟 `purge_keep_days` 一起删，长期表永不删，必须能独立 DELETE（`purge.py:96` 只 SELECT `StatisticsShortTerm`）。
3. **唯一索引不同**——5 分钟桶起点与整点会撞在同一时间戳，同表就得再加一列进复合主键。
4. **热冷分离**——短期表只有几 MB 常驻 page cache，每 5 分钟写；小时表只写不更新，且查询走 `ix_statistics_statistic_id_start_ts` 唯一索引。

---

## 2. 写入策略

**HA 是"每次状态变化写一行 states"，聚合是离线的、周期性的、幂等的。** 三个阶段：

```
state_changed 事件 ──► states 表（每事件一行，5s 批量 commit）
                          │
              每 5 分钟（second=10）compile_statistics
                          ▼
              从 states 读该 5 分钟窗口的状态
                          ▼
              statistics_short_term（12 行/小时/实体）
                          ▼
              每小时（minute=55）_compile_hourly_statistics
                          ▼
              statistics（1 行/小时/实体）
```

**注意：HA 对 `states` 不做去重。** 状态值没变也照样写一行；"只取有意义的变化"是**查询时**过滤（`last_changed_ts IS NULL OR last_changed_ts == last_updated_ts`，`history/__init__.py:197-203`），不是写入时。

### `states` 表 schema（`db_schema.py:404-452`）

| 列名 | 类型 | 含义 | 索引 |
|---|---|---|---|
| `state_id` | BIGINT PK | 自增 | PK |
| `metadata_id` | BIGINT FK→`states_meta.metadata_id` | 指向 `states_meta(entity_id)` | `ix_states_metadata_id_last_updated_ts` 复合首列 |
| `state` | VARCHAR(255) | 状态字符串（数值也存成字符串） | — |
| `last_updated_ts` | DOUBLE | 实体**最后一次被写入**的时间（属性变了也算） | 复合索引次列 + 单列 index |
| `last_changed_ts` | DOUBLE **NULL 哨兵** | 状态**值**变化时间；**NULL 表示"等于 last_updated_ts"** | — |
| `last_reported_ts` | DOUBLE NULL | 设备主动上报时间，NULL 表示等于 last_updated | — |
| `old_state_id` | BIGINT FK→`states.state_id` | 上一条状态，链表式"上一次" | index |
| `attributes_id` | BIGINT FK→`state_attributes.attributes_id` | 属性 JSON 单独存、按内容 hash 去重 | index |
| `origin_idx` | SMALLINT | 0=本地 1=远端 | — |
| `context_id_bin` / `context_user_id_bin` / `context_parent_id_bin` | BLOB(16) | 触发来源（谁/什么自动化导致） | `ix_states_context_id_bin` |
| `entity_id`/`attributes`/`event_id`/`last_updated`/`last_changed`/`context_*`(str) | CHAR(0) | 遗留占位，全空 | — |

`state_attributes`（`db_schema.py:539`）= `attributes_id` PK + `hash`(UINT32, index) + `shared_attrs`(TEXT/LONGTEXT)。**属性内容去重**：相同 hash 的多个 state 行共享同一行。

### `statistics_meta` 的作用（`db_schema.py:758-775`）

| 列名 | 类型 | 含义 |
|---|---|---|
| `id` | BIGINT PK | 内部 ID，统计表只存这个 |
| `statistic_id` | VARCHAR(255) unique index | 业务 ID（HA 里就是 entity_id，或外部来源的自定义 ID） |
| `source` | VARCHAR(32) | 谁产生的（`recorder` / 外部 integration） |
| `unit_of_measurement` | VARCHAR(255) | 统计值的**存储单位**（首次见到该实体时锁定，之后按它换算） |
| `unit_class` | VARCHAR(255) | 换算器类型（Energy/Power/Temperature…），无对应换算器则 NULL |
| `mean_type` | SMALLINT NOT NULL | 0=NONE / 1=ARITHMETIC / 2=CIRCULAR（**取代了旧的 `has_mean` bool**，2026.11 前过渡期两者共存） |
| `has_sum` | BOOLEAN | 该实体是否维护 `sum`（= `state_class` 是 total / total_increasing） |
| `name` | VARCHAR(255) | 显示名 |

### 聚合规则（`components/sensor/recorder.py:707-830`）

一个 5 分钟桶内多个样本如何合成：

| 字段 | 规则 |
|---|---|
| `min` / `max` | 窗口内所有数值样本的 min / max |
| `mean` | **时间加权算术平均** `_time_weighted_arithmetic_mean`：`Σ(value × 该值持续秒数) / 窗口秒数`，按 `last_updated` 切段，**不做插值**。`mean_type=CIRCULAR` 时用 `weighted_circular_mean`（方向/角度专用） |
| `sum` | 不做桶内求和。对 `total`/`total_increasing`，`_sum` 是**从上一条统计行继承的累计值 + 本窗口内所有增量**；并写出 `state`（本窗口最后一个读数） |
| `state` | 本窗口最后一个有效读数 |
| `last_reset` | 检测到计量归零时写入 |

**这是关键差异：电器占空比场景下 "开 1000W 30 秒 / 关 270 秒"，算术平均会得 125W（错），时间加权得 83W（对）。** 我们的功率曲线必须照抄 HA 的时间加权，而不是 `AVG()`。

### `last_updated` vs `last_changed`

- `last_updated`：属性或状态任一被写入就更新（"这次心跳"）。
- `last_changed`：只有 `state` 字符串真的变了才更新。
- DB 里 `last_changed_ts` 为 **NULL 是哨兵**，等价于 `= last_updated_ts`（`States.from_event`，`db_schema.py:490-493`；读取时 `self._last_changed_ts or self._last_updated_ts`，`models/state.py:73`）。
- **统计影响**：
  - 时间加权均值用 **`last_updated`**（段长由心跳决定）——高频上报的实体即使值不变，也会贡献"该值持续了多久"。
  - 变化率 / 通断次数 / 告警时间线用 **`last_changed`**。
  - 我们模拟器里"功率每 5 秒微小抖动"会产生大量 `last_updated` 新行但几乎无 `last_changed`——若只算 `AVG(power)` 会把抖动放大，若按 `last_changed` 采样又会把负载变化丢掉。**用 `last_updated` 做时间加权是正解。**

### 写放大：为什么不能直接查 states

- 1 个实体 5 秒 1 样本 × 1 年 = **630 万行**。1000 个实体 = **63 亿行**。任何"本月曲线"查询都要扫几十亿行。
- 同样数据的小时级聚合 = 876 万行/实体年，**降 720 倍**。5 分钟级降 60 倍。
- 附带收益：`sum` 的累加是**增量**的（`last_sum + delta`），可以在写入时一次算好；直接查 states 做差值则需要处理中途的 meter reset 和边界样本。

---

## 3. 三种 long-term statistics 类型

| 类型 | 字段 | 定义 | 典型场景 |
|---|---|---|---|
| `mean` | `mean` / `min` / `max` / `mean_weight` | 桶内时间加权均值 + 极值 | 功率 W、温度、湿度、占空比 |
| `sum` | `sum` / `state` / `last_reset_ts` | `sum` = **截至该桶结束时的累计值**；`state` = 桶内最后读数；跨桶差值 = `change` | 电表 kWh、用水量、气量 |
| `last` | `state` | 该时段最后一个值（不是独立类型，是 `state` 列的读法） | 开关通断状态、档位、模式 |

映射规则由 `DEFAULT_STATISTICS`（`sensor/recorder.py:61-71`）决定，**由 `state_class` 自动选，不由调用方指定**：

| 我们的量 | HA state_class | 统计类型 | 说明 |
|---|---|---|---|
| **瞬时功率 (W)** | `measurement` | `{mean, min, max}` + ARITHMETIC | 时间加权均值；min/max 直接给柱状图的包络 |
| **累计电量 (kWh)** | `total_increasing` | `{sum}` | `sum` 是累计值，做差得时段 kWh；写 `change` 列 |
| **断路器通断** | *（无对应 class）* | 用 `last`（`state` 列）或 `states.last_changed_ts` 时间线 | **不能**用 `total_increasing`——开→关会让读数下降，HA 会抛 `warn_dip` 警告 |
| 若同时要"今日/本周/本月" | — | 长期表永远存小时桶，日/周/月由查询时 reduce | 见 §7 |

---

## 4. 保留与清理

| 配置 | 默认 | 位置 |
|---|---|---|
| `purge_keep_days` | **10 天** | `__init__.py:109` |
| `auto_purge` | `true`，每天本地时间 **04:12** | `core.py:645` |
| `auto_repack` | `true`，**每月第二个周日** purge 后 repack（SQLite VACUUM / PG REINDEX） | `core.py:509` |
| `commit_interval` | **5 秒** | `core.py:636` |
| 磁盘要求 | 至少 **1×** 库大小的空闲空间（rebuild/repack 会全量拷贝）；SQLite 损坏重建需 **2.5×** | recorder 文档 |

**purge 删什么**（`purge.py:55-130`）：`states` → `state_attributes`（无引用后）→ `events` → `event_data` → `statistics_runs` → `statistics_short_term`。
**purge 不删什么**：`statistics`（小时长期表）。这是 HA 数据库只增不减的主因，也是社区抱怨"库只涨不跌"的根源——小时表一年才 876 万行/实体所以能忍。

**何时重算（compile）而不是实时算**：

| 任务 | 触发 | 行为 |
|---|---|---|
| `compile_statistics` | 每 5 分钟（`minute=range(0,60,5), second=10`） | 编译**刚结束**的那个 5 分钟桶；`start.minute==55` 时额外调 `_compile_hourly_statistics` 汇总前一小时 |
| `compile_missing_statistics` | **每次 HA 启动**（`core.py:794`） | 从 `max(now - keep_days, 上次 statistics_runs + 5min)` 回填到当前桶，每 12 小时数据 commit 一次 |
| 幂等性 | 唯一索引 `ix_*_statistic_id_start_ts` | `_get_first_id_stmt` 先查，**已存在就整段跳过**；`filter_unique_constraint_integrity_error` 兜底并发 |

`compile_missing_statistics` 的回填上限是 `keep_days`（10 天）——**关机超过 10 天的时段，统计数据永久丢失**，不会补。这是 HA 已知的设计取舍。

`_compile_hourly_statistics`（`statistics.py:543-607`）的核心：12 个 5 分钟桶里，`mean` = `AVG`（带 `mean_weight` 支持环形）、`min` = `MIN`、`max` = `MAX`，而 **`sum`/`state`/`last_reset` 取 rownum=1 的最后一条**（即 12 点的那个桶）。

---

## 5. 更简单的替代方案？（只有 SQLite，1~5 秒采样，保留 30 天）

基准：20 entity × 5 s/样本 × 30 天。

```
每实体样本数 = 30 × 86400 s ÷ 5 s = 518,400
总样本数     = 518,400 × 20 = 10,368,000 行  (≈ 1037 万)
```

| 方案 | 行数计算 | 总行数 | 估算体积¹ | 实时曲线可行性 |
|---|---|---|---|---|
| **(a) 全量 states，查询时 SQL 聚合** | 10,368,000 | **1037 万** | 0.8 – 1.2 GB | ⚠️ 5 分钟窗口 60 行/实体，走 `(entity_id, ts)` 索引**很快**；但"今日曲线"要吐 17,280 点/实体 = 34.5 万个数（~3 MB JSON），前端画不出。必须查时现算桶 |
| **(b-1) 只存 1 分钟桶** | 43,200 × 20 | **86.4 万** | ~45 MB | ✅ 1440 点/天够画；❌ 拿不到 5 秒原始波形，SSE 实时曲线只能靠内存缓冲 |
| **(b-2) 只存 5 分钟桶** | 8,640 × 20 | **17.3 万** | ~10 MB | ✅ 288 点/天、8640 点/月，柱状图完美；❌ 同上 |
| **(c) 混合：原始 24 h + 5 分钟桶 30 天** | 原始 17,280×20=345,600；桶 8,640×20=172,800 | **51.8 万** | ~30 MB | ✅ 24 h 内任意秒级回放 + 任意时段 5 分钟柱状图 |

¹ 体积按 SQLite ~45–90 B/行（含 1–2 个二级索引的 B-tree 条目）粗估；实际以 `(bucket_ts)` 单列索引 + 无 JSON 列为前提。若另加 1 小时桶长期层：`30×24×20 = 1.44 万行`（可忽略不计）。

**HA 自己的答案就是 (c)**：`states`(原始) + `statistics_short_term`(5 min) + `statistics`(1 h)，只是保留期不同（10 天 vs 永久）。

**推荐 (c)，且和本项目现状几乎零改动**：
- 现有 `samples` 表语义 = 原始层，**已经既供功率曲线按桶取均值、又供电量首尾差**（AGENTS.md 已记录）。只需给它加一条 `DELETE FROM samples WHERE ts < ?` 的定时任务（N=24h），再加一张 5 分钟 rollup 表。
- 对齐 HA 的两点细节：① 功率均值用**时间加权**而非 `AVG()`（占空比场景差别巨大）；② 累计电量在 rollup 里存**累计值 + 增量**两列（`energy_total` + `energy_delta`），查询做差不依赖原始行。
- 不建议 (a)：34.5 万点的"今日曲线"既要 SQL 现算又要序列化，前端还得二次降采样，白白多 1 GB 磁盘和一堆 IO。
- 不建议纯 (b)：丢掉实时波形后，告警联动的"事发前后 10 分钟"就查不到了，而这是本项目的核心功能。

---

## 6. 累计电量表（monotonic meter）的特殊处理

### HA 的对应概念：`state_class`

| state_class | 语义 | sum 计算 |
|---|---|---|
| `measurement` | 瞬时量 | 无 sum，走 mean/min/max |
| `total` | **可回退**的当期累计（读完会归零，如"本月用电"，靠 attribute `last_reset` 声明新周期） | 检测 `last_reset` attribute 变化 → 归零重开周期 |
| `total_increasing` | **只增不减**的累计（电表 kWh） | 差分累加；掉幅 >10% 判定为 meter reset |

### meter reset 检测（`sensor/recorder.py:481-500`）

```python
if 0.9 * previous <= fstate < previous:  warn_dip(...)   # 掉幅 <10%：当浮点噪声，只警告
if fstate < 0:                         warn_negative(...); raise HomeAssistantError  # 丢弃该样本
return fstate < 0.9 * previous         # 掉幅 >10%：判定 reset
```

判定为 reset 时的处理（`recorder.py:795-812`）：

```
_sum    += new_state - old_state   # 先把"回退前那一段"补记进去
new_state = fstate                 # 新周期的起点
old_state = 0.0                    # 新周期从 0 起算
last_reset = <检测到 reset 的时刻>
```

**这个"先补差、再从 0 重开"的两步是关键**——它保证了断电重启不会丢失重启前那一格的电量。对我们：ESP32 断电重启后 RS485 电表若复位（或读到 0），就应该走这条路；同时 `alarms` 里记一条 `meter_reset` 事件。

### 落到本项目

- 累计电量表：`state_class = total_increasing`，读数单位固定 kWh（不要混 Wh）。
- 求差值：跨桶用 `energy_delta`（rollup 时算好的增量）；跨任意时段用 `energy_total(t_end) - energy_total(t_start)`，**并处理跨 reset 的情况**——时段内若有 `last_reset`，答案要分段相加，不能简单相减。
- 边界：时段起点早于第一条记录时，HA 的做法是 `oldest_sum = 0.0`（`statistics.py:1930`），我们应显式返回"数据不足"而不是悄悄算少。
- 断路器通断**不是** `total_increasing`，别套这套 reset 逻辑。

---

## 7. HA 对外暴露的统计查询接口

**重要更正：HA 早已没有 `/api/statistics/period` 和 `/api/statistics/during_period` 这两个 REST 端点。** 在 `core@89f7f5d` 的 `components/api/` 下 grep 不到任何 statistics view，官方 REST API 文档（2026-08 版）也完全没有这两个路径。统计查询**只走 WebSocket**。

### WebSocket（`recorder/websocket_api.py`）

| 命令 | 必填参数 | 可选参数 | 返回 |
|---|---|---|---|
| `recorder/statistic_during_period` | `statistic_id` | `types`: `max\|mean\|min\|change`；`units`；周期三选一：`start_time`+`end_time` / `duration`+`offset` / `calendar` | **扁平 dict**：`{"mean":…,"min":…,"max":…,"change":…}`（单实体时段汇总） |
| `recorder/statistics_during_period` | `start_time`, `statistic_ids`(≥1), `period` | `end_time`; `period` = `5minute\|hour\|day\|week\|month\|year`; `types` ⊆ `change\|last_reset\|max\|mean\|min\|state\|sum`; `units` | **dict of list**：`{"sensor.x":[{start,end,mean,…},…], …}` |
| `recorder/list_statistic_ids` | — | `statistic_type`: `mean\|sum` | `[{statistic_id, has_mean, mean_type, has_sum, name, source, unit_of_measurement, unit_class}]` |
| `recorder/get_statistics_metadata` | `statistic_ids` | — | 同上，元数据字典 |

`types` 不指定则返回全部 7 种。返回的行里 `start`/`end`/`last_reset` 在 WS 层被转成**毫秒整数**。

### REST（仅剩 history）

| 端点 | 参数 | 返回 |
|---|---|---|
| `GET /api/history/period/<datetime>` | `filter_entity_id`（必填，逗号分隔）、`end_time`、`minimal_response`、`no_attributes`、`significant_changes_only` | 原始 state 数组，按 entity 分组 |

### 服务

`recorder.get_statistics`（`services.py:136`）——参数与 `recorder/statistics_during_period` 一致，但返回 ISO 字符串时间，适合 automation。

### 对我们 REST API 形状的启示

1. **拆成两个端点**，直接对应 HA 的两个 WS 命令：单实体时段汇总（"这个房间今天用了多少 kWh" = `change`）与多实体时间序列（"画柱状图"）。
2. **`change` 是一个一等公民**——"今日/本周/本月 kWh"本质上就是 `sum` 的差值，不要让前端自己减。
3. **`period` 参数枚举**（`5minute|hour|day|week|month|year`）直接照抄，服务端负责把小时桶 reduce 成日/周/月：mean 按 `mean_weight` 加权平均，min 取 min，max 取 max，`sum`/`state` 取该周期**最后一个**小时桶的值（`statistics.py:1182-1245`）。这正是我们"本月 kWh 曲线"的实现模板。
4. **时间戳一律 number 秒级**（本项目约定），不要学 HA 用 ISO 字符串；前端 `Date` 转换很容易。

---

## 结论（一页速览）

| 问题 | 答案 |
|---|---|
| HA 存不存原始数据 | 存，`states` 每变化一行，默认留 10 天 |
| 统计怎么产生 | 离线定时聚合，5 分钟桶从 states 算，小时桶从 5 分钟桶算；幂等、可重跑 |
| mean 怎么算 | **时间加权**，不是 `AVG()` |
| sum 是什么 | 累计值本身，差值由查询端 `change` 给出 |
| 长期表会被清吗 | 不会，`statistics` 小时表永不 purge |
| meter reset | 掉幅 >10% 判定 reset，先补差再从 0 重开，记 `last_reset` |
| API 形状 | WS `recorder/statistic_during_period`（单实体汇总）+ `recorder/statistics_during_period`（多实体序列，`period` 枚举）；REST 只剩 `/api/history/period` |
| 我们的选型 | **(c) 混合**：原始 24 h + 5 分钟 rollup 30 天 ≈ 51.8 万行 / ~30 MB；功率用时间加权均值，电量存累计值+增量 |
