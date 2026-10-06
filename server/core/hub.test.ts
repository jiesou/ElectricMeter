import { beforeEach, expect, test } from "bun:test";
import type { Entity } from "@em/shared";
import { db } from "./db.ts";
import * as hub from "./hub.ts";
import { now } from "./util.ts";

/** 连上时板子声明自己有什么：一个回路两个实体，开关 + 功率表 */
const FULL: Entity[] = [
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
    report: (entities: Entity[], ts = now()) => post("pub_entities", { ts, entities }),
    stop: () => hub.disconnect(id),
    reconnect: open,
  };
}

/** 内存表里的那一台设备 */
const table = (id: string) => hub.devices.get(id)!;

/** 库里的那个实体 */
const inDb = (device_id: string, id: string) => db.entity.findUnique({ where: { device_id_id: { device_id, id } } });

beforeEach(() => hub.devices.clear());

test("应用层心跳收到 ack_alive", async () => {
  const sent: string[] = [];
  await hub.connect("esp-107", { send: (m: string) => sent.push(m), close: () => {} } as never, "10.0.0.1");
  await hub.handleMessage("esp-107", JSON.stringify({ type: "pub_alive" }));
  expect(sent.map((m) => JSON.parse(m).type)).toEqual(["ack_alive"]);
});

test("设备连上就落库：名字是服务端分配的", async () => {
  const d = await fakeDevice("esp-101");
  await d.setup();
  expect(await db.device.findUnique({ where: { id: "esp-101" } })).toMatchObject({ name: "esp-101", ip: "10.0.0.1" });
});

test("身份与读数都落库：服务器重启后 load 读得回来", async () => {
  const d = await fakeDevice("esp-102");
  await d.setup();
  await d.report([{ id: "light", state: true }]);
  const row = (await inDb("esp-102", "light"))!;
  expect(row).toMatchObject({ name: "照明", type: "switch", state: true });
  expect(row.lastUpdate).toBeGreaterThan(0); // 这个读数是几点的
});

test("增量上报：没提到的字段保持上次的值", async () => {
  const d = await fakeDevice("esp-103");
  await d.setup();
  await d.report([{ id: "light", state: true }]);
  expect(table("esp-103").entities.get("light")).toMatchObject({ state: true });
  expect(await inDb("esp-103", "light")).toMatchObject({ name: "照明" }); // name 没重发，但还在
  expect(table("esp-103").entities.get("light-meter")).toMatchObject({ powerW: 0 }); // 别的实体没被碰
});

test("只报读数、没申报 type：不凭空造实体", async () => {
  const d = await fakeDevice("esp-104");
  await d.setup();
  await d.report([{ id: "kettle", powerW: 1600 }]);
  expect(table("esp-104").entities.has("kettle")).toBe(false);
  expect(await inDb("esp-104", "kettle")).toBeNull();
});

test("掉线：记录留在表里、online 变 false，读数还在", async () => {
  const d = await fakeDevice("esp-105");
  await d.setup();
  await d.report([{ id: "light", state: true }]);
  d.stop();
  expect(table("esp-105").online).toBe(false);
  expect(table("esp-105").entities.get("light")).toMatchObject({ state: true });
  await d.reconnect();
  await d.report([{ id: "light", state: false }], now() + 1);
  expect(table("esp-105").entities.get("light")).toMatchObject({ state: false });
});

test("读数报什么就是什么：电量不做加工", async () => {
  const d = await fakeDevice("esp-106");
  await d.setup();
  await d.report([{ id: "light-meter", powerW: 1000, energyKwh: 10 }]);
  expect(table("esp-106").entities.get("light-meter")!.energyKwh).toBe(10);
  await d.report([{ id: "light-meter", energyKwh: 0.5 }]); // 板子重启报了 0.5，服务器照收
  expect(table("esp-106").entities.get("light-meter")!.energyKwh).toBe(0.5);
});
