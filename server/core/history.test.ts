import { beforeEach, expect, test } from "bun:test";
import type { Entity } from "@em/shared";
import { db } from "./db.ts";
import { save } from "./history.ts";
import * as hub from "./hub.ts";
import { now } from "./util.ts";

async function device(id: string, entities: Entity[]) {
  const ws = { send: () => {}, close: () => {} } as never;
  await hub.connect(id, ws, "10.0.0.9");
  await hub.handleMessage(
    id,
    JSON.stringify({ type: "pub_entities", ts: now(), entities }),
  );
}

beforeEach(async () => {
  hub.devices.clear();
  await db.entityHistory.deleteMany();
});

test("给每个电表拍一行，开关不落盘", async () => {
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
  await save();

  const rows = await db.entityHistory.findMany({ orderBy: { id: "asc" } });
  expect(rows.map((row) => [row.device_id, row.id, row.powerW])).toEqual([
    ["esp-301", "dryer-meter", 20],
    ["esp-301", "light-meter", 55],
  ]);
});

test("窗口外的读数被删掉", async () => {
  await device("esp-301", [
    { id: "light-meter", name: "灯功率", type: "meter", powerW: 55 },
  ]);
  const old = now() - 601;
  await db.entityHistory.create({
    data: { device_id: "esp-301", id: "light-meter", ts: old, powerW: 1 },
  });
  await save();

  const rows = await db.entityHistory.findMany();
  expect(rows.map((row) => row.ts)).not.toContain(old);
  expect(rows).toHaveLength(1);
});
