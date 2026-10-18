<script setup lang="ts">
import type { ChartData, ChartOptions } from "chart.js";
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
} from "chart.js";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Bar } from "vue-chartjs";
import PageHeader from "../components/PageHeader.vue";
import { cssVar } from "../color.ts";
import { doCheckin, doCheckout, role, stats, stopStats, watchStats } from "../data.ts";
import { date, energy } from "../format.ts";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

/** 颜色一律从主题读，不在这里写死 */
const BORDER = cssVar("--border");
const MUTED = cssVar("--muted");
const PRIMARY = cssVar("--primary");
const GHOST = cssVar("--primary-ghost");

onMounted(watchStats);
onUnmounted(stopStats);

const picked = ref("");
const rooms = computed(() => stats.value?.rooms ?? []);
/** 选中的那间房：没选过就默认第一间在住的 */
const room = computed(
  () =>
    rooms.value.find((r) => r.id === picked.value) ??
    rooms.value.find((r) => r.occupied) ??
    rooms.value[0],
);
const days = computed(() => room.value?.days ?? []);
const hours = computed(() => room.value?.hours ?? []);
const avg = computed(() => stats.value?.avg_hours ?? []);
const bills = computed(() => stats.value?.stays ?? []);
const devices = computed(() =>
  [...(room.value?.devices ?? [])].sort((a, b) => b.kwh - a.kwh),
);
const maxDevice = computed(() =>
  Math.max(...devices.value.map((d) => d.kwh), 0.001),
);
/** 办理入住 / 退房只有管理角色能做 */
const canOperate = computed(() => role.value === "管理");
/** 回路配色跟客房页一致：按实体 id 排序后的序号，不是按用量排的序号 */
const circuitOf = (id: string) => {
  const ids = (room.value?.devices ?? []).map((d) => d.id).sort();
  return `var(--circuit-${(ids.indexOf(id) % 3) + 1})`;
};

const options: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { display: false },
      border: { color: BORDER },
      ticks: { color: MUTED, font: { size: 11 }, autoSkip: true, maxTicksLimit: 12 },
    },
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: BORDER },
      ticks: { color: MUTED, font: { size: 11 } },
    },
  },
};

const dayData = computed<ChartData<"bar">>(() => ({
  labels: days.value.map((d) => date(d.day)),
  datasets: [
    {
      label: "用电",
      data: days.value.map((d) => Number(d.kwh.toFixed(2))),
      backgroundColor: PRIMARY,
      borderRadius: 4,
    },
  ],
}));

const hourData = computed<ChartData<"bar">>(() => ({
  labels: hours.value.map((h) => String(h.hour)),
  datasets: [
    {
      label: "本次入住",
      data: hours.value.map((h) => Number(h.kwh.toFixed(2))),
      backgroundColor: PRIMARY,
      borderRadius: 3,
    },
    {
      label: "历史入住平均",
      data: avg.value.map((h) => Number(h.kwh.toFixed(2))),
      backgroundColor: GHOST,
      borderRadius: 3,
    },
  ],
}));
</script>

