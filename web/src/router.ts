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
    { path: "/:pathMatch(.*)*", redirect: "/rooms" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
