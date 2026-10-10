import type { Entity } from "@em/shared";

/** 缺失读数显示 —，明确的 0 必须显示出来 */
export const fmtPower = (w?: number) => (w === undefined ? "—" : w.toFixed(1).replace(/\.0$/, ""));
export const fmtEnergy = (kwh?: number) => (kwh === undefined ? "—" : kwh.toFixed(2));

export const entityName = (entity: Entity) => entity.name || entity.id;
