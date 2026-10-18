import { db } from "./db.ts";
import { now } from "./util.ts";

/** 在住的入住区间：device_id → start_ts */
const open = new Map<string, number>();

for (const row of await db.energyUsageTime.findMany({ where: { end_ts: null } }))
  open.set(row.device_id, row.start_ts);

export const occupied = (device_id: string) => open.has(device_id);

/** 这间房最近一次入住：在住就是现在这段，空房就是刚退的那段 */
export const latest = (device_id: string) =>
  db.energyUsageTime.findFirst({
    where: { device_id },
    orderBy: { start_ts: "desc" },
  });

export async function checkin(device_id: string) {
  const start_ts = now();
  await db.energyUsageTime.create({ data: { device_id, start_ts } });
  open.set(device_id, start_ts);
  return start_ts;
}

export async function checkout(device_id: string) {
  const start_ts = open.get(device_id);
  if (start_ts === undefined) return;
  open.delete(device_id);
  await db.energyUsageTime.update({
    where: { device_id_start_ts: { device_id, start_ts } },
    data: { end_ts: now() },
  });
}
