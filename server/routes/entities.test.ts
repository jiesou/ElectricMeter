import { beforeEach, expect, test } from "bun:test";
import type { Entity } from "@em/shared";
import { app } from "../app.ts";
import * as hub from "../core/hub.ts";
import { now } from "../core/util.ts";

const json = async (res: Response) => (await res.json()) as any;

/** 假板子：往上报就完事 */
const fakeWs = () => ({ send: () => {}, close: () => {} }) as never;

/** 假下位机：连上声明自己有什么 */
async function device(id: string, entities: Entity[]) {
  const ws = fakeWs();
  await hub.connect(id, ws, "10.0.0.9");
  await hub.handleMessage(
    id,
    JSON.stringify({ type: "pub_entities", ts: now(), entities }),
  );
}

beforeEach(() => hub.devices.clear());

test("实体清单：身份和读数都在内存那张表里", async () => {
  await device("esp-202", [
    { id: "light", name: "灯", type: "switch", state: false },
    {
      id: "light-meter",
      name: "灯功率",
      type: "meter",
      powerW: 55,
      energyKwh: 2.5,
    },
  ]);
  const all = await json(await app.request("/api/entities?device=esp-202"));
  expect(
    all.map((e: any) => [e.id, e.name, e.type, e.state ?? e.powerW]),
  ).toEqual([
    ["light", "灯", "switch", false],
    ["light-meter", "灯功率", "meter", 55],
  ]);
});

test("不给 device：所有设备的实体", async () => {
  await device("esp-205", [
    { id: "light", name: "灯", type: "switch", state: true },
  ]);
  const all = await json(await app.request("/api/entities"));
  expect(all.map((e: any) => `${e.device_id}/${e.id}`)).toContain(
    "esp-205/light",
  );
});

test("实体 SSE：连上先给一份全量，之后有更新就推", async () => {
  await device("esp-206", [
    { id: "light", name: "灯", type: "switch", state: false },
  ]);
  const response = await app.request("/api/entities/stream?device=esp-206");
  expect(response.headers.get("content-type")).toContain("text/event-stream");

  const reader = response.body!.getReader();
  const read = async () => {
    const { value } = await reader.read();
    return JSON.parse(new TextDecoder().decode(value).slice(6).trim());
  };

  try {
    expect(await read()).toMatchObject([{ id: "light", state: false }]);
    await hub.handleMessage(
      "esp-206",
      JSON.stringify({
        type: "pub_entities",
        entities: [{ id: "light", state: true }],
      }),
    );
    const started = Date.now();
    expect(await read()).toMatchObject([{ id: "light", state: true }]);
    expect(Date.now() - started).toBeLessThan(500); // 更新一来就推，不等下一轮
  } finally {
    await reader.cancel();
  }
});

test("单个实体：未知的就 404", async () => {
  await device("esp-203", [
    { id: "light", name: "灯", type: "switch", state: false },
  ]);
  expect(
    (await json(await app.request("/api/entities/esp-203/light"))).name,
  ).toBe("灯");
  expect((await app.request("/api/entities/esp-203/nope")).status).toBe(404);
});

/** 会记账的假板子：收到的报文都留着 */
async function recordingDevice(id: string, entities: Entity[]) {
  const sent: any[] = [];
  const ws = {
    send: (raw: string) => sent.push(JSON.parse(raw)),
    close: () => {},
  } as never;
  await hub.connect(id, ws, "10.0.0.9");
  await hub.handleMessage(
    id,
    JSON.stringify({ type: "pub_entities", ts: now(), entities }),
  );
  return sent;
}

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("下通断令：设备收到 pub_action_switch，ack 回来 state 才落表", async () => {
  const sent = await recordingDevice("esp-207", [
    { id: "light", name: "灯", type: "switch", state: false },
  ]);

  const res = await post("/api/entities/esp-207/light/switch", { state: true });
  expect(res.status).toBe(200);
  expect(sent.at(-1)).toMatchObject({
    type: "pub_action_switch",
    id: "light",
    state: true,
  });
  // 只是下了令，还没回执：表里还是旧的
  expect(hub.devices.get("esp-207")!.entities.get("light")!.state).toBe(false);

  await hub.handleMessage(
    "esp-207",
    JSON.stringify({
      type: "ack_action_switch",
      ts: now(),
      id: "light",
      state: true,
    }),
  );
  expect(
    (await json(await app.request("/api/entities/esp-207/light"))).state,
  ).toBe(true);
});

test("下通断令：未知设备、未知实体、非开关、设备离线都拒掉", async () => {
  await device("esp-208", [
    { id: "light", name: "灯", type: "switch", state: false },
    { id: "light-meter", name: "灯功率", type: "meter", powerW: 0 },
  ]);

  expect((await post("/api/entities/esp-209/light/switch", {})).status).toBe(
    404,
  );
  expect((await post("/api/entities/esp-208/nope/switch", {})).status).toBe(
    404,
  );
  expect(
    (await post("/api/entities/esp-208/light-meter/switch", {})).status,
  ).toBe(400);

  hub.devices.get("esp-208")!.online = false;
  expect(
    (await post("/api/entities/esp-208/light/switch", { state: true })).status,
  ).toBe(409);
});
