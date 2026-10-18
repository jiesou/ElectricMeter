<script setup lang="ts">
import { goNextDay } from "../data.ts";
</script>

<template>
  <button class="next" @click="goNextDay()">进入下一天</button>
</template>

<style scoped>
.next {
  height: 28px;
  padding: 0 12px;
  font-size: 13px;
  color: var(--text);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 999px;
}
</style>
