import { db } from "./db.ts";

/** 每块电表：上次收到的原始读数 + 服务器侧累计电量 */
const meters = new Map<string, { raw: number; total: number }>();

const key = (device_id: string, id: string) => `${device_id}/${id}`;

/** 样本铺完 / 启动读库时把累计值接到某个已知的点上 */
export function setBaseline(
  device_id: string,
  id: string,
  total: number,
  raw: number,
) {
  meters.set(key(device_id, id), { raw, total });
}

/**
 * 把设备报来的累计电量接成一条只增不减的线。
 * 下位机没有持久存储、读数可能归零，归零时接着往上加，不掉数。
 */
export function accumulate(device_id: string, id: string, raw: number) {
  const last = meters.get(key(device_id, id));
  const total = last
    ? last.total + (raw < last.raw ? raw : raw - last.raw)
    : raw;
  meters.set(key(device_id, id), { raw, total });
  return total;
}

/** 启动时每块电表都从账本最新一行接上，样本历史与实时数据才是一条连续的线 */
export async function loadBaseline(
  list: { device_id: string; id: string; energyKwh?: number }[],
) {
  for (const e of list) {
    const row = await db.entityHistory.findFirst({
      where: { device_id: e.device_id, id: e.id, energyKwh: { not: null } },
      orderBy: { ts: "desc" },
    });
    if (row?.energyKwh != null)
      setBaseline(e.device_id, e.id, row.energyKwh, e.energyKwh ?? 0);
  }
}
