import { ref } from "vue";
import type { Room } from "./api.ts";
import { deleteRoom, fetchRooms, renameRoom, streamRooms } from "./api.ts";
import { clearHistory, record } from "./history.ts";
import { mockRooms, mockTick } from "./mock.ts";

export const rooms = ref<Room[]>([]);
export const status = ref("连接中");
export const mock = ref(false);
/** 搜索词放最外层持有，进出视频页再回来不丢 */
export const search = ref("");

let stop: (() => void) | null = null;
let generation = 0;

function apply(next: Room[]) {
  rooms.value = next;
  record(next);
}

/** 按 mock 选来源，两者写的是同一份 rooms */
export function connect() {
  stop?.();
  stop = null;
  const gen = ++generation; // 换来源时，上一路还在飞的请求作废
  rooms.value = [];
  clearHistory();

  if (mock.value) {
    status.value = "已连接";
    apply(mockRooms());
    const timer = setInterval(() => apply(mockTick(rooms.value)), 1000);
    stop = () => clearInterval(timer);
    return;
  }

  status.value = "连接中";
  void fetchRooms().then(
    (snapshot) => {
      if (gen === generation) apply(snapshot);
    },
    () => {
      if (gen === generation) status.value = "已断开";
    },
  );
  stop = streamRooms(
    (snapshot) => {
      status.value = "已连接";
      apply(snapshot);
    },
    () => {
      status.value = "已断开";
    },
  );
}

export function disconnect() {
  stop?.();
  stop = null;
}

export function toggleMock() {
  mock.value = !mock.value;
  connect();
}

export async function rename(id: string, name: string) {
  const room = rooms.value.find((r) => r.id === id);
  if (!room) return;
  if (!mock.value) await renameRoom(id, name);
  room.name = name;
}

export async function remove(id: string) {
  if (!mock.value) await deleteRoom(id);
  rooms.value = rooms.value.filter((r) => r.id !== id);
}
