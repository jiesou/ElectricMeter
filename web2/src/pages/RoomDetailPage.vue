<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import PageHeader from "../../../web/src/components/PageHeader.vue";
import RoomCard from "../../../web/src/components/RoomCard.vue";
import { rooms, status } from "../data";

const route = useRoute();
const room = computed(() => rooms.value.find((item) => item.id === route.params.device_id));
</script>

<template>
  <RouterLink class="back" to="/rooms">← 返回客房列表</RouterLink>
  <PageHeader />
  <RoomCard v-if="room" :room="room" />
  <p v-else class="empty">{{ status === "loading" ? "正在加载客房数据" : "未找到该客房" }}</p>
</template>

<style scoped>
.back { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: 12px; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--primary); }
.empty { padding: 40px 0; text-align: center; color: var(--muted); }
</style>
