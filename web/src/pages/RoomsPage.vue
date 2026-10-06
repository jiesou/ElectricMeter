<script setup lang="ts">
import { computed } from "vue";
import DataStatus from "../components/DataStatus.vue";
import PageHeader from "../components/PageHeader.vue";
import RoomCard from "../components/RoomCard.vue";
import SummaryCard from "../components/SummaryCard.vue";
import { fmtPower } from "../format";
import { readingsIncomplete, type Room, type RoomStatus } from "../types";

const props = defineProps<{
  rooms: Room[];
  status: RoomStatus;
  demo: boolean;
  query: string;
  filter: "all" | "online" | "offline";
}>();

const emit = defineEmits<{
  "update:query": [value: string];
  "update:filter": [value: "all" | "online" | "offline"];
}>();

const filters = [
  { value: "all", label: "全部" },
  { value: "online", label: "在线" },
  { value: "offline", label: "离线" },
] as const;

// 按 id 自然顺序，读数更新不重排
const sorted = computed(() =>
  [...props.rooms].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
);

const matched = computed(() => {
  const text = props.query.trim().toLowerCase();
  return sorted.value.filter((room) => {
    const hitName = !text || room.name.toLowerCase().includes(text) || room.id.toLowerCase().includes(text);
    const hitState = props.filter === "all" || (props.filter === "online") === room.online;
    return hitName && hitState;
  });
});

// 汇总始终统计全部客房，不随搜索筛选变化
const onlineRooms = computed(() => props.rooms.filter((room) => room.online));
const totalPower = computed(() => onlineRooms.value.reduce((sum, room) => sum + room.power, 0));
const incomplete = computed(() => props.rooms.some(readingsIncomplete));

const clearFilters = () => {
  emit("update:query", "");
  emit("update:filter", "all");
};
</script>

<template>
  <div class="page">
    <PageHeader title="客房用电" subtitle="查看各客房当前用电与设备状态">
      <DataStatus :status="status" :demo="demo" />
    </PageHeader>

    <div class="summary">
      <SummaryCard label="客房数" :value="String(rooms.length)" unit="间" />
      <SummaryCard label="在线设备" :value="String(onlineRooms.length)" unit="台" />
      <SummaryCard
        label="在线客房总功率"
        :value="onlineRooms.length ? fmtPower(totalPower) : '—'"
        :unit="onlineRooms.length ? 'W' : ''"
      />
    </div>
    <p v-if="incomplete" class="notice">部分电表读数未齐，功率与电量可能偏低</p>

    <div class="toolbar">
      <input
        class="search"
        type="search"
        placeholder="搜索客房名称或设备 ID"
        aria-label="搜索客房"
        :value="query"
        @input="emit('update:query', ($event.target as HTMLInputElement).value)"
      />
      <div class="filters" role="group" aria-label="按设备状态筛选">
        <button
          v-for="item in filters"
          :key="item.value"
          class="filter"
          :class="{ 'filter--on': filter === item.value }"
          :aria-pressed="filter === item.value"
          @click="emit('update:filter', item.value)"
        >
          {{ item.label }}
        </button>
      </div>
      <p class="count">{{ matched.length }} 间</p>
    </div>

    <div v-if="status === 'loading'" class="grid">
      <div v-for="n in 6" :key="n" class="skeleton room-skeleton"></div>
    </div>

    <p v-else-if="status === 'unavailable'" class="empty">暂时无法获取客房数据，正在自动重试</p>
    <p v-else-if="!rooms.length" class="empty">暂无客房，等待设备接入</p>
    <p v-else-if="!matched.length" class="empty">
      没有匹配的客房
      <button class="btn clear" @click="clearFilters">清空筛选</button>
    </p>

    <div v-else class="grid">
      <RoomCard v-for="room in matched" :key="room.id" :room="room" />
    </div>
  </div>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.summary > :last-child {
  grid-column: span 2;
}

.notice {
  margin-top: 12px;
  color: var(--warn);
  font-size: 14px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 24px 0 16px;
}

/* 手机：搜索独占一行，筛选和数量在下一行 */
.search {
  flex: 1 0 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  font: inherit;
}

.filters {
  display: flex;
  gap: 8px;
}

.filter {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
}

.filter--on {
  color: var(--primary);
  background: var(--primary-soft);
  border-color: var(--primary);
}

.count {
  color: var(--muted);
  font-size: 14px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.room-skeleton {
  height: 200px;
}

.clear {
  margin-left: 12px;
}

@media (min-width: 640px) {
  .search {
    flex: 1 1 240px;
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 平板宽度放三张汇总卡会把标题挤换行，到桌面宽度再排三列 */
@media (min-width: 1024px) {
  .summary {
    grid-template-columns: repeat(3, 1fr);
  }

  .summary > :last-child {
    grid-column: auto;
  }
}

@media (min-width: 1280px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1800px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
