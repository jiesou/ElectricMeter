<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <header class="header">
    <div class="titles">
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
    </div>
    <div class="right">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

h1 {
  font-size: 24px;
  line-height: 1.3;
}

.subtitle {
  margin-top: 4px;
  color: var(--muted);
  font-size: 14px;
}

.right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

@media (min-width: 640px) {
  h1 {
    font-size: 28px;
  }
}
</style>
