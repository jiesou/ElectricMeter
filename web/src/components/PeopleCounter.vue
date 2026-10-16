<script setup lang="ts">
import type { Entity } from "@em/shared";

defineProps<{ entity: Entity }>();
</script>

<template>
  <div class="people">
    <span class="net-line">
      <b class="net">{{ entity.netCount ?? 0 }}</b>
      <i>净</i>
    </span>
    <span class="io">进 {{ entity.inCount ?? 0 }} · 出 {{ entity.outCount ?? 0 }}</span>
    <!-- 清零先摆着不接：怎么下指令还没定，等 action 那套 -->
    <button class="reset" type="button">清零</button>
  </div>
</template>

<style scoped>
/* 竖着长、横着窄：房卡第二行最右边，别把横向面积吃掉 */
.people {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.net-line {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.net {
  font-size: 34px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}

.net-line i {
  font-size: 13px;
  font-style: normal;
  color: var(--muted);
}

.io {
  font-size: 13px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.reset {
  margin-top: 4px;
  padding: 2px 12px;
  font-family: inherit;
  font-size: 12px;
  color: var(--muted);
  background: var(--gray-soft);
  border: 1px solid var(--border);
  border-radius: 999px;
}

.reset:hover {
  color: var(--text);
  border-color: var(--primary);
}
</style>
