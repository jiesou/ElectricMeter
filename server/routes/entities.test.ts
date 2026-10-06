import { beforeEach, expect, test } from "bun:test";
import type { Entity } from "@em/shared";
import { app } from "../app.ts";
import * as hub from "../core/hub.ts";
import { now } from "../core/util.ts";

const json = async (res: Response) => (await res.json()) as any;

/** 假下位机：连上声明自己有什么 */
async function device(id: string, entities: Entity[]) {
  await hub.connect(id, { send: () => {}, close: () => {} } as never, "10.0.0.9");
  await hub.handleMessage(id, JSON.stringify({ type: "pub_entities", ts: now(), entities }));
}

beforeEach(() => hub.devices.clear());

test("实体清单：身份和读数都在内存那张表里", async () => {
  await device("esp-202", [
    { id: "light", name: "照明", type: "switch", state: false },
    { id: "light-meter", name: "照明功率", type: "meter", powerW: 55, energyKwh: 2.5 },
  ]);
  const all = await json(await app.request("/api/entities?device=esp-202"));
  expect(all.map((e: any) => [e.id, e.name, e.type, e.state ?? e.powerW])).toEqual([
    ["light", "照明", "switch", false],
    ["light-meter", "照明功率", "meter", 55],
  ]);
});

test("不给 device：所有设备的实体", async () => {
  await device("esp-205", [{ id: "light", name: "照明", type: "switch", state: true }]);
  const all = await json(await app.request("/api/entities"));
  expect(all.map((e: any) => `${e.device_id}/${e.id}`)).toContain("esp-205/light");
});

test("实体 SSE 立即发送完整快照，之后每秒刷新", async () => {
  await device("esp-206", [{ id: "light", name: "照明", type: "switch", state: false }]);
  const response = await app.request("/api/entities/stream?device=esp-206");
  expect(response.headers.get("content-type")).toContain("text/event-stream");

  const reader = response.body!.getReader();
  const read = async () => {
    const { value } = await reader.read();
    return JSON.parse(new TextDecoder().decode(value).slice(6).trim());
  };

  try {
    expect(await read()).toMatchObject([{ id: "light", state: false }]);
    await hub.handleMessage("esp-206", JSON.stringify({ type: "pub_entities", entities: [{ id: "light", state: true }] }));
    const started = Date.now();
    expect(await read()).toMatchObject([{ id: "light", state: true }]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  } finally {
    await reader.cancel();
  }
});

test("单个实体：未知的就 404", async () => {
  await device("esp-203", [{ id: "light", name: "照明", type: "switch", state: false }]);
  expect((await json(await app.request("/api/entities/esp-203/light"))).name).toBe("照明");
  expect((await app.request("/api/entities/esp-203/nope")).status).toBe(404);
});
