<script setup lang="ts">
import { computed } from "vue";
import RoomChart from "../../../web/src/components/RoomChart.vue";
import { circuitVar } from "../../../web/src/color.ts";
import SummaryCard from "./SummaryCard.vue";
import { entityName, fmtEnergy, fmtPower } from "../format";
import { metersOf, readingsIncomplete, switchesOf, type Room } from "../types";

const props = defineProps<{ room: Room }>();
const meters = computed(() => metersOf(props.room));
const switches = computed(() => switchesOf(props.room));
const unknown = computed(() => props.room.entities.filter((e) => e.type !== "meter" && e.type !== "switch" && e.type !== "people-counter"));

const stateText = (state?: boolean) => {
  if (state === undefined) return "未上报";
  const text = state ? "通电" : "断开";
  return props.room.online ? text : `最后状态：${text}`;
};
const stateTone = (state?: boolean) => (state ? "tag--green" : "tag--gray");
</script>

<template>
  <div class="readings">
    <p v-if="!room.online" class="notice">设备离线，以下为最后上报数据</p>

    <div class="summary">
      <SummaryCard
        :label="room.online ? '当前功率' : '最后功率'"
        :value="meters.length ? fmtPower(room.power) : '—'"
        :unit="meters.length ? 'W' : ''"
      />
      <SummaryCard
        :label="room.online ? '累计电量' : '最后累计电量'"
        :value="meters.length ? fmtEnergy(room.energy) : '—'"
        :unit="meters.length ? 'kWh' : ''"
      />
    </div>

    <p v-if="readingsIncomplete(room)" class="notice">部分电表读数未齐，汇总仅含已上报值</p>

    <section v-if="meters.length" class="trend" aria-label="客房近期功率曲线">
      <div class="trend__heading">
        <h2>近期功率</h2>
        <span>最近 10 分钟 · W</span>
      </div>
      <RoomChart :key="room.id" :room="room" compact />
      <ul class="trend__legend" aria-label="电表曲线图例">
        <li v-for="meter in meters" :key="meter.id">
          <i :style="{ background: circuitVar(meter.id, room.entities) }" aria-hidden="true"></i>
          {{ entityName(meter) }}
        </li>
      </ul>
    </section>

    <p v-if="!room.entities.length" class="empty">该客房尚未上报实体</p>

    <template v-else>
      <section class="section">
        <h2>电表读数</h2>
        <p v-if="!meters.length" class="none">暂无电表</p>
        <div class="entities">
          <div v-for="meter in meters" :key="meter.id" class="card entity">
            <p class="name">{{ entityName(meter) }}</p>
            <p class="value num">{{ fmtPower(meter.powerW) }}<span class="unit">W</span></p>
            <p class="energy num">累计电量 {{ fmtEnergy(meter.energyKwh) }}<span class="unit">kWh</span></p>
            <p class="id num">{{ meter.id }}</p>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>开关状态</h2>
        <p v-if="!switches.length" class="none">暂无开关</p>
        <div class="entities">
          <div v-for="item in switches" :key="item.id" class="card entity">
            <p class="name">{{ entityName(item) }}</p>
            <span class="tag" :class="stateTone(item.state)">{{ stateText(item.state) }}</span>
            <p class="id num">{{ item.id }}</p>
          </div>
        </div>
      </section>

      <p v-if="unknown.length" class="notice">
        存在未识别实体：{{ unknown.map(entityName).join("、") }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.notice { margin-bottom: 16px; color: var(--warn); font-size: 13px; }
.summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 18px; }
.summary :deep(.summary-card) { padding: 12px; background: #f0ece3; }
.summary :deep(.value) { font-size: 25px; color: #86561f; }
.summary :deep(.unit) { margin-left: 4px; font-size: 12px; }
.trend { margin-bottom: 20px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; }
.trend__heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.trend h2 { font-size: 14px; font-weight: 600; }
.trend__heading span { color: var(--muted); font-size: 11px; white-space: nowrap; }
.trend :deep(.chart) { height: 140px; }
.trend__legend { display: flex; flex-wrap: wrap; gap: 6px 12px; padding: 0; margin: 10px 0 0; list-style: none; }
.trend__legend li { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 11px; color: var(--muted); overflow-wrap: anywhere; }
.trend__legend i { flex: none; width: 12px; height: 3px; border-radius: 2px; }
.section { margin-bottom: 18px; }
.section h2 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.entities { display: grid; grid-template-columns: minmax(0, 1fr); }
.entity {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 12px 0;
  border: 0;
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  background: transparent;
}
.name { font-size: 13px; font-weight: 600; }
.value { font-size: 24px; font-weight: 600; line-height: 1.2; }
.energy, .none { color: var(--muted); font-size: 13px; }
.unit { margin-left: 6px; font-size: 14px; font-weight: 400; color: var(--muted); }
.id { color: var(--muted); font-size: 11px; overflow-wrap: anywhere; }
</style>
