import { createRouter, createWebHistory } from "vue-router";
import CameraView from "./views/CameraView.vue";
import RoomsView from "./views/RoomsView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/rooms" },
    { path: "/rooms", component: RoomsView },
    { path: "/camera", component: CameraView },
  ],
});
