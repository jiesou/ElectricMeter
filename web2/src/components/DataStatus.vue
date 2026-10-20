<script setup lang="ts">
import { computed } from "vue";
import { mock } from "../data";
import type { RoomStatus } from "../types";

const props = defineProps<{ status: RoomStatus }>();

const text = computed(() => {
  if (mock.value) return "演示数据";
  return {
    loading: "正在加载",
    connecting: "正在连接实时更新",
    live: "数据已连接",
    broken: "更新中断，显示上次数据",
    unavailable: "暂时无法获取客房数据",
  }[props.status];
});

const tone = computed(() => {
  if (mock.value) return "tag--blue";
  if (props.status === "live") return "tag--green";
  if (props.status === "broken" || props.status === "unavailable") return "tag--warn";
  return "tag--gray";
});
</script>

<template>
  <span class="tag" :class="tone">{{ text }}</span>
</template>
