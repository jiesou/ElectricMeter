import { beforeEach, expect, test } from "bun:test";
import type { Entity } from "@em/shared";
import { app } from "../app.ts";
import { db } from "../core/db.ts";
import * as hub from "../core/hub.ts";
import { now } from "../core/util.ts";

const json = async (res: Response) => (await res.json()) as any;
const fakeWs = () => ({ send: () => {}, close: () => {} }) as never;

/** 假板子报一批读数 */
const report = (device_id: string, entities: Entity[], ts = now()) =>
  hub.handleMessage(
    device_id,
    JSON.stringify({
      type: "pub_entities",
      ts,
      entities: entities.map((e) => ({ ...e, ts })),
    }),
  );

async function device(id: string, entities: Entity[]) {
  await hub.connect(id, fakeWs(), "10.0.0.9");
  await report(id, entities);
}

const meter = (energyKwh: number, powerW = 55): Entity => ({
  id: "light-meter",
  name: "灯功率",
  type: "meter",
  powerW,
  energyKwh,
});

const stats = async () => json(await app.request("/api/stats"));
const room = (s: any, id: string) => s.rooms.find((r: any) => r.id === id);
const sleep = () => Bun.sleep(3); // 让毫秒时间戳错开

beforeEach(async () => {
  hub.devices.clear();
  await db.energyUsageTime.deleteMany();
  await db.entityHistory.deleteMany();
});

test("入住到退房：用了多少电回账本做差，退房后进记录表", async () => {
  await device("esp-401", [
    meter(100),
    { id: "light", name: "灯", type: "switch", state: true },
  ]);

  await sleep();
  await app.request("/api/rooms/esp-401/checkin", { method: "POST" });
  await sleep();
  await report("esp-401", [{ id: "light-meter", energyKwh: 103 }]);

  const living = await stats();
  expect(room(living, "esp-401").occupied).toBe(true);
  expect(room(living, "esp-401").kwh).toBeCloseTo(3);
  expect(room(living, "esp-401").devices).toEqual([
    { id: "light-meter", name: "灯功率", kwh: 3 },
  ]);
  expect(living.stays).toHaveLength(1);
  expect(living.stays[0].end_ts).toBeNull();

  await sleep();
  await app.request("/api/rooms/esp-401/checkout", { method: "POST" });
  const done = await stats();
  expect(room(done, "esp-401").occupied).toBe(false);
  expect(done.stays[0].room).toBe("esp-401");
  expect(done.stays[0].top).toBe("灯功率");
  expect(done.stays[0].percent).toBe(0);
});

test("客房快照带上在住状态，客房页拿它判空房", async () => {
  await device("esp-402", [meter(0)]);

  const before = await json(await app.request("/api/rooms"));
  expect(before.find((r: any) => r.id === "esp-402").occupied).toBe(false);

  await app.request("/api/rooms/esp-402/checkin", { method: "POST" });
  const after = await json(await app.request("/api/rooms"));
  expect(after.find((r: any) => r.id === "esp-402").occupied).toBe(true);

  await app.request("/api/rooms/esp-402/checkout", { method: "POST" });
  const done = await json(await app.request("/api/rooms"));
  expect(done.find((r: any) => r.id === "esp-402").occupied).toBe(false);
});

test("记录表按入住时间倒序，百分位是超过了多少比例的入住", async () => {
  await device("esp-403", [meter(0)]);

  let raw = 0;
  for (const kwh of [1, 3, 10]) {
    await sleep();
    await app.request("/api/rooms/esp-403/checkin", { method: "POST" });
    await sleep();
    raw += kwh;
    await report("esp-403", [{ id: "light-meter", energyKwh: raw }]);
    await sleep();
    await app.request("/api/rooms/esp-403/checkout", { method: "POST" });
  }

  const s = await stats();
  expect(s.stays.map((b: any) => b.kwh)).toEqual([10, 3, 1]);
  expect(s.stays.map((b: any) => b.percent)).toEqual([67, 33, 0]);
  expect(s.stays.map((b: any) => b.days)).toEqual([1, 1, 1]);
});

test("拨天：服务器时间前进一天，本次入住跟着多一天", async () => {
  await device("esp-404", [meter(10)]);

  await sleep();
  await app.request("/api/rooms/esp-404/checkin", { method: "POST" });
  await sleep();
  await report("esp-404", [{ id: "light-meter", energyKwh: 12 }]);

  const before = await stats();
  await app.request("/api/clock/next-day", { method: "POST" });
  await sleep();
  await report("esp-404", [{ id: "light-meter", energyKwh: 15 }]);
  const after = await stats();

  expect(after.now - before.now).toBeGreaterThanOrEqual(86_400_000);
  expect(room(after, "esp-404").kwh).toBeCloseTo(5);
  expect(room(after, "esp-404").days).toHaveLength(2);
});