<template>
  <PageHeader />

  <p class="today">今天 {{ date(stats?.now) }}</p>

  <section class="card list">
    <div
      v-for="r in rooms"
      :key="r.id"
      class="row"
      :class="{ on: r.id === room?.id }"
      @click="picked = r.id"
    >
      <span class="dot" :class="{ live: r.occupied }" />
      <span class="name">{{ r.name }}</span>
      <span class="state">{{ r.occupied ? `在住 · 第 ${r.days.length} 天` : "空房" }}</span>
      <span class="kwh num">{{ energy(r.kwh) }}</span>
      <span class="per num">
        {{ r.days.length ? `日均 ${energy(r.kwh / r.days.length)}` : "" }}
      </span>
      <button
        class="act"
        :disabled="!canOperate"
        @click.stop="r.occupied ? doCheckout(r.id) : doCheckin(r.id)"
      >
        {{ r.occupied ? "办理退房" : "办理入住" }}
      </button>
    </div>
    <p v-if="!rooms.length" class="empty">还没有客房接入</p>
  </section>

  <section class="detail">
    <div class="card panel">
      <h2>按天用电</h2>
      <div class="chart">
        <Bar v-if="days.length" :data="dayData" :options="options" />
        <p v-else class="empty">这间房还没有入住记录</p>
      </div>
    </div>

    <div class="card panel">
      <h2>24 小时用电区间</h2>
      <div class="chart">
        <Bar v-if="hours.length" :data="hourData" :options="options" />
        <p v-else class="empty">这间房还没有入住记录</p>
      </div>
      <p class="legend">
        <i class="swatch now" />本次入住
        <i class="swatch avg" />历史入住平均
      </p>
    </div>

    <div class="card panel">
      <h2>设备构成</h2>
      <ul class="devices">
        <li v-for="d in devices" :key="d.id">
          <span class="dname">{{ d.name }}</span>
          <span class="bar">
            <i
              :style="{
                width: `${(d.kwh / maxDevice) * 100}%`,
                background: circuitOf(d.id),
              }"
            />
          </span>
          <span class="dval num">{{ energy(d.kwh) }}</span>
        </li>
      </ul>
      <p v-if="!devices.length" class="empty">这间房没有电表</p>
    </div>
  </section>

  <section class="card bills">
    <h2>客户用电情况记录</h2>
    <table>
      <thead>
        <tr>
          <th>房号</th>
          <th>入住</th>
          <th>退房</th>
          <th>天数</th>
          <th>总用电</th>
          <th>日均</th>
          <th>主要设备</th>
          <th>用电水平</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="b in bills" :key="`${b.device_id}-${b.start_ts}`">
          <td>{{ b.room }}</td>
          <td>{{ date(b.start_ts) }}</td>
          <td>{{ date(b.end_ts ?? undefined) }}</td>
          <td class="num">{{ b.days }}</td>
          <td class="num">{{ energy(b.kwh) }}</td>
          <td class="num">{{ energy(b.kwh / b.days) }}</td>
          <td>{{ b.top }}</td>
          <td>超过 {{ b.percent }}% 的客人</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!bills.length" class="empty">还没有入住记录</p>
  </section>
</template>

<style scoped>
.today {
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--muted);
}

.list {
  margin-bottom: 16px;
  padding: 4px 0;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
}

.row.on {
  background: var(--primary-soft);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--muted);
  opacity: 0.5;
}

.dot.live {
  background: var(--green);
  opacity: 1;
}

.name {
  font-size: 16px;
  font-weight: 600;
}

.state {
  font-size: 13px;
  color: var(--muted);
}

.kwh {
  margin-left: auto;
  font-size: 20px;
  font-weight: 700;
}

.per {
  font-size: 13px;
  color: var(--muted);
}

.act {
  height: 30px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--primary);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 999px;
}

.act:disabled {
  color: var(--muted);
  opacity: 0.5;
}

.detail {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

@media (min-width: 1024px) {
  .detail {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.panel {
  padding: 16px;
}

h2 {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
}

.chart {
  height: 160px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 13px;
  color: var(--muted);
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.swatch.now {
  background: var(--primary);
}

.swatch.avg {
  background: var(--primary-ghost);
}

.devices {
  margin: 0;
  padding: 0;
  list-style: none;
}

.devices li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  font-size: 14px;
}

.dname {
  flex: 0 0 88px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
}

.bar {
  flex: 1;
  height: 10px;
  background: var(--gray-soft);
  border-radius: 5px;
}

.bar i {
  display: block;
  height: 100%;
  border-radius: 5px;
}

.dval {
  flex: 0 0 auto;
  font-size: 13px;
}

.bills {
  padding: 16px;
  /* 八列表格在窄屏放不下，让它自己横滚，别把整页撑宽 */
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  padding: 8px 6px;
  text-align: left;
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

td {
  padding: 9px 6px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

tbody tr:last-child td {
  border-bottom: none;
}

.empty {
  padding: 24px 0;
  text-align: center;
  font-size: 14px;
  color: var(--muted);
}
</style>
