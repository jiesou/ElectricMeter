<script setup lang="ts">
import { computed } from "vue";
import { power } from "../format.ts";

const MAX = 2000; // 满量程，指针到顶
const CX = 50;
const CY = 50;
const R = 37.8; // 弧半径：小卡内容 156px 时约 59px
const START = 135; // 从正下方偏左起，顺时针扫 270°，缺口留在正下方
const SWEEP = 270;
const TICKS = 10;

const props = defineProps<{ powerW?: number; thin?: boolean }>();

const ratio = computed(() =>
  Math.min(1, Math.max(0, (props.powerW ?? 0) / MAX)),
);

function at(angle: number, r: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function arc(from: number, to: number) {
  const a = at(from, R);
  const b = at(to, R);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

const ticks = Array.from({ length: TICKS + 1 }, (_, i) => {
  const angle = START + (SWEEP * i) / TICKS;
  const major = i % 5 === 0;
  const outer = at(angle, 36);
  const inner = at(angle, 36 - (major ? 7 : 4.5));
  return { major, x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y };
});

const needle = computed(() => at(START + SWEEP * ratio.value, 22));
</script>

<template>
  <svg
    class="gauge"
    :class="{ small: thin }"
    viewBox="0 0 100 100"
    role="img"
    :aria-label="`功率 ${power(powerW)}`"
  >
    <path class="track" :d="arc(START, START + SWEEP)" />
    <path
      v-if="ratio > 0.004"
      class="value"
      :d="arc(START, START + SWEEP * ratio)"
    />
    <line
      v-for="(t, i) in ticks"
      :key="i"
      class="tick"
      :class="{ major: t.major }"
      :x1="t.x1"
      :y1="t.y1"
      :x2="t.x2"
      :y2="t.y2"
    />
    <line
      v-if="powerW !== undefined"
      class="needle"
      :x1="CX"
      :y1="CY"
      :x2="needle.x"
      :y2="needle.y"
    />
    <circle class="hub" :cx="CX" :cy="CY" r="3.2" />
    <text
      class="reading"
      :class="{ unreported: powerW === undefined }"
      x="50"
      y="80"
      text-anchor="middle"
    >
      {{ power(powerW) }}
    </text>
  </svg>
</template>

<style scoped>
.gauge {
  display: block;
  width: 100%;
  min-width: 140px;
  height: auto;
}

/* 房级总表这种小尺寸：跟着容器缩，不再撑 140px 兜底 */
.gauge.small {
  min-width: 0;
}

.track {
  fill: none;
  stroke: var(--border);
  stroke-width: 2.5;
  stroke-linecap: round;
}

.value {
  fill: none;
  /* 有回路色就用回路色（实体小卡），房级总表没有就退回主题主色 */
  stroke: var(--circuit, var(--primary));
  stroke-width: 2.5;
  stroke-linecap: round;
}

.tick {
  stroke: var(--muted);
  stroke-width: 1;
  opacity: 0.35;
}

.tick.major {
  stroke-width: 1.4;
  opacity: 0.5;
}

.needle {
  stroke: var(--text);
  stroke-width: 2;
  stroke-linecap: round;
}

.hub {
  fill: var(--text);
}

.reading {
  font-size: 12.5px;
  font-weight: 600;
  fill: var(--text);
  font-variant-numeric: tabular-nums;
}

/* 12px 那张表里字号要缩，读数才不压住刻度 */
.gauge.small .reading {
  font-size: 9px;
}

.reading.unreported {
  font-weight: 400;
  fill: var(--muted);
}
</style>
