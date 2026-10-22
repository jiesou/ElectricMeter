<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import DataStatus from "../components/DataStatus.vue";
import RoomReadings from "../components/RoomReadings.vue";
import { rooms, status } from "../data";
import TwinCanvas from "../twin/TwinCanvas.vue";
const twinCanvas = ref<InstanceType<typeof TwinCanvas>>();
const selectedId = ref<string | null>(null);
const selectedRoom = computed(() => rooms.value.find((room) => room.id === selectedId.value));
const closeRoom = () => twinCanvas.value?.resetView();
const onKey = (event: KeyboardEvent) => {
  if (event.key === "Escape" && selectedId.value) closeRoom();
};
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));

const totalPower = computed(() => rooms.value.filter((room) => room.online).reduce((sum, room) => sum + room.power, 0));
const onlineCount = computed(() => rooms.value.filter((room) => room.online).length);
const totalEnergy = computed(() => rooms.value.reduce((sum, room) => sum + room.energy, 0));
</script>

<template>
  <div class="twin" :class="{ 'has-selection': selectedRoom }">
    <div class="canvas-area">
      <TwinCanvas ref="twinCanvas" @select="selectedId = $event" />
    </div>
    <header class="corner corner--top">
      <div>
        <p class="eyebrow">DIGITAL TWIN · 01</p>
        <h1 class="title">民宿智能用电管理平台</h1>
      </div>
      <DataStatus :status="status" />
    </header>
    <div class="corner views" role="group" aria-label="沙盘取景">
      <button type="button" @click="closeRoom">沙盘全景</button>
      <button type="button" :disabled="!rooms.length" @click="twinCanvas?.focusRoom()">客房近景</button>
      <select aria-label="选择客房" :value="selectedId ?? ''" :disabled="!rooms.length" @change="twinCanvas?.focusRoom(($event.target as HTMLSelectElement).value)">
        <option value="" disabled>选择客房</option>
        <option v-for="room in rooms" :key="room.id" :value="room.id">{{ room.name || room.id }}</option>
      </select>
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
    <aside v-if="selectedRoom" class="room-panel" aria-labelledby="selected-room-title">
      <header class="room-panel__header">
        <div class="room-panel__heading">
          <p class="room-panel__eyebrow">客房实时读数</p>
          <h2 id="selected-room-title">{{ selectedRoom.name || selectedRoom.id }}</h2>
          <p class="room-panel__id num">{{ selectedRoom.id }}</p>
          <span class="tag" :class="selectedRoom.online ? 'tag--green' : 'tag--gray'">{{ selectedRoom.online ? '在线' : '离线' }}</span>
        </div>
        <button type="button" class="room-panel__close" aria-label="关闭客房读数并返回全景" @click="closeRoom">×</button>
      </header>
      <div class="room-panel__body">
        <RoomReadings :room="selectedRoom" />
      </div>
      <footer class="room-panel__footer">
        <button type="button" @click="closeRoom">返回全景</button>
        <RouterLink :to="{ path: `/rooms/${encodeURIComponent(selectedRoom.id)}` }">查看详情 →</RouterLink>
      </footer>
    </aside>
    <p class="corner hint">点击客房看读数 · 拖拽旋转 · 滚轮缩放</p>
    <RouterLink class="corner corner--bottom back" to="/rooms">← 管理平台</RouterLink>
  </div>
</template>

<style scoped>
.twin {
  position: fixed;
  inset: 0;
  background: #d8d5ce;
}

.canvas-area { position: absolute; inset: 0; }
.has-selection .canvas-area { top: 84px; right: 388px; }
.has-selection .views { right: 408px; }
.has-selection .hint { right: 408px; }
.has-selection .back { right: 408px; }

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

.views button, .views select {
  min-height: 38px;
  padding: 8px 13px;
  border: 1px solid rgb(90 80 64 / 0.22);
  border-radius: 8px;
  background: rgb(250 248 241 / 0.82);
  color: #45463c;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  max-width: 180px;
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

.room-panel {
  --text: #37382f;
  --muted: #666759;
  --border: #ddd7cb;
  --primary: #86561f;
  position: absolute;
  z-index: 2;
  top: 84px;
  right: 24px;
  bottom: 24px;
  width: 352px;
  display: flex;
  flex-direction: column;
  border: 1px solid rgb(90 80 64 / 0.2);
  border-radius: 14px;
  background: #faf8f1;
  box-shadow: 0 12px 40px rgb(64 56 43 / 0.12);
  color: var(--text);
}

.room-panel__header { display: flex; gap: 12px; padding: 20px 20px 14px; border-bottom: 1px solid var(--border); }
.room-panel__heading { flex: 1; min-width: 0; }
.room-panel__eyebrow { color: #86561f; font-size: 11px; letter-spacing: 0.12em; margin-bottom: 6px; }
.room-panel h2 { font-size: 21px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
.room-panel__id { font-size: 12px; color: var(--muted); margin: 6px 0 10px; overflow-wrap: anywhere; }
.room-panel__close { flex: none; width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 8px; background: transparent; font-size: 26px; }
.room-panel__body { flex: 1; min-height: 0; padding: 18px 20px 0; overflow-y: auto; overscroll-behavior: contain; }
.room-panel__footer { display: flex; justify-content: space-between; gap: 12px; padding: 12px 20px; border-top: 1px solid var(--border); }
.room-panel__footer button, .room-panel__footer a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border: 1px solid var(--border); border-radius: 8px; background: transparent; font-size: 14px; }
.room-panel__footer a { background: #86561f; color: #fffaf0; border-color: #86561f; }
.room-panel button:hover { background: #f0ece3; }

@media (max-width: 1100px) and (min-width: 641px) {
  .corner--top { right: 24px; flex-direction: column; align-items: flex-start; gap: 6px; }
  .views, .has-selection .views { top: 104px; left: 24px; right: auto; }
  .views select { max-width: 120px; }
  .room-panel { top: 148px; }
}

@media (max-width: 640px) {
  .corner--top { top: 14px; left: 16px; right: 126px; gap: 6px; flex-direction: column; align-items: flex-start; }
  .title { font-size: 17px; }
  .metrics { left: 16px; bottom: 14px; width: calc(100vw - 32px); }
  .hint { display: none; }
  .corner--bottom { right: 16px; top: 14px; bottom: auto; }
  .views, .has-selection .views { top: 108px; left: 16px; right: 16px; }
  .views select { flex: 1; min-width: 0; max-width: none; }
  .has-selection .canvas-area { top: 154px; right: 0; bottom: min(48%, 420px); }
  .has-selection .metrics { display: none; }
  .has-selection .back { right: 16px; }
  .room-panel { top: auto; left: 16px; right: 16px; bottom: max(14px, env(safe-area-inset-bottom)); width: auto; height: min(46%, 400px); }
  .room-panel__header { padding: 12px 14px; }
  .room-panel__eyebrow { display: none; }
  .room-panel h2 { font-size: 17px; }
  .room-panel__id { display: inline; margin: 0 8px 0 0; font-size: 11px; }
  .room-panel__heading .tag { font-size: 11px; height: 22px; }
  .room-panel__body { padding: 12px 14px 0; }
  .room-panel__footer { padding: 8px 14px; }
}
</style>
