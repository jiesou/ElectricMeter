import type { Room } from "./types";

/** 假数据演示时视频页用的本地示例标注图 */
export const demoCameraImage = "/demo-camera.svg";

const base: Room[] = [
  {
    id: "esp-301",
    name: "301 房",
    online: true,
    power: 955,
    energy: 66.7,
    entities: [
      { id: "light-meter", device_id: "esp-301", name: "照明", type: "meter", powerW: 55, energyKwh: 12.4 },
      { id: "socket-meter", device_id: "esp-301", name: "插座", type: "meter", powerW: 0, energyKwh: 20.1 },
      { id: "ac-meter", device_id: "esp-301", name: "空调", type: "meter", powerW: 900, energyKwh: 34.2 },
      { id: "light", device_id: "esp-301", name: "照明", type: "switch", state: true },
      { id: "socket", device_id: "esp-301", name: "插座", type: "switch", state: false },
      { id: "ac", device_id: "esp-301", name: "空调", type: "switch", state: true },
    ],
  },
  {
    id: "esp-302",
    name: "302 房",
    online: true,
    power: 0,
    energy: 3.2,
    entities: [
      { id: "total-meter", device_id: "esp-302", name: "总电表", type: "meter", powerW: 0, energyKwh: 3.2 },
      { id: "light", device_id: "esp-302", name: "照明", type: "switch", state: false },
    ],
  },
  {
    id: "esp-303",
    name: "303 房",
    online: false,
    power: 120,
    energy: 45.63,
    entities: [
      { id: "light-meter", device_id: "esp-303", name: "照明", type: "meter", powerW: 45, energyKwh: 18.2, lastUpdate: 1 },
      { id: "ac-meter", device_id: "esp-303", name: "空调", type: "meter", powerW: 75, energyKwh: 27.43, lastUpdate: 1 },
      { id: "ac", device_id: "esp-303", name: "空调", type: "switch", state: true, lastUpdate: 1 },
    ],
  },
  {
    id: "esp-304",
    name: "304 房",
    online: true,
    power: 0,
    energy: 0,
    entities: [],
  },
  {
    id: "esp-305",
    name: "305 房",
    online: true,
    power: 2140,
    energy: 152.08,
    entities: [
      { id: "light-meter", device_id: "esp-305", name: "照明", type: "meter", powerW: 120, energyKwh: 30.5 },
      { id: "socket-meter", device_id: "esp-305", name: "插座", type: "meter", powerW: 320, energyKwh: 41.28 },
      { id: "ac-meter", device_id: "esp-305", name: "空调", type: "meter", powerW: 1500, energyKwh: 60.3 },
      { id: "bath-meter", device_id: "esp-305", name: "热水器", type: "meter", powerW: 200, energyKwh: 20 },
      { id: "light", device_id: "esp-305", name: "照明", type: "switch", state: true },
      { id: "socket", device_id: "esp-305", name: "插座", type: "switch", state: true },
      { id: "ac", device_id: "esp-305", name: "空调", type: "switch", state: true },
      { id: "bath", device_id: "esp-305", name: "热水器", type: "switch", state: false },
      { id: "floor-heat", device_id: "esp-305", name: "地暖", state: true },
    ],
  },
  {
    id: "esp-306",
    name: "306 房 二层靠山侧家庭套房（长名称示例）",
    online: true,
    power: 480,
    energy: 88.9,
    entities: [
      { id: "light-meter", device_id: "esp-306", name: "照明", type: "meter", powerW: 80 },
      { id: "ac-meter", device_id: "esp-306", name: "空调", type: "meter", energyKwh: 88.9 },
      { id: "ac", device_id: "esp-306", name: "空调", type: "switch" },
    ],
  },
];

/** 读数每秒小幅度变化，便于看到页面刷新 */
export function startMockRooms(onRooms: (rooms: Room[]) => void) {
  let step = 0;

  const tick = () => {
    step++;
    onRooms(
      base.map((room) => {
        if (!room.online) return structuredClone(room);
        const entities = room.entities.map((entity) => {
          if (entity.type !== "meter" || entity.powerW === undefined) return { ...entity };
          const powerW = Math.max(0, Math.round(entity.powerW + Math.sin(step / 4 + entity.id.length) * 40));
          const energyKwh = (entity.energyKwh ?? 0) + powerW / 3600000;
          return { ...entity, powerW, energyKwh };
        });
        const meters = entities.filter((entity) => entity.type === "meter");
        return {
          ...room,
          power: meters.reduce((sum, entity) => sum + (entity.powerW ?? 0), 0),
          energy: meters.reduce((sum, entity) => sum + (entity.energyKwh ?? 0), 0),
          entities,
        };
      }),
    );
  };

  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}
