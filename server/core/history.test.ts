import { beforeEach, expect, test } from "bun:test";
import type { Entity } from "@em/shared";
import { db } from "./db.ts";
import * as hub from "./hub.ts";
import { now } from "./util.ts";

async function device(id: string, entities: Entity[], ts = now()) {
  const ws = { send: () => {}, close: () => {} } as never;
  await hub.connect(id, ws, "10.0.0.9");
  await hub.handleMessage(
    id,
    JSON.stringify({
      type: "pub_entities",
      ts,
      entities: entities.map((e) => ({ ...e, ts })),
    }),
  );
}

beforeEach(async () => {
  hub.devices.clear();
  await db.entityHistory.deleteMany();
});

test("每报一次读数就落一行，开关不落盘", async () => {
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

  const rows = await db.entityHistory.findMany({ orderBy: { id: "asc" } });
  expect(rows.map((row) => [row.device_id, row.id, row.powerW])).toEqual([
    ["esp-301", "dryer-meter", 20],
    ["esp-301", "light-meter", 55],
  ]);
});

test("同一个电表报两次留两个点，时间用设备报的", async () => {
  const t = now();
  await device(
    "esp-302",
    [{ id: "light-meter", name: "灯功率", type: "meter", powerW: 10 }],
    t,
  );
  await device("esp-302", [{ id: "light-meter", powerW: 20 }], t + 290);

  const rows = await db.entityHistory.findMany({ orderBy: { ts: "asc" } });
  expect(rows.map((row) => [row.ts, row.powerW])).toEqual([
    [t, 10],
    [t + 290, 20],
  ]);
});

test("窗口外的读数被删掉", async () => {
  const old = now() - 601_000;
  await device(
    "esp-303",
    [{ id: "light-meter", name: "灯功率", type: "meter", powerW: 1 }],
    old,
  );
  await device("esp-303", [{ id: "light-meter", powerW: 55 }]);

  const rows = await db.entityHistory.findMany();
  expect(rows.map((row) => row.ts)).not.toContain(old);
  expect(rows).toHaveLength(1);
});
