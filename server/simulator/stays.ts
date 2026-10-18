import { db } from "../core/db.ts";
import { setBaseline } from "../core/energy.ts";
import { devices } from "../core/hub.ts";
import { DAY, dayStart, now } from "../core/util.ts";

/** 演示历史铺多久 */
const SEED_DAYS = 30;
/** 样本采样间隔：真实是报文频率，样本一分钟一行就够 —— 账本存的是累计电量，做差不看密度 */
const STEP = 60_000;

/** 一块表的底子功率，跟模拟器那三路电器对得上；认不出来的按 200W 算 */
const BASE: Record<string, number> = {
  "light-meter": 55,
  "kettle-meter": 1200,
  "dryer-meter": 700,
};

/** 作息：晚上多、白天少 */
const shape = (hour: number) =>
  hour >= 18 && hour <= 23 ? 1.6 : hour >= 6 && hour <= 9 ? 1.2 : 0.5;

/** 一个采样点用掉多少电：功率 × 时长（毫秒）÷ 3.6e9 就是 kWh */
const sampleKwh = (powerW: number) => (powerW * STEP) / 3.6e9;

const seeded = new Set<string>();

/** 哪间房的账本还是空的，就给它把过去铺出来；铺过就不再铺 */
export async function seedMissing() {
  for (const [device_id, device] of devices) {
    if (seeded.has(device_id)) continue;
    const meters = [...device.entities.values()].filter(
      (e) => e.type === "meter",
    );
    if (!meters.length) continue; // 实体还没申报，等下一轮
    seeded.add(device_id);
    // 这间房还没有入住记录才铺：真机连上就在写账本，不能拿账本空不空当判据
    if (await db.energyUsageTime.count({ where: { device_id } })) continue;

    const total = new Map(meters.map((m) => [m.id, 0]));
    const rows: {
      device_id: string;
      id: string;
      ts: number;
      powerW: null;
      energyKwh: number;
    }[] = [];
    const stays: { device_id: string; start_ts: number; end_ts: number }[] = [];

    // 过去 SEED_DAYS 天，每天一次入住，就在那天下午到深夜之间
    for (let d = SEED_DAYS; d > 0; d--) {
      const day = dayStart(now()) - d * DAY;
      const start_ts = day + (14 + Math.random() * 6) * 3_600_000;
      const end_ts = start_ts + (2 + Math.random() * 8) * 3_600_000;
      stays.push({ device_id, start_ts, end_ts });

      // 每次入住各块表用得多少不一样，记录表里的「主要设备」才不会千篇一律
      const mix = new Map(
        meters.map((m) => [m.id, 0.3 + Math.random() * 1.6]),
      );

      for (const m of meters)
        for (let ts = start_ts; ts <= end_ts; ts += STEP) {
          const hour = new Date(ts).getHours();
          const sum =
            (total.get(m.id) ?? 0) +
            sampleKwh((BASE[m.id] ?? 200) * (mix.get(m.id) ?? 1) * shape(hour));
          total.set(m.id, sum);
          rows.push({ device_id, id: m.id, ts, powerW: null, energyKwh: sum });
        }
    }

    for (let i = 0; i < rows.length; i += 5_000)
      await db.entityHistory.createMany({ data: rows.slice(i, i + 5_000) });
    await db.energyUsageTime.createMany({ data: stays });

    // 铺完把累计值接到样本最后一行，实时数据接着往下涨
    for (const m of meters)
      setBaseline(device_id, m.id, total.get(m.id) ?? 0, m.energyKwh ?? 0);
    console.log(
      `[seed] ${device_id} 铺了 ${rows.length} 行演示历史、${stays.length} 次入住`,
    );
  }
}
