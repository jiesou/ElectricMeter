import { db } from "./db.ts";

export interface Point {
  device_id: string;
  id: string;
  ts: number;
  powerW: number;
  energyKwh?: number; // 服务器侧累计电量，见 core/energy.ts
}

/** 来一批读数就落一批，ts 用设备报的。账本不删：统计要一直拿它做差 */
export async function save(points: Point[]) {
  if (!points.length) return;
  await db.entityHistory.createMany({ data: points });
}
