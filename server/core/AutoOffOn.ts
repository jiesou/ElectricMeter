import type { Entity } from "@em/shared";
import { devices, sendTo } from "./hub.ts";
import { isRoom, now } from "./util.ts";

/** 人出之后多久断电 */
const LEAVE_MS = 5_000;

/** 空房断电的期限；Infinity 表示这轮已经断过，人再走之前不再干预 */
const deadline = new Map<string, number>();

/** 每间房上一次看到的人数 */
const last = new Map<string, number>();

function switchAll(room: string, entities: Map<string, Entity>, state: boolean) {
  for (const e of entities.values())
    if (e.type === "switch" && e.state !== state)
      sendTo(room, { type: "pub_action_switch", ts: now(), id: e.id, state });
}

export function check(ts = now()) {
  for (const room of devices.values()) {
    if (!isRoom(room.id)) continue;
    const people = [...room.entities.values()].find(
      (e) => e.type === "people-counter",
    );
    if (!people) continue;

    const net = people.netCount ?? 0;
    const prev = last.get(room.id);
    last.set(room.id, net);

    if (net > 0) {
      deadline.delete(room.id);
      if (prev === 0) switchAll(room.id, room.entities, true); // 人进上电
      continue;
    }

    const due = deadline.get(room.id);
    if (due === undefined) deadline.set(room.id, ts + LEAVE_MS);
    else if (ts >= due) {
      switchAll(room.id, room.entities, false); // 人出超时断电
      deadline.set(room.id, Infinity);
    }
  }
}

export function startAutoOffOn() {
  setInterval(() => check(), 1000);
}
