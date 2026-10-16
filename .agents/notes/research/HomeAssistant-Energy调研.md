# Home Assistant Energy 模块调研 —— 民宿用电统计页实现指南

> 源码基线（`--depth=1` 实读）：`home-assistant/frontend@0fdbac37`、`home-assistant/core@fb2560ac`，均 2026-10-16。
> 引用 `路径:行号`，路径相对各自仓库根。

## 结论（先看这段）

| 问题 | 结论 |
| --- | --- |
| HA 那套统计基建值得整套抄吗 | **不值得**。它是为「任何人接任何表计、数据会乱、要永久留存」设计的：三张表 + 元数据表 + 单位换算体系 + reset 检测 + 环形均值。我们只有一个受控数据源。 |
| 真正值得抄的 | ① **`sum` 语义**：服务器侧维护单调递增累计，跨表计归零不掉数 ② **`change` = 相邻桶 sum 之差**，用电量永远由差值算，不信任瞬时值 ③ **日边界 = 服务器时区的当地 0 点**（不是 UTC 日） ④ UI 三件套：日期选择器 / 堆叠柱 / 按用量排序的设备图例 ⑤ **「未计量 = 总量 − 已分配设备」** 的兜底口径 |
| 我们的数据模型 | 新增 **2 张表**：`EnergyDaily`（按天分桶的增量累计）+ `Stay`（入住单）。字段见下方「我们的简化数据模型」。 |
| 图表库 | HA 用 **ECharts 6.1.0**（`package.json:102`）。我们已有的 **Chart.js 4.5.1 完全够**（堆叠柱 / 环形 / 折线都原生支持），**不要为了 Sankey 换库**。 |
| 找不到的东西 | HA **没有**「按百分比/排名筛选用户」「阈值高亮」「账期/入住周期」任何概念。它的能源页是只读的家庭仪表盘，控制走别处。我们的「客户用电情况记录表」在 HA 生态里没有对应物，别去找现成组件。 |

---

## 数据模型与统计口径

### 三张表（字段清单）

官方数据文档 `https://data.home-assistant.io/docs/statistics/` 的字段清单**已过时**（还写着 `state_unit_of_measurement` / `has_mean`）。以 `components/recorder/db_schema.py` 为准：

`statistics_meta`（`db_schema.py:758-780`）
`id` / `statistic_id`(unique) / `source` / `unit_of_measurement` / `unit_class` / `has_mean`(废弃) / `has_sum` / `name` / `mean_type`(SmallInt, `StatisticMeanType`: NONE=0/ARITHMETIC=1/CIRCULAR=2，`models/statistics.py:53-58`)

`statistics`（小时长时统计）与 `statistics_short_term`（5 分钟短时统计），**同一套列**（`StatisticsBase`，`db_schema.py:627-646`）：
`id` / `created_ts` / `metadata_id`→meta / `start_ts`(DOUBLE, 索引) / `mean` / `mean_weight` / `min` / `max` / `last_reset_ts` / `state` / `sum`
区别只有 `duration`：`Statistics.duration = 1h`（`db_schema.py:699`）、`StatisticsShortTerm.duration = 5min`（`db_schema.py:717`）。
唯一索引 `(metadata_id, start_ts)`；`statistics_runs` 只记录「哪些 5 分钟窗已编译过」。

**要点：表里没有「天」这一级**。天/周/月/年是**查询时**从小时桶归约出来的（「聚合链路」）。

### `sum` / `state` / `change` 语义与 reset 处理

