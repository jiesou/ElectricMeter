<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import DataStatus from "../components/DataStatus.vue";
import PageHeader from "../components/PageHeader.vue";
import SummaryCard from "../components/SummaryCard.vue";
import { rooms, status } from "../data";
import { entityName, fmtEnergy, fmtPower } from "../format";
import { metersOf, switchesOf } from "../types";

// App 传下来的搜索与筛选这一页用不到
defineOptions({ inheritAttrs: false });

const route = useRoute();
const room = computed(() => rooms.value.find((item) => item.id === route.params.device_id));

const meters = computed(() => (room.value ? metersOf(room.value) : []));
const switches = computed(() => (room.value ? switchesOf(room.value) : []));
const unknown = computed(() => room.value?.entities.filter((e) => e.type !== "meter" && e.type !== "switch") ?? []);

const stateText = (state?: boolean) => {
  if (state === undefined) return "未上报";
  const text = state ? "通电" : "断开";
  return room.value?.online ? text : `最后状态：${text}`;
};

const stateTone = (state?: boolean) => (state ? "tag--green" : "tag--gray");
</script>

<template>
  <div class="page">
    <RouterLink class="back" to="/rooms">← 返回客房列表</RouterLink>

    <template v-if="room">
      <PageHeader :title="room.name || room.id">
        <span class="tag" :class="room.online ? 'tag--green' : 'tag--gray'">
          {{ room.online ? "在线" : "离线" }}
        </span>
        <span class="device num">{{ room.id }}</span>
        <DataStatus :status="status" />
      </PageHeader>

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
    </template>

    <p v-else-if="status === 'loading'" class="empty">正在加载客房数据</p>

    <p v-else-if="status === 'unavailable'" class="empty">
      暂时无法获取客房数据，正在自动重试
      <RouterLink class="btn inline" to="/rooms">返回客房列表</RouterLink>
    </p>

    <p v-else class="empty">
      未找到该客房
      <RouterLink class="btn inline" to="/rooms">返回客房列表</RouterLink>
    </p>
  </div>
</template>

<style scoped>
.back {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--muted);
}

.back:hover {
  color: var(--primary);
}

.device {
  color: var(--muted);
  font-size: 14px;
}

.notice {
  margin-bottom: 16px;
  color: var(--warn);
  font-size: 14px;
}

.summary {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.section {
  margin-bottom: 24px;
}

.section h2 {
  font-size: 18px;
  margin-bottom: 12px;
}

.entities {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.entity {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.name {
  font-weight: 600;
}

.value {
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
}

.energy {
  color: var(--muted);
  font-size: 14px;
}

.unit {
  margin-left: 6px;
  font-size: 14px;
  font-weight: 400;
  color: var(--muted);
}

.id {
  color: var(--muted);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.none {
  color: var(--muted);
}

.empty {
  margin-bottom: 16px;
}

.inline {
  margin-left: 12px;
}

@media (min-width: 640px) {
  .summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .entities {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .entities {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
