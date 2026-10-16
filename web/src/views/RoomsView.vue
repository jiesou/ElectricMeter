<script setup lang="ts">
import { computed } from "vue";
import PageHeader from "../components/PageHeader.vue";
import RoomCard from "../components/RoomCard.vue";
import StatusTag from "../components/StatusTag.vue";
import { rooms, search } from "../data.ts";

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
  grid-template-columns: repeat(auto-fill, minmax(min(420px, 100%), 1fr));
  align-items: start;
  gap: 16px;
}

.empty {
  padding: 40px 0;
  text-align: center;
  font-size: 14px;
  color: var(--muted);
}
</style>