- `state` = 该桶结束时表计**原始读数**（`sensor/recorder.py:828`）。
- `sum` = 自首次统计以来**服务器侧累计增量，单调不减**：`_sum += new_state - old_state`（`sensor/recorder.py:824`）。
- 归零 / 换表：`total_increasing` 下 `fstate < 0.9 * previous_fstate` 判为新周期（`reset_detected`，`sensor/recorder.py:481-499`，**10% 容差**防抖），随后 `old_state = 0.0`，新周期从 0 起算（`sensor/recorder.py:804-817`）。官方语义表见 `developers.home-assistant.io/docs/core/entity/sensor#state-class-sensorstateclasstotal_increasing`：归零当刻**丢掉「上一读数→归零」那段不可知的量**，这是有意为之。
- 可增可减的表计用 `TOTAL + last_reset` 变化判定周期（`sensor/recorder.py:746-776`）。
- **`change` 才是「这段时间用了多少度」**：后端在查询时按 `本行 sum − 上一行 sum` 生成（`_augment_result_with_change`，`statistics.py:2064-2118`）；前端 `calculateStatisticSumGrowth` 把所有桶的 `change` 求和（`data/recorder.ts:279-300`）。前端只请求 `types: ["change"]`（`data/energy.ts:643-653`）。
- `mean/min/max` 只对 `state_class: measurement`（功率 W 这类）有意义，是**时间加权**均值（`_time_weighted_arithmetic_mean`，`sensor/recorder.py:129-164`，不插值）。映射表 `DEFAULT_STATISTICS`（`sensor/recorder.py:65-74`）：`measurement→{mean,min,max}`+ARITHMETIC，`total`/`total_increasing→{sum}`。
- `unit_class` / `unit_of_measurement` 决定查询时能否把 Wh/kWh/MWh 换算成你要的单位（`_get_statistic_to_display_unit_converter`，`statistics.py:385-411`）；换算在**返回前**做，库里只存原单位。

### 聚合链路：5 分钟 → 小时（关键：**桶是 UTC 整点**）

1. 每 5 分钟触发一次：`async_periodic_statistics` → `statistics.get_start_time()`（`core.py:534-541`），而 `get_start_time()` = `utcnow()` 向下取 5 分钟再减 5 分钟（`statistics.py:496-501`）。**桶边界是墙上时钟 UTC 的 0/5/10… 分**。
2. `_compile_statistics` 断言 `start.tzinfo == UTC`（`statistics.py:760`），平台（`sensor/recorder.py:535`）从 states 历史算出该 5 分钟窗的 `mean/min/max/sum/state`。
3. `start.minute == 55` 时汇总整点：`_compile_hourly_statistics` → `start_time = start.replace(minute=0)`（`statistics.py:555`，调用点 `statistics.py:826-828`）。**小时桶 = [UTC 整点, +1h)**：mean/min/max 用 SQL 聚合 5 分钟行，`sum` 直接取该小时内**最后一个** 5 分钟行的 `sum`（`statistics.py:548-610`）。

### HA 怎么判定「一天」★

