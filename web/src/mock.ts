import type { Entity } from "@em/shared";
import type { Bill, Room, Stats } from "./api.ts";

/** 演示时 1 秒当 40 秒，两位小数下累计电量每秒都在涨 */
const DEMO_SPEED = 40;
/** 功率围绕基准值浮动 ±40W，各实体相位不同 */
const SWING = 40;

const meter = (
  id: string,
  name: string,
  powerW?: number,
  energyKwh?: number,
): Entity => ({
  id,
  name,
  type: "meter",
  powerW,
  energyKwh,
});

const sw = (id: string, name: string, state?: boolean): Entity => ({
  id,
  name,
  type: "switch",
  state,
});

function room(
  id: string,
  name: string,
  online: boolean,
  entities: Entity[],
  occupied = false,
): Room {
  const meters = entities.filter((e) => e.type === "meter");
  return {
    id,
    name,
    online,
    occupied,
    power: meters.reduce((sum, e) => sum + (e.powerW ?? 0), 0),
    energy: meters.reduce((sum, e) => sum + (e.energyKwh ?? 0), 0),
    entities,
  };
}

/** 每间房三个用电器：灯 / 热水壶 / 吹风机，各带一个开关和一块电表 */
const APPLIANCES = [
  { id: "light", name: "灯", powerW: 55, energyKwh: 3.42 },
  { id: "kettle", name: "热水壶", powerW: 1600, energyKwh: 18.4 },
  { id: "dryer", name: "吹风机", powerW: 900, energyKwh: 46.2 },
];

const circuits = (state: boolean): Entity[] =>
  APPLIANCES.flatMap((a) => [
    meter(`${a.id}-meter`, `${a.name}功率`, a.powerW, a.energyKwh),
    sw(a.id, a.name, state),
  ]);

const TEMPLATE: Room[] = [
  room("esp-301", "301 电表箱", true, circuits(true), true), // 这间住着人
  room("esp-302", "302 电表箱", true, circuits(true)),
  room("esp-303", "303 电表箱", false, circuits(false)),
  room("esp-304", "304 电表箱", true, circuits(false)),
  room("esp-305", "305 电表箱", true, circuits(true)),
  // 读数没报齐：电表没功率没电量，开关没状态
  room("esp-306", "前院独立小屋 · 带观景露台的亲子家庭房", true, [
    meter("light-meter", "灯功率"),
    sw("light", "灯"),
    meter("kettle-meter", "热水壶功率"),
    sw("kettle", "热水壶"),
    meter("dryer-meter", "吹风机功率"),
    sw("dryer", "吹风机"),
  ]),
];

let tick = 0;

/** 六间房的初值，每次给一份可改的副本 */
export function mockRooms(): Room[] {
  tick = 0;
  return TEMPLATE.map((r) => ({
    ...r,
    entities: r.entities.map((e) => ({ ...e })),
  }));
}

/** 上一帧推进一秒：功率正弦浮动，电量按功率累积，离线房整间不动 */
export function mockTick(prev: Room[]): Room[] {
  tick += 1;
  return prev.map((r) => {
    const template = TEMPLATE.find((t) => t.id === r.id);
    if (!r.online || !template) return r;

    const entities = r.entities.map((entity, i) => {
      if (entity.type !== "meter") return entity;
      const base = template.entities[i]?.powerW;
      if (base === undefined) return entity; // 没报过读数的电表，mock 也不替它编
      const powerW = Math.max(
        0,
        Math.round(base + SWING * Math.sin((tick + i * 7) / 9)),
      );
      return {
        ...entity,
        powerW,
        energyKwh: Number(
          ((entity.energyKwh ?? 0) + (powerW * DEMO_SPEED) / 3600000).toFixed(
            2,
          ),
        ),
      };
    });

    const meters = entities.filter((e) => e.type === "meter");
    return {
      ...r,
      entities,
      power: meters.reduce((sum, e) => sum + (e.powerW ?? 0), 0),
      energy: meters.reduce((sum, e) => sum + (e.energyKwh ?? 0), 0),
    };
  });
}

/* === 统计页那份 mock：形状与 /api/stats 一致，动作只动内存 === */

const day = 86_400_000;

