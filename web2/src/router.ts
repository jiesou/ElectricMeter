import { createRouter, createWebHashHistory } from "vue-router";
import AgentView from "../../web/src/views/AgentView.vue";
import CameraView from "../../web/src/views/CameraView.vue";
import RoomsView from "../../web/src/views/RoomsView.vue";
import StatsView from "../../web/src/views/StatsView.vue";
import RoomDetailPage from "./pages/RoomDetailPage.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/rooms" },
    { path: "/rooms", component: RoomsView },
    { path: "/rooms/:device_id", component: RoomDetailPage },
    { path: "/stats", component: StatsView },
    { path: "/camera", component: CameraView },
    { path: "/agent", component: AgentView },
    { path: "/twin", component: () => import("./pages/TwinPage.vue"), meta: { bare: true } },
    { path: "/:pathMatch(.*)*", redirect: "/rooms" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
