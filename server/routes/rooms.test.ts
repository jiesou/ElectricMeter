import { beforeEach, expect, test } from "bun:test";
import type { Entity } from "@em/shared";
import { app } from "../app.ts";
import * as hub from "../core/hub.ts";
import { now } from "../core/util.ts";

const json = async (res: Response) => (await res.json()) as any;

async function device(id: string, entities: Entity[]) {
  await hub.connect(id, { send: () => {}, close: () => {} } as never, "10.0.0.9");
  await hub.handleMessage(id, JSON.stringify({ type: "pub_entities", ts: now(), entities }));
}

beforeEach(() => hub.devices.clear());

test("客房快照组合设备信息、汇总读数和实体", async () => {
  await device("esp-301", [
    { id: "light", name: "照明", type: "switch", state: true },
    { id: "light-meter", name: "照明功率", type: "meter", powerW: 55, energyKwh: 2.5 },
    { id: "socket-meter", name: "插座功率", type: "meter", powerW: 20, energyKwh: 3 },
  ]);

  const rooms = await json(await app.request("/api/rooms"));
  expect(rooms).toHaveLength(1);
  expect(rooms[0]).toMatchObject({
    id: "esp-301",
    name: "esp-301",
    online: true,
    power: 75,
    energy: 5.5,
    entities: [{ id: "light", state: true }, { id: "light-meter", powerW: 55 }, { id: "socket-meter", powerW: 20 }],
  });
});

test("客房 SSE 立即发送与 REST 相同的快照", async () => {
  await device("esp-302", [{ id: "light", name: "照明", type: "switch", state: false }]);
  const rest = await json(await app.request("/api/rooms"));
  const response = await app.request("/api/rooms/stream");
  expect(response.headers.get("content-type")).toContain("text/event-stream");

  const reader = response.body!.getReader();
  try {
    const { value } = await reader.read();
    const streamed = JSON.parse(new TextDecoder().decode(value).slice(6).trim());
    expect(streamed).toEqual(rest);
  } finally {
    await reader.cancel();
  }
});
