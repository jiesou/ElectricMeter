<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import PageHeader from "../components/PageHeader.vue";

// App 传下来的搜索与筛选这一页用不到
defineOptions({ inheritAttrs: false });

const src = ref("/api/cv/stream");
const state = ref<"connecting" | "ready" | "failed">("connecting");
const stage = ref<HTMLElement | null>(null);
const image = ref<HTMLImageElement | null>(null);

const canFullscreen = document.fullscreenEnabled;

// 换一次地址就是重建当前图像请求，旧请求随之中断
const reload = () => {
  state.value = "connecting";
  src.value = `/api/cv/stream?t=${Date.now()}`;
};

const fullscreen = () => stage.value?.requestFullscreen();

// 离开页面时移除图像并断开流，不能等浏览器自己回收
// 放在 beforeUnmount：unmounted 时模板引用已经清空
onBeforeUnmount(() => {
  if (image.value) image.value.src = "";
});
</script>

<template>
  <div class="page">
    <PageHeader title="视频监控" subtitle="查看人体检测与跨线判定画面" />

    <div class="camera">
      <div class="stage-col">
        <div ref="stage" class="viewport">
          <img ref="image" :src="src" alt="摄像头画面" @load="state = 'ready'" @error="state = 'failed'" />
          <p v-if="state === 'connecting'" class="overlay">正在连接画面</p>
          <p v-else-if="state === 'failed'" class="overlay">画面加载失败</p>
        </div>

        <div class="actions">
          <button class="btn" @click="reload">重新加载</button>
          <button v-if="canFullscreen" class="btn" @click="fullscreen">全屏查看</button>
        </div>
      </div>

      <aside class="card note">
        <h2>画面说明</h2>
        <p><i class="dot dot--green"></i>绿色框：检测到的人体</p>
        <p><i class="dot dot--yellow"></i>判定线：进出方向判定参考</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.stage-col {
  display: grid;
  gap: 12px;
}

.viewport {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: var(--radius);
  overflow: hidden;
}

.viewport:fullscreen {
  aspect-ratio: auto;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
}

img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 14px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.note {
  display: grid;
  gap: 12px;
  align-content: start;
}

.note h2 {
  font-size: 18px;
}

.note p {
  color: var(--muted);
  font-size: 14px;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 8px;
  border-radius: 50%;
}

.dot--green {
  background: #22c55e;
}

.dot--yellow {
  background: #facc15;
}

@media (min-width: 1024px) {
  .camera {
    display: grid;
    grid-template-columns: 3fr 1fr;
    gap: 16px;
    align-items: start;
  }
}
</style>
