import { db } from "./db.ts";
import { devices } from "./hub.ts";
import * as stays from "./stays.ts";
import { DAY, HOUR, byId, dayStart, hourStart, now } from "./util.ts";

/** 某块电表在某一刻的累计电量：取那一刻之前最近的一行，直接走主键 */
async function valueAt(device_id: string, id: string, ts: number) {
  const row = await db.entityHistory.findFirst({
    where: { device_id, id, ts: { lte: ts }, energyKwh: { not: null } },
    orderBy: { ts: "desc" },
  });
  return row?.energyKwh ?? 0;
}

const metersOf = (device_id: string) =>
  [...(devices.get(device_id)?.entities.values() ?? [])].filter(
    (e) => e.type === "meter",
  );

/** 一段区间用了多少电：每块表两头取值做差，再按表拆开 */
async function usage(device_id: string, from: number, to: number) {
  const per: { id: string; name: string; kwh: number }[] = [];
  for (const m of metersOf(device_id))
    per.push({
      id: m.id,
      name: m.name ?? m.id,
      kwh:
        (await valueAt(device_id, m.id, to)) -
        (await valueAt(device_id, m.id, from)),
    });
  per.sort(byId); // 跟客房页一个序，回路配色才对得上
  return { kwh: per.reduce((sum, x) => sum + x.kwh, 0), per };
}

/** 一次入住：按天、按小时、按设备都从账本现算 */
async function stayUsage(
  device_id: string,
  start_ts: number,
  end_ts: number,
) {
  const to = Math.min(end_ts, now());
  const days: { day: number; kwh: number }[] = [];
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, kwh: 0 }));

  for (let day = dayStart(start_ts); day < to; day += DAY) {
    const from = Math.max(start_ts, day);
    const until = Math.min(to, day + DAY);
    days.push({ day, kwh: (await usage(device_id, from, until)).kwh });
    for (let h = hourStart(from); h < until; h += HOUR) {
      const one = await usage(
        device_id,
        Math.max(from, h),
        Math.min(until, h + HOUR),
      );
      hours[new Date(h).getHours()].kwh += one.kwh;
    }
  }

  const total = await usage(device_id, start_ts, to);
  return { kwh: total.kwh, days, hours, devices: total.per };
}

/** 客户用电情况记录表一行 */
interface Bill {
  device_id: string;
  room: string;
  start_ts: number;
  end_ts: number | null;
  days: number;
  kwh: number;
  top: string;
  percent: number;
}

/** 客户用电情况记录表：一行一次入住，百分位是这张账单超过了多少比例的入住 */
async function bills(): Promise<Bill[]> {
  const rows = await db.energyUsageTime.findMany({
    orderBy: { start_ts: "desc" },
  });
  const list: Bill[] = [];
  for (const row of rows) {
    const end = row.end_ts ?? now();
    const { kwh, per } = await usage(row.device_id, row.start_ts, end);
    const top = [...per].sort((a, b) => b.kwh - a.kwh)[0];
    list.push({
      device_id: row.device_id,
      room: devices.get(row.device_id)?.name ?? row.device_id,
      start_ts: row.start_ts,
      end_ts: row.end_ts,
      days: (dayStart(end) - dayStart(row.start_ts)) / DAY + 1,
      kwh,
      top: top && top.kwh > 0 ? top.name : "—",
      percent: 0,
    });
  }
  const sorted = list.map((b) => b.kwh).sort((a, b) => a - b);
  for (const b of list)
    b.percent = Math.round(
      (sorted.filter((k) => k < b.kwh).length / sorted.length) * 100,
    );
  return list;
}

let cache: { done: number; hours: { hour: number; kwh: number }[] } | null =
  null;

/** 历史入住平均的 24 小时分布，给本次入住当对比的幽灵柱。入住单没变就不重算 */
async function avgHours(list: Bill[]) {
  const done = list.filter((b) => b.end_ts);
  if (cache?.done === done.length) return cache.hours; // 键用未截断的条数

  const used = done.slice(0, 20);
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, kwh: 0 }));
  for (const b of used) {
    const one = await stayUsage(b.device_id, b.start_ts, b.end_ts!);
    for (const h of one.hours) hours[h.hour].kwh += h.kwh;
  }
  if (used.length) for (const h of hours) h.kwh /= used.length;

  cache = { done: done.length, hours };
  return hours;
}

export async function report() {
  const rooms = [];
  for (const [id, device] of devices) {
    if (!metersOf(id).length) continue; // 没有电表的设备不是客房（大屏就是这样）
    const base = { id, name: device.name, occupied: stays.occupied(id) };
    const stay = await stays.latest(id);
    if (!stay) {
      rooms.push({ ...base, kwh: 0, days: [], hours: [], devices: [] });
      continue;
    }
    const detail = await stayUsage(id, stay.start_ts, stay.end_ts ?? now());
    rooms.push({ ...base, start_ts: stay.start_ts, ...detail });
  }

  const list = await bills();
  return { now: now(), rooms, stays: list, avg_hours: await avgHours(list) };
}
