<script setup lang="ts">
import type { Entity } from "@em/shared";
import { energy } from "../format.ts";
import PowerGauge from "./PowerGauge.vue";

defineProps<{ entity: Entity }>();
</script>

<template>
  <div class="entity-card meter">
    <span class="name">{{ entity.name ?? entity.id }}</span>
    <PowerGauge :power-w="entity.powerW" />
    <span class="energy num">累计 {{ energy(entity.energyKwh) }}</span>
  </div>
</template>

<style scoped>
.meter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.name {
  font-size: 14px;
  color: var(--muted);
  text-align: center;
  overflow-wrap: anywhere;
}

.energy {
  font-size: 13px;
  color: var(--muted);
  text-align: center;
}
</style>
