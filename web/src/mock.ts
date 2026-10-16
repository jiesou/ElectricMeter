import type { Entity } from "@em/shared";
import type { Room } from "./api.ts";

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
): Room {
  const meters = entities.filter((e) => e.type === "meter");
  return {
    id,
    name,
    online,
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
  room("esp-301", "301 电表箱", true, circuits(true)),
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
