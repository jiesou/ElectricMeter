import { createRouter, createWebHistory } from "vue-router";
import CameraView from "./views/CameraView.vue";
import RoomsView from "./views/RoomsView.vue";
import StatsView from "./views/StatsView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/rooms" },
    { path: "/rooms", component: RoomsView },
    { path: "/stats", component: StatsView },
    { path: "/camera", component: CameraView },
  ],
});
