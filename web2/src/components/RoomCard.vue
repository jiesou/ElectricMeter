<script setup lang="ts">
import { computed } from "vue";
import { fmtEnergy, fmtPower } from "../format";
import { metersOf, readingsIncomplete, switchesOf, type Room } from "../types";

const props = defineProps<{ room: Room }>();

const meters = computed(() => metersOf(props.room));
const switches = computed(() => switchesOf(props.room));
</script>

<template>
  <RouterLink class="card room" :to="`/rooms/${encodeURIComponent(room.id)}`">
    <div class="row">
      <h3 class="name">{{ room.name || room.id }}</h3>
      <span class="tag" :class="room.online ? 'tag--green' : 'tag--gray'">
        {{ room.online ? "在线" : "离线" }}
      </span>
    </div>

    <p class="label">{{ room.online ? "当前功率" : "最后功率" }}</p>
    <p class="value num">
      {{ meters.length ? fmtPower(room.power) : "—" }}<span class="unit">W</span>
      <span v-if="meters.length && readingsIncomplete(room)" class="tag tag--warn warn">读数未齐</span>
    </p>

    <p class="label">{{ room.online ? "累计电量" : "最后累计电量" }}</p>
    <p class="energy num">
      {{ meters.length ? fmtEnergy(room.energy) : "—" }}<span class="unit">kWh</span>
    </p>

    <p v-if="!meters.length" class="none">未上报电表</p>

    <div class="row foot">
      <span class="meta">电表 {{ meters.length }} · 开关 {{ switches.length }}</span>
      <span class="arrow" aria-hidden="true">→</span>
    </div>
  </RouterLink>
</template>

<style scoped>
.room {
  display: block;
  min-height: 200px;
  transition: border-color 0.15s;
}

.room:hover {
  border-color: var(--primary);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.name {
  font-size: 18px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.label {
  margin-top: 12px;
  color: var(--muted);
  font-size: 14px;
}

.value {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
}

.energy {
  font-size: 16px;
}

.unit {
  margin-left: 6px;
  font-size: 16px;
  font-weight: 400;
  color: var(--muted);
}

.warn {
  margin-left: 12px;
  vertical-align: middle;
}

.none {
  margin-top: 8px;
  color: var(--muted);
  font-size: 14px;
}

.foot {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 14px;
}

.arrow {
  color: var(--primary);
}
</style>
