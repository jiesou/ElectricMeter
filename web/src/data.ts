import { ref } from "vue";
import { fetchRooms, openRoomStream } from "./api";
import { startMockRooms } from "./mock";
import type { Room, RoomStatus } from "./types";

export const rooms = ref<Room[]>([]);
export const status = ref<RoomStatus>("loading");
export const mock = ref(false);

let stop: (() => void) | undefined;
let gotSnapshot = false;

const setRooms = (next: Room[]) => {
  rooms.value = next;
  gotSnapshot = true;
};

/** 连上当前来源：mock 或真实接口，切换前先断开上一来源 */
export async function connect() {
  stop?.();
  rooms.value = [];
  gotSnapshot = false;

  if (mock.value) {
    status.value = "live";
    stop = startMockRooms(setRooms);
    return;
  }

  // 先取一次完整快照，再挂 SSE，避免旧结果覆盖新快照
  status.value = "loading";
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
}

export function toggleMock() {
  mock.value = !mock.value;
  connect();
}

export function disconnect() {
  stop?.();
}
