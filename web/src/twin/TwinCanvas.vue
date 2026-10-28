<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { rooms, status } from "../data.ts";
import { createScene, type Scene } from "./scene";

const canvas = ref<HTMLCanvasElement>();
const emit = defineEmits<{ select: [id: string | null] }>();
let scene: Scene | undefined;
defineExpose({
  resetView: () => scene?.resetView(),
  focusRoom: (id?: string) => scene?.focusRoom(id),
});

// 数据断了整个画面降饱和，不让它假装还在动
const live = computed(() => status.value === "已连接");
const stale = computed(() => status.value === "已断开");

onMounted(() => {
  scene = createScene(canvas.value!, (id) => emit("select", id));
  scene.applyRooms(rooms.value, live.value);
});

watch([rooms, live], () => scene?.applyRooms(rooms.value, live.value));

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
