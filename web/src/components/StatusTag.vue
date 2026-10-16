<script setup lang="ts">
import { computed } from "vue";
import { status } from "../data.ts";

const TONES: Record<string, string> = {
  已连接: "ok",
  已断开: "warn",
  连接中: "idle",
};
const tone = computed(() => TONES[status.value] ?? "idle");
</script>

<template>
  <span class="tag" :class="tone">{{ status }}</span>
</template>

<style scoped>
.tag {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  background: var(--gray-soft);
  color: var(--muted);
}

.tag.ok {
  background: var(--green-soft);
  color: var(--green);
}

.tag.warn {
  background: var(--warn-soft);
  color: var(--warn);
}
</style>
