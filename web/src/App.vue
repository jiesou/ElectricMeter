<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { fetchRooms, openRoomStream } from "./api";
import NavLinks from "./components/NavLinks.vue";
import { startMockRooms } from "./mock";
import type { Room, RoomStatus } from "./types";

const demo = import.meta.env.VITE_DEMO === "1";

const rooms = ref<Room[]>([]);
const status = ref<RoomStatus>("loading");
// 搜索和筛选放在这里，进出详情页不丢失
const query = ref("");
const filter = ref<"all" | "online" | "offline">("all");

let stop: (() => void) | undefined;
let gotSnapshot = false;

const setRooms = (next: Room[]) => {
  rooms.value = next;
  gotSnapshot = true;
};

onMounted(async () => {
  if (demo) {
    status.value = "live";
    stop = startMockRooms(setRooms);
    return;
  }

  // 先取一次完整快照，再挂 SSE，避免旧结果覆盖新快照
  try {
    setRooms(await fetchRooms());
    status.value = "connecting";
  } catch {
    status.value = "unavailable";
  }

  stop = openRoomStream(setRooms, (state) => {
    if (state === "open") status.value = "live";
    else status.value = gotSnapshot ? "broken" : "unavailable";
  });
});

onUnmounted(() => stop?.());
</script>

<template>
  <div class="layout">
    <aside class="side">
      <p class="brand">民宿用电管理</p>
      <NavLinks variant="side" />
    </aside>

    <main class="main">
      <RouterView
        :rooms="rooms"
        :status="status"
        :demo="demo"
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