- 查询时才切分：`recorder/statistics_during_period` 带 `period="day"` 时，先把 `start_time` 折到**HA 配置时区**（`hass.config.time_zone`，经 `dt_util.as_local`）的**当地 0 点**、`end_time` 折到次日当地 0 点（`_statistics_during_period_with_session`，`statistics.py:2158-2168`）。
- 再把 UTC 整点桶按「桶起点落在哪个当地日」分组：`_reduce_statistics_per_day` / `reduce_day_ts_factory`（`statistics.py:1284-1330`），`_reduce_statistics` 里 sum 取该日**最后一桶**的 sum、mean 取各桶均值（`statistics.py:1230-1281`）。
- 返回边界：日桶 `start` = 当地 0 点的 epoch **秒**，`end` = 次日当地 0 点（`statistics.py:1240-1245`）；WS 层再 ×1000 变毫秒（`recorder/websocket_api.py:238-243`）。前端 `StatisticValue.start/end` 是毫秒（`data/recorder.ts:23-33`）。
- 周 = 当地周一 0 点（`statistics.py:1354-1363`）、月 = 当地 1 日 0 点（`statistics.py:1412-1418`）、年 = 当地 1 月 1 日 0 点（`statistics.py:1459-1467`）。
- **DST 处理**：日结束 = `(start_local + timedelta(days=1)).timestamp()`（`statistics.py:1312`），在本地时区上加一天再取时间戳，所以 23/25 小时的日子能正确闭合；前端另有 DST 修补注释（`common/energy-chart-options.ts:85-90`）。
- **前端必须把用户挑的日期换算到服务器时区再发请求**，否则浏览器时区会整体挪一天：`getStatisticsRange` + `shiftToServerTimeZone`，`data/energy.ts:522-536`。这条是踩过坑后加的（社区帖 [Energy Dashboard Time Zone Inaccuracies](https://community.home-assistant.io/t/energy-dashboard-time-zone-inaccuracies/889075)）。
- **已知硬伤**：小时桶是 UTC 整点，所以**非整小时偏移时区**（UTC+5:30 / +9:30）的当地日界会落在桶中间，日统计固定偏移半小时 —— [core#152109](https://github.com/home-assistant/core/issues/152109)（Closed as **not planned**，stale 后关闭）。**我们只用 UTC+8，全天整小时偏移，不会踩这个坑**，但仍应把「日边界 = 当地 0 点」写进我们自己的代码，别用 UTC 日。

### 数据缺失怎么处理

- **后端**：某桶没数据就没行。`change` 用「本行 sum − 上一**有值**行的 sum」算，`prev_sum` 跨缺失行保留（`statistics.py:2105-2118`）→ 缺的那段电量**并进下一个有数据的桶**，既不丢也不摊平。`sum` 为 null 的行 `change` 也是 null，前端求和时直接跳过（`data/recorder.ts:288-297`）。窗口前那一桶的基准由 `_statistics_at_time` 单独取（`statistics.py:2077-2084`）。
- **表计不可用（unavailable/unknown）**：非数值状态被过滤（`_entity_history_to_float_and_state`，`sensor/recorder.py:226-241`），`new_state` 保持上一次有效值 → 不产生也不丢失增量；只有 `sum` 为 null 时才断流。
- **前端画图**：按周期生成完整桶网格，缺的补 **0 柱**（`generateFillBuckets` + `fillDataGapsAndRoundCaps`，`common/energy-chart-options.ts:464`、`components/chart/round-caps.ts:10-120`）。不插值、不猜。
- **均值类**：时间加权均值只对「有值的时间段」做分母（`sensor/recorder.py:144-164`）—— 即「均值只对在线时段负责」。

### 前端取数命令（WebSocket）

| 命令 | 用途 | 返回 |
| --- | --- | --- |
| `energy/get_prefs` | 拿能源配置（**不是统计**） | `{energy_sources[], device_consumption[], device_consumption_water[]}`（`data/energy.ts:235-239`；后端 `components/energy/websocket_api.py:102-121`） |
| `recorder/statistics_during_period` | 拿统计 | `{statistic_id: [{start,end,change,sum,state,mean,min,max,last_reset}]}`，**start/end 毫秒**（`data/recorder.ts:190-207`；后端 `recorder/websocket_api.py:290-311`） |
| `recorder/get_statistics_metadata` | 拿单位/是否有 sum | `{statistic_id, source, name, has_sum, mean_type, unit_class, statistics_unit_of_measurement}`（`data/recorder.ts:48-56`） |
| `energy/info` | 成本传感器映射、光伏预报域 | `{cost_sensors, solar_forecast_domains}`（`websocket_api.py:148-167`） |
| `energy/validate` | 配置体检 | 见 `validate.py` |

`device_consumption` 条目 schema（`energy/data.py:638-645`）：`stat_consumption`(必) / `stat_rate`(瞬时功率) / `name` / `included_in_stat`。
`included_in_stat` 是**纯前端语义**（后端不校验层级）：指向父设备，子设备的用量从父设备里减掉，避免 Sankey / 明细图重复计算（`energy-devices-detail-graph-data.ts:387-419`）。

---

## 前端 UI 结构

### 页面结构（Energy 面板 = Lovelace 生成式 dashboard，5 个 tab）

`energy-dashboard-strategy.ts:28-128`：按配置**动态决定 tab**，无配置则进 wizard。
tab：`overview`(Summary) / `electricity`(Electricity) / `gas` / `water` / `now`(Now，实时功率)。

`electricity` 视图布局（`energy-view-strategy.ts:31-283`）：左/右 sidebar（大屏）放饼图与仪表，主区 3 列：

| 卡片 | 可视化 | 数据 |
| --- | --- | --- |
| `energy-compare` | 一条 alert 横幅，说明「正在对比哪两段」 | `startCompare/endCompare/compareMode` |
| `energy-distribution` | **手写 SVG 同心圆 + 动画弧**（`energy-distribution-home-circle.ts`），不是图表库 | 各来源流入/流出 |
| `energy-usage-graph` | **堆叠柱状**（grid/solar/battery 各自一色），可叠对比期「幽灵柱」 | `change` |
| `energy-solar-graph` | 折线 + 预报 | `change`/`mean` |
| `energy-sources-table` | **表格**：来源 / 用电 / 成本 / 上一期用电 / 上一期成本 + 合计行 | `change`、成本统计 |
| `energy-devices-detail-graph` | **按设备堆叠柱**，图例按总用量**降序**排列 | `change` |
| `energy-devices-graph` | 横向堆叠条或**环形图**（按钮切换 bar/pie） | `change` |
| `energy-sankey` | **ECharts Sankey**（`ha-sankey-chart.ts`，自研 Sankey 组件） | `change` |
| `energy-grid-balance` | 数字卡 | 导入/导出/净 |
| 4 个 gauge | 环形/指针仪表（`*-gauge-card.ts`） | 自给率、电网中性、低碳比例、光伏自用 |
| `power-sources-graph` / `power-sankey`（Now tab） | 实时功率折线 / Sankey | `mean`（5 分钟） |

`overview` tab 只放 5 块：distribution / sources-table(仅合计) / power-sources-graph / usage-graph / gas / water（`energy-overview-view-strategy.ts:63-163`）。
完整卡片目录与「什么条件下出现」集中在 `energy-cards.ts:123-291`（`isApplicable(prefs)` 谓词），视图策略只调 `isEnergyCardVisible()`，两边不会打架 —— **这个「卡片目录 + 谓词」的写法值得我们照抄**（比在模板里写 `v-if` 好维护）。

### 日期/时间范围选择器

- 位置：**视图 footer 固定条**，不是页面顶部（`energy-view-strategy.ts:38-45`）。
- 组件：`hui-energy-date-selection-card` → `hui-energy-period-selector` → `ha-date-range-picker`（`hui-energy-period-selector.ts:297-310`）。
- 预设（`hui-energy-period-selector.ts:82-93`）：`today / yesterday / this_week / this_month / this_quarter / this_year / now-7d / now-30d / now-365d / now-12m` + 自定义起止。
- 交互：`◀ ▶` 按当前粒度前后平移（`shiftDateRange`）、`Now` 回到当前、`Compare data` 开关、`Download` 导出 CSV；窄屏自动收进 overflow 菜单（`_measure()`，`hui-energy-period-selector.ts:162-165`）；**上次选的预设记在 localStorage**（`_presetSelected`，`:560-565`）。
- **联动方式**：选择器只写一个共享 collection 的 `setPeriod(start, end)` 然后 `refresh()`（`:535-541`），所有卡片订阅同一个 `EnergyCollection` 重算 —— 不是卡片之间互相传参。我们照这个做：一个 `stats` store，页面级时间范围，卡片只读。

### 「设备级拆分」怎么做

1. 用户在配置页把「某个统计实体」加进 `device_consumption` 列表（`stat_consumption` 指向一个累计电量实体，`data/energy.ts:122-128`）。
2. 前端把每个设备当成一条独立序列画进同一个堆叠柱（`energy-devices-detail-graph-data.ts:414-419` 按总量**降序排序**），图例项直接显示该设备本期总量（`:499-512`）。
3. **归到某个总表下**：靠 `included_in_stat` 指父设备，展示时「父 = 父自身 − 子」（`:387-419`）。
4. **兜底「未计量」**：`未计量 = 总用电(电网+光伏+电池) − Σ已分配设备`，为负则拆成单独的「过量上报」序列（`processUntracked`，`energy-devices-detail-graph-data.ts:213-260`）。**这一条是民宿场景最该抄的**：我们只有每房一块总表，设备级靠灯/热水壶/吹风机分项表，必然对不上，兜底序列能让演示数据自洽。
5. 图例点击可隐藏某设备，隐藏状态存 localStorage（`_hiddenStats` + `@storage`，`hui-energy-devices-detail-graph-card.ts:90-96`）。

### 指标口径（有哪些、哪些适合我们）

- 只显示：**本期总量**（图卡标题 `Total {num} kWh`，`translations/en.json` → `energy_usage_graph.total_consumed`）、**分来源/分设备小计**、**成本**、**对比期数值**、CO₂/自给率等仪表。
- **没有日均、没有环比涨跌箭头**。对比（Compare）是**显式开关**：打开后拉第二段区间，画「幽灵柱」+ 一条横幅说明对比的是哪两段（`hui-energy-compare-card.ts:128-181`），横幅上可一键切换「上一期 / 去年同期」（`CompareMode.PREVIOUS / YOY`，`data/energy.ts:516-520`）。
- 适合我们的：本期总量、分设备小计、对比上一期（幽灵柱 + 横幅）、按用量降序图例、未计量兜底。**成本/CO₂/自给率/Sankey 都不需要**（民宿没有电价体系和光伏）。

### 有没有「按百分比/排名筛选」

**没有**。HA 能源页唯一的「排序」是设备明细图的图例按用量降序（`energy-devices-detail-graph-data.ts:417-419`），没有任何阈值/百分位/高亮用户的能力，也没有「用户」这个实体。这块要我们自己设计（见 「阈值口径」）。

---

## 抄 / 不抄清单

| 抄 | 理由 | 我们怎么做 |
| --- | --- | --- |
| `sum` 单调累计 + `change` 差值口径 | 唯一能在表计归零、丢点、离线后仍算对当日用电的办法 | 「累加算法」 的 `EnergyDaily` 累加，`delta < 0 → delta = raw`（等价 HA `total_increasing`） |
| 日边界 = 当地 0 点 | UTC 日会整体错 8 小时 | 用 `day = floor(ts / 86400) * 86400` 但**先按 UTC+8 偏移**；或直接存当地 0 点秒 |
| 缺失桶「不丢也不摊平」 | 缺电就该看得出来，不该被平均掉 | 累加时跳过离线秒；曲线按 0 补点 |
| 「未计量 = 总量 − Σ设备」 | 我们必然对不上账，兜底序列能让页面自洽 | 房间级：`roomTotal - Σentities`，负值单列「过量上报」 |
| 卡片目录 + `isApplicable` 谓词 | 比模板里堆 `v-if` 好维护 | `statsCards` 数组 + 条件函数 |
| 页面级单一时间范围，卡片只订阅 | 天然联动 | 一个 `stats` store（`web/src/data.ts` 风格的注入点） |
| 图例按用量降序 + 显示小计 | 免费的「排行」 | 直接用于设备构成 |
| 对比期用「幽灵柱 + 横幅」 | 比涨跌箭头信息量大且不需要额外口径 | 退房页可对比上次入住 |

| 不抄 | 理由 | 替代 |
| --- | --- | --- |
| `statistics` / `statistics_short_term` / `statistics_meta` 三表 + `mean_type`/`unit_class`/`has_sum` 元数据 | 单数据源、单单位，元数据表是纯负担 | 字段直接落在业务表上 |
| 5 分钟 → 小时的聚合任务、`statistics_runs`、`compile_missing_statistics` 补算 | 我们不需要「任意粒度回查历史」 | 每秒累加进 `EnergyDaily`，一天一行，天然没有聚合任务 |
| reset 检测（0.9 容差、`last_reset`、环形均值、单位换算体系） | 我们的表计只有 kWh 一种单位，且已知会归零 | 一行 `if (delta < 0) delta = raw` |
| Sankey（ECharts Sankey + 自研 `ha-sankey-chart.ts` 380 行） | 我们只有「一间房 → 几个回路」，用堆叠柱/环形足够 | Chart.js `doughnut` + `bar` |
| 手写 SVG 同心圆 distribution 卡（1307 行） | 依赖 grid/solar/battery 多来源模型，我们没有 | 环形图或直接省略 |
| gauge 仪表、成本、CO₂、光伏预报、CSV 导出 | 民宿无电价/无光伏/演示不需要 | 不做 |
| 多 collection key、`EnergyCollection` 订阅缓存、每小时定时刷新 | 我们的 SSE 已经在推 | 直接 `fetch` + SSE |
| 把 `energyKwh` 原始读数直接当「用电量」用 | 归零就出负数/跳变 | 只把它当**输入**，累计值另存 |

---

## 我们的简化数据模型（原型级，秒级时间戳）

现状：`Entity.energyKwh` 是**下位机报来的原始累计值**，`hub.ts` 原样覆盖入库（`server/core/hub.ts:74-104`），没有跨归零累积；`EntityHistory` 只有 10 分钟 `powerW` 窗口（`server/prisma/schema.prisma`）。`energyKwh` 只增不减（`server/simulator/esp32.ts:24`），所以差值口径可用。

### 新增表 `EnergyDaily` —— 按天分桶的增量累计（核心）

```prisma
// 每实体每天一行：服务器侧累加，跨下位机归零不掉数（HA 的 sum 语义 + 按天分桶）
model EnergyDaily {
  device_id String   // 房间
  id        String   // 实体（light-meter / kettle-meter / dryer-meter）
  day       Int      // 当天 00:00 的秒级时间戳（本地 UTC+8）
  energyKwh Float    // 当天累计用电，只增不减
  rawKwh    Float    // 上次见到的下位机原始读数，用来算增量
  entity    Entity   @relation(fields: [device_id, id], references: [device_id, id], onDelete: Cascade)

  @@id([device_id, id, day])
  @@index([day])
  @@index([device_id, day])
}
```

累加（放在 `server/core/energy.ts`，每秒一次，跟 `history.ts` 同一个节奏）：

```ts
const delta = raw - row.rawKwh;
const add = delta < 0 ? raw : delta; // 归零：从 0 起算，丢掉不可知的尾巴（= HA total_increasing）
row.energyKwh += add;
row.rawKwh = raw;
```

- 一张表同时满足「按天看用电量」和「看设备构成」（`group by id`）。
- 不需要 `statistics`/`statistics_short_term` 那套：一天一行，没有聚合任务，没有 purge。
- 不需要单独存 `powerW` 曲线到天级：10 分钟的 `EntityHistory` 已经服务实时曲线。

### 新增表 `Stay` —— 入住单（支撑「本次入住」与记录表）

```prisma
model Stay {
  id         String  @id      // 入住单号
  device_id  String           // 房间
  checkIn    Int              // 入住秒级时间戳
  checkOut   Int?             // 退房秒级时间戳，未退房为 null
  guests     Int?             // 入住人数（没有就退房时取 netCount）
  netCount   Int?             // 退房瞬间的净人数，用来对账
  device     Device  @relation(fields: [device_id], references: [id], onDelete: Cascade)

  @@index([device_id, checkIn])
}
```

「本次入住按天用电」= 一次查询，不用物化：

```sql
select day, sum(energyKwh) as kwh from EnergyDaily
where device_id = ? and day >= 入住当天0点 and day <= 退房当天0点
group by day order by day
```

「设备构成」把 `group by day` 换成 `group by id` 即可。**不要**加 `StayEnergy` 汇总表 —— 入住单量级下这条 GROUP BY 是免费的。

### 「超过 XX% 的高用电用户」怎么定

HA 里没有，我们定两条，取其一（都一行代码）：

- **绝对阈值**（推荐原型用）：`totalKwh / nights > HIGH_KWH_PER_NIGHT`（常量，先给 8 kWh/晚），避免样本少时统计抖动。
- **相对同房历史**：`totalKwh / guests > 1.3 × 该房最近 N 次入住的 kWh/人·晚 中位数`。

记录表列（一屏够用，全部可从上面两张表算出）：

| 房间 | 入住→退房 | 晚数 | 人数 | 总 kWh | kWh/人·晚 | 设备构成（灯/热水壶/吹风机） | 是否超阈值 |
| --- | --- | --- | --- | --- | --- | --- | --- |

`kWh/人·晚` 是关键——它让 3 人房和 1 人房可比，比裸总量公平。

### 「进入下一天」演示按钮

HA 没有这个东西（它只认墙上时钟）。我们的做法：`web/src/mock.ts` 已经有 `DEMO_SPEED = 40` 的加速时钟（`mock.ts:5,105-109`），把「进入下一天」实现成**推进 mock 的当天偏移**（`dayOffset += 1`），统计接口按 `day` 过滤即可；真机模式按真实日历。**不要**在服务器上改系统时间。

---

## 图表库与实现建议

- HA 图表栈：**ECharts 6.1.0**（`package.json:102`，Apache-2.0）包在自研 `ha-chart-base`（2119 行，`components/chart/ha-chart-base.ts`）里；Sankey 另装 `resources/echarts/components/sankey`（`ha-sankey-chart.ts:9`）；`energy-distribution` 是手写 SVG。
- 我们已有 **Chart.js 4.5.1 + vue-chartjs**（`web/package.json`），堆叠柱（`scales: {x:{stacked:true},y:{stacked:true}}`）、环形、折线全都有，**换 ECharts 没有任何收益**，Sankey 也不需要（房间→回路只有两层）。
- 对比期「幽灵柱」用 Chart.js 的 `order` + 半透明 `backgroundColor` 即可。
- 曲线补点：在把 `EnergyDaily` 转成图表数据时按天生成完整数组、缺的填 0 —— 照 `fillDataGapsAndRoundCaps` 的思路，但不需要它那 121 行圆角逻辑。

---

## 证据与可持续性

- 源码：`home-assistant/frontend`（5713 ★ / 3877 fork / 848 contributors / Apache-2.0 / 最近提交 2026-10-16）、`home-assistant/core`（91546 ★ / 5972 contributors / Apache-2.0 / 最近提交 2026-10-16）。由 **Open Home Foundation / Nabu Casa** 全职团队维护，11 年持续活跃 —— 属于「结论可以直接信」的少数项目。
- 官方文档：[Home energy management](https://www.home-assistant.io/docs/energy/)（配置/自定义卡片）、[Long- and short-term statistics](https://data.home-assistant.io/docs/statistics/)（表结构，字段略旧）、[Sensor entity → Long-term statistics](https://developers.home-assistant.io/docs/core/entity/sensor)（`state_class` 与 `sum` 的逐行示例表 —— **这张表是理解 `sum` 的最短路径**）。
- 已知问题（说明「照抄会继承什么坑」）：
  - [core#152109](https://github.com/home-assistant/core/issues/152109) 非整小时时区日界错位 → **Closed as not planned**，不会修；我们用 UTC+8 不受影响。
  - [community: Energy Dashboard Time Zone Inaccuracies](https://community.home-assistant.io/t/energy-dashboard-time-zone-inaccuracies/889075) 浏览器时区影响数值 → 现行代码已用 `shiftToServerTimeZone` 修掉（`data/energy.ts:522-536`）。
  - [frontend#26353](https://github.com/home-assistant/frontend/issues/26353) 「设备明细不扣减下游设备」、[#26844](https://github.com/home-assistant/frontend/issues/26844) 「上游设备未计入」→ 就是 `included_in_stat` 那一套的历史包袱，我们**别引入父子层级**，用「未计量 = 总量 − Σ设备」一条兜底。
  - [frontend#28765](https://github.com/home-assistant/frontend/issues/28765) / [#25806](https://github.com/home-assistant/frontend/issues/25806) 未计量序列为 0、tooltip 四舍五入 —— 提示：**「对不上账」是这类页面的常态，要设计成显式可见而不是藏起来。**
