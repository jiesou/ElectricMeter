import { beforeEach, expect, test } from "bun:test";
import type { Entity } from "@em/shared";
import { db } from "./db.ts";
import * as hub from "./hub.ts";
import { now } from "./util.ts";

/** 连上时板子声明自己有什么：一个回路两个实体，开关 + 功率表 */
const FULL: Entity[] = [
  { id: "light", name: "灯", type: "switch", state: false },
  {
    id: "light-meter",
    name: "灯功率",
    type: "meter",
    powerW: 0,
    energyKwh: 2.1,
  },
];

/** 假板子：往上报就完事，服务器现在没有下行消息 */
const fakeWs = (send: (m: string) => void = () => {}) =>
  ({ send, close: () => {} }) as never;

/** 假下位机：只管往上报，服务器现在没有下行消息 */
async function fakeDevice(id: string, full = FULL) {
  const ws = fakeWs();
  const open = () => hub.connect(id, ws, "10.0.0.1");
  const post = (type: string, m: object) =>
    hub.handleMessage(id, JSON.stringify({ type, ...m }));
  const stamped = (entities: Entity[], ts: number) =>
    entities.map((e) => ({ ...e, ts }));
  await open();

  return {
    /** 连上先声明有什么 */
    setup: (ts = now()) =>
      post("pub_entities", { ts, entities: stamped(full, ts) }),
    /** 之后按字段部分更新 */
    report: (entities: Entity[], ts = now()) =>
      post("pub_entities", { ts, entities: stamped(entities, ts) }),
    stop: () => hub.disconnect(id),
    reconnect: open,
  };
}

/** 内存表里的那一台设备 */
const table = (id: string) => hub.devices.get(id)!;

/** 库里的那个实体 */
const inDb = (device_id: string, id: string) =>
  db.entity.findUnique({ where: { device_id_id: { device_id, id } } });

beforeEach(() => hub.devices.clear());

test("应用层心跳收到 ack_alive", async () => {
  const sent: string[] = [];
  const ws = fakeWs((m) => sent.push(m));
  await hub.connect("esp-107", ws, "10.0.0.1");
  await hub.handleMessage("esp-107", JSON.stringify({ type: "pub_alive" }));
  expect(sent.map((m) => JSON.parse(m).type)).toEqual([
    "pub_name",
    "ack_alive",
  ]);
});

test("失联判定：10s 没消息就当它掉线，连接也关掉", async () => {
  const closed: number[] = [];
  await hub.connect(
    "esp-111",
    { send: () => {}, close: (c: number) => closed.push(c) } as never,
    "10.0.0.1",
  );
  const d = await fakeDevice("esp-112");
  await d.setup();

  table("esp-111").lastSeen = now() - 11_000; // 断电断网，TCP 还挂着
  hub.checkOffline();

  expect(closed).toEqual([4000]);
  expect(table("esp-111").online).toBe(false);
  expect(table("esp-112").online).toBe(true); // 刚说过话的别碰
});

test("设备连上就落库：名字是服务端分配的", async () => {
  const d = await fakeDevice("esp-101");
  await d.setup();
  expect(
    await db.device.findUnique({ where: { id: "esp-101" } }),
  ).toMatchObject({ name: "esp-101", ip: "10.0.0.1" });
});

test("身份与读数都落库：服务器重启后 load 读得回来", async () => {
  const d = await fakeDevice("esp-102");
  await d.setup();
  await d.report([{ id: "light", state: true }]);
  const row = (await inDb("esp-102", "light"))!;
  expect(row).toMatchObject({ name: "灯", type: "switch", state: true });
  expect(row.ts).toBeGreaterThan(0); // 这个读数是几点的
});

test("增量上报：没提到的字段保持上次的值", async () => {
  const d = await fakeDevice("esp-103");
  await d.setup();
  await d.report([{ id: "light", state: true }]);
  expect(table("esp-103").entities.get("light")).toMatchObject({ state: true });
  expect(await inDb("esp-103", "light")).toMatchObject({ name: "灯" }); // name 没重发，但还在
  expect(table("esp-103").entities.get("light-meter")).toMatchObject({
    powerW: 0,
  }); // 别的实体没被碰
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
  expect(table("esp-105").entities.get("light")).toMatchObject({
    state: false,
  });
});

test("读数报什么就是什么：电量不做加工", async () => {
  const d = await fakeDevice("esp-106");
  await d.setup();
  await d.report([{ id: "light-meter", powerW: 1000, energyKwh: 10 }]);
  expect(table("esp-106").entities.get("light-meter")!.energyKwh).toBe(10);
  await d.report([{ id: "light-meter", energyKwh: 0.5 }]); // 板子重启报了 0.5，服务器照收
  expect(table("esp-106").entities.get("light-meter")!.energyKwh).toBe(0.5);
});

