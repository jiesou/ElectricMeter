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

export function streamRooms(on: (rooms: Room[]) => void, onError: () => void) {
  const source = new EventSource(`${base}/rooms/stream`);
  source.onmessage = (e) => on(JSON.parse(e.data) as Room[]);
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
