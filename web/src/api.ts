import type { Entity } from "@em/shared";

/** 服务端 /api/rooms 一帧的样子 */
export interface Room {
  id: string;
  name: string;
  online: boolean;
  power: number;
  energy: number;
  entities: Entity[];
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
