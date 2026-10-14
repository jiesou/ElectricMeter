import { db } from "./db.ts";
import { devices } from "./hub.ts";
import { now } from "./util.ts";

const KEEP = 600; // 只留最近 10 分钟

/** 给内存里的读数拍一张快照落盘，顺手把窗口外的删掉 */
export async function save() {
  const ts = now();
  const rows = [...devices.values()].flatMap((device) =>
    [...device.entities.values()]
      .filter((entity) => entity.type === "meter")
      .map((entity) => ({ device_id: device.id, id: entity.id, ts, powerW: entity.powerW ?? 0 })),
  );
  if (!rows.length) return;
  await db.$transaction([
    db.entityHistory.createMany({ data: rows }),
    db.entityHistory.deleteMany({ where: { ts: { lt: ts - KEEP } } }),
  ]);
}
