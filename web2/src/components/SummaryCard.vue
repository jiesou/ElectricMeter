<script setup lang="ts">
defineProps<{ label: string; value: string; unit?: string }>();
</script>

<template>
  <div class="card summary-card">
    <p class="label">{{ label }}</p>
    <p class="value num">
      {{ value }}<span v-if="unit" class="unit">{{ unit }}</span>
    </p>
  </div>
</template>

<style scoped>
.label {
  color: var(--muted);
  font-size: 14px;
}

.value {
  margin-top: 4px;
  font-size: 32px;
  font-weight: 600;
  line-height: 1.2;
}

.unit {
  margin-left: 6px;
  font-size: 16px;
  font-weight: 400;
  color: var(--muted);
}
</style>
