<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { rooms, status } from "../data";
import { createScene, type Scene } from "./scene";

const canvas = ref<HTMLCanvasElement>();
let scene: Scene | undefined;

// 数据断了整个画面降饱和，不让它假装还在动
const stale = computed(() => status.value === "broken" || status.value === "unavailable");

onMounted(() => {
  scene = createScene(canvas.value!);
  scene.applyRooms(rooms.value, status.value);
});

watch([rooms, status], () => scene?.applyRooms(rooms.value, status.value));

onUnmounted(() => scene?.dispose());
</script>

<template>
  <canvas ref="canvas" class="twin-canvas" :class="{ stale }"></canvas>
</template>

<style scoped>
.twin-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  transition: filter 0.6s;
}

@media (prefers-reduced-motion: reduce) {
  .twin-canvas {
    transition: none;
  }
}

.stale {
  filter: grayscale(0.85) brightness(0.8);
}
</style>
