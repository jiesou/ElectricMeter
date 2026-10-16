<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { connect, disconnect, toggleMock } from "./data.ts";

function onKey(e: KeyboardEvent) {
  if (e.key === "Home") {
    e.preventDefault();
    toggleMock();
  }
}

onMounted(() => {
  connect();
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => {
  disconnect();
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div class="shell">
    <nav class="nav">
      <RouterLink to="/rooms" class="item" active-class="on">
        <svg
          class="icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 10.8 12 3.4l9 7.4" />
          <path d="M5.7 9.6v10.9h12.6V9.6" />
          <path d="M9.9 20.5v-5.3h4.2v5.3" />
        </svg>
        <span>客房管理</span>
      </RouterLink>
      <RouterLink to="/camera" class="item" active-class="on">
        <svg
          class="icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="7.4" width="11.2" height="9.2" rx="2" />
          <path d="M14.2 11.6 21 8.4v7.2l-6.8-3.2z" />
        </svg>
        <span>视频监控</span>
      </RouterLink>
    </nav>

    <main class="main">
      <div class="page"><RouterView /></div>
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
}

.main {
  padding: 20px 16px calc(84px + env(safe-area-inset-bottom));
}

.page {
  max-width: 1440px;
  margin: 0 auto;
}

.nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  height: calc(64px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--card);
  border-top: 1px solid var(--border);
}

.item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 14px;
  color: var(--muted);
  text-decoration: none;
}

.icon {
  width: 22px;
  height: 22px;
}

.item.on {
  color: var(--primary);
  background: var(--primary-soft);
}

@media (min-width: 1024px) {
  .shell {
    display: flex;
  }

  .nav {
    position: sticky;
    top: 0;
    left: auto;
    right: auto;
    bottom: auto;
    flex: 0 0 200px;
    flex-direction: column;
    align-items: stretch;
    height: 100vh;
    padding: 20px 12px;
    gap: 4px;
    border-top: none;
    border-right: 1px solid var(--border);
  }

  .item {
    flex: 0 0 auto;
    flex-direction: row;
    justify-content: flex-start;
    gap: 10px;
    height: 44px;
    padding: 0 10px;
    border-radius: 10px;
    font-size: 15px;
  }

  .main {
    flex: 1;
    min-width: 0;
    padding: 28px 32px 40px;
  }
}
</style>
