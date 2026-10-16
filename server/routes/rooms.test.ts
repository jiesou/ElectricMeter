import { beforeEach, expect, test } from "bun:test";
import type { Entity } from "@em/shared";
import { app } from "../app.ts";
import { db } from "../core/db.ts";
import * as hub from "../core/hub.ts";
import { now } from "../core/util.ts";

const json = async (res: Response) => (await res.json()) as any;

/** 假板子：往上报就完事 */
const fakeWs = () => ({ send: () => {}, close: () => {} }) as never;

async function device(id: string, entities: Entity[]) {
  const ws = fakeWs();
  await hub.connect(id, ws, "10.0.0.9");
  await hub.handleMessage(
    id,
    JSON.stringify({ type: "pub_entities", ts: now(), entities }),
  );
}

beforeEach(() => hub.devices.clear());

test("客房快照组合设备信息、汇总读数和实体", async () => {
  await device("esp-301", [
    { id: "light", name: "灯", type: "switch", state: true },
    {
      id: "light-meter",
      name: "灯功率",
      type: "meter",
      powerW: 55,
      energyKwh: 2.5,
    },
    {
      id: "dryer-meter",
      name: "吹风机功率",
      type: "meter",
      powerW: 20,
      energyKwh: 3,
    },
  ]);

  const rooms = await json(await app.request("/api/rooms"));
  expect(rooms).toHaveLength(1);
  expect(rooms[0]).toMatchObject({
    id: "esp-301",
    name: "esp-301",
    online: true,
    power: 75,
    energy: 5.5,
    entities: [
      // 展示顺序按 id 字母序，跟申报的先后无关
      { id: "dryer-meter", powerW: 20 },
      { id: "light", state: true },
      { id: "light-meter", powerW: 55 },
    ],
  });
});

test("客房 SSE 立即发送与 REST 相同的快照", async () => {
  await device("esp-302", [
    { id: "light", name: "灯", type: "switch", state: false },
  ]);
  const rest = await json(await app.request("/api/rooms"));
  const response = await app.request("/api/rooms/stream");
  expect(response.headers.get("content-type")).toContain("text/event-stream");

  const reader = response.body!.getReader();
  try {
    const { value } = await reader.read();
    const streamed = JSON.parse(
      new TextDecoder().decode(value).slice(6).trim(),
    );
    expect(streamed).toEqual(rest);
  } finally {
    await reader.cancel();
  }
});

test("客房历史只给窗口内的读数", async () => {
  await device("esp-303", [
    { id: "light-meter", name: "灯功率", type: "meter", powerW: 55 },
  ]);
  const ts = now();
  await db.entityHistory.deleteMany({ where: { device_id: "esp-303" } });
  await db.entityHistory.createMany({
    data: [
      { device_id: "esp-303", id: "light-meter", ts: ts - 5, powerW: 55 },
      { device_id: "esp-303", id: "light-meter", ts: ts - 601, powerW: 10 },
    ],
  });

  expect(await json(await app.request("/api/rooms/esp-303/history"))).toEqual([
    { device_id: "esp-303", id: "light-meter", ts: ts - 5, powerW: 55 },
  ]);
});

test("改房名同时落到快照和库里", async () => {
  await device("esp-304", [
    { id: "light", name: "灯", type: "switch", state: true },
  ]);

  const res = await app.request("/api/rooms/esp-304", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "301 房" }),
  });

  expect(res.status).toBe(200);
  expect(await json(res)).toMatchObject({ id: "esp-304", name: "301 房" });
  expect(await json(await app.request("/api/rooms"))).toMatchObject([
    { id: "esp-304", name: "301 房" },
  ]);
  expect(
    await db.device.findUnique({ where: { id: "esp-304" } }),
  ).toMatchObject({ name: "301 房" });
});

test("设备重连不会把改过的房名冲掉", async () => {
  await device("esp-305", [
    { id: "light", name: "灯", type: "switch", state: true },
  ]);
  await app.request("/api/rooms/esp-305", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "302 房" }),
  });

  await device("esp-305", [
    { id: "light", name: "灯", type: "switch", state: false },
  ]);

  expect(await json(await app.request("/api/rooms"))).toMatchObject([
    { id: "esp-305", name: "302 房" },
  ]);
});

test("删房清掉设备和实体，历史靠级联一起走", async () => {
  await device("esp-306", [
    { id: "light-meter", name: "灯功率", type: "meter", powerW: 55 },
  ]);
  await db.entityHistory.create({
    data: { device_id: "esp-306", id: "light-meter", ts: now(), powerW: 55 },
  });

  expect(
    (await app.request("/api/rooms/esp-306", { method: "DELETE" })).status,
  ).toBe(204);

  expect(await json(await app.request("/api/rooms"))).toEqual([]);
  expect(await db.device.count({ where: { id: "esp-306" } })).toBe(0);
  expect(await db.entity.count({ where: { device_id: "esp-306" } })).toBe(0);
  expect(
    await db.entityHistory.count({ where: { device_id: "esp-306" } }),
  ).toBe(0);
});

test("改未知客房和空房名都被挡下", async () => {
  await device("esp-307", []);

  expect(
    (await app.request("/api/rooms/esp-999", { method: "DELETE" })).status,
  ).toBe(404);
  const patch = (body: unknown) =>
    app.request("/api/rooms/esp-307", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  expect((await patch({ name: "  " })).status).toBe(400);
  expect((await patch({ name: 123 })).status).toBe(400);
  expect(
    (
      await app.request("/api/rooms/esp-999", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "x" }),
      })
    ).status,
  ).toBe(404);
});
