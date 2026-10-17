import { db } from "./db.ts";

const KEEP = 600_000; // 只留最近 10 分钟

export interface Point {
  device_id: string;
  id: string;
  ts: number;
  powerW: number;
}

/** 来一条读数就落一行，ts 用设备报的；顺手把窗口外的删掉 */
export async function save(points: Point[]) {
  if (!points.length) return;
  await db.$transaction([
    db.entityHistory.createMany({ data: points }),
    db.entityHistory.deleteMany({
      where: { ts: { lt: Date.now() - KEEP } },
    }),
  ]);
}
