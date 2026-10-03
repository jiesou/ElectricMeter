import { beforeEach, expect, test } from "bun:test";
import type { Meter, Switch } from "@em/shared";
import * as hub from "./hub.ts";
import { now } from "./util.ts";

/** 连上时板子声明自己有什么：一个回路两个实体，开关 + 功率表 */
const FULL: Partial<Switch | Meter>[] = [
  { id: "light", name: "照明", type: "switch", state: false },
  { id: "light-meter", name: "照明功率", type: "meter", powerW: 0, energyKwh: 2.1 },
];

/** 假下位机：只管往上报，服务器现在没有下行消息 */
async function fakeDevice(id: string, full = FULL) {
  const open = () => hub.connect(id, { send: () => {}, close: () => {} } as never, "10.0.0.1");
  const post = (type: string, m: object) => hub.handleMessage(id, JSON.stringify({ type, ...m }));
  await open();

  return {
    /** 连上先声明有什么 */
    setup: (ts = now()) => post("pub_entities", { ts, entities: full }),
    /** 之后哪个实体变了就补一份 */
    report: (entities: Partial<Switch | Meter>[], ts = now()) => post("pub_entities", { ts, entities }),
    stop: () => hub.disconnect(id),
    reconnect: open,
  };
}

/** 总览里的那一台设备 */
const device = async (id: string) => (await hub.deviceTotals()).find((d) => d.id === id)!;

beforeEach(hub.restart);

test("设备连上就落库：名字是服务端分配的，ip 重启后还在", async () => {
  const d = await fakeDevice("esp-101");
  await d.setup();
  hub.restart();
  expect(await device("esp-101")).toMatchObject({ name: "esp-101", ip: "10.0.0.1" });
});

test("实体身份落库、读数不落库：重启后清单还在，读数没了", async () => {
  const d = await fakeDevice("esp-102");
  await d.setup();
  await d.report([{ id: "light", state: true }]);
  hub.restart();
  const e = (await hub.getEntity("esp-102", "light"))!;
  expect(e.name).toBe("照明");
  expect(e.type).toBe("switch");
  expect(e.state).toBeUndefined();
});

test("增量上报：没提到的字段保持上次的值", async () => {
  const d = await fakeDevice("esp-103");
  await d.setup();
  await d.report([{ id: "light", state: true }]);
  expect((await hub.getEntity("esp-103", "light"))!.state).toBe(true);
  expect((await hub.getEntity("esp-103", "light"))!.name).toBe("照明"); // name 没重发，但还在
  expect((await hub.getEntity("esp-103", "light-meter"))!.powerW).toBe(0); // 别的实体没被碰
});

test("只报读数、没申报 type：不凭空造实体", async () => {
  const d = await fakeDevice("esp-104");
  await d.setup();
  await d.report([{ id: "kettle", powerW: 1600 }]);
  expect(await hub.getEntity("esp-104", "kettle")).toBeUndefined();
});

test("掉线：实体身份照留（在库里），读数跟着连接走", async () => {
  const d = await fakeDevice("esp-105");
  await d.setup();
  await d.report([{ id: "light", state: true }]);
  d.stop();
  expect((await device("esp-105")).online).toBe(false);
  expect((await hub.getEntity("esp-105", "light"))!.name).toBe("照明");
  expect((await hub.getEntity("esp-105", "light"))!.state).toBeUndefined();
  await d.reconnect();
  await d.report([{ id: "light", state: false }], now() + 1);
  expect((await hub.getEntity("esp-105", "light"))!.state).toBe(false);
});

test("读数报什么就是什么：电量不做加工", async () => {
  const d = await fakeDevice("esp-106");
  await d.setup();
  await d.report([{ id: "light-meter", powerW: 1000, energyKwh: 10 }]);
  expect((await hub.getEntity("esp-106", "light-meter"))!.energyKwh).toBe(10);
  await d.report([{ id: "light-meter", energyKwh: 0.5 }]); // 板子重启报了 0.5，服务器照收
  expect((await hub.getEntity("esp-106", "light-meter"))!.energyKwh).toBe(0.5);
});
