<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import NavLinks from "./components/NavLinks.vue";
import { connect, disconnect, toggleMock } from "./data";

// 搜索和筛选放在这里，进出详情页不丢失
const route = useRoute();
const query = ref("");
const filter = ref<"all" | "online" | "offline">("all");

// 任何页面、任何焦点下按 Home 都切换 mock
const onKey = (event: KeyboardEvent) => {
  if (event.key !== "Home") return;
  event.preventDefault();
  toggleMock();
};

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
  <RouterView v-if="route.meta.bare" />
  <div v-else class="layout">
    <aside class="side">
      <p class="brand">民宿用电管理</p>
      <NavLinks variant="side" />
    </aside>

    <main class="main">
      <RouterView
        :query="query"
        :filter="filter"
        @update:query="query = $event"
        @update:filter="filter = $event"
      />
    </main>

    <NavLinks class="bottom" variant="bottom" />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  min-height: 100vh;
}

.main {
  flex: 1;
  min-width: 0;
}

.side {
  display: none;
}

.bottom {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--card);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
}

@media (min-width: 1024px) {
  .side {
    display: block;
    position: sticky;
    top: 0;
    width: 200px;
    flex: none;
    height: 100vh;
    padding: 20px 12px;
    background: var(--card);
    border-right: 1px solid var(--border);
  }

  .bottom {
    display: none;
  }

  .brand {
    font-size: 16px;
    font-weight: 600;
    padding: 0 12px 20px;
  }
}
</style>
