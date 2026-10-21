<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import PageHeader from "../components/PageHeader.vue";

const img = ref<HTMLImageElement | null>(null);
let running = true;
let url = "";

/** 要一帧画一帧：上一次请求回来了才要下一次，网络慢了自然就慢，不会攒延迟 */
async function loop() {
  let seq = "";
  while (running) {
    try {
      const res = await fetch("/api/cv/frame");
      if (res.status === 200) {
        const next = res.headers.get("X-Seq") ?? "";
        if (next !== seq) {
          seq = next;
          const blob = await res.blob();
          const old = url;
          url = URL.createObjectURL(blob);
          if (img.value) img.value.src = url;
          if (old) URL.revokeObjectURL(old);
        }
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500)); // 断一下接着要
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

onMounted(loop);
onUnmounted(() => {
  running = false;
  if (url) URL.revokeObjectURL(url);
});
</script>

<template>
  <PageHeader />

  <div class="card frame">
    <img ref="img" alt="实时画面" />
  </div>
</template>

<style scoped>
.frame {
  padding: 12px;
}

img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: contain;
  background: var(--gray-soft);
  border-radius: 8px;
}
</style>
