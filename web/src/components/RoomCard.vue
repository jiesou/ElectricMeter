<script setup lang="ts">
import type { Entity } from "@em/shared";
import { computed, nextTick, ref } from "vue";
import type { Room } from "../api.ts";
import { rename, remove } from "../data.ts";
import { circuitVar } from "../color.ts";
import { energy } from "../format.ts";
import MeterCard from "./MeterCard.vue";
import PeopleCounter from "./PeopleCounter.vue";
import PowerGauge from "./PowerGauge.vue";
import RoomChart from "./RoomChart.vue";
import SwitchCard from "./SwitchCard.vue";

const props = defineProps<{ room: Room }>();

/** 房级总表是服务端算好的全房合计；总闸是全房开关的聚合 */
const hasMeter = computed(() =>
  props.room.entities.some((e) => e.type === "meter"),
);
const switches = computed(() =>
  props.room.entities.filter((e) => e.type === "switch"),
);
// 人数是大屏替这间房报的，跟房里在不在线无关
const counter = computed(() =>
  props.room.entities.find((e) => e.type === "people-counter"),
);

// 闸只画不接：点一下只切本地状态，刷新就回到接口的值
const touched = ref<Record<string, boolean>>({});
const isOn = (e: Entity) => touched.value[e.id] ?? e.state ?? false;
const reported = (e: Entity) => e.state !== undefined || e.id in touched.value;

function toggle(e: Entity) {
  if (props.room.online) touched.value[e.id] = !isOn(e);
}

// 总闸：全房开关全为 on 才是 on，点一下全部切到相反值
const masterOn = computed(
  () => switches.value.length > 0 && switches.value.every(isOn),
);

function toggleMaster() {
  if (!props.room.online || !switches.value.length) return;
  const next = !masterOn.value;
  for (const e of switches.value) touched.value[e.id] = next;
}

const editing = ref(false);
const draft = ref("");
const input = ref<HTMLInputElement | null>(null);

function startEdit() {
  draft.value = props.room.name;
  editing.value = true;
  void nextTick(() => input.value?.select());
}

async function submit() {
  const name = draft.value.trim();
  editing.value = false;
  if (!name || name === props.room.name) return;
  await rename(props.room.id, name).catch(() => {});
}

async function del() {
  if (confirm(`删除客房「${props.room.name}」？`))
    await remove(props.room.id).catch(() => {});
}
</script>

<template>
  <article class="card room" :class="{ offline: !room.online }">
    <div class="head">
      <span class="dot" :class="{ off: !room.online }" />
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="name-edit"
        @keydown.enter="submit"
        @keydown.esc="editing = false"
        @blur="editing = false"
      />
      <h2 v-else class="name" title="点一下改房名" @click="startEdit">
        {{ room.name }}
      </h2>
      <span class="state">{{ room.online ? "在线" : "离线" }}</span>
      <button class="del" aria-label="删除客房" @click="del">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M4.5 7h15M9.5 7V4.8h5V7M6.8 7l.9 12.2h8.6L17.2 7M10.4 10.6v5.6M13.6 10.6v5.6"
          />
        </svg>
      </button>
    </div>

    <div class="master">
      <div v-if="hasMeter" class="master-meter">
        <PowerGauge :power-w="room.power" thin />
        <span class="energy num">累计 {{ energy(room.energy) }}</span>
      </div>
      <!-- 人数是大屏替这间房报的，排在总闸右边 -->
      <button
        class="track"
        :class="{ on: masterOn }"
        :disabled="!room.online || !switches.length"
        aria-label="整房总闸"
        @click="toggleMaster"
      >
        <span class="knob" />
      </button>
      <PeopleCounter v-if="counter" :entity="counter" />
    </div>

    <RoomChart v-if="hasMeter" :room="room" />

    <div v-if="room.entities.length" class="entities">
      <MeterCard
        v-for="e in room.entities.filter((x) => x.type === 'meter')"
        :key="e.id"
        :entity="e"
        :style="{ '--circuit': circuitVar(e.id, room.entities) }"
      />
      <SwitchCard
        v-for="e in switches"
        :key="e.id"
        :entity="e"
        :online="room.online"
        :on="isOn(e)"
        :reported="reported(e)"
        :style="{ '--circuit': circuitVar(e.id, room.entities) }"
        @toggle="toggle(e)"
      />
    </div>
    <p v-else class="empty">这间房还没有实体上报</p>
  </article>
</template>

<style scoped>
.room {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
}

.room.offline {
  opacity: 0.72;
}

.head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.dot {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--green);
}

.dot.off {
  background: var(--muted);
  opacity: 0.5;
}

.name {
  font-size: 20px;
  font-weight: 700;
  overflow-wrap: anywhere;
  cursor: text;
}

.name-edit {
  min-width: 0;
  padding: 2px 8px;
  font-family: inherit;
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  background: var(--gray-soft);
  border: 1px solid var(--primary);
  border-radius: 8px;
}

.state {
  font-size: 14px;
  color: var(--muted);
}

.del {
  display: flex;
  margin-left: auto;
  padding: 4px;
  color: var(--muted);
  background: none;
  border: none;
  border-radius: 8px;
}

.del svg {
  width: 18px;
  height: 18px;
}

.del:hover {
  color: var(--warn);
  background: var(--warn-soft);
}

/* 房级行：左总表、中间总闸、右人数，高 140px，在曲线正上方 */
.master {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 140px;
}

.master-meter {
  width: 120px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.energy {
  font-size: 13px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

/* 竖总闸，比 Entity 的闸大一号 */
.track {
  position: relative;
  flex: 0 0 auto;
  width: 56px;
  height: 88px;
  padding: 0;
  border: none;
  border-radius: 28px;
  background: var(--border);
  transition: background 200ms ease-out;
}

.track .knob {
  position: absolute;
  left: 5px;
  bottom: 5px;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--card);
  box-shadow: var(--shadow);
  transition: transform 200ms ease-out;
}

.track.on {
  /* 跟房级总表一个颜色 */
  background: var(--primary);
}

.track.on .knob {
  transform: translateY(-32px);
}

.entities {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

/* 电表仍是宽度自适应的方格小卡，最小 180px */
.entities :deep(.meter) {
  flex: 1 1 180px;
  min-width: 180px;
}

.empty {
  font-size: 14px;
  color: var(--muted);
}

@media (prefers-reduced-motion: reduce) {
  .track,
  .track .knob {
    transition: none;
  }
}
</style>
