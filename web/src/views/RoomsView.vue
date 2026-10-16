<script setup lang="ts">
import { computed } from "vue";
import PageHeader from "../components/PageHeader.vue";
import RoomCard from "../components/RoomCard.vue";
import StatusTag from "../components/StatusTag.vue";
import { rooms, search } from "../data.ts";

// 一个实体都没报过的设备不是客房（大屏就是这种：它只替别的房报人数），别画成卡片
const counters = computed(() => rooms.value.filter((r) => r.entities.length));

const shown = computed(() => {
  const key = search.value.trim().toLowerCase();
  if (!key) return counters.value;
  return counters.value.filter(
    (room) =>
      room.name.toLowerCase().includes(key) ||
      room.id.toLowerCase().includes(key),
  );
});
</script>

<template>
  <PageHeader>
    <StatusTag />
  </PageHeader>

  <input
    v-model="search"
    class="search"
    type="search"
    placeholder="搜索房名或设备编号"
  />

  <div class="cards">
    <RoomCard v-for="room in shown" :key="room.id" :room="room" />
  </div>
  <p v-if="!shown.length" class="empty">
    {{ counters.length ? "没有匹配的客房" : "还没有客房接入" }}
  </p>
</template>

<style scoped>
.search {
  display: block;
  width: 100%;
  height: 40px;
  margin-bottom: 16px;
  padding: 0 12px;
  font-family: inherit;
  font-size: 15px;
  color: var(--text);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.search:focus {
  outline: none;
  border-color: var(--primary);
}

.cards {
  display: grid;
  grid-template-columns: 1fr;
  align-items: start;
  gap: 16px;
}

/* 最多两列：房卡内容多，再挤一列就看不下了 */
@media (min-width: 640px) {
  .cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.empty {
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: var(--muted);
}
</style>
