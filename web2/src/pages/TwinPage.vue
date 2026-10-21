<script setup lang="ts">
import { computed, ref } from "vue";
import DataStatus from "../components/DataStatus.vue";
import { rooms, status } from "../data";
import TwinCanvas from "../twin/TwinCanvas.vue";
const twinCanvas = ref<InstanceType<typeof TwinCanvas>>();

const totalPower = computed(() => rooms.value.filter((room) => room.online).reduce((sum, room) => sum + room.power, 0));
const onlineCount = computed(() => rooms.value.filter((room) => room.online).length);
const totalEnergy = computed(() => rooms.value.reduce((sum, room) => sum + room.energy, 0));
</script>

<template>
  <div class="twin">
    <TwinCanvas ref="twinCanvas" />
    <header class="corner corner--top">
      <div>
        <p class="eyebrow">DIGITAL TWIN · 01</p>
        <h1 class="title">民宿智能用电管理平台</h1>
      </div>
      <DataStatus :status="status" />
    </header>
    <div class="corner views" role="group" aria-label="沙盘取景">
      <button type="button" @click="twinCanvas?.resetView()">沙盘全景</button>
      <button type="button" :disabled="!rooms.length" @click="twinCanvas?.focusRoom()">客房近景</button>
    </div>
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
  background: #d8d5ce;
}

/* 轻微收暗边缘，让模型留在画面中心 */
.twin::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 55%, rgb(74 65 51 / 0.08));
}

.corner {
  position: absolute;
  z-index: 1;
  color: #37382f;
}

.corner--top {
  top: 20px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  text-shadow: 0 1px 12px rgb(255 255 255 / 0.4);
}

.corner--bottom {
  right: 24px;
  bottom: 20px;
}

.views {
  top: 24px;
  right: 24px;
  display: flex;
  gap: 6px;
}

.views button {
  min-height: 38px;
  padding: 8px 13px;
  border: 1px solid rgb(90 80 64 / 0.22);
  border-radius: 8px;
  background: rgb(250 248 241 / 0.82);
  color: #45463c;
  cursor: pointer;
}

.views button:hover,
.views button:focus-visible {
  border-color: #986f3d;
  color: #86561f;
}

.views button:disabled {
  opacity: 0.4;
  cursor: default;
}

.title {
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.eyebrow {
  margin-bottom: 3px;
  color: #626354;
  font-size: 10px;
  letter-spacing: 0.2em;
}

.metrics {
  left: 24px;
  bottom: 22px;
  width: min(440px, calc(100vw - 48px));
  padding: 14px 16px 13px;
  border: 1px solid rgb(90 80 64 / 0.16);
  border-radius: 14px;
  background: rgb(250 248 241 / 0.94);
  box-shadow: 0 10px 32px rgb(64 56 43 / 0.08);
}

.metrics__label {
  margin-bottom: 10px;
  color: #626354;
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
  color: #956020;
  font-size: 21px;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.metrics strong small {
  color: #6c6d60;
  font-size: 12px;
}

.metrics span {
  display: block;
  margin-top: 4px;
  color: #666759;
  font-size: 11px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: #666759;
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
.legend__dot--water { background: #467d7a; }

.hint {
  right: 24px;
  bottom: 68px;
  color: #626354;
  font-size: 11px;
  letter-spacing: 0.06em;
}

.back {
  padding: 8px 14px;
  border: 1px solid rgb(90 80 64 / 0.22);
  border-radius: 10px;
  background: rgb(250 248 241 / 0.82);
  color: #55584a;
}

.back:hover {
  color: #37382f;
}

@media (max-width: 640px) {
  .corner--top { top: 14px; left: 16px; right: 126px; gap: 6px; flex-direction: column; align-items: flex-start; }
  .title { font-size: 17px; }
  .metrics { left: 16px; bottom: 14px; width: calc(100vw - 32px); }
  .hint { display: none; }
  .corner--bottom { right: 16px; top: 14px; bottom: auto; }
  .views { top: 108px; right: 16px; }
}
</style>
