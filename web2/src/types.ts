import type { Entity } from "@em/shared";

/** 客房快照，对应 GET /api/rooms；一个设备就是一间客房 */
export interface Room {
  id: string;
  name: string;
  online: boolean;
  power: number;
  energy: number;
  entities: Entity[];
}

export const metersOf = (room: Room) => room.entities.filter((e) => e.type === "meter");
export const switchesOf = (room: Room) => room.entities.filter((e) => e.type === "switch");

/** 聚合接口把缺失读数按零计算，有电表但缺读数时要提醒读数未齐 */
export const readingsIncomplete = (room: Room) =>
  metersOf(room).some((e) => e.powerW === undefined || e.energyKwh === undefined);

export type RoomStatus = "loading" | "connecting" | "live" | "broken" | "unavailable";
