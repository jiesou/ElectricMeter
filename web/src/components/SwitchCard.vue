<script setup lang="ts">
import type { Entity } from "@em/shared";

defineProps<{
  entity: Entity;
  online: boolean;
  on: boolean;
  reported: boolean;
}>();

defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    class="switch"
    :class="{ dim: !reported }"
    :disabled="!online"
    @click="$emit('toggle')"
  >
    <span class="name">{{ entity.name ?? entity.id }}</span>
    <span class="track" :class="{ on }"><span class="knob" /></span>
  </button>
</template>

<style scoped>
.switch {
  width: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.switch.dim {
  opacity: 0.5;
}

.name {
  font-size: 14px;
  color: var(--muted);
  text-align: center;
  overflow-wrap: anywhere;
}

/* 竖闸：圆点在下是断开，圆点走到最上面是通电 */
.track {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 76px;
  border-radius: 24px;
  background: var(--border);
  transition: background 200ms ease-out;
}

.track .knob {
  position: absolute;
  left: 4px;
  bottom: 4px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--card);
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.25);
  transition: transform 200ms ease-out;
}

.track.on {
  background: var(--green);
}

.track.on .knob {
  transform: translateY(-28px);
}

@media (prefers-reduced-motion: reduce) {
  .track,
  .track .knob {
    transition: none;
  }
}
</style>