test("实体自己带 device_id：算到那台设备名下，不跟连接方混在一起", async () => {
  await (await fakeDevice("esp-301")).setup(); // 301 得先存在
  await (await fakeDevice("esp-302")).setup();
  const ws = fakeWs();
  await hub.connect("bigscreen", ws, "10.0.0.2"); // 大屏随便报个身份
  await hub.handleMessage(
    "bigscreen",
    JSON.stringify({
      type: "pub_entities",
      entities: [
        {
          id: "people",
          name: "人数",
          type: "people-counter",
          inCount: 12,
          outCount: 9,
          netCount: 3,
          device_id: "esp-301",
        },
        { id: "people", name: "人数", type: "people-counter", inCount: 5, outCount: 2, netCount: 3, device_id: "esp-302" },
      ],
    }),
  );
  expect(table("esp-301").entities.get("people")).toMatchObject({
    inCount: 12,
    outCount: 9,
    netCount: 3,
  });
  expect(table("esp-302").entities.get("people")).toMatchObject({ inCount: 5, netCount: 3 });
  expect(table("bigscreen").entities.size).toBe(0); // 报的全是别人家的，自己名下啥也没有
});

test("报了不存在的设备：直接抛，不凭空把它建出来", async () => {
  const ws = fakeWs();
  await hub.connect("bigscreen", ws, "10.0.0.2");
  await expect(
    hub.handleMessage(
      "bigscreen",
      JSON.stringify({
        type: "pub_entities",
        entities: [{ id: "people", type: "people-counter", device_id: "esp-9999" }],
      }),
    ),
  ).rejects.toThrow("esp-9999");
  expect(hub.devices.has("esp-9999")).toBe(false);
});

test("没带 device_id 就听连接的：表箱照老样子报数", async () => {
  const d = await fakeDevice("esp-108");
  await d.setup();
  expect(table("esp-108").entities.get("light")).toMatchObject({ name: "灯" });
});

test("人数计数器：inCount / outCount / netCount 跟别的字段一样做部分更新", async () => {
  const d = await fakeDevice("esp-109", [
    { id: "people", name: "人数", type: "people-counter", inCount: 0, outCount: 0, netCount: 0 },
  ]);
  await d.setup();
  await d.report([{ id: "people", inCount: 7, netCount: 7 }]);
  expect(table("esp-109").entities.get("people")).toMatchObject({
    inCount: 7,
    netCount: 7,
    outCount: 0, // 没重发，还是 0
    name: "人数",
  });
  await d.report([{ id: "people", inCount: 0, outCount: 0, netCount: 0 }]); // 大屏点清零
  expect(await inDb("esp-109", "people")).toMatchObject({ inCount: 0, netCount: 0 });
});

test("netCount 服务器不拿 inCount-outCount 去算：大屏说多少就是多少", async () => {
  const d = await fakeDevice("esp-110", [
    { id: "people", name: "人数", type: "people-counter", inCount: 5, outCount: 2, netCount: 4 },
  ]);
  await d.setup();
  expect(table("esp-110").entities.get("people")).toMatchObject({ netCount: 4 });
});

test("人数是替房间报的：报一次就下发到那间房自己的设备", async () => {
  const sent: string[] = [];
  await hub.connect("esp-301", fakeWs((m) => sent.push(m)), "10.0.0.1");
  await hub.connect("bigscreen", fakeWs(), "10.0.0.2");
  await hub.handleMessage(
    "bigscreen",
    JSON.stringify({
      type: "pub_entities",
      entities: [
        {
          id: "people",
          name: "人数",
          type: "people-counter",
          inCount: 3,
          outCount: 1,
          netCount: 2,
          device_id: "esp-301",
        },
      ],
    }),
  );
  expect(sent.map((m) => JSON.parse(m))).toMatchObject([
    { type: "pub_name", name: "esp-301" },
    { type: "pub_entities", entities: [{ id: "people", netCount: 2 }] },
  ]);
});

test("刚连上就把当前人数补给它，不用等下一个人跨线", async () => {
  await hub.connect("esp-302", fakeWs(), "10.0.0.1");
  await hub.connect("bigscreen", fakeWs(), "10.0.0.2");
  await hub.handleMessage(
    "bigscreen",
    JSON.stringify({
      type: "pub_entities",
      entities: [
        { id: "people", name: "人数", type: "people-counter", inCount: 5, outCount: 0, netCount: 5, device_id: "esp-302" },
      ],
    }),
  );
  await hub.disconnect("esp-302");

  const sent: string[] = [];
  await hub.connect("esp-302", fakeWs((m) => sent.push(m)), "10.0.0.1");
  expect(sent.map((m) => JSON.parse(m))).toMatchObject([
    { type: "pub_name", name: "esp-302" },
    { type: "pub_entities", entities: [{ id: "people", netCount: 5 }] },
  ]);
});
