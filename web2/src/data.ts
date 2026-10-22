import { computed } from "vue";
import { rooms, status as connectionStatus } from "../../web/src/data.ts";
import type { RoomStatus } from "./types";

// 管理页与沙盘共用 main 的数据流，全站只建立一条客房 SSE。
export { rooms, mock, connect, disconnect, toggleMock } from "../../web/src/data.ts";
export const status = computed<RoomStatus>(() => {
  if (connectionStatus.value === "已连接") return "live";
  if (connectionStatus.value === "连接中") return rooms.value.length ? "connecting" : "loading";
  return rooms.value.length ? "broken" : "unavailable";
});