/** 24 小时的作息权重：晚上多、凌晨少 */
const WEIGHT = [
  0.3, 0.2, 0.2, 0.2, 0.2, 0.3, 0.6, 1.2, 1.0, 0.6, 0.5, 0.5, 0.6, 0.5, 0.5,
  0.6, 0.9, 1.4, 1.8, 1.6, 1.4, 1.2, 0.9, 0.5,
];

const dayStart = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** 把一段用电摊到 24 个小时上 */
const spread = (kwh: number) => {
  const sum = WEIGHT.reduce((a, b) => a + b, 0);
  return WEIGHT.map((w, hour) => ({ hour, kwh: (kwh * w) / sum }));
};

const devicesOf = (r: Room, kwh: number) =>
  r.entities
    .filter((e) => e.type === "meter")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e, i) => ({
      id: e.id,
      name: e.name ?? e.id,
      kwh: kwh ? [0.57, 0.28, 0.15][i]! * kwh : 0,
    }));

let offset = 0; // mock 自己的拨天偏移

export function mockStats(): Stats {
  const now = Date.now() + offset;
  const rooms = TEMPLATE.map((r) => {
    const kwh = r.occupied ? 7.4 : 0;
    return {
      id: r.id,
      name: r.name,
      occupied: r.occupied,
      start_ts: r.occupied ? now - 2 * day : undefined,
      kwh,
      days: r.occupied
        ? [1.8, 2.6, 3].map((k, i) => ({ day: dayStart(now) - (2 - i) * day, kwh: k }))
        : [],
      hours: spread(kwh),
      devices: devicesOf(r, kwh),
    };
  });
  return { now, rooms, stays: mockBills(now), avg_hours: spread(3.2) };
}

/** 历史入住记录：样本行的形状与真实账单一样 */
function mockBills(now: number): Bill[] {
  return [
    { start: 5, end: 4, kwh: 9.6, top: "吹风机功率", percent: 78 },
    { start: 12, end: 10, kwh: 5.2, top: "热水壶功率", percent: 42 },
    { start: 20, end: 19, kwh: 3.1, top: "灯功率", percent: 12 },
  ].map((b) => ({
    device_id: "esp-301",
    room: "301 电表箱",
    start_ts: now - b.start * day,
    end_ts: now - b.end * day,
    days: b.start - b.end + 1,
    kwh: b.kwh,
    top: b.top,
    percent: b.percent,
  }));
}

const find = (s: Stats, device_id: string) =>
  s.rooms.find((r) => r.id === device_id);

/** 在住房的用电每秒涨一点，肉眼看得见 */
export function mockStatsTick(s: Stats) {
  s.now = Date.now() + offset;
  const room = s.rooms.find((r) => r.occupied);
  if (!room) return;
  const add = 0.0006;
  room.kwh += add;
  const last = room.days[room.days.length - 1];
  if (last) last.kwh += add;
  const hour = room.hours[new Date(s.now).getHours()];
  if (hour) hour.kwh += add;
  const device = room.devices[0];
  if (device) device.kwh += add;
}

export function mockNextDay(s: Stats) {
  offset += day;
  s.now = Date.now() + offset;
  const room = s.rooms.find((r) => r.occupied);
  if (!room) return;
  room.days.push({ day: dayStart(s.now), kwh: 0 });
  room.hours = spread(0);
}

export function mockCheckin(s: Stats, device_id: string) {
  const room = find(s, device_id);
  if (!room) return;
  room.occupied = true;
  room.start_ts = s.now;
  room.kwh = 0;
  room.days = [{ day: dayStart(s.now), kwh: 0 }];
  room.hours = spread(0);
  for (const d of room.devices) d.kwh = 0;
}

export function mockCheckout(s: Stats, device_id: string) {
  const room = find(s, device_id);
  if (!room?.start_ts) return;
  const top = [...room.devices].sort((a, b) => b.kwh - a.kwh)[0];
  s.stays.unshift({
    device_id,
    room: room.name,
    start_ts: room.start_ts,
    end_ts: s.now,
    days: room.days.length,
    kwh: room.kwh,
    top: top && top.kwh > 0 ? top.name : "—",
    percent: 50,
  });
  room.occupied = false;
}
