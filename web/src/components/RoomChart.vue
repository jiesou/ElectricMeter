<script setup lang="ts">
import type { ChartData, ChartOptions } from "chart.js";
import {
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { computed, onMounted } from "vue";
import { Line } from "vue-chartjs";
import type { Room } from "../api.ts";
import { mock } from "../data.ts";
import { circuitColor, cssVar } from "../color.ts";
import { loadHistory, series } from "../history.ts";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
);

/** 颜色一律从主题读，不在这里写死 */
const BORDER = cssVar("--border");
const MUTED = cssVar("--muted");
const TEXT = cssVar("--text");
const CARD = cssVar("--card");

const props = defineProps<{ room: Room }>();

onMounted(() => {
  if (!mock.value) void loadHistory(props.room);
});

const chartData = computed<ChartData<"line">>(() => {
  const all = series(props.room.id);
  const labels = [
    ...new Set(all.flatMap((s) => s.points.map((p) => p.ts))),
  ].sort((a, b) => a - b);
  return {
    labels,
    datasets: all.map((s) => {
      const color = circuitColor(s.id, props.room.entities);
      const byTs = new Map(s.points.map((p) => [p.ts, p.powerW]));
      return {
        label: s.name,
        data: labels.map((ts) => byTs.get(ts) ?? null),
        fill: "stack",
        borderColor: color,
        backgroundColor: color + "33",
        borderWidth: 1.5,
        pointRadius: 0,
      };
    }),
  };
});

const count = computed(() => chartData.value.labels?.length ?? 0);

const options: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    tooltip: {
      backgroundColor: CARD,
      borderColor: BORDER,
      borderWidth: 1,
      titleColor: MUTED,
      bodyColor: TEXT,
      footerColor: TEXT,
      padding: 10,
      callbacks: {
        title: (items) => clock(Number(items[0]?.label)),
        label: (item) =>
          `${item.dataset.label} ${Math.round(item.parsed.y ?? 0)} W`,
        footer: (items) =>
          `合计 ${Math.round(items.reduce((sum, i) => sum + (i.parsed.y || 0), 0))} W`,
      },
    },
  },
  scales: {
    x: {
      stacked: true,
      grid: { display: false },
      border: { color: BORDER },
      ticks: {
        color: MUTED,
        font: { size: 11 },
        maxRotation: 0,
        maxTicksLimit: 6,
        callback(value) {
          return clock(Number(this.getLabelForValue(Number(value))));
        },
      },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      grid: { color: BORDER },
      border: { display: false },
      ticks: { color: MUTED, font: { size: 11 }, maxTicksLimit: 4 },
    },
  },
};

/** 时间只在这里出现：数据层一律秒级时间戳 */
function clock(ts: number) {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
</script>

<template>
  <div class="chart">
    <Line v-if="count > 1" :data="chartData" :options="options" />
    <p v-else class="hint">{{ count ? "数据积累中" : "正在加载曲线" }}</p>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  height: 130px;
}

.hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 14px;
  color: var(--muted);
}

@media (min-width: 640px) {
  .chart {
    height: 150px;
  }
}

@media (min-width: 1024px) {
  .chart {
    height: 170px;
  }
}
</style>
