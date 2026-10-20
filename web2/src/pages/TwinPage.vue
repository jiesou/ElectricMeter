<script setup lang="ts">
import { computed } from "vue";
import DataStatus from "../components/DataStatus.vue";
import { rooms, status } from "../data";
import TwinCanvas from "../twin/TwinCanvas.vue";

const totalPower = computed(() => rooms.value.filter((room) => room.online).reduce((sum, room) => sum + room.power, 0));
const onlineCount = computed(() => rooms.value.filter((room) => room.online).length);
const totalEnergy = computed(() => rooms.value.reduce((sum, room) => sum + room.energy, 0));
</script>

<template>
  <div class="twin">
    <TwinCanvas />
    <header class="corner corner--top">
      <div>
        <p class="eyebrow">DIGITAL TWIN · 01</p>
        <h1 class="title">民宿智能用电管理平台</h1>
      </div>
      <DataStatus :status="status" />
    </header>
    <section class="corner metrics" aria-label="实时运行概览">
      <p class="metrics__label">实时运行概览</p>
      <div class="metrics__grid">
        <div>
          <strong>{{ (totalPower / 1000).toFixed(2) }}</strong>
          <span>kW 当前功率</span>
        </div>
        <div>
          <strong>{{ totalEnergy.toFixed(1) }}</strong>
          <span>kWh 累计电量</span>
        </div>
        <div>
          <strong>{{ onlineCount }}<small> / {{ rooms.length }}</small></strong>
          <span>在线客房</span>
        </div>
      </div>
      <div class="legend"><i class="legend__dot legend__dot--power"></i>线路流动表示正在用电 <i class="legend__dot legend__dot--water"></i>庭院水系</div>
    </section>
    <p class="corner hint">拖拽旋转 · 滚轮缩放</p>
    <RouterLink class="corner corner--bottom back" to="/rooms">← 管理平台</RouterLink>
  </div>
</template>

<style scoped>
.twin {
  position: fixed;
  inset: 0;
  background: #101419;
}

/* 四角压一圈暗角，视线收向台面 */
.twin::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / 0.45));
}

.corner {
  position: absolute;
  z-index: 1;
  color: #edeae4;
}

.corner--top {
  top: 20px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  text-shadow: 0 2px 18px rgb(0 0 0 / 0.45);
}

.corner--bottom {
  right: 24px;
  bottom: 20px;
}

.title {
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.eyebrow {
  margin-bottom: 3px;
  color: #a39a8d;
  font-size: 10px;
  letter-spacing: 0.2em;
}

.metrics {
  left: 24px;
  bottom: 22px;
  width: min(440px, calc(100vw - 48px));
  padding: 14px 16px 13px;
  border: 1px solid rgb(231 223 211 / 0.14);
  border-radius: 14px;
  background: rgb(24 28 33 / 0.76);
  backdrop-filter: blur(14px);
  box-shadow: 0 14px 40px rgb(0 0 0 / 0.2);
}

.metrics__label {
  margin-bottom: 10px;
  color: #aaa196;
  font-size: 12px;
  letter-spacing: 0.12em;
}

.metrics__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.metrics strong {
  display: block;
  color: #f4b860;
  font-size: 21px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.metrics strong small {
  color: #9b958d;
  font-size: 12px;
}

.metrics span {
  display: block;
  margin-top: 4px;
  color: #938d84;
  font-size: 11px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: #858078;
  font-size: 10px;
}

.legend__dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-left: 5px;
  border-radius: 50%;
}

.legend__dot--power { background: #fbbf24; box-shadow: 0 0 8px #f59e0b; }
.legend__dot--water { background: #83b8bd; }

.hint {
  right: 24px;
  bottom: 68px;
  color: #817b73;
  font-size: 11px;
  letter-spacing: 0.06em;
}

.back {
  padding: 8px 14px;
  border: 1px solid #2e323a;
  border-radius: 10px;
  background: rgb(30 33 39 / 0.7);
  color: #a29d94;
}

.back:hover {
  color: #edeae4;
}

@media (max-width: 640px) {
  .corner--top { top: 14px; left: 16px; gap: 10px; }
  .title { font-size: 17px; }
  .metrics { left: 16px; bottom: 14px; width: calc(100vw - 32px); }
  .hint { display: none; }
  .corner--bottom { right: 16px; bottom: 14px; }
}
</style>
