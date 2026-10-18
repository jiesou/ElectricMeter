import { ref } from "vue";
import type { Entity } from "@em/shared";
import type { Room, Stats } from "./api.ts";
import {
  checkin as apiCheckin,
  checkout as apiCheckout,
  deleteRoom,
  fetchRooms,
  fetchStats,
  nextDay as apiNextDay,
  renameRoom,
  streamRooms,
  switchEntity,
} from "./api.ts";
import { clearHistory, record } from "./history.ts";
import {
  mockCheckin,
  mockCheckout,
  mockNextDay,
  mockRooms,
  mockStats,
  mockStatsTick,
  mockTick,
} from "./mock.ts";

export const rooms = ref<Room[]>([]);
export const status = ref("连接中");
export const mock = ref(false);
/** 搜索词放最外层持有，进出视频页再回来不丢 */
export const search = ref("");
/** 统计页那份数据：进页面才拉，走开就停 */
export const stats = ref<Stats | null>(null);

export type Role = "访客" | "保洁" | "管理";
/** 右上角切角色，默认访客 */
export const role = ref<Role>("访客");

/** 这个角色能不能动这间房的闸：访客一律不行，保洁只动空房，管理都能动 */
export const canSwitch = (room: Room) =>
  role.value === "管理" || (role.value === "保洁" && !room.occupied);

let stop: (() => void) | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;
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
    stats.value = mockStats();
    apply(mockRooms());
    const timer = setInterval(() => {
      apply(mockTick(rooms.value));
      if (stats.value) mockStatsTick(stats.value);
    }, 1000);
    stop = () => clearInterval(timer);
    return;
  }

  stats.value = null;
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
    (points) => record(rooms.value, points),
    () => {
      status.value = "已断开";
    },
  );
}

export function disconnect() {
  stop?.();
  stop = null;
  stopStats();
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

/** 翻闸：先本地翻一下，设备 ack 回来 SSE 会把实际状态盖上去 */
export async function setSwitch(device_id: string, e: Entity, state: boolean) {
  e.state = state;
  if (!mock.value) await switchEntity(device_id, e.id, state);
}

/** 拉一次统计写进 stats：mock 下数据在内存里，不用发请求；拉不到就保持原样 */
async function pullStats() {
  if (mock.value) return;
  stats.value = await fetchStats().catch(() => stats.value);
}

/** 统计页进来时开始拉，走开就停 */
export function watchStats() {
  stopStats();
  void pullStats();
  statsTimer = setInterval(() => void pullStats(), 2000);
}

export function stopStats() {
  if (statsTimer) clearInterval(statsTimer);
  statsTimer = null;
}

/** 把服务器这台表往前拨一天：所有按时间算的东西跟着前进 */
export async function goNextDay() {
  if (mock.value && stats.value) mockNextDay(stats.value);
  else await apiNextDay();
  await pullStats();
}

export async function doCheckin(device_id: string) {
  const room = rooms.value.find((r) => r.id === device_id);
  if (room) room.occupied = true; // 本地先翻，服务器那份等下面拉回来
  if (mock.value) {
    if (stats.value) mockCheckin(stats.value, device_id);
    return;
  }
  await apiCheckin(device_id);
  await pullStats();
}

export async function doCheckout(device_id: string) {
  const room = rooms.value.find((r) => r.id === device_id);
  if (room) room.occupied = false;
  if (mock.value) {
    if (stats.value) mockCheckout(stats.value, device_id);
    return;
  }
  await apiCheckout(device_id);
  await pullStats();
}
