import type { Room } from "./types";

export async function fetchRooms(): Promise<Room[]> {
  const res = await fetch("/api/rooms");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** 立即一帧、随后每秒一帧的客房快照；断线重连交给 EventSource */
export function openRoomStream(
  onRooms: (rooms: Room[]) => void,
  onState: (state: "open" | "error") => void,
) {
  const source = new EventSource("/api/rooms/stream");
  source.onmessage = (event) => onRooms(JSON.parse(event.data));
  source.onopen = () => onState("open");
  source.onerror = () => onState("error");
  return () => source.close();
}
