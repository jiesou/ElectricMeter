<script setup lang="ts">
import { computed } from "vue";
import PageHeader from "../components/PageHeader.vue";
import RoomCard from "../components/RoomCard.vue";
import { rooms, search } from "../data.ts";

// /api/rooms 已经滤掉大屏，拿到的每一台设备就是一间房
const shown = computed(() => {
  const key = search.value.trim().toLowerCase();
  if (!key) return rooms.value;
  return rooms.value.filter(
    (room) =>
      room.name.toLowerCase().includes(key) ||
      room.id.toLowerCase().includes(key),
  );
});
</script>

<template>
  <PageHeader />

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
    {{ rooms.length ? "没有匹配的客房" : "还没有客房接入" }}
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
