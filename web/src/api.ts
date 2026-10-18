import type { Entity } from "@em/shared";

/** 服务端 /api/rooms 一帧的样子 */
export interface Room {
  id: string;
  name: string;
  online: boolean;
  /** 这间房现在有没有人住：保洁只能动空房的闸 */
  occupied: boolean;
  power: number;
  energy: number;
  entities: Entity[];
}

/** /api/stats 一帧的样子，字段口径见 .agents/notes/decisions/统计与入住记录.md */
export interface Stats {
  now: number;
  rooms: StatsRoom[];
  stays: Bill[];
  avg_hours: { hour: number; kwh: number }[];
}

export interface StatsRoom {
  id: string;
  name: string;
  occupied: boolean;
  start_ts?: number;
  kwh: number;
  days: { day: number; kwh: number }[];
  hours: { hour: number; kwh: number }[];
  devices: { id: string; name: string; kwh: number }[];
}

/** 客户用电情况记录表一行 */
export interface Bill {
  device_id: string;
  room: string;
  start_ts: number;
  end_ts: number | null;
  days: number;
  kwh: number;
  top: string;
  percent: number;
}

/** /api/rooms/:device_id/history 一行 */
export interface HistoryPoint {
  id: string;
  ts: number;
  powerW: number | null;
}

const base = "/api";

async function send(path: string, init?: RequestInit) {
  const res = await fetch(base + path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res;
}

export async function fetchRooms(): Promise<Room[]> {
  return (await send("/rooms")).json();
}

/** /api/rooms/stream 上 `event: points` 推的那批读数 */
export interface Point {
  device_id: string;
  id: string;
  ts: number;
  powerW: number;
}

export function streamRooms(
  on: (rooms: Room[]) => void,
  onPoints: (points: Point[]) => void,
  onError: () => void,
) {
  const source = new EventSource(`${base}/rooms/stream`);
  source.onmessage = (e) => on(JSON.parse(e.data) as Room[]);
  source.addEventListener("points", (e) =>
    onPoints(JSON.parse((e as MessageEvent).data) as Point[]),
  );
  source.onerror = onError;
  return () => source.close();
}

export async function fetchHistory(device_id: string): Promise<HistoryPoint[]> {
  return (await send(`/rooms/${device_id}/history`)).json();
}

export async function renameRoom(
  device_id: string,
  name: string,
): Promise<Room> {
  const res = await send(`/rooms/${device_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteRoom(device_id: string): Promise<void> {
  await send(`/rooms/${device_id}`, { method: "DELETE" });
}

/** 下通断令：返回不代表闸已经动了，新状态走 SSE 回来 */
export async function switchEntity(
  device_id: string,
  id: string,
  state: boolean,
): Promise<void> {
  await send(`/entities/${device_id}/${id}/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
}

export async function fetchStats(): Promise<Stats> {
  return (await send("/stats")).json();
}

export async function checkin(device_id: string): Promise<void> {
  await send(`/rooms/${device_id}/checkin`, { method: "POST" });
}

export async function checkout(device_id: string): Promise<void> {
  await send(`/rooms/${device_id}/checkout`, { method: "POST" });
}

/** 把服务器这台表往前拨一天 */
export async function nextDay(): Promise<void> {
  await send("/clock/next-day", { method: "POST" });
}
