import type { Room } from "../api.ts";
export type { Room } from "../api.ts";

export const metersOf = (room: Room) => room.entities.filter((e) => e.type === "meter");
export const switchesOf = (room: Room) => room.entities.filter((e) => e.type === "switch");

/** 聚合接口把缺失读数按零计算，有电表但缺读数时要提醒读数未齐 */
export const readingsIncomplete = (room: Room) =>
  metersOf(room).some((e) => e.powerW === undefined || e.energyKwh === undefined);
