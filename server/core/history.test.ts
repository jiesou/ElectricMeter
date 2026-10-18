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

test("账本不删行：窗口外的读数也留着，统计要一直拿它做差", async () => {
  const old = now() - 601_000;
  await device(
    "esp-303",
    [{ id: "light-meter", name: "灯功率", type: "meter", powerW: 1 }],
    old,
  );
  await device("esp-303", [{ id: "light-meter", powerW: 55 }], now());

  const rows = await db.entityHistory.findMany({ orderBy: { ts: "asc" } });
  expect(rows).toHaveLength(2); // 窗口外那行还在
  expect(rows[0]).toMatchObject({ ts: old, powerW: 1 });
  expect(rows[1]).toMatchObject({ powerW: 55 });
});

test("累计电量只增不减：下位机归零时接着往上加", async () => {
  const t = now();
  await device(
    "esp-304",
    [
      {
        id: "light-meter",
        name: "灯功率",
        type: "meter",
        powerW: 10,
        energyKwh: 5,
      },
    ],
    t,
  );
  await device("esp-304", [{ id: "light-meter", energyKwh: 7.5 }], t + 1000);
  await device("esp-304", [{ id: "light-meter", energyKwh: 0.5 }], t + 2000); // 归零

  // 只看差值：累计基线会从账本最新一行接上（并行跑测试时别的文件可能已经写过这间房）
  const rows = await db.entityHistory.findMany({ orderBy: { ts: "asc" } });
  const totals = rows.map((row) => row.energyKwh!);
  expect(totals).toHaveLength(3);
  expect(totals[1] - totals[0]).toBeCloseTo(2.5); // 5 → 7.5
  expect(totals[2] - totals[1]).toBeCloseTo(0.5); // 归零后从 0 接着往上加
  expect(totals[0]).toBeLessThan(totals[1]);
  expect(totals[1]).toBeLessThan(totals[2]);
});
