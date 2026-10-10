<script setup lang="ts">
import DataStatus from "../components/DataStatus.vue";
import { status } from "../data";
import TwinCanvas from "../twin/TwinCanvas.vue";
</script>

<template>
  <div class="twin">
    <TwinCanvas />
    <header class="corner corner--top">
      <h1 class="title">民宿智能用电管理平台</h1>
      <DataStatus :status="status" />
    </header>
    <RouterLink class="corner corner--bottom back" to="/rooms">← 管理平台</RouterLink>
  </div>
</template>

<style scoped>
.twin {
  position: fixed;
  inset: 0;
  background: #14161a;
}

/* 四角压一圈暗角，视线收向台面 */
.twin::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 55%, rgb(0 0 0 / 0.45));
}

.corner {
  position: absolute;
  z-index: 1;
  color: #edeae4;
}

.corner--top {
  top: 20px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.corner--bottom {
  right: 24px;
  bottom: 20px;
}

.title {
  font-family: "Noto Serif SC", "Songti SC", serif;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.back {
  padding: 8px 14px;
  border: 1px solid #2e323a;
  border-radius: 10px;
  background: rgb(30 33 39 / 0.7);
  color: #a29d94;
}

.back:hover {
  color: #edeae4;
}
</style>
