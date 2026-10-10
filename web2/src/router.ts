import { createRouter, createWebHashHistory } from "vue-router";
import CameraPage from "./pages/CameraPage.vue";
import RoomDetailPage from "./pages/RoomDetailPage.vue";
import RoomsPage from "./pages/RoomsPage.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/rooms" },
    { path: "/rooms", component: RoomsPage },
    { path: "/rooms/:device_id", component: RoomDetailPage },
    { path: "/camera", component: CameraPage },
    // 三维页按需加载，管理页包体里没有 three
    { path: "/twin", component: () => import("./pages/TwinPage.vue"), meta: { bare: true } },
    { path: "/:pathMatch(.*)*", redirect: "/rooms" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
